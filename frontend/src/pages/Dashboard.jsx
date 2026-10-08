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

      {/* 8 Habit Category Cards with Month Heatmaps & Today Steppers */}
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
                        value={currentThresh}
                        onChange={(e) => handleAdjustThreshold(cat.id, e.target.value)}
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
                        value={currentStep}
                        onChange={(e) => handleSetStep(cat.id, e.target.value)}
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
