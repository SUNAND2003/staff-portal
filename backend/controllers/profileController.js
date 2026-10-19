const User = require('../models/User');
const {
  storeAvatar,
  removeAvatar,
  StorageNotConfiguredError,
} = require('../services/avatarStorage');

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

    const stored = await storeAvatar({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      userId: String(req.user._id),
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: stored.url },
      { new: true }
    );

    res.json({ avatarUrl: stored.url, user });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) {
      return res.status(503).json({ message: err.message });
    }
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('Avatar upload error:', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── DELETE /api/profile/avatar ───────────────────────────────────────────────
exports.deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.avatarUrl) {
      // Removes the file from Cloudinary, Vercel Blob, or (in development)
      // from disk. The record is cleared either way, so the profile is never
      // left pointing at an avatar that no longer exists.
      await removeAvatar(user.avatarUrl);
    }

    user.avatarUrl = '';
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    if (err instanceof StorageNotConfiguredError || err.status) {
      return res.status(err.status || 503).json({ message: err.message });
    }
    console.error('Avatar delete error:', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};