import React, { useState, useEffect, useMemo } from 'react';
import HabitCard from '../components/HabitCard';
import {
  HABIT_CATEGORIES,
  loadAllHabitsData,
  getHabitThresholds,
  setHabitThreshold,
  adjustTodayCategoryCount,
  calculateCategoryStreak,
  getTodayIso,
} from '../db/habits';
import {
  syncUpdateHabitCount,
  syncUpdateThreshold,
  subscribeDataChanges,
} from '../sync/npointSync';

export default function Dashboard({ onNavigate }) {
  const [habitsData, setHabitsData] = useState(() => loadAllHabitsData());
  const [thresholds, setThresholds] = useState(() => getHabitThresholds());
  const todayIso = useMemo(() => getTodayIso(), []);

  const loadAll = () => {
    setHabitsData(loadAllHabitsData());
    setThresholds(getHabitThresholds());
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

  // Adjust today's count (stepper + / -)
  const handleAdjustToday = async (catId, delta) => {
    const nextVal = adjustTodayCategoryCount(catId, delta);
    setHabitsData(loadAllHabitsData());

    try {
      await syncUpdateHabitCount(catId, todayIso, nextVal);
    } catch (e) {
      console.warn('Background sync note:', e);
    }
  };

  // Adjust completion threshold
  const handleAdjustThreshold = async (catId, newThresh) => {
    const updated = setHabitThreshold(catId, newThresh);
    setThresholds(updated);

    try {
      await syncUpdateThreshold(catId, updated[catId]);
    } catch (e) {
      console.warn('Background sync note:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: 760, margin: '0 auto', padding: '0 0.75rem' }}>
      {/* Top Header */}
      <div className="habit-header" style={{ marginBottom: '0.25rem' }}>
        <div>
          <h1 className="habit-header-title" style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
            {formattedHeaderDate}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            8 Core Tracking Categories • 1-Year History
          </p>
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
            />
          );
        })}
      </div>

      {/* Habit Completion Thresholds Configuration Panel (Bottom of Page) */}
      <div className="card" style={{ marginTop: '0.5rem', marginBottom: '4.5rem', padding: '1.25rem', backgroundColor: '#141414', borderRadius: '16px', border: '1px solid #282828' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Habit Completion Targets</h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
            Adjust the completion threshold for each category. Controls streak qualification and the 5-level LeetCode heatmap intensity gradient.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {HABIT_CATEGORIES.map((cat) => {
            const currentThresh = thresholds[cat.id] || cat.defaultThreshold;
            const targetLabel = cat.formatValue(currentThresh);

            return (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 0.9rem',
                  backgroundColor: '#1b1b1b',
                  borderRadius: '12px',
                  border: '1px solid #2a2a2a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff' }}>
                      {cat.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Step: ±{cat.unit === 'min' ? `${cat.step}m` : `${cat.step} ${cat.unit}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: cat.accentColor,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      minWidth: '64px',
                      textAlign: 'center',
                    }}
                  >
                    {targetLabel}
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleAdjustThreshold(cat.id, currentThresh - cat.step)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        backgroundColor: '#262626',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`Decrease ${cat.title} target by ${cat.step}`}
                    >
                      −
                    </button>
                    <button
                      onClick={() => handleAdjustThreshold(cat.id, currentThresh + cat.step)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        backgroundColor: '#262626',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={`Increase ${cat.title} target by ${cat.step}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
