import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import {
  getNpointUrl,
  setNpointUrl,
  getEncryptionMode,
  getLastSyncTime,
  syncWithNpoint,
  changeEncryptionSettings,
  clearCachedPassword,
  exportPlainJsonBackup,
  importPlainJsonBackup,
  createNpointBin,
} from '../sync/npointSync';

export default function Settings() {
  const [npointUrl, setUrlState] = useState('');
  const [encMode, setEncModeState] = useState('password');
  const [lastSync, setLastSyncState] = useState(null);
  const [counts, setCounts] = useState({ todos: 0, thoughts: 0, dailyLogs: 0 });

  // URL Editing State
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [urlMessage, setUrlMessage] = useState('');

  // Password / Encryption Change State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberOnDevice, setRememberOnDevice] = useState(true);
  const [securityMessage, setSecurityMessage] = useState('');
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  // Sync Diagnostics State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');

  const loadSettings = async () => {
    const url = getNpointUrl();
    setUrlState(url);
    setNewUrlInput(url);
    setEncModeState(getEncryptionMode());
    setLastSyncState(getLastSyncTime());

    try {
      const [tCount, thCount, dlCount] = await Promise.all([
        db.todos.count(),
        db.thoughts.count(),
        db.daily_logs.count(),
      ]);
      setCounts({ todos: tCount, thoughts: thCount, dailyLogs: dlCount });
    } catch (e) {
      console.warn('Error reading local counts:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveUrl = async (e) => {
    e.preventDefault();
    setUrlMessage('');
    if (!newUrlInput.trim()) {
      setUrlMessage('URL cannot be empty.');
      return;
    }
    const normalized = setNpointUrl(newUrlInput);
    setUrlState(normalized);
    setIsEditingUrl(false);
    setUrlMessage('✓ Storage URL updated.');
    handleForceSync();
  };

  const handleAutoCreateBin = async () => {
    setUrlMessage('Creating new bin on npoint.io...');
    try {
      const res = await createNpointBin();
      setNpointUrl(res.apiUrl);
      setUrlState(res.apiUrl);
      setNewUrlInput(res.apiUrl);
      setIsEditingUrl(false);
      setUrlMessage(`✓ Created bin: ${res.token}!`);
      handleForceSync();
    } catch (err) {
      setUrlMessage(`Error creating bin: ${err.message}`);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncFeedback('Syncing with npoint.io...');
    try {
      const res = await syncWithNpoint();
      if (res.success) {
        setSyncFeedback('✓ Successfully synced!');
        loadSettings();
      } else {
        setSyncFeedback(`Sync note: ${res.error || res.reason}`);
      }
    } catch (err) {
      setSyncFeedback(`Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSecurityMessage('');

    if (newPassword !== confirmPassword) {
      setSecurityMessage('Passwords do not match.');
      return;
    }
    if (!newPassword && encMode === 'password') {
      setSecurityMessage('Please enter a new password.');
      return;
    }

    setIsUpdatingSecurity(true);
    try {
      await changeEncryptionSettings('password', newPassword, rememberOnDevice);
      setSecurityMessage('✓ Password updated & bin re-encrypted with AES-256!');
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
      loadSettings();
    } catch (err) {
      setSecurityMessage(`Failed to update password: ${err.message}`);
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleToggleEncryption = async () => {
    setSecurityMessage('');
    if (encMode === 'password') {
      if (window.confirm('Switch to No Encryption? Your data will be stored as plaintext JSON in npoint.io.')) {
        setIsUpdatingSecurity(true);
        try {
          await changeEncryptionSettings('none', '', false);
          setSecurityMessage('✓ Switched to plaintext mode (no encryption).');
          loadSettings();
        } catch (err) {
          setSecurityMessage(`Error: ${err.message}`);
        } finally {
          setIsUpdatingSecurity(false);
        }
      }
    } else {
      setShowPasswordForm(true);
    }
  };

  const handleLockDashboard = () => {
    clearCachedPassword();
    alert('Dashboard locked! You will be prompted for your password on the next sync.');
    window.location.reload();
  };

  const handleExportBackup = async () => {
    try {
      await exportPlainJsonBackup();
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (window.confirm('Import and merge this backup with your local database?')) {
          await importPlainJsonBackup(json);
          alert('✓ Backup successfully imported and synced!');
          loadSettings();
        }
      } catch (err) {
        alert(`Failed to import backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900, margin: '0 auto', padding: '0 1.25rem' }}>
      <div>
        <h1 style={{ margin: '0 0 0.25rem' }}>Settings & Storage</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          npoint.io storage bin, AES-256 client-side encryption, and offline backups
        </p>
      </div>

      {/* 1. npoint.io Bin Configuration */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <div>
            <h2 className="card-title">npoint.io Cloud Storage</h2>
            <p style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
              Serverless JSON store holding your encrypted dashboard state
            </p>
          </div>
          {npointUrl && (
            <a
              href={npointUrl.replace('api.npoint.io', 'www.npoint.io')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none' }}
            >
              Open Bin in npoint.io ↗
            </a>
          )}
        </div>

        {!isEditingUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connected Bin URL</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 600, wordBreak: 'break-all', marginTop: '0.2rem' }}>
                {npointUrl || 'Not configured'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingUrl(true)}>
                Edit Storage URL
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleAutoCreateBin}>
                + Create New Free Bin
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveUrl} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#ccc', marginBottom: '0.3rem' }}>
                Enter npoint.io API URL or Token
              </label>
              <input
                type="text"
                className="input"
                placeholder="https://api.npoint.io/629ab9576194b3d2c24f"
                value={newUrlInput}
                onChange={(e) => setNewUrlInput(e.target.value)}
                style={{ fontFamily: 'monospace' }}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                Save & Connect
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingUrl(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {urlMessage && (
          <div style={{ fontSize: '0.82rem', marginTop: '0.75rem', color: urlMessage.startsWith('✓') ? '#34d399' : '#60a5fa' }}>
            {urlMessage}
          </div>
        )}
      </div>

      {/* 2. Encryption & Security */}
      <div className="card">
        <h2 className="card-title">Client-Side Encryption</h2>
        <p style={{ fontSize: '0.82rem', margin: '0 0 1rem', color: 'var(--text-muted)' }}>
          Hardware-accelerated AES-GCM 256-bit encryption. The server and npoint.io only ever see encrypted bytes.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Mode</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: encMode === 'password' ? '#863bff' : '#fbbf24', marginTop: '0.2rem' }}>
              {encMode === 'password' ? '🔒 AES-256 Encrypted' : '📄 Plaintext (No Encryption)'}
            </div>
          </div>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Key Derivation</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.2rem' }}>
              {encMode === 'password' ? 'PBKDF2-SHA256 (100k rounds)' : 'Disabled'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {encMode === 'password' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(!showPasswordForm)}>
              {showPasswordForm ? 'Cancel Password Change' : 'Change Encryption Password'}
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={handleToggleEncryption} disabled={isUpdatingSecurity}>
            {encMode === 'password' ? 'Disable Encryption' : 'Enable Password Encryption'}
          </button>

          {encMode === 'password' && (
            <button className="btn btn-secondary btn-sm" onClick={handleLockDashboard} title="Clears in-memory session key">
              Lock Dashboard
            </button>
          )}
        </div>

        {showPasswordForm && (
          <form
            onSubmit={handleChangePassword}
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#1c1c1c',
              borderRadius: '12px',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Set New Encryption Password</h4>
            <input
              type="password"
              className="input"
              placeholder="New Master Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <input
              type="password"
              className="input"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#aaa', cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberOnDevice} onChange={(e) => setRememberOnDevice(e.target.checked)} />
              Remember on this browser
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={isUpdatingSecurity} style={{ alignSelf: 'flex-start' }}>
              {isUpdatingSecurity ? 'Re-encrypting...' : 'Update Password & Re-encrypt'}
            </button>
          </form>
        )}

        {securityMessage && (
          <div style={{ fontSize: '0.82rem', marginTop: '0.75rem', color: securityMessage.startsWith('✓') ? '#34d399' : '#f87171' }}>
            {securityMessage}
          </div>
        )}
      </div>

      {/* 3. Synchronization & Diagnostics */}
      <div className="card">
        <h2 className="card-title">Data Diagnostics & Sync</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Todos</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{counts.todos}</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Thoughts</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{counts.thoughts}</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Daily Logs</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{counts.dailyLogs}</div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Synced</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.35rem' }}>
              {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-sm" onClick={handleForceSync} disabled={isSyncing}>
            {isSyncing ? 'Syncing...' : '↻ Force Sync Now'}
          </button>
        </div>

        {syncFeedback && (
          <div style={{ fontSize: '0.82rem', marginTop: '0.75rem', color: syncFeedback.startsWith('✓') ? '#34d399' : '#60a5fa' }}>
            {syncFeedback}
          </div>
        )}
      </div>

      {/* 4. Backup & Portability */}
      <div className="card">
        <h2 className="card-title">Backup & Portability</h2>
        <p style={{ fontSize: '0.82rem', margin: '0 0 1rem', color: 'var(--text-muted)' }}>
          Export your complete dashboard data as a standard JSON file or restore from a previous backup.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
            ⬇ Export JSON Backup
          </button>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
            ⬆ Import JSON Backup
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}
