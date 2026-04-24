import { Link } from 'react-router-dom';
import { Shield, Zap, Clock, Download, Lock, Globe } from 'lucide-react';

const features = [
  { icon: Shield, title: 'AES-256-GCM Encryption', desc: 'Every file encrypted chunk-by-chunk in your browser. Your key never leaves your device.', color: '#6366f1' },
  { icon: Zap, title: '50GB File Support', desc: 'Chunked resumable uploads directly to Google Drive. Survive connection drops and resume anytime.', color: '#22d3ee' },
  { icon: Clock, title: 'Expiry Links', desc: 'Set custom expiry times — 1 hour, 24 hours, or any duration. Links auto-invalidate after.', color: '#a78bfa' },
  { icon: Download, title: 'Download Limits', desc: 'Control exactly how many times a file can be downloaded before the link deactivates.', color: '#10b981' },
  { icon: Lock, title: 'Zero-Knowledge Architecture', desc: 'Backend never sees your files. PBKDF2 key derivation with 250k iterations.', color: '#f59e0b' },
  { icon: Globe, title: 'Instant Sharing', desc: 'Generate a shareable URL in seconds. Recipients download directly — no account needed.', color: '#ef4444' },
];

export default function LandingPage() {
  return (
    <div className="page" style={{ fontFamily: "'Syne', sans-serif" }}>
      {/* Nav */}
      <nav style={{
        padding: '20px 0', borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,5,8,0.8)',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), var(--accent-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.4)',
            }}>
              <Shield size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>
              Secure<span style={{ color: 'var(--accent)' }}>Share</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '100px 0 80px', textAlign: 'center' }}>
        <div className="container">
          <div className="animate-fade-in" style={{ animationDelay: '0s' }}>
            <div className="badge badge-accent" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
              <Shield size={10} />  AES-256-GCM · PBKDF2 · Zero Knowledge
            </div>
          </div>
          <h1 className="animate-fade-in" style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800,
            lineHeight: 1.05, letterSpacing: '-0.04em',
            marginBottom: 24, animationDelay: '0.1s',
          }}>
            Encrypted file sharing<br />
            <span style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>built for the paranoid.</span>
          </h1>
          <p className="animate-fade-in" style={{
            fontSize: 18, color: 'var(--text-dim)', maxWidth: 560,
            margin: '0 auto 48px', lineHeight: 1.7, animationDelay: '0.2s',
          }}>
            Upload files up to 50GB. Encrypt them in your browser.
            Share with expiring links. Control who downloads what.
          </p>
          <div className="animate-fade-in" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', animationDelay: '0.3s' }}>
            <Link to="/signup" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 36px' }}>
              Start Sharing Free
            </Link>
            <Link to="/login" className="btn btn-secondary" style={{ fontSize: 16, padding: '14px 36px' }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '60px 0 100px' }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}>
            {features.map((f, i) => (
              <div key={f.title} className="glass animate-fade-in" style={{
                padding: 28, animationDelay: `${0.1 * i}s`,
                transition: 'border-color 0.2s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = f.color + '50'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                  background: f.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${f.color}30`,
                }}>
                  <f.icon size={20} color={f.color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          SecureShare — Computer Engineering Mini Project · Built with Node.js, React, MongoDB, Google Drive API
        </p>
      </footer>
    </div>
  );
}
