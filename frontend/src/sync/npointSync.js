/**
 * Client-Side npoint.io Sync Engine
 * 
 * Manages reliable single-source-of-truth sync across devices (phone, laptop, tablet):
 * - Guarantees only ONE npoint URL active on the device at a time.
 * - When setting or changing URL: fetches cloud data FIRST and overwrites local device.
 * - Separate PULL (read-only, never pushes back) and PUSH (triggered only by local edits).
 * - Real-time cross-device updates: auto-pulls on tab visibility, window focus, and 10s intervals.
 * - Hardware-accelerated AES-GCM 256-bit encryption with PBKDF2.
 */

import { db } from '../db/database';
import { packageEnvelope, decryptPayload, verifyPassword } from '../crypto/encryption';

// Storage Keys
export const STORAGE_NPOINT_URL = 'dashboard_npoint_url';
export const STORAGE_ENCRYPTION_MODE = 'dashboard_encryption_mode'; // 'password' | 'none'
export const STORAGE_SAVED_PASSWORD = 'dashboard_saved_password';
export const STORAGE_LAST_SYNC = 'dashboard_last_sync_at';
export const SESSION_PASSWORD = 'dashboard_session_password';

// Sync States: 'needs_setup' | 'locked' | 'synced' | 'syncing' | 'offline' | 'error'
let syncState = 'offline';
let syncErrorMessage = '';
let isSyncInProgress = false;
let debounceTimeout = null;
let lastSyncTimestamp = localStorage.getItem(STORAGE_LAST_SYNC) || null;
let lastRemoteHash = null;

const stateListeners = new Set();
const dataChangeListeners = new Set();

/**
 * Normalize any npoint URL / token to standard API endpoint:
 * https://api.npoint.io/{token}
 */
export function normalizeNpointUrl(rawInput) {
  if (!rawInput) return '';
  let str = rawInput.trim();
  
  // Extract token if full URL provided
  const match = str.match(/([a-f0-9]{16,40})/i);
  if (match) {
    return `https://api.npoint.io/${match[1]}`;
  }

  if (str.startsWith('http://') || str.startsWith('https://')) {
    return str;
  }

  return `https://api.npoint.io/${str}`;
}

export function getNpointUrl() {
  return localStorage.getItem(STORAGE_NPOINT_URL) || '';
}

export function setNpointUrl(url) {
  const normalized = normalizeNpointUrl(url);
  if (normalized) {
    localStorage.setItem(STORAGE_NPOINT_URL, normalized);
  } else {
    localStorage.removeItem(STORAGE_NPOINT_URL);
  }
  return normalized;
}

export function getEncryptionMode() {
  return localStorage.getItem(STORAGE_ENCRYPTION_MODE) || 'password';
}

export function setEncryptionMode(mode) {
  localStorage.setItem(STORAGE_ENCRYPTION_MODE, mode);
}

export function getCachedPassword() {
  return sessionStorage.getItem(SESSION_PASSWORD) || localStorage.getItem(STORAGE_SAVED_PASSWORD) || '';
}

export function setCachedPassword(password, rememberOnDevice = true) {
  if (password) {
    sessionStorage.setItem(SESSION_PASSWORD, password);
    if (rememberOnDevice) {
      localStorage.setItem(STORAGE_SAVED_PASSWORD, password);
    }
  } else {
    sessionStorage.removeItem(SESSION_PASSWORD);
    localStorage.removeItem(STORAGE_SAVED_PASSWORD);
  }
}

export function clearCachedPassword() {
  sessionStorage.removeItem(SESSION_PASSWORD);
  localStorage.removeItem(STORAGE_SAVED_PASSWORD);
}

export function getSyncState() {
  return syncState;
}

export function getSyncErrorMessage() {
  return syncErrorMessage;
}

export function getLastSyncTime() {
  return lastSyncTimestamp;
}

export function subscribeSyncState(fn) {
  stateListeners.add(fn);
  fn(syncState, syncErrorMessage);
  return () => stateListeners.delete(fn);
}

export function subscribeDataChanges(fn) {
  dataChangeListeners.add(fn);
  return () => dataChangeListeners.delete(fn);
}

function setSyncState(state, error = '') {
  syncState = state;
  syncErrorMessage = error;
  stateListeners.forEach((fn) => {
    try {
      fn(syncState, syncErrorMessage);
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  });
}

function notifyDataChanged() {
  dataChangeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Data change listener error:', e);
    }
  });
}

/**
 * Automatically create a new empty bin on npoint.io
 */
export async function createNpointBin() {
  const resp = await fetch('https://www.npoint.io/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: JSON.stringify({
        version: 1,
        created_at: new Date().toISOString(),
        todos: [],
        thoughts: [],
        daily_logs: [],
      }),
    }),
  });

  if (!resp.ok) {
    throw new Error(`Failed to create npoint bin (HTTP ${resp.status})`);
  }

  const json = await resp.json();
  const token = json.token;
  const apiUrl = `https://api.npoint.io/${token}`;
  return { token, apiUrl };
}

/**
 * Fetch and decrypt remote snapshot from npoint.io
 */
async function fetchRemoteSnapshot(url, password) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    cache: 'no-cache',
  });

  if (response.status === 404) {
    throw new Error('Bin not found (404). Please verify your npoint.io URL.');
  }

  if (!response.ok) {
    throw new Error(`npoint.io server error: HTTP ${response.status}`);
  }

  const envelope = await response.json();

  // If remote bin is completely empty or empty object
  if (!envelope || (typeof envelope === 'object' && Object.keys(envelope).length === 0)) {
    return { isEmpty: true, data: null, envelope: null };
  }

  // Check if encrypted
  if (envelope.encrypted) {
    if (!password) {
      const err = new Error('This bin is encrypted with a password.');
      err.code = 'PASSWORD_REQUIRED';
      err.envelope = envelope;
      throw err;
    }
    const decryptedData = await decryptPayload(envelope, password);
    return { isEmpty: false, data: decryptedData, envelope };
  }

  // Plaintext data
  const data = envelope.data !== undefined ? envelope.data : envelope;
  return { isEmpty: false, data: data, envelope };
}

/**
 * Push snapshot envelope to npoint.io
 */
async function pushRemoteSnapshot(url, envelope) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    throw new Error(`Failed to push to npoint.io (HTTP ${response.status})`);
  }

  return await response.json();
}

/**
 * Collect full local snapshot from Dexie DB
 */
export async function getLocalSnapshot() {
  const [todos, thoughts, dailyLogs] = await Promise.all([
    db.todos.toArray(),
    db.thoughts.toArray(),
    db.daily_logs.toArray(),
  ]);

  let thresholds = {};
  try {
    const raw = localStorage.getItem('dashboard_habit_thresholds');
    if (raw) thresholds = JSON.parse(raw);
  } catch (e) {}

  return {
    version: 1,
    client_timestamp: new Date().toISOString(),
    todos: todos || [],
    thoughts: thoughts || [],
    daily_logs: dailyLogs || [],
    settings: {
      thresholds,
    },
  };
}

/**
 * Overwrite all local device Dexie tables with remote data
 */
async function overwriteLocalDevice(remoteData) {
  if (!remoteData || typeof remoteData !== 'object') return;
  if (remoteData.settings?.thresholds) {
    localStorage.setItem('dashboard_habit_thresholds', JSON.stringify(remoteData.settings.thresholds));
  }

  await db.transaction('rw', [db.todos, db.thoughts, db.daily_logs], async () => {
    await db.todos.clear();
    await db.thoughts.clear();
    await db.daily_logs.clear();

    if (Array.isArray(remoteData.todos) && remoteData.todos.length > 0) {
      await db.todos.bulkPut(remoteData.todos);
    }
    if (Array.isArray(remoteData.thoughts) && remoteData.thoughts.length > 0) {
      await db.thoughts.bulkPut(remoteData.thoughts);
    }
    if (Array.isArray(remoteData.daily_logs) && remoteData.daily_logs.length > 0) {
      await db.daily_logs.bulkPut(remoteData.daily_logs);
    }
  });

  notifyDataChanged();
}

/**
 * Merge remote updates into local device if newer
 */
async function mergeRemoteIfNewer(remoteData) {
  if (!remoteData) return false;
  let changed = false;
  if (remoteData.settings?.thresholds) {
    localStorage.setItem('dashboard_habit_thresholds', JSON.stringify(remoteData.settings.thresholds));
  }

  await db.transaction('rw', [db.todos, db.thoughts, db.daily_logs], async () => {
    // 1. Todos
    if (Array.isArray(remoteData.todos)) {
      const current = await db.todos.toArray();
      const currentMap = new Map(current.map((t) => [t.id, t]));
      for (const r of remoteData.todos) {
        if (!r?.id) continue;
        const l = currentMap.get(r.id);
        const rTime = new Date(r.updated_at || r.created_at || 0).getTime();
        const lTime = l ? new Date(l.updated_at || l.created_at || 0).getTime() : -1;
        if (!l || rTime >= lTime) {
          await db.todos.put(r);
          changed = true;
        }
      }
    }

    // 2. Thoughts
    if (Array.isArray(remoteData.thoughts)) {
      const current = await db.thoughts.toArray();
      const currentMap = new Map(current.map((t) => [t.id, t]));
      for (const r of remoteData.thoughts) {
        if (!r?.id) continue;
        const l = currentMap.get(r.id);
        const rTime = new Date(r.updated_at || r.created_at || 0).getTime();
        const lTime = l ? new Date(l.updated_at || l.created_at || 0).getTime() : -1;
        if (!l || rTime >= lTime) {
          await db.thoughts.put(r);
          changed = true;
        }
      }
    }

    // 3. Daily Logs
    if (Array.isArray(remoteData.daily_logs)) {
      const current = await db.daily_logs.toArray();
      const currentMap = new Map(current.map((dl) => [dl.date, dl]));
      for (const r of remoteData.daily_logs) {
        if (!r?.date) continue;
        const l = currentMap.get(r.date);
        const rTime = new Date(r.updated_at || 0).getTime();
        const lTime = l ? new Date(l.updated_at || 0).getTime() : -1;
        if (!l || rTime >= lTime) {
          await db.daily_logs.put({ ...(l || {}), ...r });
          changed = true;
        }
      }
    }
  });

  if (changed) {
    notifyDataChanged();
  }
  return changed;
}

/**
 * Connect to URL: ONLY fetch data first and overwrite existing local data.
 * The device only ever holds ONE single npoint URL.
 */
export async function connectAndFetchFirst(rawUrl, password = '', encryptionMode = 'password') {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('Please enter a valid npoint URL');
  }

  const normalized = normalizeNpointUrl(rawUrl);

  // 1. Fetch remote data first
  const remote = await fetchRemoteSnapshot(normalized, password);

  // 2. Only store this single URL in localStorage
  setNpointUrl(normalized);
  setEncryptionMode(encryptionMode);
  setCachedPassword(password, true);

  // 3. If remote already has data, overwrite this device's local database!
  if (remote && !remote.isEmpty && remote.data) {
    await overwriteLocalDevice(remote.data);
    lastSyncTimestamp = remote.envelope?.updated_at || new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);
  } else {
    // If the remote bin was freshly created and completely empty, push local state to initialize it
    const local = await getLocalSnapshot();
    const env = await packageEnvelope(local, encryptionMode, password);
    await pushRemoteSnapshot(normalized, env);
    lastSyncTimestamp = new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);
  }

  setSyncState('synced');
  return { success: true };
}

/**
 * PULL ONLY from npoint.io (Read-only, never pushes back to cloud)
 * Safely fetches latest changes from laptop/phone.
 */
export async function pullFromNpoint(silent = false) {
  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
    return { success: false, reason: 'NEEDS_SETUP' };
  }

  if (!navigator.onLine) {
    setSyncState('offline');
    return { success: false, reason: 'OFFLINE' };
  }

  if (isSyncInProgress) {
    return { success: false, reason: 'BUSY' };
  }

  isSyncInProgress = true;
  if (!silent) setSyncState('syncing');

  try {
    const password = getCachedPassword();
    const remote = await fetchRemoteSnapshot(url, password);

    if (remote && !remote.isEmpty && remote.data) {
      // Fingerprint / timestamp check
      const currentRemoteHash = remote.envelope?.ciphertext || JSON.stringify(remote.data);
      if (currentRemoteHash !== lastRemoteHash) {
        lastRemoteHash = currentRemoteHash;
        await mergeRemoteIfNewer(remote.data);
        lastSyncTimestamp = remote.envelope?.updated_at || new Date().toISOString();
        localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);
      }
    }

    setSyncState('synced');
    return { success: true };
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD') {
      setSyncState('locked', err.message);
    } else {
      if (!silent) {
        setSyncState('error', err.message);
      }
    }
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * PUSH local changes to npoint.io (triggered on user mutation)
 */
export async function pushToNpoint() {
  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
    return { success: false, reason: 'NEEDS_SETUP' };
  }

  if (!navigator.onLine) {
    setSyncState('offline');
    return { success: false, reason: 'OFFLINE' };
  }

  if (isSyncInProgress) {
    setTimeout(pushToNpoint, 800);
    return { success: false, reason: 'QUEUED' };
  }

  isSyncInProgress = true;
  setSyncState('syncing');

  try {
    const encMode = getEncryptionMode();
    const password = getCachedPassword();
    const localSnapshot = await getLocalSnapshot();
    const envelope = await packageEnvelope(localSnapshot, encMode, password);

    await pushRemoteSnapshot(url, envelope);

    lastRemoteHash = envelope.ciphertext || JSON.stringify(envelope.data);
    lastSyncTimestamp = envelope.updated_at || new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);

    setSyncState('synced');
    return { success: true };
  } catch (err) {
    console.error('[Sync] Push error:', err);
    setSyncState('error', err.message || 'Push failed');
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Main bidirectional sync (used for manual "Sync Now" button)
 */
export async function syncWithNpoint() {
  const pullRes = await pullFromNpoint(false);
  if (!pullRes.success && pullRes.reason === 'LOCKED') return pullRes;
  return await pushToNpoint();
}

/**
 * Debounced trigger when local data changes
 */
export function triggerDebouncedSync(delayMs = 800) {
  clearTimeout(debounceTimeout);
  if (syncState === 'synced') {
    setSyncState('syncing');
  }
  debounceTimeout = setTimeout(() => {
    pushToNpoint();
  }, delayMs);
}

/**
 * Unlock and authenticate with a given password
 */
export async function unlockWithPassword(password, rememberOnDevice = true) {
  const url = getNpointUrl();
  if (!url) {
    setCachedPassword(password, rememberOnDevice);
    return { success: true };
  }

  // Fetch remote and verify password
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to contact npoint.io (HTTP ${response.status})`);
  }

  const envelope = await response.json();
  if (envelope && envelope.encrypted) {
    const isValid = await verifyPassword(envelope, password);
    if (!isValid) {
      throw new Error('Incorrect password. Please try again.');
    }
  }

  setCachedPassword(password, rememberOnDevice);
  setEncryptionMode('password');
  return await pullFromNpoint(false);
}

/**
 * Change the encryption password or toggle encryption mode
 */
export async function changeEncryptionSettings(newMode, newPassword = '', rememberOnDevice = true) {
  const url = getNpointUrl();
  if (!url) {
    throw new Error('Configure npoint.io URL before changing encryption settings');
  }

  const localSnapshot = await getLocalSnapshot();
  const newEnvelope = await packageEnvelope(localSnapshot, newMode, newPassword);
  await pushRemoteSnapshot(url, newEnvelope);

  setEncryptionMode(newMode);
  setCachedPassword(newPassword, rememberOnDevice);
  lastRemoteHash = newEnvelope.ciphertext || JSON.stringify(newEnvelope.data);
  lastSyncTimestamp = new Date().toISOString();
  localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);

  setSyncState('synced');
  return { success: true };
}

/**
 * Export all data as unencrypted plain JSON file
 */
export async function exportPlainJsonBackup() {
  const snapshot = await getLocalSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `personal_dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Import and replace/merge from plain JSON backup
 */
export async function importPlainJsonBackup(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Invalid JSON file format');
  }

  if (Array.isArray(jsonData.todos)) {
    for (const t of jsonData.todos) await db.todos.put(t);
  }
  if (Array.isArray(jsonData.thoughts)) {
    for (const th of jsonData.thoughts) await db.thoughts.put(th);
  }
  if (Array.isArray(jsonData.daily_logs)) {
    for (const dl of jsonData.daily_logs) await db.daily_logs.put(dl);
  }

  notifyDataChanged();
  triggerDebouncedSync(100);
}

/**
 * Initialize engine lifecycle listeners:
 * - Pull on app mount
 * - Pull on window focus / tab visibility change (instant cross-device sync)
 * - Periodic background pull every 12 seconds
 */
export function initNpointSync() {
  // 1. Network status listeners
  window.addEventListener('online', () => {
    pullFromNpoint(true);
  });

  window.addEventListener('offline', () => {
    setSyncState('offline');
  });

  // 2. Active Tab / Phone App visibility listeners:
  // When switching between phone and laptop, pulling happens instantly!
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullFromNpoint(true);
    }
  });

  window.addEventListener('focus', () => {
    pullFromNpoint(true);
  });

  // 3. Periodic background pull every 12s when online
  setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') {
      pullFromNpoint(true);
    }
  }, 12000);

  // 4. Initial check on mount
  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
  } else {
    pullFromNpoint(false);
  }
}
