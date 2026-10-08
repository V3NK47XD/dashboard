import React, { useState, useEffect } from 'react';
import {
  subscribeSyncState,
  syncWithNpoint,
  getNpointUrl,
  getLastSyncTime,
  getEncryptionMode,
} from '../sync/npointSync';

export default function SyncStatus({ onOpenSettings, onOpenSetup, onOpenUnlock }) {
  const [syncState, setSyncState] = useState('offline');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [npointUrl, setNpointUrl] = useState('');
  const [encMode, setEncMode] = useState('password');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncState((state, error) => {
      setSyncState(state);
      setErrorMessage(error);
      setLastSync(getLastSyncTime());
      setNpointUrl(getNpointUrl());
      setEncMode(getEncryptionMode());
    });
    return () => unsubscribe();
  }, []);

  const handleOpen = () => {
    if (syncState === 'needs_setup' && onOpenSetup) {
      onOpenSetup();
      return;
    }
    if (syncState === 'locked' && onOpenUnlock) {
      onOpenUnlock();
      return;
    }
    setLastSync(getLastSyncTime());
    setNpointUrl(getNpointUrl());
    setEncMode(getEncryptionMode());
    setShowModal(true);
  };

  const handleManualSync = async () => {
    await syncWithNpoint();
    setLastSync(getLastSyncTime());
  };

  const getStatusDisplay = () => {
    switch (syncState) {
      case 'synced':
        return {
          label: encMode === 'password' ? 'Encrypted & Synced' : 'Synced',
          color: '#34d399',
          bg: 'rgba(52, 211, 153, 0.12)',
          border: 'rgba(52, 211, 153, 0.3)',
          icon: '●',
        };
      case 'syncing':
        return {
          label: 'Syncing...',
          color: '#60a5fa',
          bg: 'rgba(96, 165, 250, 0.12)',
          border: 'rgba(96, 165, 250, 0.3)',
          icon: '◌',
        };
      case 'locked':
        return {
          label: 'Locked',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          icon: '🔒',
        };
      case 'needs_setup':
        return {
          label: 'Connect Storage',
          color: '#ec4899',
          bg: 'rgba(236, 72, 153, 0.12)',
          border: 'rgba(236, 72, 153, 0.3)',
          icon: '⚙',
        };
      case 'offline':
        return {
          label: 'Offline (Local)',
          color: '#fbbf24',
          bg: 'rgba(251, 191, 36, 0.12)',
          border: 'rgba(251, 191, 36, 0.3)',
          icon: '○',
        };
      case 'error':
        return {
          label: 'Sync Issue',
          color: '#f87171',
          bg: 'rgba(248, 113, 113, 0.12)',
          border: 'rgba(248, 113, 113, 0.3)',
          icon: '⚠',
        };
      default:
        return {
          label: 'Offline',
          color: '#9ca3af',
          bg: 'rgba(156, 163, 175, 0.1)',
          border: 'rgba(156, 163, 175, 0.2)',
          icon: '○',
        };
    }
  };

  const current = getStatusDisplay();

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.65rem',
          backgroundColor: current.bg,
          border: `1px solid ${current.border}`,
          borderRadius: '9999px',
          color: current.color,
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={`Storage status: ${current.label}. Click for details.`}
      >
        <span style={{ fontSize: '0.85rem' }}>{current.icon}</span>
        <span>{current.label}</span>
      </button>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#161616',
              border: '1px solid #333',
              borderRadius: '16px',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem', color: current.color }}>{current.icon}</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>npoint.io Sync Status</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#222', borderRadius: '8px' }}>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>Storage Target</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                  {npointUrl || 'Not configured'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ padding: '0.6rem', backgroundColor: '#222', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.75rem' }}>Security Mode</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {encMode === 'password' ? '🔒 AES-256' : '📄 Plaintext'}
                  </div>
                </div>

                <div style={{ padding: '0.6rem', backgroundColor: '#222', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.75rem' }}>Last Sync</div>
                  <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                    {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div style={{ padding: '0.6rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '8px', fontSize: '0.8rem' }}>
                  {errorMessage}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowModal(false);
                  if (onOpenSettings) onOpenSettings();
                }}
              >
                Open Settings
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleManualSync}>
                Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
