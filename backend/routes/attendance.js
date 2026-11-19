const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const { verifyCompanyNetwork } = require('../middleware/verifyCompanyNetwork');
const ctrl = require('../controllers/attendanceController');

router.use(protect);

// Employee routes (strictly company network verified)
router.post('/checkin', verifyCompanyNetwork, ctrl.checkIn);
router.post('/checkout', verifyCompanyNetwork, ctrl.checkOut);
router.post('/break/start', verifyCompanyNetwork, ctrl.breakStart);
router.post('/break/end', verifyCompanyNetwork, ctrl.breakEnd);
router.get('/today', ctrl.getToday);
router.get('/my', ctrl.getMyAttendance);
router.get('/report', ctrl.getReport);

// Admin/Manager routes
router.get('/all', managerOrAdmin, ctrl.getAllAttendance);
router.patch('/:id', managerOrAdmin, ctrl.updateAttendance);
router.put('/:id', managerOrAdmin, ctrl.updateAttendance);

module.exports = router;