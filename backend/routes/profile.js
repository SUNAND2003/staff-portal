const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/profileController');

router.use(protect);

router.get('/',               ctrl.getProfile);
router.patch('/',             ctrl.updateProfile);
router.post('/avatar',        upload.single('avatar'), ctrl.uploadAvatar);
router.delete('/avatar',      ctrl.deleteAvatar);

module.exports = router;