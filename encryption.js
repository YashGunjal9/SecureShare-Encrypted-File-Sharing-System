/**
 * encryption.js
 * Chunk-level AES-256-GCM encryption using the Web Crypto API.
 *
 * ARCHITECTURE:
 *   - File is split into 2MB chunks
 *   - Each chunk is encrypted with AES-256-GCM + a unique 96-bit IV
 *   - Key is derived from a password using PBKDF2-SHA256 (250k iterations)
 *   - Salt (16 bytes) + IV list are stored in MongoDB as encryptionMetadata
 *   - The password/key is NEVER stored anywhere on the server
 *
 * VIVA NOTES:
 *   - AES-GCM provides both confidentiality AND authentication (detects tampering)
 *   - Per-chunk IVs ensure identical chunks encrypt differently (semantic security)
 *   - PBKDF2 with high iterations makes brute-force attacks computationally expensive
 *   - Web Crypto API is native browser crypto — hardware-accelerated, no external libs
 */

export const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
const PBKDF2_ITERATIONS = 250_000;
const KEY_LENGTH = 256;

// ─── Utility functions ───────────────────────────────────────────────────────

export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(bytes);
}

export function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex) {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return result;
}

// ─── Key derivation ──────────────────────────────────────────────────────────

/**
 * Derive AES-256 CryptoKey from a user password + hex salt using PBKDF2.
 * @param {string} password
 * @param {string} saltHex
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(password, saltHex) {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);

  // Import raw password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // non-extractable — can't read the raw key bytes
    ['encrypt', 'decrypt']
  );
}

// ─── Chunk encryption ────────────────────────────────────────────────────────

/**
 * Encrypt a single ArrayBuffer chunk.
 * Returns { ciphertext: ArrayBuffer, ivHex: string }
 */
export async function encryptChunk(key, chunkBuffer) {
  // Each chunk gets a fresh random 96-bit IV (12 bytes)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    chunkBuffer
  );
  return { ciphertext, ivHex: bytesToHex(iv) };
}

/**
 * Decrypt a single ArrayBuffer chunk.
 */
export async function decryptChunk(key, ciphertextBuffer, ivHex) {
  const iv = hexToBytes(ivHex);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBuffer);
}

// ─── Full file encryption ────────────────────────────────────────────────────

/**
 * Encrypts a File object chunk-by-chunk.
 *
 * @param {File} file - The original file
 * @param {string} password - User-provided encryption password
 * @param {function} onProgress - (percent: number) => void
 * @returns {Promise<{
 *   encryptedChunks: ArrayBuffer[],
 *   ivList: string[],
 *   saltHex: string,
 *   totalEncryptedSize: number
 * }>}
 */
export async function encryptFile(file, password, onProgress) {
  const saltHex = generateSalt();
  const key = await deriveKey(password, saltHex);

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const encryptedChunks = [];
  const ivList = [];
  let totalEncryptedSize = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    const chunkBuffer = await blob.arrayBuffer();

    const { ciphertext, ivHex } = await encryptChunk(key, chunkBuffer);
    encryptedChunks.push(ciphertext);
    ivList.push(ivHex);
    totalEncryptedSize += ciphertext.byteLength;

    onProgress?.((i + 1) / totalChunks * 100);
  }

  return { encryptedChunks, ivList, saltHex, totalEncryptedSize };
}

// ─── Full file decryption ────────────────────────────────────────────────────

/**
 * Decrypts a downloaded encrypted file blob back to original bytes.
 *
 * The downloaded file is a binary concatenation of encrypted chunks.
 * We need the ivList from encryptionMetadata to decrypt each chunk.
 *
 * @param {ArrayBuffer} encryptedFileBuffer - Full encrypted file bytes
 * @param {string} password
 * @param {object} encryptionMetadata - { saltHex, ivList, chunkSize }
 * @param {function} onProgress
 * @returns {Promise<Blob>} - Decrypted file as a Blob
 */
export async function decryptFile(encryptedFileBuffer, password, encryptionMetadata, onProgress) {
  const { saltHex, ivList, chunkSize = CHUNK_SIZE } = encryptionMetadata;
  const key = await deriveKey(password, saltHex);

  // AES-GCM adds 16 bytes (auth tag) per chunk
  const encryptedChunkSize = chunkSize + 16;
  const decryptedChunks = [];

  for (let i = 0; i < ivList.length; i++) {
    const start = i * encryptedChunkSize;
    const end = Math.min(start + encryptedChunkSize, encryptedFileBuffer.byteLength);
    const encChunk = encryptedFileBuffer.slice(start, end);

    const decrypted = await decryptChunk(key, encChunk, ivList[i]);
    decryptedChunks.push(new Uint8Array(decrypted));

    onProgress?.((i + 1) / ivList.length * 100);
  }

  // Concatenate all decrypted chunks
  const totalLength = decryptedChunks.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decryptedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([result]);
}
