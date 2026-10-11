import React, { useState, useEffect, useCallback } from 'react';
import { getThoughts, searchThoughtsLocally, deleteThought, createThought } from '../db/thoughts';
import { subscribeDataChanges } from '../sync/npointSync';
import { Send, Trash2, Search } from 'lucide-react';

const THOUGHT_COLORS = [
  '#facc15', // gold / yellow
  '#38bdf8', // sky blue
  '#ec4899', // pink
  '#10b981', // emerald green
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f43f5e', // rose
  '#6366f1', // indigo
];

function getThoughtColor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return THOUGHT_COLORS[Math.abs(hash) % THOUGHT_COLORS.length];
}

export default function Thoughts() {
  const [thoughts, setThoughts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadThoughts = useCallback(async () => {
    if (searchQuery.trim()) {
      const results = await searchThoughtsLocally(searchQuery);
      setThoughts(results);
    } else {
      const all = await getThoughts();
      setThoughts(all);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadThoughts();
    const unsub = subscribeDataChanges(() => {
      loadThoughts();
    });
    return () => unsub();
  }, [loadThoughts]);

  // Newest quotes first for gallery view
  const galleryThoughts = [...thoughts].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  const handleSendThought = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await createThought(inputText.trim());
      setInputText('');
      await loadThoughts();
    } catch (err) {
      console.warn('Error saving thought:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendThought();
    }
  };

  const handleDelete = async (id) => {
    await deleteThought(id);
    loadThoughts();
  };

  return (
    <div className="page-responsive-container fixed-viewport-page" style={{ paddingBottom: '0.25rem' }}>
      {/* Main Messages Container Card with Border */}
      <div
        className="card"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          backgroundColor: '#121212',
          border: '1.5px solid rgba(134, 59, 255, 0.4)',
          borderTop: '3px solid #863bff',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Chat Top Header with Border */}
        <div
          style={{
            padding: '0.5rem 0.85rem',
            borderBottom: '1px solid rgba(134, 59, 255, 0.2)',
            backgroundColor: '#151515',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.95rem', color: '#a855f7' }}>✦</span>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e5e7eb' }}>
              Quotes Gallery
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({thoughts.length})
            </span>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '160px' }}>
            <Search
              size={12}
              style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '24px',
                paddingTop: '0.2rem',
                paddingBottom: '0.2rem',
                fontSize: '0.75rem',
                backgroundColor: 'rgba(134, 59, 255, 0.05)',
                border: '1px solid rgba(134, 59, 255, 0.35)',
                borderRadius: '6px',
              }}
            />
          </div>
        </div>
        {/* Scrollable Quotes Gallery Grid */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '0.75rem',
            backgroundColor: '#0d0d0d',
          }}
        >
          {galleryThoughts.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.4rem', opacity: 0.6 }}>✦</span>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#888' }}>
                {searchQuery ? 'No quotes matching search query.' : 'Your personal quotes gallery is empty.'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '0.25rem' }}>
                Type a thought, quote, or reflection below to pin it to your gallery
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '0.65rem',
              }}
            >
              {galleryThoughts.map((th) => {
                const dateObj = new Date(th.created_at);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                const bubbleColor = getThoughtColor(th.id);

                return (
                  <div
                    key={th.id}
                    style={{
                      backgroundColor: '#141414',
                      backgroundImage: `linear-gradient(145deg, ${bubbleColor}10, #111111 70%)`,
                      border: `1.5px solid ${bubbleColor}35`,
                      borderTop: `3px solid ${bubbleColor}`,
                      borderRadius: '13px',
                      padding: '0.7rem 0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '95px',
                      gap: '0.55rem',
                      boxShadow: `0 3px 14px rgba(0, 0, 0, 0.4), 0 0 10px ${bubbleColor}10`,
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Quote Mark & Body */}
                    <div>
                      <div
                        style={{
                          fontSize: '1.25rem',
                          lineHeight: 1,
                          fontFamily: 'Georgia, serif',
                          color: bubbleColor,
                          opacity: 0.85,
                          marginBottom: '0.15rem',
                          userSelect: 'none',
                        }}
                      >
                        “
                      </div>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 500,
                          lineHeight: 1.45,
                          color: '#f0f0f0',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {th.content}
                      </div>
                    </div>

                    {/* Quote Footer: Date + Delete */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.35rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.67rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>{formattedDate}</span>

                      <button
                        onClick={() => handleDelete(th.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#666',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease',
                        }}
                        title="Delete quote"
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Separate Chat Input Box (Outside the messages card at the bottom) */}
      <form
        onSubmit={handleSendThought}
        style={{
          marginTop: '0.45rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.45rem 0.35rem 0.75rem',
          backgroundColor: '#121212',
          border: '1.5px solid rgba(134, 59, 255, 0.45)',
          borderRadius: '12px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        }}
      >
        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?..."
          disabled={isSending}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.35,
            padding: '0.2rem 0',
            display: 'block',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: inputText.trim() ? '#863bff' : '#222222',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputText.trim() ? 'pointer' : 'default',
            opacity: inputText.trim() ? 1 : 0.5,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          aria-label="Send thought"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
