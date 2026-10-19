const multer = require('multer');

// ─── Avatar upload middleware ────────────────────────────────────────────────
// The file is buffered in memory and handed to services/avatarStorage.js,
// which decides where it is persisted (disk in development, Vercel Blob in
// production).
//
// IMPORTANT: this module must not touch the filesystem when it is required.
// The previous version ran fs.mkdirSync() at load time, which threw
// ENOENT: no such file or directory, mkdir '/var/task/backend/uploads/avatars'
// on Vercel (read-only filesystem) and took the whole API down with
// FUNCTION_INVOCATION_FAILED.

const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
  const err = new Error('Only JPEG, PNG, and WebP images allowed');
  err.status = 400; // validation failure, not a server error
  cb(err, false);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = upload;
module.exports.ALLOWED_MIME = ALLOWED_MIME;
