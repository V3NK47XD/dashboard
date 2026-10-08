import React, { useMemo } from 'react';
import { getHabitIntensity, isHabitValid } from '../db/habits';

export default function HabitCard({
  habit,
  selectedDate,
  streak = 0,
  onAdjustCounter,
  onOpenNote,
  logsMap = new Map(),
  weeksCount = 20,
}) {
  const { id, title, icon, colorTheme = 'habit-yellow', formatValue, formatTarget, threshold, step, metricField } = habit;

  // Current day value & validity
  const currentDayLog = logsMap.get(selectedDate);
  const currentVal = currentDayLog ? currentDayLog[metricField] || 0 : 0;
  const isValid = currentVal >= threshold;

  // Generate 7 rows x weeksCount columns pixel grid ending at today/this week
  const pixelWeeks = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - dayOfWeek));

    const totalDays = weeksCount * 7;
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (totalDays - 1));

    const weeks = [];
    const cur = new Date(startDate);

    for (let w = 0; w < weeksCount; w++) {
      const daysInWeek = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().split('T')[0];
        const log = logsMap.get(iso);
        const intensity = getHabitIntensity(habit, log);
        const dayVal = log ? log[metricField] || 0 : 0;

        daysInWeek.push({
          iso,
          intensity,
          dayVal,
          isFuture: cur > today,
        });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(daysInWeek);
    }
    return weeks;
  }, [logsMap, habit, weeksCount, metricField]);

  return (
    <div className={`habit-card ${colorTheme}`}>
      {/* Top Header */}
      <div className="habit-card-header">
        <div className="habit-card-left">
          <div className="habit-icon-avatar">
            <span>{icon}</span>
          </div>
          <div>
            <div className="habit-title">{title}</div>
            <div className="habit-streak">
              🔥 Streak: {streak} day{streak === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div className="habit-card-right">
          {/* Note / Journal Icon Button */}
          <button
            className="note-btn"
            onClick={() => onOpenNote && onOpenNote(habit)}
            title="Add note / journal entry"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </button>

          {/* Stepper Counter Control with + and - buttons */}
          <div className={`habit-counter-control ${isValid ? 'is-valid' : ''}`}>
            <div className="counter-info">
              <span className="counter-value-text">
                {formatValue ? formatValue(currentVal) : currentVal}
              </span>
              <span className={`counter-target-badge ${isValid ? 'achieved' : ''}`}>
                {isValid ? `Target ${formatTarget} ✓` : `Goal: ${formatTarget}`}
              </span>
            </div>

            <div className="counter-actions">
              {/* Decrement Button */}
              <button
                type="button"
                className="counter-btn"
                onClick={() => onAdjustCounter && onAdjustCounter(habit, -step)}
                title={`Subtract ${step}`}
                disabled={currentVal <= 0}
                style={{ opacity: currentVal <= 0 ? 0.35 : 1, cursor: currentVal <= 0 ? 'not-allowed' : 'pointer' }}
              >
                −
              </button>

              {/* Increment Button */}
              <button
                type="button"
                className="counter-btn btn-plus"
                onClick={() => onAdjustCounter && onAdjustCounter(habit, step)}
                title={`Add ${step}`}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Pixel Contribution Heatmap with 5-Level Light-to-Dark Gradient */}
      <div className="card-heatmap-wrapper">
        <div className="card-pixel-grid">
          {pixelWeeks.map((week, wIdx) =>
            week.map((day) => (
              <div
                key={day.iso}
                className={`card-pixel level-${day.intensity}`}
                style={day.isFuture ? { opacity: 0.25 } : {}}
                title={`${day.iso}: ${day.dayVal} (${day.intensity >= 3 ? 'Target reached' : day.intensity > 0 ? 'Partial' : 'No activity'})`}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
