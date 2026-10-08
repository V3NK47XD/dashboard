import Dexie from 'dexie';

export const db = new Dexie('PersonalDashboardDB');

db.version(1).stores({
  todos: 'id, created_at, updated_at, deleted_at, server_version, completed',
  thoughts: 'id, created_at, updated_at, deleted_at, server_version',
  daily_logs: 'id, date, created_at, updated_at, deleted_at, server_version',
  sync_outbox: 'operation_id, entity_type, entity_id, status, created_at',
  sync_meta: 'key',
});

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId() {
  try {
    const entry = await db.sync_meta.get('device_id');
    if (entry && entry.value) {
      return entry.value;
    }
    const newId = `dev-${generateUUID().slice(0, 12)}`;
    await db.sync_meta.put({ key: 'device_id', value: newId });
    return newId;
  } catch {
    return 'browser-client';
  }
}

export async function getMeta(key, defaultValue = null) {
  try {
    const entry = await db.sync_meta.get(key);
    return entry ? entry.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setMeta(key, value) {
  try {
    await db.sync_meta.put({ key, value });
  } catch (err) {
    console.error('Error setting meta', key, err);
  }
}
