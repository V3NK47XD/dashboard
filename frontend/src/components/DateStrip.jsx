import React, { useMemo } from 'react';
import { DEFAULT_HABITS, isHabitValid } from '../db/habits';

export default function DateStrip({ selectedDate, onSelectDate, logsMap = new Map() }) {
  // Generate current week window (Monday to Sunday) based on selected date or today
  const weekDays = useMemo(() => {
    const base = new Date(selectedDate || new Date().toISOString().split('T')[0]);
    // Get Monday of that week
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(base.setDate(diff));

    const days = [];
    const weekdaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const iso = cur.toISOString().split('T')[0];
      const log = logsMap.get(iso);

      // Determine completion status using thresholds
      let completedCount = 0;
      if (log) {
        DEFAULT_HABITS.forEach((h) => {
          if (isHabitValid(h, log)) {
            completedCount++;
          }
        });
      }

      days.push({
        iso,
        dateNum: cur.getDate(),
        weekday: weekdaysShort[i],
        isToday: iso === new Date().toISOString().split('T')[0],
        completedCount,
      });
    }
    return days;
  }, [selectedDate, logsMap]);

  return (
    <div className="date-strip-container">
      <div className="date-strip">
        {weekDays.map((d) => {
          const isSelected = selectedDate === d.iso;
          const hasRing = d.completedCount > 0;
          const ringClass = d.completedCount >= 3 ? 'ring-active' : d.completedCount > 0 ? 'ring-partial' : '';

          return (
            <button
              key={d.iso}
              className={`date-strip-item ${isSelected ? 'is-selected' : ''} ${d.isToday ? 'is-today' : ''}`}
              onClick={() => onSelectDate(d.iso)}
            >
              <span>{d.weekday}</span>
              <div className="date-circle">
                {hasRing && <div className={`ring-progress ${ringClass}`} />}
                <span>{d.dateNum}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
