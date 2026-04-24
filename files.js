const express = require('express');
const router = express.Router();
const {
  createUploadSession,
  saveFile,
  getUserFiles,
  deleteFile,
  getFileStats,
} = require('../controllers/fileController');
const { authenticate } = require('../middleware/auth');
const { validate, uploadSessionSchema, saveFileSchema } = require('../middleware/validate');

// All file routes require authentication
router.use(authenticate);

router.post('/upload-session', validate(uploadSessionSchema), createUploadSession);
router.post('/save', validate(saveFileSchema), saveFile);
router.get('/', getUserFiles);
router.delete('/:id', deleteFile);
router.get('/:id/stats', getFileStats);

module.exports = router;
