import { triggerDebouncedSync } from '../sync/npointSync';
import { db, generateUUID, getDeviceId } from './database';

let syncTriggerCallback = null;
export function registerSyncTrigger(callback) {
  syncTriggerCallback = callback;
}
function notifySync() {
  if (typeof syncTriggerCallback === 'function') {
    syncTriggerCallback();
  }
  triggerDebouncedSync();
}

export async function getTodos() {
  const all = await db.todos.toArray();
  return all
    .filter((t) => !t.deleted_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createTodo(title) {
  const id = generateUUID();
  const device_id = await getDeviceId();
  const now = new Date().toISOString();

  const record = {
    id,
    title: title.trim(),
    completed: false,
    priority: 'medium',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    server_version: 0,
    device_id,
  };

  await db.todos.put(record);
  notifySync();
  return record;
}

export async function toggleTodo(id) {
  const existing = await db.todos.get(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    completed: !existing.completed,
    updated_at: now,
  };

  await db.todos.put(updated);
  notifySync();
  return updated;
}

export async function updateTodoTitle(id, newTitle) {
  const existing = await db.todos.get(id);
  if (!existing || existing.deleted_at) return null;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    title: newTitle.trim(),
    updated_at: now,
  };

  await db.todos.put(updated);
  notifySync();
  return updated;
}

export async function deleteTodo(id) {
  const existing = await db.todos.get(id);
  if (!existing) return;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    deleted_at: now,
    updated_at: now,
  };

  await db.todos.put(updated);
  notifySync();
}
