const Joi = require('joi');

// Generic validator factory
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }
  next();
};

// Auth schemas
const signupSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// File schemas
const uploadSessionSchema = Joi.object({
  fileName: Joi.string().max(255).required(),
  fileSize: Joi.number().min(1).max(50 * 1024 * 1024 * 1024).required(), // max 50GB
  mimeType: Joi.string().required(),
  encrypted: Joi.boolean().default(true),
  encryptionMetadata: Joi.object({
    algorithm: Joi.string().default('AES-GCM'),
    keyDerivation: Joi.string().default('PBKDF2'),
    chunkSize: Joi.number().default(2097152),
    saltHex: Joi.string(),
  }).optional(),
});

const saveFileSchema = Joi.object({
  googleDriveFileId: Joi.string().required(),
  googleDriveViewLink: Joi.string().uri().optional(),
  originalName: Joi.string().required(),
  mimeType: Joi.string().required(),
  size: Joi.number().required(),
  encrypted: Joi.boolean().default(true),
  encryptionMetadata: Joi.object({
    algorithm: Joi.string(),
    keyDerivation: Joi.string(),
    chunkSize: Joi.number(),
    saltHex: Joi.string(),
  }).optional(),
});

// Share schemas
const createShareSchema = Joi.object({
  fileId: Joi.string().required(),
  expiryHours: Joi.number().min(0.1).max(720).required(), // max 30 days
  maxDownloads: Joi.number().min(1).max(1000).optional().allow(null),
});

module.exports = {
  validate,
  signupSchema,
  loginSchema,
  uploadSessionSchema,
  saveFileSchema,
  createShareSchema,
};
