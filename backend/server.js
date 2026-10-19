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
const PORT = process.env.PORT || 5000;
const ON_VERCEL = Boolean(process.env.VERCEL);

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set. Set it in backend/.env (locally) or in the Vercel project environment variables.');
}

// Retries instead of exiting: a serverless instance that process.exit()s on a
// transient connection error is reported by Vercel as FUNCTION_INVOCATION_FAILED
// on every single request, which hides the real problem.
const connectWithRetry = (attempt = 1) => {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB connected successfully');

      if (!ON_VERCEL) {
        app.listen(PORT, () => {
          console.log(`🚀 Server running on port ${PORT}`);
        });
      }
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);

      if (ON_VERCEL && attempt < 5) {
        const delay = Math.min(30000, 2 ** attempt * 1000);
        console.error(`   Retrying in ${delay}ms (attempt ${attempt + 1}/5)…`);
        setTimeout(() => connectWithRetry(attempt + 1), delay);
        return;
      }

      if (!ON_VERCEL) process.exit(1);
    });
};

connectWithRetry();

// On Vercel the Express app itself is the function handler — no listen().
module.exports = app;