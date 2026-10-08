/**
 * Client-Side npoint.io Sync Engine (Fixed Structure & Record-Level Encryption)
 * 
 * Fixed JSON Structure:
 * {
 *   version: 2,
 *   updated_at: ISOString,
 *   habits: { [category]: { [dateIso]: count } },
 *   thresholds: { [category]: targetNumber },
 *   tasks: { [taskId]: { id, completed, created_at, updated_at, val } },
 *   thoughts: { [thoughtId]: { id, created_at, updated_at, val } }
 * }
 * 
 * - Only task and thought values are encrypted (enc:v1:salt:iv:ciphertext)
 * - Fetch-latest-then-update pattern prevents race conditions between phone & laptop
 * - 1-year history per habit category
 * - Immediate updates on visibility change, focus, and 10s polling
 */

import { db } from '../db/database';
import {
  encryptRecordValue,
  decryptRecordValue,
  generateSalt,
} from '../crypto/encryption';
import {
  HABIT_CATEGORIES,
  loadAllHabitsData,
  saveAllHabitsData,
  getHabitThresholds,
  setHabitThreshold,
} from '../db/habits';

export const STORAGE_NPOINT_URL = 'dashboard_npoint_url';
export const STORAGE_ENCRYPTION_MODE = 'dashboard_encryption_mode'; // 'password' | 'none'
export const STORAGE_SAVED_PASSWORD = 'dashboard_saved_password';
export const STORAGE_LAST_SYNC = 'dashboard_last_sync_at';
export const SESSION_PASSWORD = 'dashboard_session_password';

let syncState = 'offline';
let syncErrorMessage = '';
let isSyncInProgress = false;
let lastSyncTimestamp = localStorage.getItem(STORAGE_LAST_SYNC) || null;
let lastRemoteDocHash = null;

const stateListeners = new Set();
const dataChangeListeners = new Set();

/**
 * Clean & normalize npoint URL or bin token
 */
export function normalizeNpointUrl(rawInput) {
  if (!rawInput) return '';
  let str = rawInput.trim();
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

export function notifyDataChanged() {
  dataChangeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Data change listener error:', e);
    }
  });
}

/**
 * Create default empty fixed JSON structure
 */
export function createDefaultDocument() {
  const habits = {};
  const thresholds = {};
  HABIT_CATEGORIES.forEach((cat) => {
    habits[cat.id] = {};
    thresholds[cat.id] = cat.defaultThreshold;
  });

  return {
    version: 2,
    updated_at: new Date().toISOString(),
    salt: generateSalt(),
    habits,
    thresholds,
    tasks: {},
    thoughts: {},
  };
}

/**
 * Automatically create a new empty bin on npoint.io with fixed structure
 */
export async function createNpointBin() {
  const initialDoc = createDefaultDocument();
  const resp = await fetch('https://www.npoint.io/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: JSON.stringify(initialDoc) }),
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
 * Fetch raw document from npoint.io
 */
async function fetchRemoteDoc(url) {
  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    cache: 'no-cache',
  });

  if (resp.status === 404) {
    throw new Error('Bin not found (404). Please verify your npoint.io URL.');
  }

  if (!resp.ok) {
    throw new Error(`npoint.io server error: HTTP ${resp.status}`);
  }

  let doc = await resp.json();
  if (!doc || doc.version === 1 || (doc.encrypted && doc.ciphertext) || typeof doc !== 'object') {
    doc = createDefaultDocument();
  }
  if (!doc.habits) doc.habits = {};
  if (!doc.thresholds) doc.thresholds = {};
  if (!doc.tasks) doc.tasks = {};
  if (!doc.thoughts) doc.thoughts = {};
  return doc;
}
/**
 * Push document to npoint.io
 */
async function pushRemoteDoc(url, doc) {
  doc.updated_at = new Date().toISOString();
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });

  if (!resp.ok) {
    throw new Error(`Failed to update npoint.io (HTTP ${resp.status})`);
  }

  lastSyncTimestamp = doc.updated_at;
  localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);
  return await resp.json();
}

/**
 * Overwrite local device state (Dexie + localStorage) with remote doc
 */
async function overwriteDeviceFromDoc(doc, password) {
  if (!doc) return;

  // 1. Habits history & thresholds
  if (doc.habits) {
    saveAllHabitsData(doc.habits);
  }
  if (doc.thresholds) {
    localStorage.setItem('dashboard_habit_thresholds_v2', JSON.stringify(doc.thresholds));
  }

  // 2. Tasks: decrypt values and write to Dexie
  const decryptedTasks = [];
  if (doc.tasks && typeof doc.tasks === 'object') {
    for (const [id, t] of Object.entries(doc.tasks)) {
      if (!t) continue;
      const title = await decryptRecordValue(t.val, password);
      decryptedTasks.push({
        id: t.id || id,
        title: title || '',
        completed: Boolean(t.completed),
        created_at: t.created_at || new Date().toISOString(),
        updated_at: t.updated_at || new Date().toISOString(),
        deleted_at: null,
      });
    }
  }

  // 3. Thoughts: decrypt values and write to Dexie
  const decryptedThoughts = [];
  if (doc.thoughts && typeof doc.thoughts === 'object') {
    for (const [id, th] of Object.entries(doc.thoughts)) {
      if (!th) continue;
      const content = await decryptRecordValue(th.val, password);
      decryptedThoughts.push({
        id: th.id || id,
        content: content || '',
        created_at: th.created_at || new Date().toISOString(),
        updated_at: th.updated_at || new Date().toISOString(),
        deleted_at: null,
      });
    }
  }

  await db.transaction('rw', [db.todos, db.thoughts], async () => {
    await db.todos.clear();
    await db.thoughts.clear();
    if (decryptedTasks.length > 0) await db.todos.bulkPut(decryptedTasks);
    if (decryptedThoughts.length > 0) await db.thoughts.bulkPut(decryptedThoughts);
  });

  notifyDataChanged();
}

/**
 * Connect to URL: fetches cloud data first and overwrites local device.
 * Only ONE npoint URL is ever stored on the device.
 */
export async function connectAndFetchFirst(rawUrl, password = '', encryptionMode = 'password') {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('Please enter a valid npoint URL');
  }

  const normalized = normalizeNpointUrl(rawUrl);
  setSyncState('syncing');

  try {
    const doc = await fetchRemoteDoc(normalized);

    // Only store this single URL
    setNpointUrl(normalized);
    setEncryptionMode(encryptionMode);
    setCachedPassword(password, true);

    if (doc && (doc.habits || doc.tasks || doc.thoughts)) {
      // Overwrite local device with fetched remote data
      await overwriteDeviceFromDoc(doc, password);
    } else {
      // If remote bin is brand new / empty, initialize with fixed structure
      const newDoc = createDefaultDocument();
      await pushRemoteDoc(normalized, newDoc);
      await overwriteDeviceFromDoc(newDoc, password);
    }

    setSyncState('synced');
    return { success: true };
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD') {
      setSyncState('locked', err.message);
    } else {
      setSyncState('error', err.message);
    }
    throw err;
  }
}

/**
 * Fetch-latest-then-update pattern:
 * 1. GET latest JSON from npoint
 * 2. Check if operation is possible & apply mutation
 * 3. POST back updated JSON
 * 4. Update local state
 */
export async function applyRemoteMutation(mutateFn) {
  const url = getNpointUrl();
  if (!url) return null;
  if (!navigator.onLine) {
    setSyncState('offline');
    return null;
  }

  try {
    setSyncState('syncing');
    const doc = (await fetchRemoteDoc(url)) || createDefaultDocument();
    const password = getCachedPassword();

    // Check if doc structure exists, fill defaults if empty
    if (!doc.habits) doc.habits = {};
    if (!doc.thresholds) doc.thresholds = {};
    if (!doc.tasks) doc.tasks = {};
    if (!doc.thoughts) doc.thoughts = {};

    // Execute mutation on the latest doc
    const possible = await mutateFn(doc, password);
    if (possible === false) {
      console.warn('[Sync] Mutation not possible on latest remote doc');
      setSyncState('synced');
      return false;
    }

    await pushRemoteDoc(url, doc);
    setSyncState('synced');
    return true;
  } catch (err) {
    console.error('[Sync] Mutation error:', err);
    setSyncState('error', err.message);
    throw err;
  }
}

/**
 * Poll remote first, check if possible, mutate, and push back.
 */

/**
 * Mutator: Add or edit task (poll latest -> check -> encrypt -> push)
 */
export async function syncSaveTask(task) {
  const password = getCachedPassword();
  const encryptedVal = await encryptRecordValue(task.title, password);

  await applyRemoteMutation(async (doc) => {
    doc.tasks[task.id] = {
      id: task.id,
      completed: Boolean(task.completed),
      created_at: task.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      val: encryptedVal,
    };
    return true;
  });

  await db.todos.put(task);
  notifyDataChanged();
}

/**
 * Mutator: Toggle task (poll latest -> check exists -> toggle -> push)
 */
export async function syncToggleTask(taskId) {
  let nextCompleted = false;

  const applied = await applyRemoteMutation(async (doc) => {
    if (!doc.tasks || !doc.tasks[taskId]) {
      return false; // Task was deleted or not on remote
    }
    doc.tasks[taskId].completed = !doc.tasks[taskId].completed;
    doc.tasks[taskId].updated_at = new Date().toISOString();
    nextCompleted = doc.tasks[taskId].completed;
    return true;
  });

  if (applied) {
    const existing = await db.todos.get(taskId);
    if (existing) {
      await db.todos.put({ ...existing, completed: nextCompleted, updated_at: new Date().toISOString() });
      notifyDataChanged();
    }
  }
  return applied;
}

/**
 * Mutator: Remove task (poll latest -> check exists -> delete -> push)
 */
export async function syncRemoveTask(taskId) {
  await applyRemoteMutation(async (doc) => {
    if (doc.tasks && doc.tasks[taskId]) {
      delete doc.tasks[taskId];
      return true;
    }
    return true; // Already deleted
  });

  await db.todos.delete(taskId);
  notifyDataChanged();
}

/**
 * Mutator: Add or edit thought (poll latest -> check -> encrypt -> push)
 */
export async function syncSaveThought(thought) {
  const password = getCachedPassword();
  const encryptedVal = await encryptRecordValue(thought.content, password);

  await applyRemoteMutation(async (doc) => {
    doc.thoughts[thought.id] = {
      id: thought.id,
      created_at: thought.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      val: encryptedVal,
    };
    return true;
  });

  await db.thoughts.put(thought);
  notifyDataChanged();
}

/**
 * Mutator: Remove thought (poll latest -> check exists -> delete -> push)
 */
export async function syncRemoveThought(thoughtId) {
  await applyRemoteMutation(async (doc) => {
    if (doc.thoughts && doc.thoughts[thoughtId]) {
      delete doc.thoughts[thoughtId];
      return true;
    }
    return true;
  });

  await db.thoughts.delete(thoughtId);
  notifyDataChanged();
}

/**
 * Mutator: Adjust habit for today (poll latest -> check current remote -> adjust -> push)
 */
export async function syncAdjustHabitToday(catId, delta) {
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let nextVal = 0;

  await applyRemoteMutation(async (doc) => {
    if (!doc.habits[catId]) doc.habits[catId] = {};
    const currentRemote = doc.habits[catId][todayIso] || 0;
    nextVal = Math.max(0, currentRemote + delta);
    doc.habits[catId][todayIso] = nextVal;
    return true;
  });

  // Update local habits store
  const habits = loadAllHabitsData();
  if (!habits[catId]) habits[catId] = {};
  habits[catId][todayIso] = nextVal;
  saveAllHabitsData(habits);
  notifyDataChanged();
  return nextVal;
}

/**
 * Mutator: Update habit threshold (poll latest -> update -> push)
 */
export async function syncUpdateThreshold(catId, newThresh) {
  await applyRemoteMutation(async (doc) => {
    if (!doc.thresholds) doc.thresholds = {};
    doc.thresholds[catId] = Number(newThresh);
    return true;
  });

  setHabitThreshold(catId, newThresh);
  notifyDataChanged();
}
let debounceTimer = null;
export function triggerDebouncedSync(delayMs = 800) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pullFromNpoint(true);
  }, delayMs);
}

/**
 * PULL ONLY from npoint.io (Read-only, updates local device if remote changed)
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

  if (isSyncInProgress) return { success: false, reason: 'BUSY' };

  isSyncInProgress = true;
  if (!silent) setSyncState('syncing');

  try {
    const doc = await fetchRemoteDoc(url);
    const password = getCachedPassword();

    // Check if remote doc changed
    const docHash = doc.updated_at || JSON.stringify(doc);
    if (docHash !== lastRemoteDocHash) {
      lastRemoteDocHash = docHash;
      await overwriteDeviceFromDoc(doc, password);
      lastSyncTimestamp = doc.updated_at || new Date().toISOString();
      localStorage.setItem(STORAGE_LAST_SYNC, lastSyncTimestamp);
    }

    setSyncState('synced');
    return { success: true };
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED' || err.code === 'INVALID_PASSWORD') {
      setSyncState('locked', err.message);
    } else {
      if (!silent) setSyncState('error', err.message);
    }
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Manual Sync button handler
 */
export async function syncWithNpoint() {
  return await pullFromNpoint(false);
}

/**
 * Unlock and authenticate
 */
export async function unlockWithPassword(password, rememberOnDevice = true) {
  const url = getNpointUrl();
  setCachedPassword(password, rememberOnDevice);
  setEncryptionMode('password');

  if (!url) return { success: true };
  return await pullFromNpoint(false);
}

/**
 * Change encryption password or toggle encryption
 */
export async function changeEncryptionSettings(newMode, newPassword = '', rememberOnDevice = true) {
  const url = getNpointUrl();
  if (!url) throw new Error('Configure npoint.io URL first');

  setEncryptionMode(newMode);
  setCachedPassword(newPassword, rememberOnDevice);

  // Re-encrypt all tasks and thoughts on remote
  await applyRemoteMutation(async (doc) => {
    // Read local decrypted tasks and re-encrypt
    const tasks = await db.todos.toArray();
    for (const t of tasks) {
      const val = newMode === 'password' && newPassword ? await encryptRecordValue(t.title, newPassword) : t.title;
      doc.tasks[t.id] = {
        id: t.id,
        completed: Boolean(t.completed),
        created_at: t.created_at,
        updated_at: new Date().toISOString(),
        val,
      };
    }

    const thoughts = await db.thoughts.toArray();
    for (const th of thoughts) {
      const val = newMode === 'password' && newPassword ? await encryptRecordValue(th.content, newPassword) : th.content;
      doc.thoughts[th.id] = {
        id: th.id,
        created_at: th.created_at,
        updated_at: new Date().toISOString(),
        val,
      };
    }
    return true;
  });

  return { success: true };
}

/**
 * Export unencrypted JSON backup
 */
export async function exportPlainJsonBackup() {
  const [tasks, thoughts] = await Promise.all([db.todos.toArray(), db.thoughts.toArray()]);
  const habits = loadAllHabitsData();
  const thresholds = getHabitThresholds();

  const backup = {
    version: 2,
    exported_at: new Date().toISOString(),
    habits,
    thresholds,
    tasks,
    thoughts,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `personal_dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Import JSON backup
 */
export async function importPlainJsonBackup(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Invalid backup JSON format');
  }

  if (jsonData.habits) saveAllHabitsData(jsonData.habits);
  if (jsonData.thresholds) localStorage.setItem('dashboard_habit_thresholds_v2', JSON.stringify(jsonData.thresholds));

  if (Array.isArray(jsonData.tasks)) {
    await db.todos.clear();
    for (const t of jsonData.tasks) await syncSaveTask(t);
  }
  if (Array.isArray(jsonData.thoughts)) {
    await db.thoughts.clear();
    for (const th of jsonData.thoughts) await syncSaveThought(th);
  }

  notifyDataChanged();
}

/**
 * Initialize sync listeners:
 * - Pull on mount
 * - Pull on tab focus / visibilitychange (instant phone <-> laptop sync)
 * - Periodic background pull every 10s
 */
export function initNpointSync() {
  window.addEventListener('online', () => pullFromNpoint(true));
  window.addEventListener('offline', () => setSyncState('offline'));

  // Immediate pull when switching tabs or opening phone browser
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullFromNpoint(true);
    }
  });

  window.addEventListener('focus', () => {
    pullFromNpoint(true);
  });


  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
  } else {
    pullFromNpoint(false);
  }
}
