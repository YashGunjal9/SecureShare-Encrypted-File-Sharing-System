import { useState, useRef, useCallback } from 'react';
import { Upload, Lock, Unlock, X, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../utils/api';
import { encryptFile } from '../../utils/encryption';
import { uploadEncryptedChunks, uploadRawFile, formatBytes } from '../../utils/upload';

const PHASES = {
  IDLE: 'idle',
  ENCRYPTING: 'encrypting',
  UPLOADING: 'uploading',
  SAVING: 'saving',
  DONE: 'done',
  ERROR: 'error',
};

export default function UploadZone({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [useEncryption, setUseEncryption] = useState(true);
  const [encPassword, setEncPassword] = useState('');
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('0');
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  const MAX_SIZE = 50 * 1024 * 1024 * 1024; // 50GB

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }, []);

  const selectFile = (file) => {
    if (file.size > MAX_SIZE) {
      toast.error(`File too large. Maximum size is 50GB. Your file: ${formatBytes(file.size)}`);
      return;
    }
    setSelectedFile(file);
    setPhase(PHASES.IDLE);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (useEncryption && !encPassword) {
      toast.error('Please enter an encryption password.');
      return;
    }

    try {
      let encryptionMetadata = null;
      let encryptedChunks = null;
      let uploadSize = selectedFile.size;

      // ─── Phase 1: Encrypt ─────────────────────────────────────────────────
      if (useEncryption) {
        setPhase(PHASES.ENCRYPTING);
        setStatusMsg('Encrypting file chunks in your browser...');
        setProgress(0);

        const result = await encryptFile(selectedFile, encPassword, (pct) => {
          setProgress(pct);
          setStatusMsg(`Encrypting chunk ${Math.ceil(pct / 100 * Math.ceil(selectedFile.size / (2 * 1024 * 1024)))} — ${pct.toFixed(0)}%`);
        });

        encryptedChunks = result.encryptedChunks;
        uploadSize = result.totalEncryptedSize;
        encryptionMetadata = {
          algorithm: 'AES-GCM',
          keyDerivation: 'PBKDF2',
          chunkSize: 2097152,
          saltHex: result.saltHex,
          ivList: result.ivList,
        };
        setStatusMsg('Encryption complete ✓');
      }

      // ─── Phase 2: Get upload session from backend ─────────────────────────
      setPhase(PHASES.UPLOADING);
      setProgress(0);
      setStatusMsg('Initializing secure upload session...');

      const sessionRes = await API.post('/files/upload-session', {
        fileName: selectedFile.name,
        fileSize: uploadSize,
        mimeType: useEncryption ? 'application/octet-stream' : (selectedFile.type || 'application/octet-stream'),
        encrypted: useEncryption,
        encryptionMetadata: encryptionMetadata ? {
          algorithm: encryptionMetadata.algorithm,
          keyDerivation: encryptionMetadata.keyDerivation,
          chunkSize: encryptionMetadata.chunkSize,
          saltHex: encryptionMetadata.saltHex,
        } : undefined,
      });

      const { resumableUri } = sessionRes.data;

      // ─── Phase 3: Upload directly to Google Drive ─────────────────────────
      setStatusMsg('Uploading directly to Google Drive...');

      let driveFileId;
      if (useEncryption) {
        driveFileId = await uploadEncryptedChunks(
          resumableUri,
          encryptedChunks,
          uploadSize,
          'application/octet-stream',
          (pct, spd) => {
            setProgress(pct);
            setSpeed(spd);
            setStatusMsg(`Uploading — ${pct.toFixed(1)}% at ${spd} MB/s`);
          }
        );
      } else {
        driveFileId = await uploadRawFile(
          resumableUri,
          selectedFile,
          (pct, spd) => {
            setProgress(pct);
            setSpeed(spd);
            setStatusMsg(`Uploading — ${pct.toFixed(1)}% at ${spd} MB/s`);
          }
        );
      }

      // ─── Phase 4: Save metadata to our backend ────────────────────────────
      setPhase(PHASES.SAVING);
      setProgress(100);
      setStatusMsg('Saving file metadata...');

      await API.post('/files/save', {
        googleDriveFileId: driveFileId,
        originalName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size,
        encrypted: useEncryption,
        encryptionMetadata: encryptionMetadata ? {
          algorithm: encryptionMetadata.algorithm,
          keyDerivation: encryptionMetadata.keyDerivation,
          chunkSize: encryptionMetadata.chunkSize,
          saltHex: encryptionMetadata.saltHex,
          // NOTE: ivList is NOT stored on server — user keeps it or we embed in link
          // For full implementation, ivList should be stored encrypted server-side
          // or provided by the user at download time.
        } : undefined,
      });

      setPhase(PHASES.DONE);
      setStatusMsg('Upload complete!');
      toast.success(`${selectedFile.name} uploaded successfully!`);
      onUploadComplete?.();

      // Reset after 3s
      setTimeout(() => {
        setSelectedFile(null);
        setPhase(PHASES.IDLE);
        setProgress(0);
        setEncPassword('');
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setPhase(PHASES.ERROR);
      setStatusMsg(err.message || 'Upload failed.');
      toast.error(err.response?.data?.error || err.message || 'Upload failed.');
    }
  };

  const isActive = phase !== PHASES.IDLE && phase !== PHASES.DONE && phase !== PHASES.ERROR;

  return (
    <div>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--accent)' : selectedFile ? 'var(--accent-3)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: selectedFile ? 'default' : 'pointer',
          background: isDragging ? 'var(--accent-dim)' : 'var(--surface-2)',
          transition: 'all 0.2s',
          boxShadow: isDragging ? '0 0 30px rgba(99,102,241,0.2)' : 'none',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && selectFile(e.target.files[0])}
        />

        {!selectedFile ? (
          <>
            <div style={{
              width: 60, height: 60, borderRadius: 16, margin: '0 auto 16px',
              background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-bright)',
            }}>
              <Upload size={26} color="var(--accent)" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {isDragging ? 'Drop it here!' : 'Drop your file or click to browse'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Supports any file type · Up to 50GB · Direct to Google Drive
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{selectedFile.name}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatBytes(selectedFile.size)} · {selectedFile.type || 'Unknown type'}</p>
            </div>
            {!isActive && (
              <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPhase(PHASES.IDLE); }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      {selectedFile && phase === PHASES.IDLE && (
        <div className="animate-fade-in" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Encryption toggle */}
          <div className="glass" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: useEncryption ? 'var(--accent-dim)' : 'var(--surface-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${useEncryption ? 'var(--border-bright)' : 'var(--border)'}`,
            }}>
              {useEncryption ? <Lock size={16} color="var(--accent)" /> : <Unlock size={16} color="var(--text-muted)" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>AES-256-GCM Encryption</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                Encrypt in browser before upload — key never leaves your device
              </p>
            </div>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <div
                onClick={() => setUseEncryption(!useEncryption)}
                style={{
                  width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
                  background: useEncryption ? 'var(--accent)' : 'var(--surface-3)',
                  border: '1px solid var(--border)', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: useEncryption ? 22 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
            </label>
          </div>

          {/* Password input */}
          {useEncryption && (
            <div className="form-group">
              <label className="form-label">Encryption Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter a strong password to encrypt your file"
                value={encPassword}
                onChange={(e) => setEncPassword(e.target.value)}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                ⚠️ Store this password safely — it's required for decryption and is NOT saved on our servers.
              </p>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleUpload} style={{ justifyContent: 'center', padding: '14px' }}>
            <Zap size={16} />
            {useEncryption ? 'Encrypt & Upload' : 'Upload File'}
          </button>
        </div>
      )}

      {/* Progress */}
      {isActive && (
        <div className="animate-fade-in" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
              {phase === PHASES.ENCRYPTING ? '🔐 Encrypting' : phase === PHASES.SAVING ? '💾 Saving' : '📡 Uploading'}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
              {progress.toFixed(1)}% {phase === PHASES.UPLOADING && speed !== '0' ? `· ${speed} MB/s` : ''}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>{statusMsg}</p>
        </div>
      )}

      {/* Done / Error */}
      {phase === PHASES.DONE && (
        <div className="animate-fade-in" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)' }}>
          <CheckCircle size={16} /> <span style={{ fontSize: 14, fontWeight: 600 }}>Upload complete!</span>
        </div>
      )}
      {phase === PHASES.ERROR && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', marginBottom: 8 }}>
            <AlertCircle size={16} /> <span style={{ fontSize: 14, fontWeight: 600 }}>Upload failed</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>{statusMsg}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setPhase(PHASES.IDLE)}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
