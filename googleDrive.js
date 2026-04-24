const { google } = require('googleapis');

/**
 * Creates an authenticated Google OAuth2 client.
 * Uses service account refresh token stored in env.
 */
const getOAuth2Client = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
};

/**
 * Initiates a Google Drive resumable upload session.
 * Returns a resumable upload URI that the frontend uses directly.
 * 
 * This is the KEY architecture: backend only creates the session,
 * never touches the actual file bytes.
 */
const createResumableUploadSession = async ({ fileName, fileSize, mimeType }) => {
  const oauth2Client = getOAuth2Client();
  const accessTokenResponse = await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse.token;

  // Build the file metadata for Drive
  const fileMetadata = {
    name: fileName,
    parents: process.env.GOOGLE_DRIVE_FOLDER_ID
      ? [process.env.GOOGLE_DRIVE_FOLDER_ID]
      : [],
  };

  // Call Drive API to initiate resumable upload
  // This returns a session URI, not the uploaded file
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileSize.toString(),
      },
      body: JSON.stringify(fileMetadata),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Drive session creation failed: ${errText}`);
  }

  // The resumable URI is in the Location header
  const resumableUri = response.headers.get('Location');
  if (!resumableUri) {
    throw new Error('No resumable URI returned from Google Drive');
  }

  return { resumableUri, accessToken };
};

/**
 * Makes a Drive file publicly accessible (read-only) for sharing.
 */
const makeFilePublic = async (fileId) => {
  const oauth2Client = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  const fileInfo = await drive.files.get({
    fileId,
    fields: 'id, name, webViewLink, webContentLink',
  });

  return fileInfo.data;
};

/**
 * Deletes a file from Google Drive.
 */
const deleteFileFromDrive = async (fileId) => {
  const oauth2Client = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  await drive.files.delete({ fileId });
};

/**
 * Gets a direct download link for a file (for logged-in share access).
 * Returns a short-lived signed URL via access token.
 */
const getFileDownloadUrl = async (fileId) => {
  const oauth2Client = getOAuth2Client();
  const accessTokenResponse = await oauth2Client.getAccessToken();
  const accessToken = accessTokenResponse.token;

  // This URL lets the holder download the file directly
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`;
  return downloadUrl;
};

module.exports = {
  getOAuth2Client,
  createResumableUploadSession,
  makeFilePublic,
  deleteFileFromDrive,
  getFileDownloadUrl,
};
