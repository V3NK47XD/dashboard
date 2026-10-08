import {
  syncSaveThought,
  syncRemoveThought,
} from '../sync/npointSync';
import { db, generateUUID, getDeviceId } from './database';

export async function getThoughts() {
  const all = await db.thoughts.toArray();
  return all
    .filter((t) => !t.deleted_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createThought(content) {
  if (!content || !content.trim()) return null;

  const id = generateUUID();
  const device_id = await getDeviceId();
  const now = new Date().toISOString();

  const record = {
    id,
    content: content.trim(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    server_version: 0,
    device_id,
  };

  await syncSaveThought(record);
  return record;
}

export async function deleteThought(id) {
  await syncRemoveThought(id);
}

export async function searchThoughtsLocally(query) {
  if (!query || !query.trim()) return getThoughts();
  const q = query.toLowerCase();
  const all = await db.thoughts.toArray();
  return all
    .filter((t) => !t.deleted_at && t.content && t.content.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
