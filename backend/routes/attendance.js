const express = require('express');
const router  = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

router.use(protect);

// Employee routes
router.post('/checkin',    ctrl.checkIn);
router.post('/checkout',   ctrl.checkOut);
router.post('/break/start',ctrl.breakStart);
router.post('/break/end',  ctrl.breakEnd);
router.get('/today',       ctrl.getToday);
router.get('/my',          ctrl.getMyAttendance);
router.get('/report',      ctrl.getReport);

// Admin/Manager routes
router.get('/all',         managerOrAdmin, ctrl.getAllAttendance);

module.exports = router;