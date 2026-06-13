const express = require('express');
const router  = express.Router();
const { protect, managerOrAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/reportsController');

router.use(protect);

router.get('/',       ctrl.getReport);
router.get('/admin',  managerOrAdmin, ctrl.getAdminReport);

module.exports = router;