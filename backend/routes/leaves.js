const express = require('express');
const router  = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/leaveController');

router.use(protect);

// Employee
router.post('/',              ctrl.applyLeave);
router.get('/my',             ctrl.getMyLeaves);
router.get('/balance',        ctrl.getLeaveBalance);
router.patch('/:id/cancel',   ctrl.cancelLeave);

// Admin/Manager
router.get('/all',            managerOrAdmin, ctrl.getAllLeaves);
router.patch('/:id/approve',  managerOrAdmin, ctrl.approveLeave);
router.patch('/:id/reject',   managerOrAdmin, ctrl.rejectLeave);

// Single leave (owner or admin)
router.get('/:id',            ctrl.getById);

module.exports = router;