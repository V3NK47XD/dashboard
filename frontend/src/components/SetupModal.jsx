import React, { useState } from 'react';
import {
  setNpointUrl,
  setEncryptionMode,
  setCachedPassword,
  createNpointBin,
  syncWithNpoint,
} from '../sync/npointSync';

export default function SetupModal({ isOpen, onClose }) {
  const [url, setUrl] = useState('');
  const [encryptionChoice, setEncryptionChoice] = useState('password'); // 'password' | 'none'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(true);
  const [isCreatingBin, setIsCreatingBin] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreateBin = async () => {
    setIsCreatingBin(true);
    setStatusMessage({ text: 'Creating fresh npoint.io bin...', type: 'info' });
    try {
      const res = await createNpointBin();
      setUrl(res.apiUrl);
      setStatusMessage({
        text: `✓ Created! Connected to token: ${res.token}`,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({
        text: `Failed to auto-create bin: ${err.message}. You can manually create one at npoint.io and paste the URL.`,
        type: 'error',
      });
    } finally {
      setIsCreatingBin(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatusMessage({ text: '', type: '' });

    if (!url.trim()) {
      setStatusMessage({ text: 'Please enter a valid npoint.io URL or generate one.', type: 'error' });
      return;
    }

    if (encryptionChoice === 'password') {
      if (!password) {
        setStatusMessage({ text: 'Please enter an encryption password.', type: 'error' });
        return;
      }
      if (password !== confirmPassword) {
        setStatusMessage({ text: 'Passwords do not match. Please verify.', type: 'error' });
        return;
      }
    }

    setLoading(true);
    try {
      const normalized = setNpointUrl(url);
      setEncryptionMode(encryptionChoice);
      if (encryptionChoice === 'password') {
        setCachedPassword(password, rememberPassword);
      } else {
        setCachedPassword('');
      }

      setStatusMessage({ text: 'Testing connection and initializing sync...', type: 'info' });
      const result = await syncWithNpoint();

      if (result.success || result.reason === 'OFFLINE') {
        setStatusMessage({ text: '✓ Connected successfully!', type: 'success' });
        setTimeout(() => {
          onClose();
        }, 600);
      } else if (result.reason === 'LOCKED') {
        setStatusMessage({
          text: 'This bin is already encrypted. Please verify password.',
          type: 'error',
        });
      } else {
        setStatusMessage({
          text: `Warning: Saved settings, but sync reported: ${result.error || result.reason}`,
          type: 'info',
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      setStatusMessage({ text: `Connection error: ${err.message}`, type: 'error' });
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
          maxWidth: 540,
          backgroundColor: '#141414',
          border: '1px solid #2a2a2a',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#863bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.2rem',
              color: '#fff',
            }}
          >
            OS
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Connect Storage & Privacy</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Zero-backend storage powered by npoint.io with client-side encryption
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* npoint URL Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              npoint.io Bin URL
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input"
                placeholder="https://api.npoint.io/629ab9576194b3d2c24f"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                required
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCreateBin}
                disabled={isCreatingBin}
                style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                title="Automatically create a new free bin on npoint.io"
              >
                {isCreatingBin ? 'Creating...' : '+ Create New Bin'}
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Enter your npoint.io URL or click <strong>+ Create New Bin</strong> to auto-generate one.
            </div>
          </div>

          {/* Encryption Mode Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              Client-Side Encryption Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setEncryptionChoice('password')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${encryptionChoice === 'password' ? '#863bff' : '#2a2a2a'}`,
                  backgroundColor: encryptionChoice === 'password' ? 'rgba(134, 59, 255, 0.12)' : '#1a1a1a',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>🔒 AES-256 Encrypted</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Hardware-accelerated password encryption. Only you can read the data.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEncryptionChoice('none')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${encryptionChoice === 'none' ? '#863bff' : '#2a2a2a'}`,
                  backgroundColor: encryptionChoice === 'none' ? 'rgba(134, 59, 255, 0.12)' : '#1a1a1a',
                  color: '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>📄 No Encryption</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Plaintext JSON stored directly in your bin. No password required.
                </div>
              </button>
            </div>
          </div>

          {/* Password fields when encryption enabled */}
          {encryptionChoice === 'password' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: '#1a1a1a',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #2a2a2a',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '0.25rem' }}>
                  Master Encryption Password
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Enter a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={encryptionChoice === 'password'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '0.25rem' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={encryptionChoice === 'password'}
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
                  marginTop: '0.2rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                />
                Remember password on this browser (stored in browser local storage)
              </label>
            </div>
          )}

          {statusMessage.text && (
            <div
              style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                backgroundColor:
                  statusMessage.type === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : statusMessage.type === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  statusMessage.type === 'error'
                    ? '#f87171'
                    : statusMessage.type === 'success'
                    ? '#34d399'
                    : '#60a5fa',
                border: `1px solid ${
                  statusMessage.type === 'error'
                    ? '#7f1d1d'
                    : statusMessage.type === 'success'
                    ? '#065f46'
                    : '#1e3a8a'
                }`,
              }}
            >
              {statusMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ padding: '0.65rem 1.5rem', fontWeight: 600 }}
            >
              {loading ? 'Saving...' : 'Connect & Start'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
