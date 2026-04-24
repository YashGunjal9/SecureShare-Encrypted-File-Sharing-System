const express = require('express');
const router = express.Router();
const {
  createShareLink,
  accessShareLink,
  downloadSharedFile,
  getUserShareLinks,
  revokeShareLink,
} = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');
const { validate, createShareSchema } = require('../middleware/validate');

// Public routes (no auth needed)
router.get('/:token', accessShareLink);
router.get('/:token/download', downloadSharedFile);

// Protected routes
router.post('/create', authenticate, validate(createShareSchema), createShareLink);
router.get('/', authenticate, getUserShareLinks);
router.delete('/:id', authenticate, revokeShareLink);

module.exports = router;
