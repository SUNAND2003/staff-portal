require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Explicit path: on Vercel the working directory is the project root, so a
// bare dotenv.config() would look for /.env and silently load nothing.
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
// FRONTEND_URL may hold several origins separated by commas, so local dev and
// the deployed site can both talk to this API.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

console.log('🔐 Allowed CORS origins:', allowedOrigins.join(' | '));

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (curl, server-to-server) is allowed through.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/attendance', require('./routes/punch'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/worklogs', require('./routes/worklogs'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/config', require('./routes/config'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    // 'connected' | 'connecting' | 'disconnected' — used to verify deployments
    db: ['disconnected', 'connected', 'connecting', 'disconnecting'][
      mongoose.connection.readyState
    ],
    storage: require('./services/avatarStorage').activeBackend(),
    timestamp: new Date(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Multer upload errors (file too large, unexpected field, …)
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image is too large. Maximum size is 2MB.'
          : err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
});

// ─── MongoDB Connection + Server Start ───────────────────────────────────────
// Render (and every other PaaS / container host) injects PORT and routes traffic
// to the interface the process binds, so bind 0.0.0.0 explicitly — a server
// bound only to 127.0.0.1 makes the deploy health check hang forever.
// Locally PORT falls back to 5000 (see .env.example).
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const ON_VERCEL = Boolean(process.env.VERCEL);

// The same code runs on Render, on Vercel and locally, so accept either variable
// name — MONGODB_URI (Render convention) or MONGO_URI (this project's original
// name, used by backend/.env, the seed script and the tests). Neither value is
// ever written to the logs; only a credential-masked host is.
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const maskUri = (uri) => uri.replace(/\/\/[^@/]*@/, '//<credentials>@');

// ─── Environment sanity check ────────────────────────────────────────────────
// Startup must never look healthy when it is not: every misconfiguration is
// reported loudly here, and /api/health keeps reporting db:"disconnected"
// until the connection really exists.
if (!MONGO_URI) {
  console.error(
    '❌ MONGO_URI (or MONGODB_URI) is not set. Define it in backend/.env for ' +
      'local runs, or in the Render service environment variables. The API ' +
      'will still boot, but every database route answers 503 until it exists.'
  );
} else {
  console.log(`🗄️  MongoDB target: ${maskUri(MONGO_URI)}`);
}

if (!process.env.JWT_SECRET) {
  console.error(
    '❌ JWT_SECRET is not set — login and every protected route will fail until ' +
      'it is provided in the Render service environment variables.'
  );
}

if (!process.env.FRONTEND_URL) {
  console.log(
    'ℹ️  FRONTEND_URL is not set — CORS only allows http://localhost:5173. ' +
      'Set it to the deployed frontend origin (comma-separated for several).'
  );
}

console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// ─── Connection state reporting ──────────────────────────────────────────────
// These listeners, plus the readyState read by /api/health and the 503 guard in
// middleware/auth.js, guarantee a failed connection is never presented as a
// successful one.
mongoose.connection
  .on('connected', () => console.log('✅ MongoDB connected successfully'))
  .on('disconnected', () => console.warn('⚠️  MongoDB disconnected'))
  .on('reconnected', () => console.log('🔁 MongoDB reconnected'))
  .on('error', (err) => console.error('❌ MongoDB error:', err.message));

// ─── HTTP server ─────────────────────────────────────────────────────────────
let server;

const startServer = () => {
  if (server) return server;
  server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT} (port ${PORT})`);
    console.log(`🧭 Health check: http://${HOST}:${PORT}/api/health`);
  });
  server.on('error', (err) => {
    console.error('❌ HTTP server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(
        `   Port ${PORT} is already in use. Let Render assign PORT — never hardcode it.`
      );
    }
  });
  return server;
};

// ─── MongoDB connect with retry ──────────────────────────────────────────────
// On a long-running host (Render, a VM, local dev) we retry forever with a capped
// backoff instead of process.exit(1): an exit only produces a restart loop that
// hides the real cause — usually the Atlas network-access list or the credentials.
// On Vercel (serverless) we stop after 5 attempts but keep the process alive,
// because a crashing function is reported as FUNCTION_INVOCATION_FAILED.
const MAX_VERCEL_ATTEMPTS = 5;

const connectWithRetry = (attempt = 1) => {
  if (!MONGO_URI) {
    console.error('⏭️  Skipping MongoDB connection: no connection string configured.');
    return;
  }

  mongoose
    .connect(MONGO_URI)
    .then(() => {
      // Vercel provides the listener itself; everywhere else we already started
      // listening above (and startServer() is a no-op if we did).
      if (!ON_VERCEL) startServer();
    })
    .catch((err) => {
      console.error(`❌ MongoDB connection error (attempt ${attempt}): ${err.message}`);

      // Actionable hints for the failures we actually hit in production.
      if (/querySrvENOTFOUND|getaddrinfo|ENOTFOUND|DNS/i.test(err.message)) {
        console.error(
          '   Hint: the hostname did not resolve. Check the Atlas connection string,\n' +
            '         e.g. mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/hexahr'
        );
      } else if (/auth|credential|Authentication failed/i.test(err.message)) {
        console.error(
          '   Hint: Atlas rejected the credentials. Check Database Access → the\n' +
            '         database user and password (passwords with special characters\n' +
            '         must be URL-encoded in the connection string).'
        );
      } else if (/ip|timed out|timeout|ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(err.message)) {
        console.error(
          "   Hint: the Atlas cluster could not be reached. In MongoDB Atlas →\n" +
            '         Network Access, allow Render\'s IPs (or 0.0.0.0/0 while testing).'
        );
      }

      if (ON_VERCEL && attempt >= MAX_VERCEL_ATTEMPTS) {
        console.error(`   Giving up after ${MAX_VERCEL_ATTEMPTS} attempts (serverless).`);
        return;
      }

      const delay = Math.min(30000, 2 ** attempt * 1000);
      console.error(`   Retrying in ${Math.round(delay / 1000)}s…`);
      setTimeout(() => connectWithRetry(attempt + 1), delay);
    });
};

// Start listening immediately, then connect to MongoDB in the background.
// Render marks the deploy live as soon as the port accepts connections; waiting
// for a slow Atlas cold start risks a deploy timeout. Until the connection is
// ready, protected routes answer 503 and /api/health reports db:"disconnected",
// so nothing reports success before it is true.
if (!ON_VERCEL) startServer();

connectWithRetry();

// ─── Process-level safety nets ───────────────────────────────────────────────
// Log (never silently swallow) unhandled rejections, and shut down cleanly when
// Render recycles the instance — a graceful close lets in-flight requests finish.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  const closeDb = () =>
    mongoose.connection
      .close(false)
      .catch((err) => console.error('❌ Error closing MongoDB connection:', err.message))
      .finally(() => process.exit(0));

  if (server && server.listening) server.close(closeDb);
  else closeDb();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// On Vercel the Express app itself is the function handler — no listen().
module.exports = app;