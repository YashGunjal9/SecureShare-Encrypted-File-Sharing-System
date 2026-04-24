import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LogOut, Upload, Files, Search, RefreshCw,
  HardDrive, Link2, TrendingUp, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import API from '../../utils/api';
import UploadZone from './UploadZone';
import FileCard from './FileCard';
import { formatBytes } from '../../utils/upload';

const TAB_FILES = 'files';
const TAB_UPLOAD = 'upload';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState(TAB_FILES);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/files', { params: { page, search, limit: 12 } });
      setFiles(res.data.files);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load files.');
    } finally {
      setLoading(false);
    }
  }, [page, search, refreshKey]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Fetch user stats
  useEffect(() => {
    API.get('/auth/me').then((res) => setStats(res.data.user)).catch(() => {});
  }, [refreshKey]);

  const handleDelete = (fileId) => {
    setFiles((prev) => prev.filter((f) => f._id !== fileId));
    setRefreshKey((k) => k + 1);
  };

  const handleUploadComplete = () => {
    setTab(TAB_FILES);
    setRefreshKey((k) => k + 1);
    toast.success('File ready! You can now share it.');
  };

  const statCards = [
    { label: 'Total Files', value: stats?.totalUploads ?? 0, icon: Files, color: 'var(--accent)' },
    { label: 'Storage Used', value: formatBytes(stats?.storageUsed ?? 0), icon: HardDrive, color: 'var(--accent-2)' },
    { label: 'Downloads', value: stats?.totalDownloads ?? 0, icon: TrendingUp, color: 'var(--accent-3)' },
  ];

  return (
    <div className="page">
      {/* Navbar */}
      <nav style={{
        borderBottom: '1px solid var(--border)', padding: '0',
        backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,5,8,0.85)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(99,102,241,0.35)',
            }}>
              <Shield size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>
              Secure<span style={{ color: 'var(--accent)' }}>Share</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 13 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-dim)', border: '1px solid var(--border-bright)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <User size={13} color="var(--accent)" />
              </div>
              <span style={{ fontWeight: 600 }}>{user?.name}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); toast.success('Logged out.'); }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 36, paddingBottom: 60 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
          {statCards.map((s) => (
            <div key={s.label} className="glass" style={{ padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${s.color}30`,
              }}>
                <s.icon size={18} color={s.color} />
              </div>
              <div>
                <p className="mono" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { id: TAB_FILES, label: 'My Files', icon: Files },
            { id: TAB_UPLOAD, label: 'Upload', icon: Upload },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: "'Syne', sans-serif",
                color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.2s',
              }}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {tab === TAB_UPLOAD && (
          <div className="animate-fade-in" style={{ maxWidth: 600 }}>
            <div className="glass-bright" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Upload a File</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                Files are encrypted chunk-by-chunk in your browser using AES-256-GCM before being uploaded directly to Google Drive.
              </p>
              <UploadZone onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        )}

        {/* Files tab */}
        {tab === TAB_FILES && (
          <div className="animate-fade-in">
            {/* Search + refresh */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 38 }}
                  placeholder="Search files..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setRefreshKey((k) => k + 1)} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>

            {/* File list */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div className="animate-spin" style={{
                  width: 36, height: 36, border: '3px solid var(--border)',
                  borderTop: '3px solid var(--accent)', borderRadius: '50%', margin: '0 auto 12px',
                }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading files...</p>
              </div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                  {search ? 'No files match your search' : 'No files uploaded yet'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                  {search ? 'Try a different search term.' : 'Upload your first file to get started.'}
                </p>
                {!search && (
                  <button className="btn btn-primary" onClick={() => setTab(TAB_UPLOAD)}>
                    <Upload size={15} /> Upload a File
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {files.map((file) => (
                    <FileCard
                      key={file._id}
                      file={file}
                      onDelete={handleDelete}
                      onLinkCreated={() => setRefreshKey((k) => k + 1)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >← Prev</button>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      Page {page} of {pagination.pages} · {pagination.total} files
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={page === pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
