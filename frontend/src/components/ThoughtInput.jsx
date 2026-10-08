import React, { useState } from 'react';
import { createThought } from '../db/thoughts';

export default function ThoughtInput({ onThoughtCreated }) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!content.trim()) return;

      setIsSubmitting(true);
      try {
        const record = await createThought(content);
        setContent('');
        if (onThoughtCreated) {
          onThoughtCreated(record);
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Quick Capture • Message to Myself
        </label>
        <textarea
          className="textarea"
          rows={2}
          placeholder="What's on your mind? (Press Enter to save instantly)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Press Enter to capture • Shift+Enter for new line
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              if (!content.trim()) return;
              const record = await createThought(content);
              setContent('');
              if (onThoughtCreated) onThoughtCreated(record);
            }}
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
