import React, { useState } from 'react';
import { createThought } from '../db/thoughts';

export default function HabitNoteModal({ habit, date, isOpen, onClose, onNoteSaved }) {
  const [content, setContent] = useState('');

  if (!isOpen || !habit) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    const prefix = `[${habit.title} • ${date}] `;
    await createThought(`${prefix}${content.trim()}`);
    setContent('');
    onNoteSaved && onNoteSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              {habit.icon} {habit.title} Journal
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Log notes for {date}</p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea
            className="textarea"
            rows={4}
            placeholder={`How was your ${habit.title.toLowerCase()} session today? Notes, weights, feeling...`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
            required
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
