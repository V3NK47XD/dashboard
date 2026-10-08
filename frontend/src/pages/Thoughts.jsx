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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>💭</span>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {thoughts.length} {thoughts.length === 1 ? 'thought' : 'thoughts'}
            </div>
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
        {/* Scrollable Chat Area: Old things UP, new things DOWN */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            backgroundColor: '#0e0e0e',
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
                    border: '1px solid rgba(134, 59, 255, 0.35)',
                    borderLeft: '3px solid #863bff',
                    borderRadius: '10px',
                    padding: '0.45rem 0.7rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    position: 'relative',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.84rem', lineHeight: 1.4, color: '#f0f0f0' }}>
                    {th.content}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      marginTop: '0.35rem',
                      fontSize: '0.68rem',
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
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
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
