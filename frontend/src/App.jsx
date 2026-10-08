import {
  LayoutGrid,
  RefreshCw,
  CheckSquare,
  Sparkles,
  Settings as SettingsIcon,
  Timer as TimerIcon,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import SyncStatus from './components/SyncStatus';
import SetupModal from './components/SetupModal';
import UnlockModal from './components/UnlockModal';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import Dashboard from './pages/Dashboard';
import Todos from './pages/Todos';
import Thoughts from './pages/Thoughts';
import AI from './pages/AI';
import Settings from './pages/Settings';
import Timer from './pages/Timer';
import { initNpointSync, subscribeSyncState, pullFromNpoint } from './sync/npointSync';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [syncState, setSyncState] = useState('offline');

  // Sync engine bootstrap on mount
  useEffect(() => {
    initNpointSync();
    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state);
      if (state === 'needs_setup') {
        setIsSetupOpen(true);
      } else if (state === 'locked') {
        setIsUnlockOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Smooth in-app splash dismissal (fast, silky transition on PC & mobile)
  useEffect(() => {
    const splash = document.getElementById('app-splash');
    if (splash) {
      const timer = setTimeout(() => {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 350);
      }, 420);
      return () => clearTimeout(timer);
    }
  }, []);
  // Handle URL path on first load and back/forward navigation
  useEffect(() => {
    const handleLocationChange = () => {
      // Strip repo prefix like '/dashboard' if hosted on GitHub Pages
      const normalizedPath = window.location.pathname
        .replace(/^\/dashboard\/?/i, '/')
        .replace(/^\//, '');

      if (!normalizedPath || normalizedPath === 'dashboard') {
        setCurrentPage('dashboard');
      } else if (['todos', 'thoughts', 'settings'].includes(normalizedPath)) {
        setCurrentPage(normalizedPath);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (page) => {
    setCurrentPage(page);
    const prefix = window.location.pathname.toLowerCase().startsWith('/dashboard') ? '/dashboard' : '';
    const targetUrl = page === 'dashboard' ? `${prefix}/` : `${prefix}/${page}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`app-container ${['todos', 'thoughts', 'timer'].includes(currentPage) ? 'locked-app-shell' : ''}`}>
      {/* Top minimal bar for SyncStatus & branding on larger screens */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 1.25rem',
          backgroundColor: '#000000',
          borderBottom: '1px solid #181818',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem' }}
            onClick={() => navigate('dashboard')}
          >
            <span style={{ color: '#facc15' }}>✦</span>
            <span>Personal OS</span>
          </div>

          <button
            onClick={() => navigate('settings')}
            title="Settings"
            style={{
              background: currentPage === 'settings' ? '#222222' : 'none',
              border: '1px solid #282828',
              borderRadius: '6px',
              padding: '0.2rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: currentPage === 'settings' ? '#facc15' : '#888',
              fontSize: '0.72rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <SettingsIcon size={12} strokeWidth={2.2} />
            <span>Settings</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <SyncStatus
            onOpenSettings={() => navigate('settings')}
            onOpenSetup={() => setIsSetupOpen(true)}
            onOpenUnlock={() => setIsUnlockOpen(true)}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '0.5rem 0' }}>
        {currentPage === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {currentPage === 'todos' && <Todos />}
        {currentPage === 'thoughts' && <Thoughts />}
        {currentPage === 'ai' && <AI />}
        {currentPage === 'timer' && <Timer />}
        {currentPage === 'settings' && <Settings />}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <nav className="floating-bottom-bar" aria-label="Main Navigation">
        {/* Habits */}
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigate('dashboard')}
          aria-label="Habits Dashboard"
        >
          <LayoutGrid className="nav-icon" size={20} strokeWidth={2.2} />
          <span className="nav-label">Habits</span>
        </button>

        {/* Tasks */}
        <button
          className={`nav-item ${currentPage === 'todos' ? 'active' : ''}`}
          onClick={() => navigate('todos')}
          aria-label="Tasks"
        >
          <CheckSquare className="nav-icon" size={20} strokeWidth={2.2} />
          <span className="nav-label">Tasks</span>
        </button>

        {/* Center Cloud Poll / Sync Button */}
        <button
          className="nav-action-btn"
          onClick={async () => {
            setIsPolling(true);
            try {
              await pullFromNpoint(false);
            } finally {
              setTimeout(() => setIsPolling(false), 600);
            }
          }}
          disabled={isPolling}
          aria-label="Poll Cloud Changes"
          title="Poll cloud data from npoint.io"
        >
          <RefreshCw
            size={20}
            strokeWidth={2.5}
            style={{
              animation: isPolling || syncState === 'syncing' ? 'spin 1s linear infinite' : 'none',
            }}
          />
        </button>

        {/* Thoughts */}
        <button
          className={`nav-item ${currentPage === 'thoughts' ? 'active' : ''}`}
          onClick={() => navigate('thoughts')}
          aria-label="Thoughts"
        >
          <Sparkles className="nav-icon" size={20} strokeWidth={2.2} />
          <span className="nav-label">Thoughts</span>
        </button>

        {/* Timer */}
        <button
          className={`nav-item ${currentPage === 'timer' ? 'active' : ''}`}
          onClick={() => navigate('timer')}
          aria-label="Timer"
        >
          <TimerIcon className="nav-icon" size={20} strokeWidth={2.2} />
          <span className="nav-label">Timer</span>
        </button>
      </nav>

      {/* Setup Modal (When npoint URL not configured) */}
      <SetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />

      {/* Unlock Modal (When remote bin is encrypted) */}
      <UnlockModal
        isOpen={isUnlockOpen}
        onClose={() => setIsUnlockOpen(false)}
      />

      {/* PWA Mobile Installation Prompt */}
      <PwaInstallPrompt />
    </div>
  );
}
