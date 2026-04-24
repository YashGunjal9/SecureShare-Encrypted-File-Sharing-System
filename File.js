const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true, // in bytes
    },
    googleDriveFileId: {
      type: String,
      required: true,
      unique: true,
    },
    googleDriveViewLink: {
      type: String,
    },
    // Encryption metadata
    encrypted: {
      type: Boolean,
      default: true,
    },
    encryptionMetadata: {
      // Stored per-chunk IV info: { algorithm, keyDerivation, chunkSize }
      algorithm: { type: String, default: 'AES-GCM' },
      keyDerivation: { type: String, default: 'PBKDF2' },
      chunkSize: { type: Number, default: 2097152 }, // 2MB
      saltHex: { type: String }, // hex-encoded salt for key derivation
    },
    // Stats
    downloadCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['uploading', 'active', 'deleted'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: human-readable size
fileSchema.virtual('sizeFormatted').get(function () {
  const bytes = this.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
});

fileSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('File', fileSchema);
