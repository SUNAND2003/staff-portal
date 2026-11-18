const express = require('express');
const router = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const { verifyCompanyNetwork } = require('../middleware/verifyCompanyNetwork');
const ctrl = require('../controllers/punchController');

router.use(protect);

// Network status check (can be called by any authenticated user)
router.get('/network-status', ctrl.getNetworkStatus);

// Employee routes
router.post('/punch', verifyCompanyNetwork, ctrl.recordPunch);
router.get('/punches/today', ctrl.getTodayPunches);
router.get('/punches/my', ctrl.getMyPunches);

// Admin/Manager routes
router.get('/punches/live', managerOrAdmin, ctrl.getLivePunches);
router.get('/punches/all', managerOrAdmin, ctrl.getAllPunches);
router.get('/punches/employee/:employeeId', managerOrAdmin, ctrl.getEmployeePunches);

module.exports = router;
