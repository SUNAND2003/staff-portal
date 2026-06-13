const express = require('express');
const router  = express.Router();
const { protect, adminOnly, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/employeeController');

router.use(protect);

// Specific routes BEFORE parameterized routes
router.get('/:id/attendance-summary',       managerOrAdmin, ctrl.attendanceSummary);
router.patch('/:id/toggle-status',          adminOnly,      ctrl.toggleStatus);
router.patch('/:id/reset-password',         adminOnly,      ctrl.resetPassword);

// General routes
router.get('/',                             managerOrAdmin, ctrl.getAll);
router.post('/',                            adminOnly,      ctrl.create);
router.get('/:id',                          managerOrAdmin, ctrl.getById);
router.patch('/:id',                        managerOrAdmin, ctrl.update);
router.delete('/:id',                       adminOnly,      ctrl.remove);

module.exports = router;