import React, { useState } from 'react';
import { unlockWithPassword, getNpointUrl } from '../sync/npointSync';

export default function UnlockModal({ isOpen, onClose }) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) return;

    setError('');
    setLoading(true);
    try {
      const res = await unlockWithPassword(password, remember);
      if (res.success) {
        setPassword('');
        onClose();
      } else {
        setError(res.error || 'Failed to unlock with this password.');
      }
    } catch (err) {
      setError(err.message || 'Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#141414',
          border: '1px solid #333',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(134, 59, 255, 0.15)',
              border: '1px solid #863bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem',
              margin: '0 auto 0.75rem',
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Storage Locked</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Enter your password to decrypt your personal dashboard
          </p>
          <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '0.35rem', fontFamily: 'monospace' }}>
            {getNpointUrl().replace('https://api.npoint.io/', 'bin: ')}
          </div>
        </div>

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '0.35rem' }}>
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Enter master password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#aaa',
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>

          {error && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid #7f1d1d',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ padding: '0.65rem', fontWeight: 600, marginTop: '0.25rem' }}
          >
            {loading ? 'Decrypting...' : 'Unlock & Sync'}
          </button>
        </form>
      </div>
    </div>
  );
}
