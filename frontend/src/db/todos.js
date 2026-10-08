import {
  syncSaveTask,
  syncToggleTask,
  syncRemoveTask,
} from '../sync/npointSync';
import { db, generateUUID, getDeviceId } from './database';

export async function getTodos() {
  const all = await db.todos.toArray();
  return all
    .filter((t) => !t.deleted_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createTodo(title) {
  if (!title || !title.trim()) return null;
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

  await syncSaveTask(record);
  return record;
}

export async function toggleTodo(id) {
  const existing = await db.todos.get(id);
  if (!existing) return null;

  await syncToggleTask(id);
  return { ...existing, completed: !existing.completed };
}

export async function updateTodoTitle(id, newTitle) {
  const existing = await db.todos.get(id);
  if (!existing || existing.deleted_at) return null;

  const updated = {
    ...existing,
    title: newTitle.trim(),
    updated_at: new Date().toISOString(),
  };

  await syncSaveTask(updated);
  return updated;
}

export async function deleteTodo(id) {
  await syncRemoveTask(id);
}
