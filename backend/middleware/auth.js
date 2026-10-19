const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// ─── Protect route (must be logged in) ───────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    // Fail fast with an actionable status instead of letting Mongoose buffer
    // queries for 10s and then surface a generic 500.
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message:
          'Database is not connected yet. Check the MONGO_URI environment variable and retry.',
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: 'JWT_SECRET environment variable is not configured on the server.',
      });
    }

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized. No token.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Contact admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized. Invalid token.' });
  }
};

// ─── Restrict to roles ────────────────────────────────────────────────────────
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of: ${roles.join(', ')}`,
      });
    }
    next();
  };
};

// ─── Admin only ───────────────────────────────────────────────────────────────
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

// ─── Admin or Manager ─────────────────────────────────────────────────────────
exports.managerOrAdmin = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Manager or Admin access required.' });
  }
  next();
};