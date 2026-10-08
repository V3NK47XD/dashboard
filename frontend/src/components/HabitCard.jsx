import React, { useState, useMemo } from 'react';
import {
  getMonthHeatmapDays,
  getPastMonthsList,
  getTodayIso,
} from '../db/habits';

export default function HabitCard({
  category,
  todayVal = 0,
  threshold = 1,
  streak = 0,
  historyMap = {},
  onAdjustToday,
}) {
  const { id, title, icon, colorTheme, accentColor, step, formatValue, unit } = category;
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = current month, 1 = last month...

  const todayIso = getTodayIso();
  const isValidToday = todayVal >= threshold;

  const now = new Date();
  const pastMonths = useMemo(() => getPastMonthsList(12), []);

  // Selected month for display
  const activeMonthInfo = pastMonths[selectedMonthOffset] || pastMonths[0];

  // Days for the active month's heatmap
  const heatmapDays = useMemo(() => {
    return getMonthHeatmapDays(
      activeMonthInfo.year,
      activeMonthInfo.month,
      historyMap,
      threshold
    );
  }, [activeMonthInfo, historyMap, threshold]);

  const targetLabel = formatValue(threshold);

  return (
    <div
      className={`habit-card ${colorTheme}`}
      style={{
        marginBottom: '1rem',
        border: `1.5px solid ${accentColor}55`,
        borderTop: `4px solid ${accentColor}`,
        backgroundColor: '#131313',
        backgroundImage: `radial-gradient(circle at top right, ${accentColor}18, transparent 65%)`,
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.45), 0 0 16px ${accentColor}12`,
      }}
    >
      {/* 1. Header with Category, Icon & Streak */}
      <div className="habit-card-header" style={{ marginBottom: '0.75rem' }}>
        <div className="habit-info">
          <span className="habit-icon" style={{ fontSize: '1.4rem' }}>{icon}</span>
          <div>
            <h3 className="habit-title" style={{ fontSize: '1.05rem', margin: 0 }}>{title}</h3>
            <div className="habit-streak" style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
              🔥 Streak: <strong style={{ color: streak > 0 ? '#facc15' : 'inherit' }}>{streak} {streak === 1 ? 'day' : 'days'}</strong>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              backgroundColor: isValidToday ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              color: isValidToday ? '#34d399' : '#888888',
              border: `1px solid ${isValidToday ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
            }}
          >
            {isValidToday ? 'Target Met ✓' : `Goal: ${targetLabel}`}
          </div>
        </div>
      </div>

      {/* 2. Today's Stepper Counter (Updates only current day) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: '#171717',
          borderRadius: '14px',
          border: `1.5px solid ${accentColor}50`,
          boxShadow: `inset 0 0 16px ${accentColor}0a`,
          marginBottom: '0.85rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today's Log
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isValidToday ? accentColor : '#ffffff', marginTop: '0.1rem' }}>
            {formatValue(todayVal)}
          </div>
        </div>

        <div className="counter-stepper" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            className="stepper-btn"
            onClick={() => onAdjustToday(id, -step)}
            disabled={todayVal <= 0}
            aria-label={`Decrease today's ${title} by ${step}`}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: todayVal > 0 ? `${accentColor}18` : '#1f1f1f',
              border: `1.5px solid ${todayVal > 0 ? `${accentColor}70` : '#333333'}`,
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: todayVal <= 0 ? 'not-allowed' : 'pointer',
              opacity: todayVal <= 0 ? 0.4 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            −
          </button>
          <button
            className="stepper-btn"
            onClick={() => onAdjustToday(id, step)}
            aria-label={`Increase today's ${title} by ${step}`}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: `${accentColor}25`,
              border: `1.5px solid ${accentColor}88`,
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 2px 8px ${accentColor}25`,
              transition: 'all 0.15s ease',
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* 3. Heatmap Header & Month Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {activeMonthInfo.label} Activity
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: accentColor,
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          {isExpanded ? 'Collapse ▴' : 'View More Months ▾'}
        </button>
      </div>

      {/* Past Months Tabs (when View More is toggled) */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            marginBottom: '0.65rem',
            scrollbarWidth: 'none',
          }}
        >
          {pastMonths.map((m, idx) => (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => setSelectedMonthOffset(idx)}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: selectedMonthOffset === idx ? 700 : 500,
                backgroundColor: selectedMonthOffset === idx ? 'rgba(255, 255, 255, 0.15)' : '#1a1a1a',
                color: selectedMonthOffset === idx ? '#ffffff' : '#888888',
                border: `1px solid ${selectedMonthOffset === idx ? accentColor : '#2a2a2a'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {m.shortLabel}
            </button>
          ))}
        </div>
      )}

      {/* 4. LeetCode-style Monthly Heatmap Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(26px, 1fr))',
          gap: '5px',
          padding: '0.75rem',
          backgroundColor: '#161616',
          borderRadius: '14px',
          border: `1.5px solid ${accentColor}40`,
        }}
      >
        {heatmapDays.map((d) => {
          const isToday = d.dateIso === todayIso;

            const pixelBorder = isToday
              ? '2px solid #ffffff'
              : d.intensity >= 3
              ? `2px solid ${accentColor}`
              : d.intensity > 0
              ? `1.5px solid ${accentColor}cc`
              : `1px solid ${accentColor}55`;
            return (
              <div
                key={d.dateIso}
                className={`matrix-pixel pixel-${colorTheme.replace('habit-', '')} level-${d.intensity}`}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: d.intensity >= 3 ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
                  border: pixelBorder,
                  boxShadow: isToday ? `0 0 8px ${accentColor}` : d.intensity >= 3 ? `0 0 6px ${accentColor}66` : 'none',
                  cursor: 'default',
                  position: 'relative',
                  transition: 'border-color 0.15s ease',
                }}
                title={`${d.dateIso}: ${formatValue(d.val)} (Target: ${targetLabel}) ${d.isValid ? '✓' : ''}`}
              >
                {d.day}
              </div>
            );
          })}
      </div>
    </div>
  );
}
