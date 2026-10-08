import React, { useMemo } from 'react';
import { getHabitIntensity, isHabitValid } from '../db/habits';

export default function HabitMatrix({
  habits = [],
  logsMap = new Map(),
  daysCount = 18,
  selectedDate,
  onSelectDate,
  onToggleHabitDate,
}) {
  // Generate date columns ending at today
  const dateColumns = useMemo(() => {
    const today = new Date();
    const cols = [];
    const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cur = new Date(today);
    cur.setDate(today.getDate() - (daysCount - 1));

    for (let i = 0; i < daysCount; i++) {
      const iso = cur.toISOString().split('T')[0];
      cols.push({
        iso,
        dateNum: cur.getDate(),
        weekday: weekdaysShort[cur.getDay()],
        isToday: iso === today.toISOString().split('T')[0],
      });
      cur.setDate(cur.getDate() + 1);
    }
    return cols;
  }, [daysCount]);

  return (
    <div className="matrix-container">
      <table className="matrix-table">
        <thead>
          <tr>
            <th style={{ padding: '0.5rem', textAlign: 'left' }}>
              <span className="matrix-habit-header-pill">Habits</span>
            </th>
            {dateColumns.map((col) => (
              <th
                key={col.iso}
                className="matrix-header-cell"
                onClick={() => onSelectDate && onSelectDate(col.iso)}
                style={{ cursor: 'pointer' }}
              >
                <div className="matrix-weekday">{col.weekday}</div>
                <div
                  className={`matrix-date-circle ${col.isToday ? 'is-today' : ''}`}
                  style={selectedDate === col.iso ? { outline: '2px solid #facc15' } : {}}
                >
                  {col.dateNum}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => {
            const pixelColorClass = `pixel-${habit.colorTheme.replace('habit-', '')}`;

            return (
              <tr key={habit.id}>
                {/* Habit Label Pill */}
                <td style={{ padding: '0.4rem 0.6rem 0.4rem 0' }}>
                  <div className="matrix-habit-pill">
                    <span>{habit.icon}</span>
                    <span>{habit.title}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      ({habit.formatTarget})
                    </span>
                  </div>
                </td>

                {/* Pixel Blocks with 5-Level Light-to-Dark Gradient */}
                {dateColumns.map((col) => {
                  const log = logsMap.get(col.iso);
                  const intensity = getHabitIntensity(habit, log);
                  const val = log ? log[habit.metricField] || 0 : 0;
                  const valid = isHabitValid(habit, log);

                  return (
                    <td key={col.iso} style={{ padding: '2px' }}>
                      <div
                        className={`matrix-pixel ${pixelColorClass} level-${intensity}`}
                        title={`${habit.title} on ${col.iso}: ${habit.formatValue(val)} (Target: ${habit.formatTarget}) - ${valid ? 'Goal Met ✓' : 'Incomplete'}`}
                        onClick={() => onToggleHabitDate && onToggleHabitDate(habit, col.iso)}
                      >
                        {intensity >= 3 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: intensity === 4 ? '#000' : 'inherit' }}>
                            ✓
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
