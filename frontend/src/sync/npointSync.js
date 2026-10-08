/**
 * Client-Side npoint.io Sync Engine
 * 
 * Manages full bidirectional sync with npoint.io:
 * - Direct client-side GET and POST to api.npoint.io
 * - AES-GCM 256-bit client-side encryption envelope
 * - Timestamp-based eventual consistency & field-level merging
 * - Offline-first persistence via Dexie (IndexedDB)
 * - Auto-sync on local mutations with debouncing
 * - Online/offline network detection & automatic reconnect
 */

import { db } from '../db/database';
import { packageEnvelope, decryptPayload, verifyPassword } from '../crypto/encryption';

// Storage Keys
export const STORAGE_NPOINT_URL = 'dashboard_npoint_url';
export const STORAGE_ENCRYPTION_MODE = 'dashboard_encryption_mode'; // 'password' | 'none'
export const STORAGE_SAVED_PASSWORD = 'dashboard_saved_password'; // Optional local storage
export const STORAGE_LAST_SYNC = 'dashboard_last_sync_at';
export const SESSION_PASSWORD = 'dashboard_session_password';

// Sync States: 'needs_setup' | 'locked' | 'synced' | 'syncing' | 'offline' | 'error'
let syncState = 'offline';
let syncErrorMessage = '';
let isSyncInProgress = false;
let pendingPushAfterSync = false;
let debounceTimeout = null;
let lastSyncTimestamp = localStorage.getItem(STORAGE_LAST_SYNC) || null;

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

export function setCachedPassword(password, rememberOnDevice = false) {
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

  // If remote bin is empty or plain object
  if (!envelope || (typeof envelope === 'object' && Object.keys(envelope).length === 0)) {
    return { isEmpty: true, data: null };
  }

  // If remote is encrypted
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

  return {
    version: 1,
    client_timestamp: new Date().toISOString(),
    todos: todos || [],
    thoughts: thoughts || [],
    daily_logs: dailyLogs || [],
  };
}

/**
 * Merge remote snapshot into local Dexie database
 * Uses timestamp-based eventual consistency
 */
export async function mergeRemoteIntoLocal(remoteData) {
  if (!remoteData) return false;

  let hasChanges = false;
  const nowIso = new Date().toISOString();

  // 1. Merge Todos by ID
  if (Array.isArray(remoteData.todos)) {
    const localTodos = await db.todos.toArray();
    const localMap = new Map(localTodos.map((t) => [t.id, t]));

    for (const rTodo of remoteData.todos) {
      if (!rTodo || !rTodo.id) continue;
      const lTodo = localMap.get(rTodo.id);

      if (!lTodo) {
        // Insert new remote todo
        await db.todos.put(rTodo);
        hasChanges = true;
      } else {
        const remoteTime = new Date(rTodo.updated_at || rTodo.created_at || 0).getTime();
        const localTime = new Date(lTodo.updated_at || lTodo.created_at || 0).getTime();

        if (remoteTime > localTime) {
          await db.todos.put(rTodo);
          hasChanges = true;
        }
      }
    }
  }

  // 2. Merge Thoughts by ID
  if (Array.isArray(remoteData.thoughts)) {
    const localThoughts = await db.thoughts.toArray();
    const localMap = new Map(localThoughts.map((t) => [t.id, t]));

    for (const rThought of remoteData.thoughts) {
      if (!rThought || !rThought.id) continue;
      const lThought = localMap.get(rThought.id);

      if (!lThought) {
        await db.thoughts.put(rThought);
        hasChanges = true;
      } else {
        const remoteTime = new Date(rThought.updated_at || rThought.created_at || 0).getTime();
        const localTime = new Date(lThought.updated_at || lThought.created_at || 0).getTime();

        if (remoteTime > localTime) {
          await db.thoughts.put(rThought);
          hasChanges = true;
        }
      }
    }
  }

  // 3. Merge Daily Logs by Date
  if (Array.isArray(remoteData.daily_logs)) {
    const localLogs = await db.daily_logs.toArray();
    const localMap = new Map(localLogs.map((l) => [l.date, l]));

    for (const rLog of remoteData.daily_logs) {
      if (!rLog || !rLog.date) continue;
      const lLog = localMap.get(rLog.date);

      if (!lLog) {
        await db.daily_logs.put(rLog);
        hasChanges = true;
      } else {
        const remoteTime = new Date(rLog.updated_at || 0).getTime();
        const localTime = new Date(lLog.updated_at || 0).getTime();

        if (remoteTime > localTime) {
          // Field-level merge favoring remote for newer entries, but preserving any non-null local fields
          const merged = {
            ...lLog,
            ...rLog,
            updated_at: rLog.updated_at || nowIso,
          };
          await db.daily_logs.put(merged);
          hasChanges = true;
        }
      }
    }
  }

  return hasChanges;
}

/**
 * Execute a complete sync cycle (PULL -> MERGE -> PUSH)
 */
export async function syncWithNpoint(options = {}) {
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
    pendingPushAfterSync = true;
    return { success: false, reason: 'IN_PROGRESS' };
  }

  isSyncInProgress = true;
  setSyncState('syncing');

  try {
    const encMode = getEncryptionMode();
    const password = getCachedPassword();

    // 1. PULL & DECRYPT
    let remote;
    try {
      remote = await fetchRemoteSnapshot(url, password);
    } catch (err) {
      if (err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD') {
        setSyncState('locked', err.message);
        isSyncInProgress = false;
        return { success: false, reason: 'LOCKED', error: err.message };
      }
      throw err;
    }

    // 2. MERGE REMOTE INTO LOCAL
    let hasMerged = false;
    if (remote && !remote.isEmpty && remote.data) {
      hasMerged = await mergeRemoteIntoLocal(remote.data);
      if (hasMerged) {
        notifyDataChanged();
      }
    }

    // 3. PACKAGE & PUSH (Full snapshot push)
    const localSnapshot = await getLocalSnapshot();
    const envelope = await packageEnvelope(localSnapshot, encMode, password);
    await pushRemoteSnapshot(url, envelope);

    lastSyncTimestamp = new Date().toISOString();
    localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);

    setSyncState('synced');
    return { success: true };
  } catch (err) {
    console.error('npoint sync error:', err);
    setSyncState('error', err.message || 'Sync failed');
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
    if (pendingPushAfterSync) {
      pendingPushAfterSync = false;
      setTimeout(() => syncWithNpoint(), 500);
    }
  }
}

/**
 * Debounced trigger when local data changes
 */
export function triggerDebouncedSync(delayMs = 1500) {
  clearTimeout(debounceTimeout);

  // Fast optimistic state
  if (syncState === 'synced') {
    setSyncState('syncing');
  }

  debounceTimeout = setTimeout(() => {
    syncWithNpoint();
  }, delayMs);
}

/**
 * Unlock and authenticate with a given password
 */
export async function unlockWithPassword(password, rememberOnDevice = false) {
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
  return await syncWithNpoint();
}

/**
 * Change the encryption password or toggle encryption mode
 */
export async function changeEncryptionSettings(newMode, newPassword = '', rememberOnDevice = false) {
  const url = getNpointUrl();
  if (!url) {
    throw new Error('Configure npoint.io URL before changing encryption settings');
  }

  // 1. Get current decrypted local data
  const localSnapshot = await getLocalSnapshot();

  // 2. Package envelope with new settings
  const newEnvelope = await packageEnvelope(localSnapshot, newMode, newPassword);

  // 3. Push to npoint
  await pushRemoteSnapshot(url, newEnvelope);

  // 4. Update stored credentials
  setEncryptionMode(newMode);
  setCachedPassword(newPassword, rememberOnDevice);
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
 * Initialize engine lifecycle listeners
 */
export function initNpointSync() {
  window.addEventListener('online', () => {
    console.log('[Sync] Network online detected');
    syncWithNpoint();
  });

  window.addEventListener('offline', () => {
    console.log('[Sync] Network offline detected');
    setSyncState('offline');
  });

  // Initial check on mount
  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
  } else {
    // Background sync on app launch
    syncWithNpoint();
  }
}
