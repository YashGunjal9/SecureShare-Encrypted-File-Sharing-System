/**
 * upload.js
 * Direct-to-Google-Drive resumable upload engine.
 *
 * ARCHITECTURE:
 *   Backend creates the Drive resumable session URI → returns it to frontend.
 *   Frontend uploads encrypted chunks DIRECTLY to Google Drive.
 *   Backend never sees or buffers the file bytes.
 *
 * FEATURES:
 *   - Chunk-based (2MB) for memory efficiency and resume support
 *   - Automatic retry with exponential backoff (up to 5 retries per chunk)
 *   - Resume interrupted uploads by querying the Drive session state
 *   - Real-time progress percentage + upload speed calculation
 *   - Works for files up to 50GB
 */

import { CHUNK_SIZE } from './encryption';

const MAX_RETRIES = 5;

/**
 * Upload encrypted chunks directly to Google Drive using a resumable session URI.
 *
 * @param {string} resumableUri - From backend /api/files/upload-session
 * @param {ArrayBuffer[]} encryptedChunks - Encrypted chunks from encryptFile()
 * @param {number} totalSize - Total encrypted size in bytes
 * @param {string} mimeType - File MIME type (or 'application/octet-stream' for encrypted)
 * @param {function} onProgress - (percent: number, speedMBps: string) => void
 * @returns {Promise<string>} - Google Drive file ID
 */
export async function uploadEncryptedChunks(
  resumableUri,
  encryptedChunks,
  totalSize,
  mimeType,
  onProgress
) {
  const startTime = Date.now();
  let offset = 0;
  let chunkIndex = 0;

  // ── Step 1: Check if there's an existing upload to resume ──────────────────
  try {
    const statusRes = await fetch(resumableUri, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes */${totalSize}` },
    });

    if (statusRes.status === 308) {
      // Upload in progress — get the byte offset we left off at
      const rangeHeader = statusRes.headers.get('Range');
      if (rangeHeader) {
        const lastByte = parseInt(rangeHeader.split('-')[1]);
        offset = lastByte + 1;

        // Calculate chunk index by figuring out how many chunks fit before `offset`
        // Note: each chunk has its own size (may vary for the last one)
        let byteCount = 0;
        while (chunkIndex < encryptedChunks.length && byteCount < offset) {
          byteCount += encryptedChunks[chunkIndex].byteLength;
          chunkIndex++;
        }
        console.log(`[UPLOAD] Resuming from byte ${offset}, chunk ${chunkIndex}`);
      }
    } else if (statusRes.status === 200 || statusRes.status === 201) {
      // Already complete
      const data = await statusRes.json();
      return data.id;
    }
  } catch (_) {
    console.log('[UPLOAD] No existing session, starting fresh');
  }

  // ── Step 2: Upload chunk by chunk ──────────────────────────────────────────
  while (chunkIndex < encryptedChunks.length) {
    const chunkData = encryptedChunks[chunkIndex];
    const chunkSize = chunkData.byteLength;
    const chunkEnd = offset + chunkSize - 1;
    const isLastChunk = chunkIndex === encryptedChunks.length - 1;

    let driveFileId = null;
    let chunkSuccess = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(resumableUri, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${offset}-${chunkEnd}/${totalSize}`,
            'Content-Type': 'application/octet-stream',
          },
          body: chunkData,
        });

        // 200 / 201 = upload fully complete (returned on last chunk)
        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          driveFileId = data.id;
          onProgress?.(100, calcSpeed(startTime, totalSize));
          return driveFileId;
        }

        // 308 = chunk received, continue
        if (res.status === 308) {
          chunkSuccess = true;
          break;
        }

        // 503 / 429 = server overload, backoff and retry
        if (res.status === 503 || res.status === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`[UPLOAD] Rate limited/server error. Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        }

        throw new Error(`Unexpected HTTP status: ${res.status}`);
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) {
          throw new Error(`Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} attempts: ${err.message}`);
        }
        const backoffMs = Math.pow(2, attempt) * 1200;
        console.warn(`[UPLOAD] Chunk ${chunkIndex} attempt ${attempt + 1} failed. Retry in ${backoffMs}ms`);
        await sleep(backoffMs);
      }
    }

    if (!chunkSuccess && !driveFileId) {
      throw new Error(`Chunk ${chunkIndex} failed after all retries.`);
    }

    offset += chunkSize;
    chunkIndex++;

    const progress = Math.min((offset / totalSize) * 100, 99.5);
    const speed = calcSpeed(startTime, offset);
    onProgress?.(progress, speed);
  }

  throw new Error('Upload loop completed without receiving a file ID from Google Drive.');
}

/**
 * Upload a raw (unencrypted) File directly to Google Drive.
 * Used when user opts out of encryption.
 */
export async function uploadRawFile(resumableUri, file, onProgress) {
  const startTime = Date.now();
  const totalSize = file.size;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const blob = file.slice(offset, end);
    const chunkBuffer = await blob.arrayBuffer();
    const chunkSize = chunkBuffer.byteLength;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(resumableUri, {
          method: 'PUT',
          headers: {
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${offset}-${offset + chunkSize - 1}/${totalSize}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: chunkBuffer,
        });

        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          onProgress?.(100, calcSpeed(startTime, totalSize));
          return data.id;
        }

        if (res.status === 308) break;

        if (res.status === 503 || res.status === 429) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        throw new Error(`Status: ${res.status}`);
      } catch (err) {
        if (attempt === MAX_RETRIES - 1) throw err;
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }

    offset += chunkSize;
    onProgress?.((offset / totalSize) * 100, calcSpeed(startTime, offset));
  }

  throw new Error('Upload ended without file ID.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcSpeed(startTime, bytesUploaded) {
  const elapsedSec = (Date.now() - startTime) / 1000;
  if (elapsedSec < 0.1) return '0';
  const mbps = bytesUploaded / elapsedSec / (1024 * 1024);
  return mbps.toFixed(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format bytes into human-readable string */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Format seconds into human-readable time */
export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
