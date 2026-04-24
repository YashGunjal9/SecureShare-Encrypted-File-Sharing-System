const cron = require('node-cron');
const SharedLink = require('../models/SharedLink');
const File = require('../models/File');

/**
 * Cron job: Marks expired shared links as inactive every hour.
 * Also cleans up files older than 30 days with no active links.
 */
const startCronJobs = () => {
  // Run every hour: deactivate expired links
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 [CRON] Checking for expired shared links...');
    try {
      const result = await SharedLink.updateMany(
        {
          active: true,
          expiresAt: { $lt: new Date() },
        },
        {
          $set: { active: false },
        }
      );
      console.log(`✅ [CRON] Deactivated ${result.modifiedCount} expired links.`);
    } catch (err) {
      console.error('❌ [CRON] Error deactivating expired links:', err.message);
    }
  });

  // Run every day at midnight: find orphan files (no links, older than 30 days)
  cron.schedule('0 0 * * *', async () => {
    console.log('🕛 [CRON] Checking for orphan files...');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Find files older than 30 days
      const oldFiles = await File.find({
        createdAt: { $lt: thirtyDaysAgo },
        status: 'active',
      });

      for (const file of oldFiles) {
        // Check if any active link still points to this file
        const activeLink = await SharedLink.findOne({
          file: file._id,
          active: true,
          expiresAt: { $gt: new Date() },
        });

        if (!activeLink) {
          console.log(`🗑️  [CRON] Orphan file found: ${file.originalName}`);
          // In production, delete from Drive too:
          // await deleteFileFromDrive(file.googleDriveFileId);
          await File.findByIdAndUpdate(file._id, { status: 'deleted' });
        }
      }
    } catch (err) {
      console.error('❌ [CRON] Error cleaning orphan files:', err.message);
    }
  });

  console.log('⏰ Cron jobs started (hourly expiry check, daily cleanup)');
};

module.exports = { startCronJobs };
