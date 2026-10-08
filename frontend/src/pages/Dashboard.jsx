import React, { useState, useEffect, useMemo } from 'react';
import DateStrip from '../components/DateStrip';
import HabitCard from '../components/HabitCard';
import HabitMatrix from '../components/HabitMatrix';
import HabitNoteModal from '../components/HabitNoteModal';
import { DEFAULT_HABITS, calculateHabitStreak, toggleHabitForDate, adjustHabitCounter } from '../db/habits';
import { getDailyLogs } from '../db/daily';
import { getTodos, toggleTodo } from '../db/todos';
import { getThoughts } from '../db/thoughts';
import { subscribeDataChanges } from '../sync/npointSync';

export default function Dashboard({ onNavigate }) {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' (Image #2) or 'matrix' (Image #1)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [todos, setTodos] = useState([]);
  const [thoughts, setThoughts] = useState([]);
  const [noteModalHabit, setNoteModalHabit] = useState(null);

  const loadAllData = async () => {
    const allLogs = await getDailyLogs();
    setLogs(allLogs);
    const allTodos = await getTodos();
    setTodos(allTodos.slice(0, 4));
    const allThoughts = await getThoughts();
    setThoughts(allThoughts.slice(0, 3));
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
          {DEFAULT_HABITS.map((habit) => {
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

          {/* Secondary Quick Access Widgets: Tasks & Journal Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
            {/* Quick Tasks */}
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Tasks to do</span>
                <button
                  style={{ background: 'none', border: 'none', color: '#facc15', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => onNavigate('todos')}
                >
                  View All →
                </button>
              </div>
              {todos.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>All caught up! No tasks pending.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {todos.map((t) => (
                    <div
                      key={t.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                    >
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={async () => {
                          await toggleTodo(t.id);
                          loadAllData();
                        }}
                        style={{ accentColor: '#facc15' }}
                      />
                      <span style={{ textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {t.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Journal Thoughts */}
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Journal & Thoughts</span>
                <button
                  style={{ background: 'none', border: 'none', color: '#facc15', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => onNavigate('thoughts')}
                >
                  Timeline →
                </button>
              </div>
              {thoughts.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No thoughts logged today.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {thoughts.map((th) => (
                    <div
                      key={th.id}
                      style={{
                        padding: '0.5rem 0.65rem',
                        backgroundColor: '#181818',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        borderLeft: '3px solid #facc15',
                      }}
                    >
                      {th.content}
                    </div>
                  ))}
                </div>
              )}
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
            habits={DEFAULT_HABITS}
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
