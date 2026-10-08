import { getDailyLogs, getDailyLogByDate, saveDailyMetrics } from './daily';

export const DEFAULT_HABITS = [
  {
    id: 'gym',
    title: 'Go To Gym',
    icon: '🏋️',
    colorTheme: 'habit-yellow',
    metricField: 'exercise_minutes',
    threshold: 30, // 30 mins to be considered valid
    step: 15, // +15m or -15m
    unit: 'min',
    formatValue: (val) => `${val || 0}m`,
    formatTarget: '30m',
  },
  {
    id: 'skincare',
    title: 'Do Skincare',
    icon: '✨',
    colorTheme: 'habit-coral',
    metricField: 'fiber_g', // Using fiber_g as routine steps / skincare counter
    threshold: 2, // 2 routines (morning + night)
    step: 1, // +1 or -1
    unit: 'steps',
    formatValue: (val) => `${val || 0} steps`,
    formatTarget: '2 steps',
  },
  {
    id: 'early_rise',
    title: 'Early Rise',
    icon: '🌅',
    colorTheme: 'habit-emerald',
    metricField: 'sleep_minutes',
    threshold: 420, // 7.0 hours (420 mins)
    step: 30, // +30m or -30m
    unit: 'hrs',
    formatValue: (val) => `${((val || 0) / 60).toFixed(1)}h`,
    formatTarget: '7.0h',
  },
  {
    id: 'code_daily',
    title: 'Code Daily',
    icon: '💻',
    colorTheme: 'habit-teal',
    metricField: 'leetcode_solved',
    threshold: 2, // 2 problems
    step: 1, // +1 or -1
    unit: 'problems',
    formatValue: (val) => `${val || 0} solved`,
    formatTarget: '2 solved',
  },
  {
    id: 'hydrate',
    title: 'Hydrate Daily',
    icon: '💧',
    colorTheme: 'habit-blue',
    metricField: 'water_ml',
    threshold: 2000, // 2000 ml (approx 8 glasses)
    step: 250, // +250ml or -250ml (1 glass)
    unit: 'ml',
    formatValue: (val) => `${val || 0}ml`,
    formatTarget: '2000ml',
  },
  {
    id: 'learning',
    title: 'Study & Learn',
    icon: '📚',
    colorTheme: 'habit-purple',
    metricField: 'learning_minutes',
    threshold: 45, // 45 mins
    step: 15, // +15m or -15m
    unit: 'min',
    formatValue: (val) => `${val || 0}m`,
    formatTarget: '45m',
  },
];

/**
 * Returns intensity level 0 to 4 based on counter value relative to threshold:
 * 0: 0 / none
 * 1: >0 and < 40% of threshold (light shade)
 * 2: 40% to 79% of threshold (medium-light shade)
 * 3: 80% to 119% of threshold (target reached / valid! rich vibrant shade)
 * 4: >= 120% of threshold (exceeded target! deepest / max glowing shade)
 */
export function getHabitIntensity(habit, log) {
  if (!log) return 0;
  const val = log[habit.metricField] || 0;
  if (val <= 0) return 0;

  const threshold = habit.threshold || 1;
  const ratio = val / threshold;

  if (ratio < 0.4) {
    return 1;
  } else if (ratio < 0.8) {
    return 2;
  } else if (ratio < 1.2) {
    return 3;
  } else {
    return 4;
  }
}

/**
 * Determines whether a habit is considered valid on a given day based on the threshold
 */
export function isHabitValid(habit, log) {
  if (!log) return false;
  const val = log[habit.metricField] || 0;
  return val >= (habit.threshold || 1);
}

/**
 * Calculates current consecutive streak for a specific habit (must meet threshold)
 */
export function calculateHabitStreak(habit, logsMap) {
  let streak = 0;
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestIso = yest.toISOString().split('T')[0];

  const todayLog = logsMap.get(todayIso);
  const yestLog = logsMap.get(yestIso);

  const doneToday = todayLog && isHabitValid(habit, todayLog);
  const doneYest = yestLog && isHabitValid(habit, todayLog);

  if (!doneToday && !doneYest) {
    return 0;
  }

  const startDate = doneToday ? today : yest;
  const cur = new Date(startDate);

  while (true) {
    const iso = cur.toISOString().split('T')[0];
    const log = logsMap.get(iso);
    if (log && isHabitValid(habit, log)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Adjusts counter by delta (+step or -step) for a specific date
 */
export async function adjustHabitCounter(habit, date, delta) {
  const currentLog = await getDailyLogByDate(date);
  const currentVal = currentLog[habit.metricField] || 0;
  const newVal = Math.max(0, currentVal + delta);
  const updates = { [habit.metricField]: newVal };
  const updatedLog = await saveDailyMetrics(date, updates);
  return updatedLog;
}

/**
 * Toggles habit completion directly to threshold (or resets to 0 if already valid)
 */
export async function toggleHabitForDate(habit, date) {
  const currentLog = await getDailyLogByDate(date);
  const currentVal = currentLog[habit.metricField] || 0;
  const isValid = currentVal >= habit.threshold;
  const newVal = isValid ? 0 : habit.threshold;
  const updates = { [habit.metricField]: newVal };
  const updatedLog = await saveDailyMetrics(date, updates);
  return updatedLog;
}
