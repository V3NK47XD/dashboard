import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register PWA Service Worker relative to current base path
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL || './'}sw.js`.replace(/\/\/+/g, '/');
    navigator.serviceWorker.register(swPath).then(
      (registration) => {
        console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
      },
      (err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      }
    );
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
