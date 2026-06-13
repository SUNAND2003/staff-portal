const express = require('express');
const router  = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/worklogController');

router.use(protect);

// Employee
router.get('/today',        ctrl.getToday);
router.get('/',             ctrl.getMyLogs);
router.post('/',            ctrl.addLog);
router.patch('/:id/end',    ctrl.endLog);
router.delete('/:id',       ctrl.deleteLog);

// Admin/Manager
router.get('/all',          managerOrAdmin, ctrl.getAllLogs);

module.exports = router;