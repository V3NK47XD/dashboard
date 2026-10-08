import React, { useState, useEffect } from 'react';
import { getTodos, createTodo, toggleTodo, updateTodoTitle, deleteTodo } from '../db/todos';
import { subscribeDataChanges } from '../sync/npointSync';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | completed
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const loadTodos = async () => {
    const list = await getTodos();
    setTodos(list);
  };

  useEffect(() => {
    loadTodos();
    const unsub = subscribeDataChanges(() => {
      loadTodos();
    });
    return () => unsub();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createTodo(newTitle.trim());
    setNewTitle('');
    loadTodos();
  };

  const handleToggle = async (id) => {
    await toggleTodo(id);
    loadTodos();
  };

  const handleDelete = async (id) => {
    await deleteTodo(id);
    loadTodos();
  };

  const handleStartEdit = (todo) => {
    setEditingId(todo.id);
    setEditingText(todo.title);
  };

  const handleSaveEdit = async (id) => {
    if (editingText.trim()) {
      await updateTodoTitle(id, editingText.trim());
    }
    setEditingId(null);
    loadTodos();
  };

  const filteredTodos = todos.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const pendingCount = todos.filter((t) => !t.completed).length;

  return (
    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#121212', border: '1.5px solid #2e2e2e', borderRadius: '16px' }}>
      <div className="card-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="card-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Tasks & Todos</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            {pendingCount} remaining • Encrypted & offline-ready
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                textTransform: 'capitalize',
                fontSize: '0.78rem',
                border: filter === f ? '1px solid #863bff' : '1px solid #333',
              }}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Input box with border */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Add a new task and press Enter..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: '#0c0c0c',
            border: '1.5px solid #3a3a3a',
            borderRadius: '12px',
            padding: '0.7rem 1rem',
            fontSize: '0.92rem',
            color: '#ffffff',
            outline: 'none',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
          onBlur={(e) => (e.target.style.borderColor = '#3a3a3a')}
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.7rem 1.25rem',
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <Plus size={18} />
          <span>Add</span>
        </button>
      </form>

      {/* Todo items with borders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredTodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No tasks found in this view.
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className="todo-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: '#181818',
                borderRadius: '12px',
                border: '1.5px solid #383838',
                borderLeft: todo.completed ? '3.5px solid #10b981' : '3.5px solid #3b82f6',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                opacity: todo.completed ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    backgroundColor: todo.completed ? '#10b981' : 'transparent',
                    border: todo.completed ? '1px solid #10b981' : '2px solid #555',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  aria-label={todo.completed ? 'Mark uncompleted' : 'Mark completed'}
                >
                  {todo.completed && <Check size={14} color="#ffffff" strokeWidth={3} />}
                </button>

                {editingId === todo.id ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveEdit(todo.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(todo.id)}
                    autoFocus
                    style={{
                      flex: 1,
                      backgroundColor: '#0c0c0c',
                      border: '1.5px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.92rem',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => handleStartEdit(todo)}
                    style={{
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? 'var(--text-muted)' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.92rem',
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {todo.title}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.75rem', flexShrink: 0 }}>
                <button
                  className="icon-btn"
                  title="Edit task"
                  onClick={() => handleStartEdit(todo)}
                  style={{ width: '32px', height: '32px', border: '1px solid #333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="icon-btn"
                  title="Delete task"
                  onClick={() => handleDelete(todo.id)}
                  style={{ width: '32px', height: '32px', border: '1px solid #333', borderRadius: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
