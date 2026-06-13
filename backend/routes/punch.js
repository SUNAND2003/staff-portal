const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/punchController');

router.use(protect);

// Employee routes
router.post('/punch', ctrl.recordPunch);
router.get('/punches/today', ctrl.getTodayPunches);
router.get('/punches/my', ctrl.getMyPunches);

// Admin/Manager routes
router.get('/punches/live', managerOrAdmin, ctrl.getLivePunches);
router.get('/punches/all', managerOrAdmin, ctrl.getAllPunches);
router.get('/punches/employee/:employeeId', managerOrAdmin, ctrl.getEmployeePunches);

module.exports = router;
