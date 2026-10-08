import React, { useState, useEffect, useRef } from 'react';
import { getTodos, createTodo } from '../db/todos';
import { getThoughts, createThought } from '../db/thoughts';
import { loadAllHabitsData, adjustTodayCategoryCount, getTodayIso } from '../db/habits';
import { triggerDebouncedSync } from '../sync/npointSync';

export default function AI() {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('dashboard_ai_url') || 'http://localhost:11434/v1');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('dashboard_ai_key') || '');
  const [modelName, setModelName] = useState(() => localStorage.getItem('dashboard_ai_model') || 'llama3.2');
  const [showConfig, setShowConfig] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your client-side personal assistant. I can inspect and modify your todos, thoughts, and daily habits directly in your browser. All updates are encrypted and synced to npoint.io.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const saveAiConfig = () => {
    localStorage.setItem('dashboard_ai_url', baseUrl);
    localStorage.setItem('dashboard_ai_key', apiKey);
    localStorage.setItem('dashboard_ai_model', modelName);
    setShowConfig(false);
  };

  // Client-side Tool Execution against Dexie
  const executeClientTool = async (name, args) => {
    try {
      if (name === 'todo_list') {
        const todos = await getTodos();
        return JSON.stringify(todos.slice(0, 10));
      }
      if (name === 'todo_add') {
        const item = await createTodo(args.title);
        triggerDebouncedSync();
        return `Added task: "${item.title}"`;
      }
      if (name === 'thought_add') {
        const th = await createThought(args.content);
        triggerDebouncedSync();
        return `Captured thought: "${th.content}"`;
      }
      if (name === 'thought_list') {
        const thoughts = await getThoughts();
        return JSON.stringify(thoughts.slice(0, 10));
      }
      if (name === 'habits_get') {
        const habits = loadAllHabitsData();
        return JSON.stringify(habits);
      }
      if (name === 'habits_update') {
        const catId = args.category || 'workout';
        const delta = Number(args.delta || 1);
        const nextVal = adjustTodayCategoryCount(catId, delta);
        return `Updated today's ${catId} to ${nextVal}`;
      }
    } catch (e) {
      return `Tool execution error: ${e.message}`;
    }
    return `Unknown tool ${name}`;
  };

  const handleSend = async (customPrompt = null) => {
    const text = customPrompt || inputValue;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!customPrompt) setInputValue('');
    setLoading(true);

    // Client-side quick command intent parser for instant zero-dependency execution
    const lower = text.toLowerCase().trim();
    if (lower.startsWith('add todo:') || lower.startsWith('todo:') || lower.startsWith('task:')) {
      const title = text.replace(/^(add todo:|todo:|task:)/i, '').trim();
      if (title) {
        const res = await executeClientTool('todo_add', { title });
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: `✓ ${res}. Encrypted and queued for sync to npoint.io.`,
            tool_calls: [{ name: 'todo_add', args: { title } }],
          },
        ]);
        setLoading(false);
        return;
      }
    }

    if (lower.startsWith('capture thought:') || lower.startsWith('thought:') || lower.startsWith('note:')) {
      const content = text.replace(/^(capture thought:|thought:|note:)/i, '').trim();
      if (content) {
        const res = await executeClientTool('thought_add', { content });
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: `✓ ${res}. Saved locally and encrypted to npoint.io.`,
            tool_calls: [{ name: 'thought_add', args: { content } }],
          },
        ]);
        setLoading(false);
        return;
      }
    }

    if (lower.includes('my tasks') || lower.includes('my todos') || lower.includes('todo list')) {
      const todos = await getTodos();
      const summary =
        todos.length === 0
          ? 'You currently have no pending tasks.'
          : `Here are your current tasks:\n` +
            todos.map((t) => `• [${t.completed ? '✓' : ' '}] ${t.title}`).join('\n');
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: summary,
          tool_calls: [{ name: 'todo_list', args: {} }],
        },
      ]);
      setLoading(false);
      return;
    }

    // Direct LLM API call if user configured custom URL
    try {
      const toolsDef = [
        {
          type: 'function',
          function: {
            name: 'todo_add',
            description: 'Add a new task or todo',
            parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
          },
        },
        {
          type: 'function',
          function: {
            name: 'thought_add',
            description: 'Capture a journal thought or reflection',
            parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
          },
        },
      ];

      const cleanUrl = baseUrl.replace(/\/+$/, '') + '/chat/completions';
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content:
                'You are an assistant for a personal dashboard operating client-side with encrypted npoint.io synchronization.',
            },
            ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          tools: toolsDef,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0]?.message;

      if (choice?.tool_calls && choice.tool_calls.length > 0) {
        const toolResults = [];
        for (const tc of choice.tool_calls) {
          const fnName = tc.function.name;
          const fnArgs = JSON.parse(tc.function.arguments || '{}');
          const outcome = await executeClientTool(fnName, fnArgs);
          toolResults.push({ name: fnName, result: outcome });
        }

        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: choice.content || 'Action executed successfully.',
            tool_calls: toolResults,
          },
        ]);
      } else {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content: choice?.content || '(No response text)',
          },
        ]);
      }
    } catch (err) {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `Notice: Could not connect to LLM at ${baseUrl} (${err.message}). You can use instant commands like "Add todo: <task>" or "Capture thought: <note>" directly without an external LLM, or configure your endpoint in Settings.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    'What tasks are on my todo list?',
    'Add todo: Review project milestones',
    'Capture thought: Exploring client-side encryption architectures',
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: 900,
        margin: '0 auto',
        padding: '0 1.25rem',
        height: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 0.2rem' }}>AI Assistant</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Client-Side Execution • Direct IndexedDB MCP Tools
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setShowConfig(!showConfig)}>
          ⚙ AI Endpoint Settings
        </button>
      </div>

      {showConfig && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#161616',
            border: '1px solid #333',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>OpenAI-compatible Endpoint (Ollama / OpenRouter)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              placeholder="Base URL (e.g. http://localhost:11434/v1)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <input
              type="text"
              className="input"
              placeholder="Model Name (e.g. llama3.2)"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
            <input
              type="password"
              className="input"
              placeholder="API Key (Optional for Ollama)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveAiConfig} style={{ alignSelf: 'flex-start' }}>
            Save Endpoint
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div
        className="card"
        style={{
          flex: 1,
          minHeight: '380px',
          maxHeight: '520px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.25rem',
          backgroundColor: '#121212',
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '0.75rem 1rem',
                borderRadius: '14px',
                fontSize: '0.9rem',
                lineHeight: 1.5,
                backgroundColor: m.role === 'user' ? '#863bff' : '#222222',
                color: '#fff',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {m.content}
            </div>

            {m.tool_calls && m.tool_calls.length > 0 && (
              <div
                style={{
                  marginTop: '0.4rem',
                  fontSize: '0.75rem',
                  color: '#34d399',
                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                }}
              >
                🛠 Tool executed: {m.tool_calls.map((tc) => tc.name || tc.result).join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Assistant is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {QUICK_PROMPTS.map((qp, i) => (
          <button
            key={i}
            className="btn btn-secondary btn-sm"
            onClick={() => handleSend(qp)}
            disabled={loading}
            style={{ fontSize: '0.78rem' }}
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '4rem' }}
      >
        <input
          type="text"
          className="input"
          placeholder="Ask a question or enter 'Add todo: ...'"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
