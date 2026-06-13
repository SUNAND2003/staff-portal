const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const ctrl = require('../controllers/configController');

// Get working hours (public, but useful to cache)
router.get('/working-hours', ctrl.getWorkingHours);

// Update working hours (admin only)
router.patch('/working-hours', protect, adminOnly, ctrl.updateWorkingHours);

module.exports = router;
