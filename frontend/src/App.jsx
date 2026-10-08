import React, { useState, useEffect } from 'react';
import SyncStatus from './components/SyncStatus';
import QuickAddModal from './components/QuickAddModal';
import SetupModal from './components/SetupModal';
import UnlockModal from './components/UnlockModal';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import Dashboard from './pages/Dashboard';
import Daily from './pages/Daily';
import Todos from './pages/Todos';
import Thoughts from './pages/Thoughts';
import AI from './pages/AI';
import Settings from './pages/Settings';
import { initNpointSync, subscribeSyncState, getNpointUrl } from './sync/npointSync';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState({});
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [syncState, setSyncState] = useState('offline');
  const [todayIso] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Handle URL path on first load and back/forward navigation
  useEffect(() => {
    const handleLocationChange = () => {
      // Strip repo prefix like '/dashboard' if hosted on GitHub Pages
      const normalizedPath = window.location.pathname
        .replace(/^\/dashboard\/?/i, '/')
        .replace(/^\//, '');

      if (!normalizedPath || normalizedPath === 'dashboard') {
        setCurrentPage('dashboard');
      } else if (['daily', 'todos', 'thoughts', 'ai', 'settings'].includes(normalizedPath)) {
        setCurrentPage(normalizedPath);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (page, params = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    const prefix = window.location.pathname.toLowerCase().startsWith('/dashboard') ? '/dashboard' : '';
    const targetUrl = page === 'dashboard' ? `${prefix}/` : `${prefix}/${page}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
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
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem' }}
          onClick={() => navigate('dashboard')}
        >
          <span style={{ color: '#facc15' }}>✦</span>
          <span>Personal OS</span>
          <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: 500, border: '1px solid #282828', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
            npoint.io
          </span>
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
        {currentPage === 'daily' && <Daily initialDate={pageParams.date} />}
        {currentPage === 'todos' && <Todos />}
        {currentPage === 'thoughts' && <Thoughts />}
        {currentPage === 'ai' && <AI />}
        {currentPage === 'settings' && <Settings />}
      </main>

      {/* Floating Bottom Navigation Bar (Image #1 & Image #2) */}
      <nav className="floating-bottom-bar">
        {/* Habit Dashboard (Matrix / Cards) */}
        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigate('dashboard')}
          aria-label="Habits Dashboard"
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="2" />
          </svg>
          <span className="nav-label">Habits</span>
        </button>

        {/* Daily Metric Detail */}
        <button
          className={`nav-item ${currentPage === 'daily' ? 'active' : ''}`}
          onClick={() => navigate('daily', { date: todayIso })}
          aria-label="Daily Metric Detail"
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
          </svg>
          <span className="nav-label">Daily</span>
        </button>

        {/* Center Quick Add Action Button (+) */}
        <button
          className="nav-action-btn"
          onClick={() => setIsQuickAddOpen(true)}
          aria-label="Quick Add Activity"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </button>

        {/* Tasks / Todos */}
        <button
          className={`nav-item ${currentPage === 'todos' ? 'active' : ''}`}
          onClick={() => navigate('todos')}
          aria-label="Tasks and Todos"
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 11l3 3L22 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="nav-label">Tasks</span>
        </button>

        {/* Thoughts / Notes */}
        <button
          className={`nav-item ${currentPage === 'thoughts' ? 'active' : ''}`}
          onClick={() => navigate('thoughts')}
          aria-label="Instant Thoughts"
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="nav-label">Thoughts</span>
        </button>

        {/* Settings */}
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
          aria-label="Settings and Diagnostics"
        >
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        date={todayIso}
        onMetricUpdated={() => {
          // Handled via reactive local DB queries
        }}
      />

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
