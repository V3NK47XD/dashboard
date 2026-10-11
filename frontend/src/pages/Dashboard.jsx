import React, { useState, useEffect, useMemo } from 'react';
import HabitCard from '../components/HabitCard';
import {
  HABIT_CATEGORIES,
  loadAllHabitsData,
  getHabitThresholds,
  setHabitThreshold,
  getHabitSteps,
  setHabitStep,
  adjustTodayCategoryCount,
  calculateCategoryStreak,
  getTodayIso,
} from '../db/habits';
import {
  syncAdjustHabitToday,
  syncUpdateThreshold,
  subscribeDataChanges,
} from '../sync/npointSync';

export default function Dashboard({ onNavigate }) {
  const [habitsData, setHabitsData] = useState(() => loadAllHabitsData());
  const [thresholds, setThresholds] = useState(() => getHabitThresholds());
  const [steps, setSteps] = useState(() => getHabitSteps());
  const [editingThresh, setEditingThresh] = useState({});
  const [editingSteps, setEditingSteps] = useState({});
  const [isDetailedOpen, setIsDetailedOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const todayIso = useMemo(() => getTodayIso(), []);

  const loadAll = () => {
    setHabitsData(loadAllHabitsData());
    setThresholds(getHabitThresholds());
    setSteps(getHabitSteps());
  };

  useEffect(() => {
    loadAll();
    const unsub = subscribeDataChanges(() => {
      loadAll();
    });
    return () => unsub();
  }, []);

  // Formatted date string for header
  const formattedHeaderDate = useMemo(() => {
    const parts = todayIso.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    const dayNum = dateObj.getDate();
    const suffix =
      dayNum % 10 === 1 && dayNum !== 11
        ? 'st'
        : dayNum % 10 === 2 && dayNum !== 12
        ? 'nd'
        : dayNum % 10 === 3 && dayNum !== 13
        ? 'rd'
        : 'th';

    const monthStr = dateObj.toLocaleDateString(undefined, { month: 'short' });
    return `Today, ${dayNum}${suffix} ${monthStr}`;
  }, [todayIso]);

  // Adjust today's count (stepper + / -): polls cloud first, checks, updates, pushes
  const handleAdjustToday = async (catId, delta) => {
    try {
      await syncAdjustHabitToday(catId, delta);
      loadAll();
    } catch (e) {
      console.warn('Sync note:', e);
      adjustTodayCategoryCount(catId, delta);
      loadAll();
    }
  };

  // Set completion threshold directly from typed input
  const handleAdjustThreshold = async (catId, newThresh) => {
    const val = Math.max(1, parseInt(newThresh, 10) || 1);
    const updated = setHabitThreshold(catId, val);
    setThresholds({ ...updated });

    try {
      await syncUpdateThreshold(catId, val);
    } catch (e) {
      console.warn('Background sync note:', e);
    }
  };

  // Set increment step size directly from typed input
  const handleSetStep = (catId, newStep) => {
    const val = Math.max(1, parseInt(newStep, 10) || 1);
    const updated = setHabitStep(catId, val);
    setSteps({ ...updated });
  };

  return (
    <div className="page-responsive-container">
      {/* Top Header */}
      <div className="habit-header" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 className="habit-header-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            {formattedHeaderDate}
          </h1>
        </div>

        <div className="habit-header-actions">
          <button
            className="icon-btn"
            onClick={() => onNavigate('settings')}
            title="Settings"
            style={{ width: '38px', height: '38px', borderRadius: '10px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 1. Main Daily Habit Tracking Grid (Today Alone, No Charts) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '0.65rem',
          marginBottom: '0.85rem',
        }}
      >
        {HABIT_CATEGORIES.map((cat) => {
          const catHistory = habitsData[cat.id] || {};
          const todayVal = catHistory[todayIso] || 0;
          const threshold = thresholds[cat.id] || cat.defaultThreshold;
          const currentStep = steps[cat.id] || cat.step;
          const streak = calculateCategoryStreak(cat.id, catHistory, threshold);
          const isValid = todayVal >= threshold;

          return (
            <div
              key={cat.id}
              style={{
                padding: '0.65rem 0.75rem',
                backgroundColor: '#121212',
                border: `1.5px solid ${isValid ? cat.accentColor : cat.accentColor + '30'}`,
                borderLeft: `4px solid ${cat.accentColor}`,
                borderRadius: '13px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.45rem',
                boxShadow: isValid ? `0 2px 10px ${cat.accentColor}20` : '0 2px 8px rgba(0, 0, 0, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Icon, Title & Streak */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.icon}</span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={cat.title}
                  >
                    {cat.title}
                  </span>
                </div>

                {streak > 0 && (
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#facc15', flexShrink: 0 }}>
                    🔥{streak}
                  </span>
                )}
              </div>

              {/* Today's Logged Value & Goal Status */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.35rem' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isValid ? cat.accentColor : '#ffffff', lineHeight: 1.1 }}>
                  {cat.formatValue(todayVal)}
                </div>
                <div
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 600,
                    color: isValid ? '#34d399' : 'var(--text-muted)',
                    backgroundColor: isValid ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '5px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isValid ? '✓ Done' : `/ ${cat.formatValue(threshold)}`}
                </div>
              </div>

              {/* Steppers (+ / -) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  onClick={() => handleAdjustToday(cat.id, -currentStep)}
                  disabled={todayVal <= 0}
                  aria-label={`Decrease ${cat.title}`}
                  style={{
                    flex: 1,
                    height: '28px',
                    borderRadius: '7px',
                    border: `1px solid ${todayVal > 0 ? cat.accentColor + '50' : '#282828'}`,
                    backgroundColor: todayVal > 0 ? `${cat.accentColor}12` : '#181818',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: todayVal <= 0 ? 'not-allowed' : 'pointer',
                    opacity: todayVal <= 0 ? 0.35 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  −
                </button>
                <button
                  onClick={() => handleAdjustToday(cat.id, currentStep)}
                  aria-label={`Increase ${cat.title}`}
                  style={{
                    flex: 1,
                    height: '28px',
                    borderRadius: '7px',
                    border: `1px solid ${cat.accentColor}80`,
                    backgroundColor: `${cat.accentColor}25`,
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 2px 6px ${cat.accentColor}20`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Collapsible Detailed View: Full Heatmaps & Monthly History */}
      <div
        className="card"
        style={{
          marginBottom: '0.75rem',
          padding: 0,
          backgroundColor: '#131313',
          borderRadius: '16px',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setIsDetailedOpen(!isDetailedOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.15rem',
            backgroundColor: isDetailedOpen ? '#171717' : '#131313',
            border: 'none',
            borderBottom: isDetailedOpen ? '1px solid #222222' : 'none',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Monthly Heatmaps & Activity History</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Full LeetCode-style activity grids, streaks, and monthly archives
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              transform: isDetailedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            ▼
          </div>
        </button>

        {isDetailedOpen && (
          <div style={{ padding: '0.85rem 1rem' }}>
            <div className="habit-cards-stream">
              {HABIT_CATEGORIES.map((cat) => {
                const catHistory = habitsData[cat.id] || {};
                const todayVal = catHistory[todayIso] || 0;
                const threshold = thresholds[cat.id] || cat.defaultThreshold;
                const streak = calculateCategoryStreak(cat.id, catHistory, threshold);

                return (
                  <HabitCard
                    key={cat.id}
                    category={cat}
                    todayVal={todayVal}
                    threshold={threshold}
                    streak={streak}
                    historyMap={catHistory}
                    onAdjustToday={handleAdjustToday}
                    stepOverride={steps[cat.id] || cat.step}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Collapsible Targets & Increment Steps Configuration Panel */}
      <div
        className="card"
        style={{
          marginTop: '0.75rem',
          marginBottom: '4.5rem',
          padding: 0,
          backgroundColor: '#131313',
          borderRadius: '16px',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            backgroundColor: isConfigOpen ? '#171717' : '#131313',
            border: 'none',
            borderBottom: isConfigOpen ? '1px solid #222222' : 'none',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⚙</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Targets & Increment Sizes</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Customize daily goals and stepper increments for each habit
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              transform: isConfigOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            ▼
          </div>
        </button>

        {isConfigOpen && (
          <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
            {HABIT_CATEGORIES.map((cat) => {
              const currentThresh = thresholds[cat.id] || cat.defaultThreshold;
              const currentStep = steps[cat.id] || cat.step;
              return (
                <div
                  key={cat.id}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: '#171717',
                    borderRadius: '14px',
                    border: `1.5px solid ${cat.accentColor}40`,
                    borderLeft: `4px solid ${cat.accentColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{cat.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>{cat.title}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    {/* Goal / Target Typing Input */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                        Goal ({cat.unit})
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingThresh[cat.id] !== undefined ? editingThresh[cat.id] : currentThresh}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setEditingThresh((prev) => ({ ...prev, [cat.id]: raw }));
                          if (raw.trim() !== '') {
                            const parsed = parseInt(raw, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              handleAdjustThreshold(cat.id, parsed);
                            }
                          }
                        }}
                        onBlur={() => {
                          const raw = editingThresh[cat.id];
                          if (raw !== undefined) {
                            const parsed = parseInt(raw, 10);
                            const commitVal = Math.max(1, isNaN(parsed) ? (thresholds[cat.id] || cat.defaultThreshold) : parsed);
                            handleAdjustThreshold(cat.id, commitVal);
                            setEditingThresh((prev) => {
                              const next = { ...prev };
                              delete next[cat.id];
                              return next;
                            });
                          }
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f0f0f',
                          border: `1.5px solid ${cat.accentColor}55`,
                          borderRadius: '8px',
                          padding: '0.35rem 0.55rem',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: cat.accentColor,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {/* Increment Step Typing Input */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                        Step ({cat.unit})
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingSteps[cat.id] !== undefined ? editingSteps[cat.id] : currentStep}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setEditingSteps((prev) => ({ ...prev, [cat.id]: raw }));
                          if (raw.trim() !== '') {
                            const parsed = parseInt(raw, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              handleSetStep(cat.id, parsed);
                            }
                          }
                        }}
                        onBlur={() => {
                          const raw = editingSteps[cat.id];
                          if (raw !== undefined) {
                            const parsed = parseInt(raw, 10);
                            const commitVal = Math.max(1, isNaN(parsed) ? (steps[cat.id] || cat.step) : parsed);
                            handleSetStep(cat.id, commitVal);
                            setEditingSteps((prev) => {
                              const next = { ...prev };
                              delete next[cat.id];
                              return next;
                            });
                          }
                        }}
                        style={{
                          width: '100%',
                          backgroundColor: '#0f0f0f',
                          border: '1.5px solid rgba(250, 204, 21, 0.45)',
                          borderRadius: '8px',
                          padding: '0.35rem 0.55rem',
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: '#facc15',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
