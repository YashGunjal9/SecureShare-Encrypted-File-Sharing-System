import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield, Download, Lock, Clock, AlertTriangle, CheckCircle,
  XCircle, Eye, EyeOff, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../utils/api';
import { decryptFile } from '../../utils/encryption';
import { formatBytes } from '../../utils/upload';

const STATUS = {
  LOADING: 'loading',
  VALID: 'valid',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  LIMIT: 'limit',
  NOT_FOUND: 'not_found',
  ERROR: 'error',
};

const DOWNLOAD_PHASE = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  DECRYPTING: 'decrypting',
  DONE: 'done',
  ERROR: 'error',
};

export default function SharePage() {
  const { token } = useParams();
  const [status, setStatus] = useState(STATUS.LOADING);
  const [fileInfo, setFileInfo] = useState(null);
  const [dlPhase, setDlPhase] = useState(DOWNLOAD_PHASE.IDLE);
  const [dlProgress, setDlProgress] = useState(0);
  const [decPassword, setDecPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    API.get(`/share/${token}`)
      .then((res) => {
        setFileInfo(res.data);
        setStatus(STATUS.VALID);
      })
      .catch((err) => {
        const code = err.response?.data?.code;
        if (code === 'EXPIRED') setStatus(STATUS.EXPIRED);
        else if (code === 'REVOKED') setStatus(STATUS.REVOKED);
        else if (code === 'LIMIT_REACHED') setStatus(STATUS.LIMIT);
        else if (code === 'NOT_FOUND') setStatus(STATUS.NOT_FOUND);
        else setStatus(STATUS.ERROR);
      });
  }, [token]);

  const handleDownload = async () => {
    if (fileInfo?.encrypted && !decPassword) {
      toast.error('Please enter the decryption password.');
      return;
    }
    setDlPhase(DOWNLOAD_PHASE.DOWNLOADING);
    setDlProgress(0);

    try {
      // 1. Get the download URL from our backend
      const res = await API.get(`/share/${token}/download`);
      const { downloadUrl, fileName, encrypted, encryptionMetadata } = res.data;

      // 2. Fetch the actual file bytes from Google Drive
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Failed to fetch file from storage.');

      const totalBytes = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (totalBytes) setDlProgress((received / totalBytes) * 80);
      }

      // Combine all chunks into one ArrayBuffer
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
      const fileBuffer = combined.buffer;

      // 3. Decrypt if necessary
      let blob;
      if (encrypted && encryptionMetadata) {
        setDlPhase(DOWNLOAD_PHASE.DECRYPTING);
        setDlProgress(80);
        blob = await decryptFile(
          fileBuffer,
          decPassword,
          encryptionMetadata,
          (pct) => setDlProgress(80 + pct * 0.2)
        );
      } else {
        blob = new Blob([fileBuffer]);
      }

      // 4. Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDlPhase(DOWNLOAD_PHASE.DONE);
      setDlProgress(100);
      toast.success('File downloaded successfully!');

      // Update download count display
      setFileInfo((prev) => ({
        ...prev,
        downloadCount: (prev?.downloadCount || 0) + 1,
        remainingDownloads: prev?.remainingDownloads != null ? prev.remainingDownloads - 1 : null,
      }));
    } catch (err) {
      console.error('Download error:', err);
      setDlPhase(DOWNLOAD_PHASE.ERROR);
      toast.error(err.message || 'Download failed. Wrong password or file corrupted.');
    }
  };

  // ── Render states ─────────────────────────────────────────────────────────

  const PageWrapper = ({ children }) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
              Secure<span style={{ color: 'var(--accent)' }}>Share</span>
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );

  if (status === STATUS.LOADING) {
    return (
      <PageWrapper>
        <div className="glass-bright animate-scale-in" style={{ padding: 48, textAlign: 'center' }}>
          <div className="animate-spin" style={{
            width: 36, height: 36, border: '3px solid var(--border)',
            borderTop: '3px solid var(--accent)', borderRadius: '50%', margin: '0 auto 16px',
          }} />
          <p style={{ color: 'var(--text-muted)' }}>Validating link...</p>
        </div>
      </PageWrapper>
    );
  }

  // Error states
  const errorStates = {
    [STATUS.EXPIRED]: { icon: Clock, color: 'var(--warning)', title: 'Link Expired', msg: 'This share link has expired. Please ask the sender to create a new one.' },
    [STATUS.REVOKED]: { icon: XCircle, color: 'var(--danger)', title: 'Link Revoked', msg: 'This share link has been revoked by the owner.' },
    [STATUS.LIMIT]: { icon: Download, color: 'var(--danger)', title: 'Download Limit Reached', msg: 'This link has reached its maximum number of downloads.' },
    [STATUS.NOT_FOUND]: { icon: AlertTriangle, color: 'var(--text-muted)', title: 'Link Not Found', msg: "This link doesn't exist or has been deleted." },
    [STATUS.ERROR]: { icon: AlertTriangle, color: 'var(--danger)', title: 'Something Went Wrong', msg: 'Unable to access this share link. Please try again later.' },
  };

  if (errorStates[status]) {
    const { icon: Icon, color, title, msg } = errorStates[status];
    return (
      <PageWrapper>
        <div className="glass-bright animate-scale-in" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
            background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${color}30`,
          }}>
            <Icon size={28} color={color} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{title}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>{msg}</p>
        </div>
      </PageWrapper>
    );
  }

  // Valid state
  const isDownloading = dlPhase === DOWNLOAD_PHASE.DOWNLOADING || dlPhase === DOWNLOAD_PHASE.DECRYPTING;
  const expiresAt = new Date(fileInfo?.expiresAt);
  const timeLeft = expiresAt - Date.now();
  const hoursLeft = Math.floor(timeLeft / 3600000);
  const minsLeft = Math.floor((timeLeft % 3600000) / 60000);

  return (
    <PageWrapper>
      <div className="glass-bright animate-scale-in" style={{ padding: 32 }}>
        {/* File info */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'var(--surface-3)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 28, border: '1px solid var(--border)',
          }}>
            📁
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: 17, fontWeight: 700, marginBottom: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {fileInfo?.fileName}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-muted">{formatBytes(fileInfo?.fileSize || 0)}</span>
              {fileInfo?.encrypted && <span className="badge badge-accent"><Lock size={9} /> Encrypted</span>}
              {fileInfo?.remainingDownloads != null && (
                <span className="badge badge-warning">{fileInfo.remainingDownloads} downloads left</span>
              )}
            </div>
          </div>
        </div>

        <div className="divider" style={{ marginBottom: 20 }} />

        {/* Expiry info */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          marginBottom: 20, fontSize: 13,
        }}>
          <Clock size={14} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)' }}>
            Expires in <strong style={{ color: 'var(--text)' }}>
              {hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft} minutes`}
            </strong>
            {' '}· {fileInfo?.downloadCount} downloads so far
          </span>
        </div>

        {/* Decryption password (if encrypted) */}
        {fileInfo?.encrypted && dlPhase === DOWNLOAD_PHASE.IDLE && (
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label"><Lock size={11} style={{ display: 'inline', marginRight: 4 }} />Decryption Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter the decryption password"
                value={decPassword}
                onChange={(e) => setDecPassword(e.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              This file was encrypted. The sender must share the password with you separately.
            </p>
          </div>
        )}

        {/* Progress */}
        {isDownloading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>
                {dlPhase === DOWNLOAD_PHASE.DECRYPTING ? '🔓 Decrypting...' : '📥 Downloading...'}
              </span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{dlProgress.toFixed(0)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${dlProgress}%` }} />
            </div>
          </div>
        )}

        {/* Done state */}
        {dlPhase === DOWNLOAD_PHASE.DONE && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px',
            background: 'var(--success-dim)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 'var(--radius-sm)', marginBottom: 16,
          }}>
            <CheckCircle size={16} color="var(--success)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>Downloaded & decrypted successfully!</span>
          </div>
        )}

        {/* Download button */}
        {dlPhase !== DOWNLOAD_PHASE.DONE && (
          <button
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isDownloading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}
          >
            {isDownloading ? (
              <><span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block' }} />
                {dlPhase === DOWNLOAD_PHASE.DECRYPTING ? 'Decrypting...' : 'Downloading...'}</>
            ) : (
              <><Download size={16} />
                {fileInfo?.encrypted ? 'Download & Decrypt' : 'Download File'}</>
            )}
          </button>
        )}

        {/* Error state */}
        {dlPhase === DOWNLOAD_PHASE.ERROR && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>
              Download failed. Check your password and try again.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => { setDlPhase(DOWNLOAD_PHASE.IDLE); setDlProgress(0); }}>
              Try Again
            </button>
          </div>
        )}

        <div className="divider" style={{ margin: '20px 0' }} />
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          Powered by <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>SecureShare</Link>
          {' '}— AES-256-GCM encrypted file sharing
        </p>
      </div>
    </PageWrapper>
  );
}
