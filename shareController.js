const SharedLink = require('../models/SharedLink');
const File = require('../models/File');
const User = require('../models/User');
const { getFileDownloadUrl } = require('../utils/googleDrive');

// POST /api/share/create
const createShareLink = async (req, res) => {
  try {
    const { fileId, expiryHours, maxDownloads } = req.body;

    // Verify ownership
    const file = await File.findOne({ _id: fileId, owner: req.user._id, status: 'active' });
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied.' });
    }

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const sharedLink = await SharedLink.create({
      file: file._id,
      owner: req.user._id,
      expiresAt,
      maxDownloads: maxDownloads || null,
    });

    const shareUrl = `${process.env.FRONTEND_URL}/share/${sharedLink.token}`;

    res.status(201).json({
      message: 'Share link created successfully.',
      shareUrl,
      token: sharedLink.token,
      expiresAt: sharedLink.expiresAt,
      maxDownloads: sharedLink.maxDownloads,
    });
  } catch (err) {
    console.error('Create share link error:', err);
    res.status(500).json({ error: 'Failed to create share link.' });
  }
};

// GET /api/share/:token — Public access, no auth required
const accessShareLink = async (req, res) => {
  try {
    const { token } = req.params;

    const link = await SharedLink.findOne({ token }).populate('file');
    if (!link) {
      return res.status(404).json({ error: 'Share link not found.', code: 'NOT_FOUND' });
    }

    // Check validity
    if (!link.active) {
      return res.status(410).json({ error: 'This link has been revoked.', code: 'REVOKED' });
    }

    if (link.isExpired) {
      // Deactivate
      link.active = false;
      await link.save();
      return res.status(410).json({ error: 'This link has expired.', code: 'EXPIRED' });
    }

    if (link.isDownloadLimitReached) {
      return res.status(410).json({
        error: 'Download limit reached for this link.',
        code: 'LIMIT_REACHED',
      });
    }

    if (!link.file || link.file.status === 'deleted') {
      return res.status(404).json({ error: 'File no longer exists.', code: 'FILE_DELETED' });
    }

    // Return file info (metadata only — no download yet)
    res.json({
      fileName: link.file.originalName,
      fileSize: link.file.size,
      sizeFormatted: link.file.sizeFormatted,
      mimeType: link.file.mimeType,
      encrypted: link.file.encrypted,
      encryptionMetadata: link.file.encrypted ? link.file.encryptionMetadata : null,
      expiresAt: link.expiresAt,
      maxDownloads: link.maxDownloads,
      downloadCount: link.downloadCount,
      remainingDownloads: link.maxDownloads
        ? link.maxDownloads - link.downloadCount
        : null,
    });
  } catch (err) {
    console.error('Access share link error:', err);
    res.status(500).json({ error: 'Failed to access share link.' });
  }
};

// GET /api/share/:token/download — Initiates actual file download
const downloadSharedFile = async (req, res) => {
  try {
    const { token } = req.params;

    const link = await SharedLink.findOne({ token }).populate('file');
    if (!link || !link.isValid || !link.file) {
      return res.status(410).json({ error: 'Link invalid or expired.', code: 'INVALID' });
    }

    // Get temporary download URL from Google Drive
    const downloadUrl = await getFileDownloadUrl(link.file.googleDriveFileId);

    // Increment download count
    link.downloadCount += 1;
    link.accessLog.push({
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown',
    });
    await link.save();

    // Update file download count
    await File.findByIdAndUpdate(link.file._id, { $inc: { downloadCount: 1 } });

    // Update owner stats
    await User.findByIdAndUpdate(link.owner, { $inc: { totalDownloads: 1 } });

    // Redirect client to the Drive download URL
    // (The URL contains a short-lived access token from Google)
    res.json({
      downloadUrl,
      fileName: link.file.originalName,
      encrypted: link.file.encrypted,
      encryptionMetadata: link.file.encrypted ? link.file.encryptionMetadata : null,
    });
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to initiate download.' });
  }
};

// GET /api/share — Get user's share links
const getUserShareLinks = async (req, res) => {
  try {
    const links = await SharedLink.find({ owner: req.user._id })
      .populate('file', 'originalName size mimeType')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      links: links.map((l) => ({
        id: l._id,
        token: l.token,
        shareUrl: `${process.env.FRONTEND_URL}/share/${l.token}`,
        file: l.file,
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
    console.error('Get links error:', err);
    res.status(500).json({ error: 'Failed to fetch share links.' });
  }
};

// DELETE /api/share/:id — Revoke a share link
const revokeShareLink = async (req, res) => {
  try {
    const link = await SharedLink.findOne({ _id: req.params.id, owner: req.user._id });
    if (!link) {
      return res.status(404).json({ error: 'Share link not found.' });
    }

    link.active = false;
    await link.save();

    res.json({ message: 'Share link revoked successfully.' });
  } catch (err) {
    console.error('Revoke link error:', err);
    res.status(500).json({ error: 'Failed to revoke link.' });
  }
};

module.exports = {
  createShareLink,
  accessShareLink,
  downloadSharedFile,
  getUserShareLinks,
  revokeShareLink,
};
