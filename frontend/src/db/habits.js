/**
 * 8 Core Habit Categories with 1-Year History & Dynamic Thresholds
 * 
 * Categories:
 * 1. Workout
 * 2. Wakeup on alarm
 * 3. Water
 * 4. Code
 * 5. Learn
 * 6. Protein
 * 7. Fiber
 * 8. NoGoon
 * 
 * - Each stores 1 year of daily history: { "YYYY-MM-DD": number }
 * - Stepper (+ / −) updates ONLY the current day
 * - Monthly heatmap view with "View More" for past months
 */

export const HABIT_CATEGORIES = [
  {
    id: 'workout',
    title: 'Workout',
    icon: '🏋️',
    colorTheme: 'habit-yellow',
    accentColor: '#facc15',
    unit: 'min',
    step: 5,
    defaultThreshold: 30,
    formatValue: (val) => `${val || 0}m`,
  },
  {
    id: 'alarm',
    title: 'Wakeup on alarm',
    icon: '⏰',
    colorTheme: 'habit-emerald',
    accentColor: '#10b981',
    unit: 'time',
    step: 1,
    defaultThreshold: 1,
    formatValue: (val) => (val >= 1 ? 'Awake ✓' : 'Missed'),
  },
  {
    id: 'water',
    title: 'Water',
    icon: '💧',
    colorTheme: 'habit-blue',
    accentColor: '#38bdf8',
    unit: 'ml',
    step: 250,
    defaultThreshold: 2000,
    formatValue: (val) => `${val || 0}ml`,
  },
  {
    id: 'code',
    title: 'Code',
    icon: '💻',
    colorTheme: 'habit-teal',
    accentColor: '#2dd4bf',
    unit: 'problems',
    step: 1,
    defaultThreshold: 2,
    formatValue: (val) => `${val || 0} solved`,
  },
  {
    id: 'learn',
    title: 'Learn',
    icon: '📚',
    colorTheme: 'habit-purple',
    accentColor: '#a855f7',
    unit: 'min',
    step: 5,
    defaultThreshold: 45,
    formatValue: (val) => `${val || 0}m`,
  },
  {
    id: 'protein',
    title: 'Protein',
    icon: '🥩',
    colorTheme: 'habit-coral',
    accentColor: '#fb7185',
    unit: 'g',
    step: 3,
    defaultThreshold: 120,
    formatValue: (val) => `${val || 0}g`,
  },
  {
    id: 'fiber',
    title: 'Fiber',
    icon: '🥗',
    colorTheme: 'habit-green',
    accentColor: '#4ade80',
    unit: 'g',
    step: 3,
    defaultThreshold: 30,
    formatValue: (val) => `${val || 0}g`,
  },
  {
    id: 'nogoon',
    title: 'NoGoon',
    icon: '🛡️',
    colorTheme: 'habit-violet',
    accentColor: '#c084fc',
    unit: 'clean',
    step: 1,
    defaultThreshold: 1,
    formatValue: (val) => (val >= 1 ? 'Clean ✓' : '0'),
  },
  {
    id: 'sleep',
    title: 'Sleep Time',
    icon: '🌙',
    colorTheme: 'habit-indigo',
    accentColor: '#818cf8',
    unit: 'h',
    step: 1,
    defaultThreshold: 8,
    formatValue: (val) => `${val || 0}h`,
  },
  {
    id: 'idle',
    title: 'Idle Time',
    icon: '⏳',
    colorTheme: 'habit-amber',
    accentColor: '#f59e0b',
    unit: 'h',
    step: 1,
    defaultThreshold: 2,
    formatValue: (val) => `${val || 0}h`,
  },
];

export const STORAGE_HABIT_DATA = 'dashboard_habits_store_v2';
export const STORAGE_HABIT_THRESHOLDS = 'dashboard_habit_thresholds_v2';
export const STORAGE_HABIT_STEPS = 'dashboard_habit_steps_v2';
/**
 * Get current date ISO string (YYYY-MM-DD)
 */
export function getTodayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Load thresholds from localStorage with defaults
 */
export function getHabitThresholds() {
  let thresholds = {};
  try {
    const raw = localStorage.getItem(STORAGE_HABIT_THRESHOLDS);
    if (raw) thresholds = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading thresholds:', e);
  }
  HABIT_CATEGORIES.forEach((cat) => {
    if (thresholds[cat.id] === undefined) {
      thresholds[cat.id] = cat.defaultThreshold;
    }
  });
  return thresholds;
}

/**
 * Save threshold for a category
 */
export function setHabitThreshold(catId, newThreshold) {
  const current = getHabitThresholds();
  current[catId] = Math.max(1, Number(newThreshold) || 1);
  localStorage.setItem(STORAGE_HABIT_THRESHOLDS, JSON.stringify(current));
  return current;
}

/**
 * Load increment steps from localStorage with defaults
 */
export function getHabitSteps() {
  let steps = {};
  try {
    const raw = localStorage.getItem(STORAGE_HABIT_STEPS);
    if (raw) steps = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading steps:', e);
  }
  HABIT_CATEGORIES.forEach((cat) => {
    if (steps[cat.id] === undefined) {
      steps[cat.id] = cat.step;
    }
  });
  return steps;
}

/**
 * Save increment step for a category
 */
export function setHabitStep(catId, newStep) {
  const current = getHabitSteps();
  current[catId] = Math.max(1, Number(newStep) || 1);
  localStorage.setItem(STORAGE_HABIT_STEPS, JSON.stringify(current));
  return current;
}

/**
 * Load all habits 1-year history:
 * {
 *   [catId]: {
 *     [dateIso]: number
 *   }
 * }
 */
export function loadAllHabitsData() {
  let data = {};
  try {
    const raw = localStorage.getItem(STORAGE_HABIT_DATA);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading habits data:', e);
  }
  HABIT_CATEGORIES.forEach((cat) => {
    if (!data[cat.id]) data[cat.id] = {};
  });
  return data;
}

/**
 * Save all habits history to localStorage
 */
export function saveAllHabitsData(data) {
  localStorage.setItem(STORAGE_HABIT_DATA, JSON.stringify(data));
}

/**
 * Get the count for a specific category and date
 */
export function getCategoryDateCount(catId, dateIso = getTodayIso()) {
  const data = loadAllHabitsData();
  return (data[catId] && data[catId][dateIso]) || 0;
}

/**
 * Update today's count for a category (strictly today only)
 */
export function adjustTodayCategoryCount(catId, delta) {
  const today = getTodayIso();
  const data = loadAllHabitsData();
  if (!data[catId]) data[catId] = {};

  const current = data[catId][today] || 0;
  const nextVal = Math.max(0, current + delta);
  data[catId][today] = nextVal;

  saveAllHabitsData(data);
  return nextVal;
}

/**
 * Compute intensity level (0 to 4) relative to threshold
 */
export function getIntensityLevel(val, threshold) {
  if (!val || val <= 0) return 0;
  const ratio = val / (threshold || 1);
  if (ratio < 0.4) return 1;
  if (ratio < 0.8) return 2;
  if (ratio < 1.2) return 3;
  return 4;
}

/**
 * Compute streak for a habit category
 */
export function calculateCategoryStreak(catId, historyMap = null, threshold = null) {
  const history = historyMap || (loadAllHabitsData()[catId] || {});
  const thresh = threshold !== null ? threshold : (getHabitThresholds()[catId] || 1);

  const today = getTodayIso();
  let streak = 0;
  const curr = new Date();

  // If today is completed, start from today; otherwise check starting from yesterday
  const todayVal = history[today] || 0;
  let checkDate = new Date(curr.getTime());
  if (todayVal < thresh) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const y = checkDate.getFullYear();
    const m = String(checkDate.getMonth() + 1).padStart(2, '0');
    const d = String(checkDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const val = history[dateStr] || 0;
    if (val >= thresh) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get days array for a specific month (year, month: 1-12)
 * for rendering the LeetCode heatmap grid
 */
export function getMonthHeatmapDays(year, month, catHistory, threshold) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dateIso = `${year}-${monthStr}-${dayStr}`;

    const val = (catHistory && catHistory[dateIso]) || 0;
    const intensity = getIntensityLevel(val, threshold);

    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon ...

    days.push({
      day,
      dateIso,
      val,
      intensity,
      isValid: val >= threshold,
      dayOfWeek,
    });
  }

  return days;
}

/**
 * Get past available months list for "View More"
 */
export function getPastMonthsList(count = 12) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1, // 1-12
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    });
  }
  return list;
}
