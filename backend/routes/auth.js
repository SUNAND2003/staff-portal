const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

// Public
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);

// Protected
router.use(protect);

router.post('/logout', ctrl.logout);
router.get('/me', ctrl.getMe);
router.patch('/change-password', ctrl.changePassword);

module.exports = router;