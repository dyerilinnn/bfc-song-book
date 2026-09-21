const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const id = crypto.randomBytes(8).toString('hex');
    cb(null, id + path.extname(file.originalname).toLowerCase());
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^audio\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('That file is not an audio file. Upload an MP3.'));
  }
});
