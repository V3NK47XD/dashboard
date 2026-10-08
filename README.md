# Personal OS — Offline-First Dashboard (Serverless & Encrypted)

[![Deploy SPA PWA to GitHub Pages](https://github.com/V3NK47XD/dashboard/actions/workflows/deploy.yml/badge.svg)](https://github.com/V3NK47XD/dashboard/actions/workflows/deploy.yml)

🌐 **Live Application (GitHub Pages)**: [https://v3nk47xd.github.io/dashboard/](https://v3nk47xd.github.io/dashboard/)

A lightweight, zero-backend, offline-first personal dashboard that runs entirely in the browser, persists locally in **IndexedDB (Dexie)**, and synchronizes encrypted state to a serverless JSON bin on **[npoint.io](https://www.npoint.io)**.

---

## Architecture Overview

```text
Browser (PC / Phone / Tablet / PWA)
├── UI: React Single Page Application (Vite)
├── Local Storage: IndexedDB (Dexie) — Instant zero-latency reads & writes
├── Encryption Layer: Native Web Crypto API (AES-GCM 256-bit + PBKDF2)
│                     ↳ Data is encrypted locally before transmission.
└── Sync Engine: Direct client-side GET & POST to npoint.io
                         │
                         ▼
             Remote Storage (npoint.io JSON Bin)
             ↳ Stores single encrypted JSON payload:
               { version, encrypted, salt, iv, ciphertext, updated_at }
```

### Dev Environment: Flask Static Host
There is **no server-side database or business logic**. A minimal **Flask** script hosts the compiled static SPA and PWA assets for local development:
```bash
python server.py
```

---

## Key Features

1. **Serverless Cloud Storage via npoint.io**:
   - The user enters their npoint.io URL once (e.g. `https://api.npoint.io/629ab9576194b3d2c24f`).
   - Stored in browser storage (`localStorage`) until modified.
   - Built-in one-click **+ Create New Bin** helper to auto-provision a free bin instantly.

2. **Hardware-Accelerated Client-Side Encryption**:
   - Uses native `window.crypto.subtle` (AES-GCM 256-bit key).
   - Key derived using PBKDF2-SHA256 with 100,000 rounds and random 16-byte salt per encryption.
   - **Privacy Guarantee**: npoint.io and network observers only ever see encrypted bytes.
   - Options to:
     - Set and change master password.
     - Switch between **AES-256 Encrypted** and **Plaintext (No Encryption)** modes.
     - Lock dashboard session in memory.

3. **Client-Side Timestamps & Eventual Consistency**:
   - Offline-first: mutations update local IndexedDB immediately.
   - Debounced automatic sync pushes updates to npoint.io.
   - Timestamp-based merging by entity ID (`todos`, `thoughts`) and date (`daily_logs`).

4. **Progressive Web App (PWA) on Mobile**:
   - Web App Manifest (`manifest.webmanifest`) and Service Worker (`sw.js`).
   - Automatically detects mobile devices (Android / iOS) and prompts for installation.
   - Full-screen standalone mode with offline asset caching.

5. **Daily Habit Tracking & 5-Level Heatmap Matrix**:
   - Stepper counters (`+` and `−`) for Exercise, Routine, Sleep, LeetCode, Hydration, and Study.
   - 5-level light-to-dark gradient heatmaps based on category validity thresholds.
   - Interactive horizontal matrix view.

6. **Instant Tasks & Thoughts Timeline**:
   - Fast task management with inline toggling and filters.
   - Quick thought capture with local search.

7. **Data Portability**:
   - One-click JSON backup export (unencrypted plaintext download for personal archives).
   - JSON backup restore and merge.

---

## Live Deployment (GitHub Pages)

The application automatically builds and deploys to GitHub Pages on every push to `main` via GitHub Actions (`.github/workflows/deploy.yml`):

👉 **Access the Dashboard:** [https://v3nk47xd.github.io/dashboard/](https://v3nk47xd.github.io/dashboard/)

---

## Local Development Setup

### 1. Install & Build
```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
```

### 2. Run Dev Server
```bash
python server.py
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## PWA Installation on Mobile

- **Android Chrome / Edge**: Tap "Install App" on the prompted banner, or tap browser menu (⋮) -> "Install App".
- **iOS Safari**: Tap the Share button (⎋), then select "Add to Home Screen" (⊞).
