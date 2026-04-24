const File = require('../models/File');
const SharedLink = require('../models/SharedLink');
const User = require('../models/User');
const { createResumableUploadSession, deleteFileFromDrive } = require('../utils/googleDrive');

// POST /api/files/upload-session
// Creates a Google Drive resumable upload session.
// Frontend uploads directly to Google Drive using the returned URI.
const createUploadSession = async (req, res) => {
  try {
    const { fileName, fileSize, mimeType, encrypted, encryptionMetadata } = req.body;

    // Validate file size (50GB max)
    const MAX_SIZE = 50 * 1024 * 1024 * 1024;
    if (fileSize > MAX_SIZE) {
      return res.status(400).json({ error: 'File exceeds 50GB limit.' });
    }

    // Create resumable session in Google Drive
    const { resumableUri, accessToken } = await createResumableUploadSession({
      fileName,
      fileSize,
      mimeType,
    });

    res.json({
      resumableUri,
      accessToken, // Sent to frontend for direct upload authorization
      sessionCreatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Upload session error:', err);
    res.status(500).json({ error: `Failed to create upload session: ${err.message}` });
  }
};

// POST /api/files/save
// Called after frontend completes the Drive upload.
// Stores metadata in MongoDB.
const saveFile = async (req, res) => {
  try {
    const {
      googleDriveFileId,
      googleDriveViewLink,
      originalName,
      mimeType,
      size,
      encrypted,
      encryptionMetadata,
    } = req.body;

    const file = await File.create({
      owner: req.user._id,
      originalName,
      mimeType,
      size,
      googleDriveFileId,
      googleDriveViewLink,
      encrypted: encrypted !== false,
      encryptionMetadata: encryptionMetadata || {
        algorithm: 'AES-GCM',
        keyDerivation: 'PBKDF2',
        chunkSize: 2097152,
      },
    });

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { storageUsed: size, totalUploads: 1 },
    });

    res.status(201).json({
      message: 'File saved successfully.',
      file: {
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        sizeFormatted: file.sizeFormatted,
        mimeType: file.mimeType,
        encrypted: file.encrypted,
        googleDriveFileId: file.googleDriveFileId,
        createdAt: file.createdAt,
      },
    });
  } catch (err) {
    console.error('Save file error:', err);
    res.status(500).json({ error: 'Failed to save file metadata.' });
  }
};

// GET /api/files
// Get all files for current user
const getUserFiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sortBy = 'createdAt', order = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      owner: req.user._id,
      status: { $ne: 'deleted' },
    };

    if (search) {
      query.originalName = { $regex: search, $options: 'i' };
    }

    const sortOrder = order === 'asc' ? 1 : -1;

    const [files, total] = await Promise.all([
      File.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      File.countDocuments(query),
    ]);

    // Get share link counts for each file
    const fileIds = files.map((f) => f._id);
    const linkCounts = await SharedLink.aggregate([
      { $match: { file: { $in: fileIds }, active: true } },
      { $group: { _id: '$file', count: { $sum: 1 } } },
    ]);
    const linkCountMap = Object.fromEntries(linkCounts.map((l) => [l._id.toString(), l.count]));

    const enrichedFiles = files.map((f) => ({
      ...f,
      activeLinks: linkCountMap[f._id.toString()] || 0,
    }));

    res.json({
      files: enrichedFiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get files error:', err);
    res.status(500).json({ error: 'Failed to fetch files.' });
  }
};

// DELETE /api/files/:id
const deleteFile = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Delete from Google Drive
    try {
      await deleteFileFromDrive(file.googleDriveFileId);
    } catch (driveErr) {
      console.warn('Drive delete warning:', driveErr.message);
      // Continue even if Drive delete fails (file might already be deleted)
    }

    // Deactivate all shared links for this file
    await SharedLink.updateMany({ file: file._id }, { active: false });

    // Update user storage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { storageUsed: -file.size },
    });

    // Mark file as deleted
    await File.findByIdAndUpdate(file._id, { status: 'deleted' });

    res.json({ message: 'File deleted successfully.' });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
};

// GET /api/files/:id/stats
const getFileStats = async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user._id });
    if (!file) return res.status(404).json({ error: 'File not found.' });

    const links = await SharedLink.find({ file: file._id })
      .select('-encryptionPasswordHint')
      .sort({ createdAt: -1 });

    res.json({
      file: {
        id: file._id,
        originalName: file.originalName,
        size: file.size,
        sizeFormatted: file.sizeFormatted,
        mimeType: file.mimeType,
        encrypted: file.encrypted,
        downloadCount: file.downloadCount,
        createdAt: file.createdAt,
      },
      links: links.map((l) => ({
        id: l._id,
        token: l.token,
        expiresAt: l.expiresAt,
        maxDownloads: l.maxDownloads,
        downloadCount: l.downloadCount,
        active: l.active,
        isExpired: l.isExpired,
        isValid: l.isValid,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error('File stats error:', err);
    res.status(500).json({ error: 'Failed to get file stats.' });
  }
};

module.exports = { createUploadSession, saveFile, getUserFiles, deleteFile, getFileStats };
