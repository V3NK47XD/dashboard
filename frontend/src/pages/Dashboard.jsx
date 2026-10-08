import React, { useState, useEffect, useMemo } from 'react';
import DateStrip from '../components/DateStrip';
import HabitCard from '../components/HabitCard';
import HabitMatrix from '../components/HabitMatrix';
import HabitNoteModal from '../components/HabitNoteModal';
import { getActiveHabits, setHabitThreshold, calculateHabitStreak, toggleHabitForDate, adjustHabitCounter } from '../db/habits';
import { getDailyLogs } from '../db/daily';
import { subscribeDataChanges } from '../sync/npointSync';

export default function Dashboard({ onNavigate }) {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (Image #2) or 'matrix' (Image #1)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [activeHabits, setActiveHabits] = useState(() => getActiveHabits());
  const [noteModalHabit, setNoteModalHabit] = useState(null);

  const loadAllData = async () => {
    const allLogs = await getDailyLogs();
    setLogs(allLogs);
    setActiveHabits(getActiveHabits());
  };

  useEffect(() => {
    loadAllData();
    const unsub = subscribeDataChanges(() => {
      loadAllData();
    });
    return () => unsub();
  }, []);

  const logsMap = useMemo(() => {
    const map = new Map();
    logs.forEach((l) => map.set(l.date, l));
    return map;
  }, [logs]);

  // Formatted date string (e.g. "Today, 4th Dec" or "Wed, 7th Oct")
  const formattedHeaderDate = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    const isToday = selectedDate === todayIso;

    const parts = selectedDate.split('-');
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
    const weekday = dateObj.toLocaleDateString(undefined, { weekday: 'short' });

    if (isToday) {
      return `Today, ${dayNum}${suffix} ${monthStr}`;
    }
    return `${weekday}, ${dayNum}${suffix} ${monthStr}`;
  }, [selectedDate]);

  const handleAdjustCounter = async (habit, delta) => {
    await adjustHabitCounter(habit, selectedDate, delta);
    loadAllData();
  };

  const handleToggleMatrixHabit = async (habit, date) => {
    await toggleHabitForDate(habit, date);
    loadAllData();
  };

  const handleAdjustThreshold = (habitId, newThresh) => {
    setHabitThreshold(habitId, newThresh);
    setActiveHabits(getActiveHabits());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {/* Top Header matching Image #2 */}
      <div className="habit-header">
        <h1 className="habit-header-title">{formattedHeaderDate}</h1>
        <div className="habit-header-actions">
          {/* View Toggle Button: Cards vs Matrix */}
          <button
            className={`icon-btn ${viewMode === 'matrix' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'cards' ? 'matrix' : 'cards')}
            title={viewMode === 'cards' ? 'Switch to Matrix View (Table)' : 'Switch to Cards View'}
          >
            {viewMode === 'cards' ? (
              // Matrix/Table icon
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ) : (
              // List/Cards icon
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
                <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
                <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
              </svg>
            )}
          </button>

          {/* Settings icon */}
          <button
            className="icon-btn"
            onClick={() => onNavigate('settings')}
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date Strip Component (Image #2) */}
      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        logsMap={logsMap}
      />

      {/* View Mode: Cards View (Image #2) */}
      {viewMode === 'cards' && (
        <div className="habit-cards-stream">
          {activeHabits.map((habit) => {
            const streak = calculateHabitStreak(habit, logsMap);

            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                selectedDate={selectedDate}
                streak={streak}
                logsMap={logsMap}
                onAdjustCounter={handleAdjustCounter}
                onOpenNote={(h) => setNoteModalHabit(h)}
              />
            );
          })}

          {/* Habit Completion Thresholds Configuration */}
          <div className="card" style={{ marginTop: '0.75rem', padding: '1.25rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🎯</span>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Habit Completion Targets</h2>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                Adjust daily target thresholds required for each habit to be considered valid, earn streaks, and reach full intensity shades.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {activeHabits.map((habit) => (
                <div
                  key={habit.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    backgroundColor: '#181818',
                    borderRadius: '12px',
                    border: '1px solid #282828',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{habit.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#ffffff' }}>
                        {habit.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Step: ±{habit.unit === 'min' ? `${habit.step}m` : habit.unit === 'hrs' ? `${(habit.step / 60).toFixed(1)}h` : `${habit.step} ${habit.unit}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        minWidth: '70px',
                        textAlign: 'center',
                      }}
                    >
                      {habit.formatTarget}
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleAdjustThreshold(habit.id, habit.threshold - habit.step)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #333',
                          backgroundColor: '#242424',
                          color: '#fff',
                          fontSize: '1rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`Decrease ${habit.title} target by ${habit.step}`}
                      >
                        −
                      </button>
                      <button
                        onClick={() => handleAdjustThreshold(habit.id, habit.threshold + habit.step)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #333',
                          backgroundColor: '#242424',
                          color: '#fff',
                          fontSize: '1rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`Increase ${habit.title} target by ${habit.step}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Mode: Matrix Table View (Image #1) */}
      {viewMode === 'matrix' && (
        <div style={{ padding: '0.5rem 0 2rem 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Tap any block to toggle habit completion • Scroll horizontally for all dates
          </div>
          <HabitMatrix
            habits={activeHabits}
            logsMap={logsMap}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onToggleHabitDate={handleToggleMatrixHabit}
            daysCount={21}
          />
        </div>
      )}

      {/* Habit Note Modal */}
      <HabitNoteModal
        habit={noteModalHabit}
        date={selectedDate}
        isOpen={Boolean(noteModalHabit)}
        onClose={() => setNoteModalHabit(null)}
        onNoteSaved={loadAllData}
      />
    </div>
  );
}
