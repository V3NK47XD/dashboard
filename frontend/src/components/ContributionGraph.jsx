import React, { useState, useMemo } from 'react';

const METRICS = [
  { id: 'overall', label: 'Overall' },
  { id: 'sleep_minutes', label: 'Sleep' },
  { id: 'water_ml', label: 'Water' },
  { id: 'protein_g', label: 'Protein' },
  { id: 'fiber_g', label: 'Fiber' },
  { id: 'learning_minutes', label: 'Learning' },
  { id: 'exercise_minutes', label: 'Exercise' },
  { id: 'leetcode_solved', label: 'LeetCode' },
];

export function getMetricIntensity(metric, log) {
  if (!log) return 0;
  if (metric === 'overall') {
    let score = 0;
    let count = 0;
    const sub = [
      getMetricIntensity('sleep_minutes', log),
      getMetricIntensity('water_ml', log),
      getMetricIntensity('protein_g', log),
      getMetricIntensity('fiber_g', log),
      getMetricIntensity('learning_minutes', log),
      getMetricIntensity('exercise_minutes', log),
      getMetricIntensity('leetcode_solved', log),
    ];
    sub.forEach((s) => {
      if (s > 0) {
        score += s;
        count++;
      }
    });
    if (count === 0) return 0;
    const avg = score / 7;
    if (avg >= 2.5) return 4;
    if (avg >= 1.8) return 3;
    if (avg >= 1.0) return 2;
    return 1;
  }

  const val = log[metric] || 0;
  switch (metric) {
    case 'sleep_minutes':
      if (val >= 480) return 4; // 8h+
      if (val >= 420) return 3; // 7h+
      if (val >= 360) return 2; // 6h+
      if (val > 0) return 1;
      return 0;
    case 'water_ml':
      if (val >= 3000) return 4;
      if (val >= 2000) return 3;
      if (val >= 1000) return 2;
      if (val > 0) return 1;
      return 0;
    case 'protein_g':
      if (val >= 140) return 4;
      if (val >= 100) return 3;
      if (val >= 50) return 2;
      if (val > 0) return 1;
      return 0;
    case 'fiber_g':
      if (val >= 35) return 4;
      if (val >= 25) return 3;
      if (val >= 15) return 2;
      if (val > 0) return 1;
      return 0;
    case 'learning_minutes':
      if (val >= 120) return 4;
      if (val >= 60) return 3;
      if (val >= 30) return 2;
      if (val > 0) return 1;
      return 0;
    case 'exercise_minutes':
      if (val >= 60) return 4;
      if (val >= 45) return 3;
      if (val >= 20) return 2;
      if (val > 0) return 1;
      return 0;
    case 'leetcode_solved':
      if (val >= 4) return 4;
      if (val >= 3) return 3;
      if (val >= 2) return 2;
      if (val >= 1) return 1;
      return 0;
    default:
      return 0;
  }
}

function formatMetricValue(metric, val) {
  if (val === undefined || val === null) return '0';
  switch (metric) {
    case 'sleep_minutes':
      return `${Math.floor(val / 60)}h ${val % 60}m`;
    case 'water_ml':
      return `${val} ml`;
    case 'protein_g':
      return `${val} g`;
    case 'fiber_g':
      return `${val} g`;
    case 'learning_minutes':
      return `${val} min`;
    case 'exercise_minutes':
      return `${val} min`;
    case 'leetcode_solved':
      return `${val} problems`;
    default:
      return `${val}`;
  }
}

export default function ContributionGraph({ logs = [], onSelectDate, selectedDate }) {
  const [selectedMetric, setSelectedMetric] = useState('overall');
  const [hoveredDay, setHoveredDay] = useState(null);

  // Map logs by date (YYYY-MM-DD)
  const logMap = useMemo(() => {
    const map = new Map();
    logs.forEach((log) => {
      if (log.date) {
        map.set(log.date, log);
      }
    });
    return map;
  }, [logs]);

  // Generate 52 weeks up to today
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    // End on upcoming Saturday or today
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - dayOfWeek));

    // 52 weeks = 364 days
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 364);

    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = cur.toISOString().split('T')[0];
      const log = logMap.get(dateStr);
      const intensity = getMetricIntensity(selectedMetric, log);
      days.push({
        date: dateStr,
        intensity,
        log,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [logMap, selectedMetric]);

  // Streak Calculation
  const { currentStreak, bestStreak } = useMemo(() => {
    const sortedDates = Array.from(logMap.keys()).sort();
    if (sortedDates.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    let best = 0;
    let temp = 0;
    let prev = null;

    sortedDates.forEach((dStr) => {
      const log = logMap.get(dStr);
      const hasActivity = getMetricIntensity('overall', log) > 0;
      if (hasActivity) {
        if (!prev) {
          temp = 1;
        } else {
          const prevDate = new Date(prev);
          const curDate = new Date(dStr);
          const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            temp++;
          } else {
            temp = 1;
          }
        }
        prev = dStr;
        if (temp > best) best = temp;
      }
    });

    // Calculate current streak from today or yesterday
    let curr = 0;
    const checkDate = new Date();
    const todayStr = checkDate.toISOString().split('T')[0];
    checkDate.setDate(checkDate.getDate() - 1);
    const yestStr = checkDate.toISOString().split('T')[0];

    let startCheck = logMap.get(todayStr) && getMetricIntensity('overall', logMap.get(todayStr)) > 0
      ? new Date()
      : (logMap.get(yestStr) && getMetricIntensity('overall', logMap.get(yestStr)) > 0 ? checkDate : null);

    if (startCheck) {
      const runDate = new Date(startCheck);
      while (true) {
        const dStr = runDate.toISOString().split('T')[0];
        const log = logMap.get(dStr);
        if (log && getMetricIntensity('overall', log) > 0) {
          curr++;
          runDate.setDate(runDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return { currentStreak: curr, bestStreak: best };
  }, [logMap]);

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 className="card-title">Activity Heatmap</h2>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
            <span>
              🔥 Current Streak: <strong style={{ color: '#fbbf24' }}>{currentStreak} days</strong>
            </span>
            <span>
              🏆 Best Streak: <strong style={{ color: '#34d399' }}>{bestStreak} days</strong>
            </span>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', maxWidth: '100%', paddingBottom: '0.25rem' }}>
          {METRICS.map((m) => (
            <button
              key={m.id}
              className={`btn btn-sm ${selectedMetric === m.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedMetric(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="heatmap-container">
        <div className="heatmap-grid">
          {calendarDays.map((day) => {
            const isSelected = selectedDate === day.date;
            return (
              <div
                key={day.date}
                className={`heatmap-cell heat-${day.intensity}`}
                style={isSelected ? { outline: '2px solid #3b82f6', zIndex: 5 } : {}}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => onSelectDate && onSelectDate(day.date)}
              />
            );
          })}
        </div>
      </div>

      {/* Heatmap Legend & Tooltip bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <div>
          {hoveredDay ? (
            <span>
              <strong>{hoveredDay.date}</strong>: {selectedMetric === 'overall'
                ? `Activity Level ${hoveredDay.intensity}/4`
                : formatMetricValue(selectedMetric, hoveredDay.log ? hoveredDay.log[selectedMetric] : 0)}
            </span>
          ) : (
            <span>Click any day to view & log metrics</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Less</span>
          <div className="heatmap-cell heat-0" style={{ cursor: 'default' }} />
          <div className="heatmap-cell heat-1" style={{ cursor: 'default' }} />
          <div className="heatmap-cell heat-2" style={{ cursor: 'default' }} />
          <div className="heatmap-cell heat-3" style={{ cursor: 'default' }} />
          <div className="heatmap-cell heat-4" style={{ cursor: 'default' }} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
