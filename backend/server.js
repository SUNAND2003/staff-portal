const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// In local Windows / ISP environments (e.g. Jio/Reliance/Airtel), Node's c-ares
// resolver fails SRV lookups (querySrv ECONNREFUSED) against local router IPv6 DNS.
// Setting public fallback DNS servers (Google 8.8.8.8, Cloudflare 1.1.1.1) guarantees
// reliable MongoDB Atlas SRV resolution locally and in cloud containers.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if custom DNS servers cannot be set
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Explicit path: load local .env if present (ignored on production if absent)
dotenv.config({ path: path.join(__dirname, '.env') });

// Detect deployment environment: Render provides RENDER=true automatically
const isRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
if (isRender || process.env.VERCEL) {
  // Ensure production mode on Render and Vercel deployments
  process.env.NODE_ENV = 'production';
} else if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
const isProduction = process.env.NODE_ENV === 'production' || isRender;

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
// FRONTEND_URL may hold several origins separated by commas, so local dev and
// the deployed site can both talk to this API. Trailing slashes are stripped
// to prevent CORS origin mismatch with browser origin headers.
const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// Production frontends allowed unconditionally, so the deployed UI keeps working
// even before FRONTEND_URL is updated in the Render dashboard. Origins only —
// never credentials. Add new frontends here and/or to FRONTEND_URL.
const knownOrigins = [
  'https://hexaportal.vercel.app',
  'https://staffportal-hx6zg5sd0-hexa-branding.vercel.app',
];

// Local dev must keep working even when FRONTEND_URL only lists production
// origins — these can only be sent by a page running on this machine, so they
// are safe to allow unconditionally.
const devOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

const allowedOrigins = new Set([...configuredOrigins, ...knownOrigins, ...devOrigins]);

console.log('🔐 Allowed CORS origins:', [...allowedOrigins].join(' | '));

app.use(cors({
  origin: (origin, callback) => {
    // No Origin header (curl, server-to-server, Render health check) is allowed through.
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/+$/, '');
    if (allowedOrigins.has(cleanOrigin) || allowedOrigins.has(origin)) return callback(null, true);
    // Allow any Vercel deployment (*.vercel.app)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(cleanOrigin)) return callback(null, true);
    // Without this header the browser blocks the response and the app reports a
    // generic "Network error" — log the offending origin so the cause is visible
    // in the Render logs instead of being invisible.
    console.warn(`⛔ CORS blocked origin: ${origin} — add it to the FRONTEND_URL environment variable.`);
    return callback(null, false);
  },
  credentials: true,
  // Preflight (OPTIONS) is answered by this middleware directly, before any
  // route or auth middleware runs. Declare the methods and headers the app
  // actually uses: JSON bodies and bearer-token auth.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Cache the preflight result for 10 minutes so browsers do not send an
  // OPTIONS request before every API call.
  maxAge: 600,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Route Handlers ───────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const punchRoutes = require('./routes/punch');
const leaveRoutes = require('./routes/leaves');
const taskRoutes = require('./routes/tasks');
const worklogRoutes = require('./routes/worklogs');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const configRoutes = require('./routes/config');

// ─── Health & Status Check ────────────────────────────────────────────────────
const healthCheckHandler = (req, res) => {
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
};

app.get('/api/health', healthCheckHandler);
app.get('/health', healthCheckHandler);

// Root endpoint for simple browser verification
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'HexaHR Staff Portal API is active',
    health: '/api/health',
  });
});

// ─── Primary /api Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance', punchRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/worklogs', worklogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/config', configRoutes);

// ─── Direct Aliases (supports requests called with or without /api prefix) ────
app.use('/auth', authRoutes);
app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/attendance', punchRoutes);
app.use('/leaves', leaveRoutes);
app.use('/tasks', taskRoutes);
app.use('/worklogs', worklogRoutes);
app.use('/reports', reportRoutes);
app.use('/profile', profileRoutes);
app.use('/config', configRoutes);

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
// name — MONGO_URI (this project's original name) or MONGODB_URI (Render convention).
// Trim whitespace and remove any accidental surrounding quotes.
const rawMongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const cleanMongoUri = typeof rawMongoUri === 'string'
  ? rawMongoUri.trim().replace(/^["']|["']$/g, '')
  : '';

// Helper to test if a URI points to localhost / loopback address
const isLocalhostUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(uri);
};

// Safe URI credential masking for both standard (mongodb://) and DNS SRV (mongodb+srv://)
const maskUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/[^@/]+@/, '//<credentials>@');
};

// Error message / log string sanitizer to avoid credential leaks
const sanitizeLog = (val) => {
  if (!val) return '';
  const str = typeof val === 'string' ? val : (val.message || String(val));
  return str.replace(/\/\/[^@/]+@/g, '//<credentials>@');
};

// Determine active MONGO_URI, strictly disallowing localhost in production
let MONGO_URI = cleanMongoUri;
let mongoConfigError = null;

if (!MONGO_URI) {
  mongoConfigError = isProduction
    ? '❌ CRITICAL CONFIGURATION ERROR: MONGO_URI (or MONGODB_URI) is not configured in Render environment variables.\n' +
      '   In production, you must set MONGO_URI to your MongoDB Atlas connection string (mongodb+srv://...).'
    : '⚠️  MONGO_URI is not set. In local development, configure MONGO_URI in backend/.env.';
} else if (isProduction && isLocalhostUri(MONGO_URI)) {
  mongoConfigError =
    `❌ CRITICAL PRODUCTION MISCONFIGURATION: MONGO_URI is pointing to localhost (${maskUri(MONGO_URI)}).\n` +
    `   Render web services run in cloud containers and cannot connect to localhost or 127.0.0.1:27017.\n` +
    `   Localhost fallback is strictly rejected in production to prevent ECONNREFUSED loops.\n` +
    `   ACTION REQUIRED: In your Render dashboard (Environment tab), update MONGO_URI to your\n` +
    `   MongoDB Atlas connection string (e.g. mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/hexahr).`;
  // In production, do not attempt to connect to localhost
  MONGO_URI = null;
}

// ─── Environment sanity check ────────────────────────────────────────────────
// Startup must never look healthy when it is not: every misconfiguration is
// reported loudly here, and /api/health keeps reporting db:"disconnected"
// until the connection really exists.
if (mongoConfigError) {
  console.error(mongoConfigError);
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
  .on('error', (err) => console.error('❌ MongoDB error:', sanitizeLog(err.message)));

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
// On a long-running host (Render, a VM, local dev) we retry with a capped
// backoff instead of process.exit(1): an exit only produces a restart loop that
// hides the real cause — usually the Atlas network-access list or credentials.
// On Vercel (serverless) we stop after 5 attempts but keep the process alive,
// because a crashing function is reported as FUNCTION_INVOCATION_FAILED.
const MAX_VERCEL_ATTEMPTS = 5;

const connectWithRetry = (attempt = 1) => {
  if (!MONGO_URI) {
    if (mongoConfigError && isProduction) {
      console.error('⏭️  Skipping MongoDB connection: invalid or missing production MONGO_URI.');
    } else {
      console.error('⏭️  Skipping MongoDB connection: no connection string configured.');
    }
    return;
  }

  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000, // Timeout after 10s if cluster is unreachable
    socketTimeoutMS: 45000,          // Close inactive sockets after 45s
  };

  mongoose
    .connect(MONGO_URI, mongooseOptions)
    .then((conn) => {
      console.log(`✅ MongoDB connected successfully to host: ${conn.connection.host}`);
      // Vercel provides the listener itself; everywhere else we already started
      // listening above (and startServer() is a no-op if we did).
      if (!ON_VERCEL) startServer();
    })
    .catch((err) => {
      const safeErrorMsg = sanitizeLog(err.message);
      console.error(`❌ MongoDB connection error (attempt ${attempt}): ${safeErrorMsg}`);

      // Actionable hints for the failures we actually hit in production.
      if (/querySrvENOTFOUND|getaddrinfo|ENOTFOUND|DNS/i.test(err.message)) {
        console.error(
          '   Hint: DNS SRV lookup failed. Check the Atlas connection string in Render,\n' +
            '         e.g. mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/hexahr'
        );
      } else if (/auth|credential|Authentication failed/i.test(err.message)) {
        console.error(
          '   Hint: Atlas rejected credentials. Check Database Access in MongoDB Atlas:\n' +
            '         1. Verify database username and password.\n' +
            '         2. Ensure the user has "Read and write to any database" role.\n' +
            '         3. Passwords with special characters (@, :, /, ?, #) must be URL-encoded.'
        );
      } else if (/ip|timed out|timeout|ECONNREFUSED|ETIMEDOUT|ECONNRESET/i.test(err.message)) {
        console.error(
          "   Hint: The Atlas cluster could not be reached (Network Access / Firewall).\n" +
            '         In MongoDB Atlas → Network Access, allow Render\'s IPs (or 0.0.0.0/0 while testing).'
        );
      }

      if (ON_VERCEL && attempt >= MAX_VERCEL_ATTEMPTS) {
        console.error(`   Giving up after ${MAX_VERCEL_ATTEMPTS} attempts (serverless).`);
        return;
      }

      const delay = Math.min(30000, 2 ** Math.min(attempt, 5) * 1000);
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