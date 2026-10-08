import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getThoughts, searchThoughtsLocally, deleteThought, createThought } from '../db/thoughts';
import { subscribeDataChanges } from '../sync/npointSync';
import { Send, Trash2, Search } from 'lucide-react';

export default function Thoughts() {
  const [thoughts, setThoughts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

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

  // Chronological order: oldest messages up, newest messages down (chat app format)
  const chronologicalThoughts = [...thoughts].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thoughts.length]);

  const handleSendThought = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await createThought(inputText.trim());
      setInputText('');
      await loadThoughts();
      setTimeout(scrollToBottom, 50);
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
    <div className="page-responsive-container" style={{ paddingBottom: '2rem' }}>
      <div>
        <h1 style={{ margin: '0 0 0.25rem' }}>Thoughts & Journal</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Personal chronological thought stream • Messages to yourself
        </p>
      </div>

      {/* Main Chat Box Container with Border */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 220px)',
          minHeight: '520px',
          maxHeight: '760px',
          padding: 0,
          backgroundColor: '#131313',
          border: '1.5px solid rgba(134, 59, 255, 0.45)',
          borderTop: '4px solid #863bff',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundImage: 'radial-gradient(circle at top right, rgba(134, 59, 255, 0.12), transparent 70%)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(134, 59, 255, 0.12)',
        }}
      >
        {/* Chat Top Header with Border */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1.5px solid rgba(134, 59, 255, 0.25)',
            backgroundColor: '#161616',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(134, 59, 255, 0.15)',
                border: '1px solid #863bff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              💭
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff' }}>Thoughts Stream</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {thoughts.length} {thoughts.length === 1 ? 'thought' : 'thoughts'} logged
              </div>
            </div>
          </div>

          {/* Search Filter Box with Border */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '220px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '28px',
                paddingTop: '0.35rem',
                paddingBottom: '0.35rem',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(134, 59, 255, 0.05)',
                border: '1.5px solid rgba(134, 59, 255, 0.4)',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>

        {/* Scrollable Chat Area: Old things UP, new things DOWN */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            backgroundColor: '#0f0f0f',
          }}
        >
          {chronologicalThoughts.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {searchQuery ? 'No thoughts matching search query.' : 'No thoughts yet. Send a message to yourself below!'}
            </div>
          ) : (
            chronologicalThoughts.map((th) => {
              const dateObj = new Date(th.created_at);
              const formattedDate = dateObj.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={th.id}
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: 'rgba(134, 59, 255, 0.04)',
                    border: '1.5px solid rgba(134, 59, 255, 0.4)',
                    borderLeft: '4px solid #863bff',
                    borderRadius: '14px',
                    padding: '0.85rem 1.1rem',
                    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.35), 0 0 10px rgba(134, 59, 255, 0.08)',
                    position: 'relative',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.55, color: '#f0f0f0' }}>
                    {th.content}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      marginTop: '0.5rem',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>
                      {formattedDate} • {formattedTime}
                    </span>

                    <button
                      onClick={() => handleDelete(th.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#777',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.72rem',
                        transition: 'color 0.15s ease',
                      }}
                      title="Delete thought"
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#777')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Chat Input Box with Border */}
        <form
          onSubmit={handleSendThought}
          style={{
            padding: '0.85rem 1rem',
            borderTop: '1.5px solid rgba(134, 59, 255, 0.25)',
            backgroundColor: '#161616',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? (Press Enter to send)"
              disabled={isSending}
              style={{
                width: '100%',
                padding: '0.7rem 0.95rem',
                backgroundColor: '#0c0c0c',
                border: '1.5px solid rgba(134, 59, 255, 0.55)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                display: 'block',
                boxSizing: 'border-box',
                boxShadow: '0 0 10px rgba(134, 59, 255, 0.1)',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#a855f7')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(134, 59, 255, 0.55)')}
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: inputText.trim() ? '#863bff' : '#262626',
              border: `1px solid ${inputText.trim() ? '#9b51e0' : '#333333'}`,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              opacity: inputText.trim() ? 1 : 0.5,
              transition: 'all 0.15s ease',
            }}
            aria-label="Send thought"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
