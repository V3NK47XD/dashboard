import { triggerDebouncedSync } from '../sync/npointSync';
import { db, generateUUID, getDeviceId } from './database';

let syncTriggerCallback = null;
export function registerDailySyncTrigger(callback) {
  syncTriggerCallback = callback;
}
function notifySync() {
  if (typeof syncTriggerCallback === 'function') {
    syncTriggerCallback();
  }
  triggerDebouncedSync();
}

export const DEFAULT_DAILY_METRICS = {
  sleep_minutes: 0,
  water_ml: 0,
  protein_g: 0,
  fiber_g: 0,
  sugar_g: 0,
  learning_minutes: 0,
  exercise_minutes: 0,
  leetcode_solved: 0,
};

export async function getDailyLogs() {
  const all = await db.daily_logs.toArray();
  return all
    .filter((l) => !l.deleted_at)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDailyLogByDate(date) {
  const existing = await db.daily_logs.where('date').equals(date).first();
  if (existing && !existing.deleted_at) {
    return existing;
  }
  return {
    id: null,
    date,
    ...DEFAULT_DAILY_METRICS,
    server_version: 0,
  };
}

export async function saveDailyMetrics(date, metrics) {
  const existing = await db.daily_logs.where('date').equals(date).first();
  const now = new Date().toISOString();
  const device_id = await getDeviceId();

  let record;

  if (!existing || existing.deleted_at) {
    const id = existing ? existing.id : generateUUID();
    record = {
      id,
      date,
      ...DEFAULT_DAILY_METRICS,
      ...metrics,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      deleted_at: null,
      server_version: existing ? existing.server_version : 0,
      device_id,
    };
  } else {
    record = {
      ...existing,
      ...metrics,
      updated_at: now,
      device_id,
    };
  }

  await db.daily_logs.put(record);
  notifySync();
  return record;
}
