import React, { useState } from 'react';
import { createTodo } from '../db/todos';
import { createThought } from '../db/thoughts';
import { saveDailyMetrics, getDailyLogByDate } from '../db/daily';

export default function QuickAddModal({ isOpen, onClose, selectedDate, onDataSaved }) {
  const [activeTab, setActiveTab] = useState('habit'); // habit | todo | thought
  const [todoTitle, setTodoTitle] = useState('');
  const [thoughtContent, setThoughtContent] = useState('');
  const [metricType, setMetricType] = useState('water_ml');
  const [metricValue, setMetricValue] = useState(250);

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
    const existing = await getDailyLogByDate(selectedDate);
    const updated = {
      [metricType]: (existing[metricType] || 0) + Number(metricValue),
    };
    await saveDailyMetrics(selectedDate, updated);
    onDataSaved && onDataSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Quick Capture & Log</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            className={`btn btn-sm ${activeTab === 'habit' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('habit')}
          >
            Log Metric
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
            Journal / Thought
          </button>
        </div>

        {activeTab === 'habit' && (
          <form onSubmit={handleSaveMetric} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Select Metric ({selectedDate})
              </label>
              <select
                className="select"
                value={metricType}
                onChange={(e) => setMetricType(e.target.value)}
              >
                <option value="water_ml">💧 Water Intake (ml)</option>
                <option value="exercise_minutes">🏋️ Gym / Exercise (mins)</option>
                <option value="sleep_minutes">😴 Sleep Time (mins)</option>
                <option value="leetcode_solved">💻 LeetCode Problems</option>
                <option value="learning_minutes">📚 Learning Time (mins)</option>
                <option value="protein_g">🥩 Protein (g)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                Amount to Add
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
              Add to {selectedDate}
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
              Save Task (Offline-First)
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
              Save to Timeline
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
