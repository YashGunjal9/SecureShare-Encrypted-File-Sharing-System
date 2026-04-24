const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sharedLinkSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Expiry configuration
    expiresAt: {
      type: Date,
      required: true,
    },
    // Download limit
    maxDownloads: {
      type: Number,
      default: null, // null = unlimited
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    // Access log
    accessLog: [
      {
        ip: String,
        userAgent: String,
        accessedAt: { type: Date, default: Date.now },
      },
    ],
    // Status
    active: {
      type: Boolean,
      default: true,
    },
    // Encryption key hint for download (encrypted with server secret)
    encryptionPasswordHint: {
      type: String,
      select: false, // Only returned when explicitly requested
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: is expired?
sharedLinkSchema.virtual('isExpired').get(function () {
  return new Date() > this.expiresAt;
});

// Virtual: is download limit reached?
sharedLinkSchema.virtual('isDownloadLimitReached').get(function () {
  if (this.maxDownloads === null) return false;
  return this.downloadCount >= this.maxDownloads;
});

// Virtual: is valid?
sharedLinkSchema.virtual('isValid').get(function () {
  return this.active && !this.isExpired && !this.isDownloadLimitReached;
});

sharedLinkSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('SharedLink', sharedLinkSchema);
