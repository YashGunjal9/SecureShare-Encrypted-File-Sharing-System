import { useState } from 'react';
import {
  File, Lock, Unlock, Share2, Trash2, Copy, Clock, Download, CheckCircle, X, Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../../utils/api';
import { formatBytes } from '../../utils/upload';

const MIME_ICONS = {
  'image/': '🖼️',
  'video/': '🎥',
  'audio/': '🎵',
  'application/pdf': '📄',
  'application/zip': '📦',
  'application/': '📦',
  'text/': '📝',
};

function getMimeIcon(mime) {
  for (const [prefix, icon] of Object.entries(MIME_ICONS)) {
    if (mime?.startsWith(prefix)) return icon;
  }
  return '📁';
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FileCard({ file, onDelete, onLinkCreated }) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ expiryHours: '24', maxDownloads: '' });
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await API.post('/share/create', {
        fileId: file._id,
        expiryHours: parseFloat(shareForm.expiryHours),
        maxDownloads: shareForm.maxDownloads ? parseInt(shareForm.maxDownloads) : null,
      });
      setShareResult(res.data);
      onLinkCreated?.();
      toast.success('Share link created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create share link.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareResult.shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.originalName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await API.delete(`/files/${file._id}`);
      toast.success('File deleted.');
      onDelete?.(file._id);
    } catch (err) {
      toast.error('Failed to delete file.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="glass" style={{
        padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start',
        transition: 'border-color 0.2s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-bright)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'var(--surface-3)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 22,
          border: '1px solid var(--border)',
        }}>
          {getMimeIcon(file.mimeType)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontWeight: 700, fontSize: 14, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {file.originalName}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatBytes(file.size)}</span>
            <span style={{ color: 'var(--border)', fontSize: 12' }}>·</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{timeAgo(file.createdAt)}</span>
            {file.encrypted && (
              <span className="badge badge-accent" style={{ gap: 3 }}>
                <Lock size={9} /> Encrypted
              </span>
            )}
            {file.activeLinks > 0 && (
              <span className="badge badge-success">
                <Link2 size={9} /> {file.activeLinks} link{file.activeLinks !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm btn-icon"
            title="Share"
            onClick={() => { setShowShareModal(true); setShareResult(null); }}
          >
            <Share2 size={14} />
          </button>
          <button
            className="btn btn-danger btn-sm btn-icon"
            title="Delete"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}
          onClick={(e) => e.target === e.currentTarget && setShowShareModal(false)}
        >
          <div className="glass-bright animate-scale-in" style={{ width: '100%', maxWidth: 460, padding: 32 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Share File</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.originalName}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowShareModal(false)}>
                <X size={16} />
              </button>
            </div>

            {!shareResult ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
                  <div className="form-group">
                    <label className="form-label"><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />Expiry Time</label>
                    <select
                      className="form-input"
                      value={shareForm.expiryHours}
                      onChange={(e) => setShareForm({ ...shareForm, expiryHours: e.target.value })}
                    >
                      <option value="1">1 hour</option>
                      <option value="6">6 hours</option>
                      <option value="24">24 hours</option>
                      <option value="72">3 days</option>
                      <option value="168">7 days</option>
                      <option value="720">30 days</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label"><Download size={11} style={{ display: 'inline', marginRight: 4 }} />Max Downloads (optional)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Unlimited"
                      min="1"
                      max="1000"
                      value={shareForm.maxDownloads}
                      onChange={(e) => setShareForm({ ...shareForm, maxDownloads: e.target.value })}
                    />
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Leave blank for unlimited downloads
                    </p>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleShare}
                  disabled={sharing}
                  style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
                >
                  {sharing ? (
                    <><span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block' }} /> Generating...</>
                  ) : (
                    <><Share2 size={15} /> Generate Share Link</>
                  )}
                </button>
              </>
            ) : (
              <div className="animate-fade-in">
                <div style={{
                  background: 'var(--success-dim)', border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 'var(--radius-sm)', padding: 16, marginBottom: 20, display: 'flex', gap: 10,
                }}>
                  <CheckCircle size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--success)', fontSize: 14 }}>Link created!</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Expires: {new Date(shareResult.expiresAt).toLocaleString()}
                      {shareResult.maxDownloads ? ` · Max ${shareResult.maxDownloads} downloads` : ' · Unlimited downloads'}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Share URL</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      readOnly
                      className="form-input mono"
                      value={shareResult.shareUrl}
                      style={{ fontSize: 12 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleCopy} style={{ flexShrink: 0 }}>
                      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setShareResult(null)}
                  >
                    Create Another
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setShowShareModal(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
