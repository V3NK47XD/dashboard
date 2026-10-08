import React, { useState, useEffect } from 'react';
import ThoughtInput from '../components/ThoughtInput';
import { getThoughts, searchThoughtsLocally, deleteThought } from '../db/thoughts';
import { subscribeDataChanges } from '../sync/npointSync';

export default function Thoughts() {
  const [thoughts, setThoughts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadThoughts = async () => {
    if (searchQuery.trim()) {
      const results = await searchThoughtsLocally(searchQuery);
      setThoughts(results);
    } else {
      const all = await getThoughts();
      setThoughts(all);
    }
  };

  useEffect(() => {
    loadThoughts();
    const unsub = subscribeDataChanges(() => {
      loadThoughts();
    });
    return () => unsub();
  }, [searchQuery]);

  const handleDelete = async (id) => {
    await deleteThought(id);
    loadThoughts();
  };

  return (
    <div className="page-responsive-container">
      <div>
        <h1>Thoughts & Notes</h1>
        <p>Instant capture • Personal thought stream • Chronological timeline</p>
      </div>

      <ThoughtInput onThoughtCreated={() => loadThoughts()} />

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Timeline</h2>
            <p style={{ fontSize: '0.85rem' }}>{thoughts.length} thought{thoughts.length === 1 ? '' : 's'} recorded</p>
          </div>
          <div style={{ maxWidth: 260, width: '100%' }}>
            <input
              type="text"
              className="input"
              placeholder="Search thoughts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {thoughts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            {searchQuery ? 'No thoughts matching search query.' : 'No thoughts yet. Capture what is on your mind above!'}
          </div>
        ) : (
          <div className="thoughts-timeline-grid">
            {thoughts.map((th) => {
              const dateObj = new Date(th.created_at);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={th.id}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                    {th.content}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>
                      {formattedDate} at {formattedTime}
                    </span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(th.id)}
                      title="Delete thought"
                    >
                      Delete
                    </button>
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
