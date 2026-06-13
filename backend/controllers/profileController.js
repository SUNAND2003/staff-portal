const User = require('../models/User');
const path = require('path');
const fs   = require('fs');

// ─── GET /api/profile ─────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PATCH /api/profile ───────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'email', 'phone', 'address', 'bio',
      'designation', 'skills', 'emergencyContact',
    ];

    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new:            true,
      runValidators:  true,
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── POST /api/profile/avatar ─────────────────────────────────────────────────
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl },
      { new: true }
    );

    res.json({ avatarUrl, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── DELETE /api/profile/avatar ───────────────────────────────────────────────
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.avatarUrl) {
      const filePath = path.join(__dirname, '..', user.avatarUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    user.avatarUrl = undefined;
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};