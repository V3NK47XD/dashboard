import React, { useState } from 'react';
import { createTodo } from '../db/todos';
import { createThought } from '../db/thoughts';
import {
  HABIT_CATEGORIES,
  adjustTodayCategoryCount,
  getTodayIso,
} from '../db/habits';
import { syncUpdateHabitCount } from '../sync/npointSync';

export default function QuickAddModal({ isOpen, onClose, onDataSaved }) {
  const [activeTab, setActiveTab] = useState('habit'); // habit | todo | thought
  const [todoTitle, setTodoTitle] = useState('');
  const [thoughtContent, setThoughtContent] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('workout');
  const [metricValue, setMetricValue] = useState(15);

  if (!isOpen) return null;

  const handleSaveTodo = async (e) => {
    e.preventDefault();
    if (!todoTitle.trim()) return;
    await createTodo(todoTitle.trim());
    setTodoTitle('');
    onDataSaved && onDataSaved();
    onClose();
  };

  const handleSaveThought = async (e) => {
    e.preventDefault();
    if (!thoughtContent.trim()) return;
    await createThought(thoughtContent.trim());
    setThoughtContent('');
    onDataSaved && onDataSaved();
    onClose();
  };

  const handleSaveMetric = async (e) => {
    e.preventDefault();
    const today = getTodayIso();
    const nextVal = adjustTodayCategoryCount(selectedCatId, Number(metricValue));
    try {
      await syncUpdateHabitCount(selectedCatId, today, nextVal);
    } catch (err) {
      console.warn('Sync note:', err);
    }
    onDataSaved && onDataSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Quick Add</h2>
          <button className="icon-btn" onClick={onClose} style={{ border: 'none', background: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn btn-sm ${activeTab === 'habit' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('habit')}
          >
            Log Habit
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'todo' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('todo')}
          >
            Add Task
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'thought' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('thought')}
          >
            Thought
          </button>
        </div>

        {activeTab === 'habit' && (
          <form onSubmit={handleSaveMetric} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Select Habit (Today)
              </label>
              <select
                className="select"
                value={selectedCatId}
                onChange={(e) => {
                  setSelectedCatId(e.target.value);
                  const cat = HABIT_CATEGORIES.find((c) => c.id === e.target.value);
                  if (cat) setMetricValue(cat.step);
                }}
              >
                {HABIT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.title} ({cat.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Amount to Add Today
              </label>
              <input
                type="number"
                className="input"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                min={1}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Add to Today's Count
            </button>
          </form>
        )}

        {activeTab === 'todo' && (
          <form onSubmit={handleSaveTodo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Task Title
              </label>
              <input
                type="text"
                className="input"
                placeholder="What needs to be done?"
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Save Task
            </button>
          </form>
        )}

        {activeTab === 'thought' && (
          <form onSubmit={handleSaveThought} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                What's on your mind?
              </label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Capture an idea, reflection, or note..."
                value={thoughtContent}
                onChange={(e) => setThoughtContent(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              Save Thought
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
