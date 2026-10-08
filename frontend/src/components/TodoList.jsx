import React, { useState, useEffect } from 'react';
import { getTodos, createTodo, toggleTodo, updateTodoTitle, deleteTodo } from '../db/todos';
import { subscribeDataChanges } from '../sync/npointSync';

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
    await createTodo(newTitle);
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
      await updateTodoTitle(id, editingText);
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
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Tasks & Todos</h2>
          <p style={{ fontSize: '0.85rem' }}>
            {pendingCount} remaining • Local-first & offline ready
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['all', 'active', 'completed'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Input box */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          className="input"
          placeholder="Add a new task and press Enter..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>

      {/* Todo items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredTodos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            No tasks found in this view.
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                opacity: todo.completed ? 0.65 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggle(todo.id)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#3b82f6',
                    cursor: 'pointer',
                  }}
                />

                {editingId === todo.id ? (
                  <input
                    type="text"
                    className="input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveEdit(todo.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(todo.id)}
                    autoFocus
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem' }}
                  />
                ) : (
                  <span
                    onClick={() => handleStartEdit(todo)}
                    style={{
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      cursor: 'pointer',
                      fontSize: '0.92rem',
                    }}
                  >
                    {todo.title}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  title="Edit task"
                  onClick={() => handleStartEdit(todo)}
                >
                  ✎
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  title="Delete task"
                  onClick={() => handleDelete(todo.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
