import React, { useState, useEffect } from 'react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if already in standalone / PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if mobile device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobileDevice =
      /iphone|ipad|ipod|android|mobile|touch/.test(userAgent) ||
      (window.innerWidth <= 768 && 'ontouchstart' in window);

    if (!isMobileDevice) {
      return;
    }

    // Check if user dismissed recently (24 hours)
    const dismissedTime = localStorage.getItem('dashboard_pwa_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // Detect iOS
    const isAppleMobile = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    if (isAppleMobile) {
      setIsIos(true);
      setShowPrompt(true);
      return;
    }

    // Listen for beforeinstallprompt event (Android Chrome, Edge, etc.)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If on Android but beforeinstallprompt already fired or delayed, display after 2s
    const fallbackTimer = setTimeout(() => {
      if (!isStandalone) {
        setShowPrompt(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install: Open your browser menu (⋮) and select "Add to Home Screen" or "Install App".');
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('dashboard_pwa_dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '12px',
        right: '12px',
        zIndex: 1000,
        backgroundColor: '#161616',
        border: '1px solid #333',
        borderRadius: '16px',
        padding: '1rem',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#863bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.2rem',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(134, 59, 255, 0.4)',
            }}
          >
            OS
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              Install Personal OS App
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999' }}>
              Fast offline access directly from your phone home screen
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#777',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {isIos ? (
        <div
          style={{
            fontSize: '0.8rem',
            color: '#bbb',
            backgroundColor: '#222',
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            lineHeight: 1.4,
          }}
        >
          Tap the <strong>Share button</strong> (
          <span role="img" aria-label="share">
            ⎋
          </span>
          ) in Safari, then tap <strong>'Add to Home Screen'</strong> (
          <span role="img" aria-label="plus">
            ⊞
          </span>
          ).
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
          <button
            onClick={handleInstallClick}
            style={{
              flex: 1,
              backgroundColor: '#863bff',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '0.6rem',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Install App
          </button>
          <button
            onClick={handleDismiss}
            style={{
              backgroundColor: '#262626',
              color: '#ccc',
              border: '1px solid #333',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Maybe Later
          </button>
        </div>
      )}
    </div>
  );
}
