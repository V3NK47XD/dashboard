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
export const STORAGE_OFFLINE_QUEUE = 'dashboard_offline_queue_v2';

export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_OFFLINE_QUEUE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading offline queue:', e);
  }
  return [];
}

export function saveOfflineQueue(queue) {
  if (queue && queue.length > 0) {
    localStorage.setItem(STORAGE_OFFLINE_QUEUE, JSON.stringify(queue));
  } else {
    localStorage.removeItem(STORAGE_OFFLINE_QUEUE);
  }
}

export function enqueueOfflineMutation(mutation) {
  const q = getOfflineQueue();
  q.push({
    ...mutation,
    queued_at: new Date().toISOString(),
  });
  saveOfflineQueue(q);
}

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
  if (!doc.salt) doc.salt = generateSalt();
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

  // 1. Habits history & thresholds (support encrypted string token or plain object)
  if (doc.habits) {
    let habitsData = doc.habits;
    if (typeof habitsData === 'string' && habitsData.startsWith('enc:v1:')) {
      habitsData = await decryptRecordValue(habitsData, password);
    }
    if (habitsData && typeof habitsData === 'object') {
      saveAllHabitsData(habitsData);
    }
  }
  if (doc.thresholds) {
    let thresholdsData = doc.thresholds;
    if (typeof thresholdsData === 'string' && thresholdsData.startsWith('enc:v1:')) {
      thresholdsData = await decryptRecordValue(thresholdsData, password);
    }
    if (thresholdsData && typeof thresholdsData === 'object') {
      localStorage.setItem('dashboard_habit_thresholds_v2', JSON.stringify(thresholdsData));
    }
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
      if (encryptionMode === 'password' && password) {
        newDoc.habits = await encryptRecordValue(newDoc.habits, password, newDoc.salt);
        newDoc.thresholds = await encryptRecordValue(newDoc.thresholds, password, newDoc.salt);
      }
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
 * In-memory Promise chain mutex to serialize all remote mutations and prevent race conditions
 */
let mutationQueueChain = Promise.resolve();

function runSerializedMutation(fn) {
  const next = async () => {
    return await fn();
  };
  const resultPromise = mutationQueueChain.then(next, next);
  mutationQueueChain = resultPromise.catch(() => {});
  return resultPromise;
}

/**
 * Fetch-latest-then-update pattern:
 * Serialized through mutex to guarantee zero concurrent overwrite races.
 */
export async function applyRemoteMutation(mutateFn) {
  const url = getNpointUrl();
  if (!url) return null;
  if (!navigator.onLine) {
    setSyncState('offline');
    return null;
  }

  return runSerializedMutation(async () => {
    try {
      isSyncInProgress = true;
      setSyncState('syncing');
      const doc = (await fetchRemoteDoc(url)) || createDefaultDocument();
      const password = getCachedPassword();

      if (!doc.salt) doc.salt = generateSalt();
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
    } finally {
      isSyncInProgress = false;
    }
  });
}

/**
 * Drain queued offline mutations to npoint.io on reconnect or manual poll
 */
export async function drainOfflineQueue() {
  const url = getNpointUrl();
  const queue = getOfflineQueue();

  if (!url || !navigator.onLine) {
    if (queue.length > 0) {
      setSyncState('offline', `Saved locally (${queue.length} pending sync)`);
    } else {
      setSyncState('offline');
    }
    return false;
  }

  if (queue.length === 0) {
    return await pullFromNpoint(true);
  }

  return runSerializedMutation(async () => {
    try {
      isSyncInProgress = true;
      setSyncState('syncing');
      const doc = (await fetchRemoteDoc(url)) || createDefaultDocument();
      const password = getCachedPassword();

      if (!doc.salt) doc.salt = generateSalt();
      const binSalt = doc.salt;

      if (!doc.tasks) doc.tasks = {};
      if (!doc.thoughts) doc.thoughts = {};

      // Unpack habits and thresholds if encrypted
      let currentHabits = doc.habits;
      if (typeof currentHabits === 'string' && currentHabits.startsWith('enc:v1:')) {
        currentHabits = (await decryptRecordValue(currentHabits, password)) || {};
      }
      if (!currentHabits || typeof currentHabits !== 'object') currentHabits = {};

      let currentThresholds = doc.thresholds;
      if (typeof currentThresholds === 'string' && currentThresholds.startsWith('enc:v1:')) {
        currentThresholds = (await decryptRecordValue(currentThresholds, password)) || {};
      }
      if (!currentThresholds || typeof currentThresholds !== 'object') currentThresholds = {};

      for (const m of queue) {
        if (m.type === 'habit_delta') {
          if (!currentHabits[m.catId]) currentHabits[m.catId] = {};
          const curr = currentHabits[m.catId][m.dateIso] || 0;
          currentHabits[m.catId][m.dateIso] = Math.max(0, curr + m.delta);
        } else if (m.type === 'task_save') {
          const val = await encryptRecordValue(m.task.title, password, binSalt);
          doc.tasks[m.task.id] = {
            id: m.task.id,
            completed: Boolean(m.task.completed),
            created_at: m.task.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            val,
          };
        } else if (m.type === 'task_toggle') {
          if (doc.tasks?.[m.taskId]) {
            doc.tasks[m.taskId].completed = !doc.tasks[m.taskId].completed;
            doc.tasks[m.taskId].updated_at = new Date().toISOString();
          }
        } else if (m.type === 'task_remove') {
          if (doc.tasks?.[m.taskId]) {
            delete doc.tasks[m.taskId];
          }
        } else if (m.type === 'thought_save') {
          const val = await encryptRecordValue(m.thought.content, password, binSalt);
          doc.thoughts[m.thought.id] = {
            id: m.thought.id,
            created_at: m.thought.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            val,
          };
        } else if (m.type === 'thought_remove') {
          if (doc.thoughts?.[m.thoughtId]) {
            delete doc.thoughts[m.thoughtId];
          }
        } else if (m.type === 'threshold_update') {
          currentThresholds[m.catId] = Number(m.newThresh);
        }
      }

      doc.habits = password ? await encryptRecordValue(currentHabits, password, binSalt) : currentHabits;
      doc.thresholds = password ? await encryptRecordValue(currentThresholds, password, binSalt) : currentThresholds;

      await pushRemoteDoc(url, doc);
      saveOfflineQueue([]);
      await overwriteDeviceFromDoc(doc, password);
      setSyncState('synced');
      return true;
    } catch (err) {
      console.warn('[Sync] Drain queue retry later:', err);
      setSyncState('offline', `Saved locally (${queue.length} pending sync)`);
      return false;
    } finally {
      isSyncInProgress = false;
    }
  });
}



/**
 * Mutator: Add or edit task (writes locally immediately, syncs or queues)
 */
export async function syncSaveTask(task) {
  // 1. Immediate local write (works 100% offline)
  await db.todos.put(task);
  notifyDataChanged();

  // 2. Network sync or queue
  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'task_save', task });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc, password) => {
      doc.salt = doc.salt || generateSalt();
      const encryptedVal = await encryptRecordValue(task.title, password, doc.salt);
      doc.tasks[task.id] = {
        id: task.id,
        completed: Boolean(task.completed),
        created_at: task.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        val: encryptedVal,
      };
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Task save queued offline:', err);
    enqueueOfflineMutation({ type: 'task_save', task });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
}

/**
 * Mutator: Toggle task (writes locally immediately, syncs or queues)
 */
export async function syncToggleTask(taskId) {
  const existing = await db.todos.get(taskId);
  if (!existing) return;

  const updated = { ...existing, completed: !existing.completed, updated_at: new Date().toISOString() };
  await db.todos.put(updated);
  notifyDataChanged();

  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'task_toggle', taskId });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc) => {
      if (!doc.tasks || !doc.tasks[taskId]) return false;
      doc.tasks[taskId].completed = updated.completed;
      doc.tasks[taskId].updated_at = updated.updated_at;
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Task toggle queued offline:', err);
    enqueueOfflineMutation({ type: 'task_toggle', taskId });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
}

/**
 * Mutator: Remove task (writes locally immediately, syncs or queues)
 */
export async function syncRemoveTask(taskId) {
  await db.todos.delete(taskId);
  notifyDataChanged();

  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'task_remove', taskId });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc) => {
      if (doc.tasks && doc.tasks[taskId]) {
        delete doc.tasks[taskId];
      }
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Task remove queued offline:', err);
    enqueueOfflineMutation({ type: 'task_remove', taskId });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
}

/**
 * Mutator: Add or edit thought (writes locally immediately, syncs or queues)
 */
export async function syncSaveThought(thought) {
  await db.thoughts.put(thought);
  notifyDataChanged();

  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'thought_save', thought });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc, password) => {
      doc.salt = doc.salt || generateSalt();
      const encryptedVal = await encryptRecordValue(thought.content, password, doc.salt);
      doc.thoughts[thought.id] = {
        id: thought.id,
        created_at: thought.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        val: encryptedVal,
      };
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Thought save queued offline:', err);
    enqueueOfflineMutation({ type: 'thought_save', thought });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
}

/**
 * Mutator: Remove thought (writes locally immediately, syncs or queues)
 */
export async function syncRemoveThought(thoughtId) {
  await db.thoughts.delete(thoughtId);
  notifyDataChanged();

  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'thought_remove', thoughtId });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc) => {
      if (doc.thoughts && doc.thoughts[thoughtId]) {
        delete doc.thoughts[thoughtId];
      }
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Thought remove queued offline:', err);
    enqueueOfflineMutation({ type: 'thought_remove', thoughtId });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
}

/**
 * Mutator: Adjust habit for today (writes locally immediately, syncs or queues)
 */
export async function syncAdjustHabitToday(catId, delta) {
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // 1. Always update local habits store immediately (100% offline functional)
  const habits = loadAllHabitsData();
  if (!habits[catId]) habits[catId] = {};
  const currentLocal = habits[catId][todayIso] || 0;
  const localNext = Math.max(0, currentLocal + delta);
  habits[catId][todayIso] = localNext;
  saveAllHabitsData(habits);
  notifyDataChanged();

  // 2. Network sync or queue
  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'habit_delta', catId, delta, dateIso: todayIso });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return localNext;
  }

  try {
    await applyRemoteMutation(async (doc, password) => {
      doc.salt = doc.salt || generateSalt();
      let habitsMap = doc.habits;
      if (typeof habitsMap === 'string' && habitsMap.startsWith('enc:v1:')) {
        habitsMap = (await decryptRecordValue(habitsMap, password)) || {};
      }
      if (!habitsMap || typeof habitsMap !== 'object') habitsMap = {};

      if (!habitsMap[catId]) habitsMap[catId] = {};
      const currentRemote = habitsMap[catId][todayIso] || 0;
      habitsMap[catId][todayIso] = Math.max(0, currentRemote + delta);

      doc.habits = password ? await encryptRecordValue(habitsMap, password, doc.salt) : habitsMap;
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Habit delta queued offline:', err);
    enqueueOfflineMutation({ type: 'habit_delta', catId, delta, dateIso: todayIso });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }

  return localNext;
}

/**
 * Mutator: Update habit threshold (writes locally immediately, syncs or queues)
 */
export async function syncUpdateThreshold(catId, newThresh) {
  setHabitThreshold(catId, newThresh);
  notifyDataChanged();

  const url = getNpointUrl();
  if (!url || !navigator.onLine) {
    enqueueOfflineMutation({ type: 'threshold_update', catId, newThresh });
    setSyncState('offline', 'Saved locally (queued for sync)');
    return;
  }

  try {
    await applyRemoteMutation(async (doc, password) => {
      doc.salt = doc.salt || generateSalt();
      let threshMap = doc.thresholds;
      if (typeof threshMap === 'string' && threshMap.startsWith('enc:v1:')) {
        threshMap = (await decryptRecordValue(threshMap, password)) || {};
      }
      if (!threshMap || typeof threshMap !== 'object') threshMap = {};

      threshMap[catId] = Number(newThresh);
      doc.thresholds = password ? await encryptRecordValue(threshMap, password, doc.salt) : threshMap;
      return true;
    });
  } catch (err) {
    console.warn('[Sync] Threshold update queued offline:', err);
    enqueueOfflineMutation({ type: 'threshold_update', catId, newThresh });
    setSyncState('offline', 'Saved locally (queued for sync)');
  }
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

  const offlineQueue = getOfflineQueue();
  if (offlineQueue.length > 0) {
    return await drainOfflineQueue();
  }

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
  return await drainOfflineQueue();
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

  // Re-encrypt all tasks, thoughts, habits, and thresholds on remote
  await applyRemoteMutation(async (doc) => {
    doc.salt = generateSalt();
    const binSalt = doc.salt;
    const isEnc = newMode === 'password' && Boolean(newPassword);

    // Habits & Thresholds
    const localHabits = loadAllHabitsData();
    const localThresholds = getHabitThresholds();
    doc.habits = isEnc ? await encryptRecordValue(localHabits, newPassword, binSalt) : localHabits;
    doc.thresholds = isEnc ? await encryptRecordValue(localThresholds, newPassword, binSalt) : localThresholds;

    // Read local decrypted tasks and re-encrypt
    const tasks = await db.todos.toArray();
    for (const t of tasks) {
      const val = isEnc ? await encryptRecordValue(t.title, newPassword, binSalt) : t.title;
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
      const val = isEnc ? await encryptRecordValue(th.content, newPassword, binSalt) : th.content;
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
  window.addEventListener('online', () => drainOfflineQueue());
  window.addEventListener('offline', () => {
    const q = getOfflineQueue();
    setSyncState('offline', q.length > 0 ? `Saved locally (${q.length} pending sync)` : '');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      drainOfflineQueue();
    }
  });

  window.addEventListener('focus', () => {
    drainOfflineQueue();
  });

  const url = getNpointUrl();
  if (!url) {
    setSyncState('needs_setup');
  } else {
    drainOfflineQueue();
  }
}
