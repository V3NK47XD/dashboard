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

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.6rem' }}>
      {/* Filter Selector & Counts Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.2rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {[
            { id: 'all', label: 'All', count: todos.length },
            { id: 'active', label: 'Active', count: activeCount },
            { id: 'completed', label: 'Done', count: completedCount },
          ].map(({ id: f, label, count }) => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.74rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '8px',
                border: filter === f ? '1px solid #3b82f6' : '1px solid #2a2a2a',
                backgroundColor: filter === f ? '#1d4ed8' : '#141414',
                color: '#ffffff',
              }}
              onClick={() => setFilter(f)}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Separate Input Box (Outside the List Card) */}
      <form
        onSubmit={handleCreate}
        style={{
          display: 'flex',
          gap: '0.45rem',
          padding: '0.35rem 0.45rem 0.35rem 0.75rem',
          backgroundColor: '#121212',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        }}
      >
        <input
          type="text"
          className="input"
          placeholder="Add task and press Enter..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            padding: '0.25rem 0',
            fontSize: '0.85rem',
            color: '#ffffff',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: newTitle.trim() ? '#3b82f6' : '#222222',
            border: 'none',
            color: '#ffffff',
            cursor: newTitle.trim() ? 'pointer' : 'default',
            opacity: newTitle.trim() ? 1 : 0.5,
            transition: 'all 0.15s ease',
          }}
          aria-label="Add task"
        >
          <Plus size={16} />
        </button>
      </form>

      {/* Scrollable Tasks List Container Card */}
      <div
        className="card"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0.65rem 0.75rem',
          backgroundColor: '#111111',
          border: '1.5px solid rgba(59, 130, 246, 0.3)',
          borderTop: '3px solid #3b82f6',
          borderRadius: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        {filteredTodos.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No tasks in this view.
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
                padding: '0.45rem 0.65rem',
                backgroundColor: todo.completed ? 'rgba(16, 185, 129, 0.04)' : 'rgba(59, 130, 246, 0.04)',
                borderRadius: '10px',
                border: todo.completed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)',
                borderLeft: todo.completed ? '3px solid #10b981' : '3px solid #3b82f6',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                opacity: todo.completed ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    backgroundColor: todo.completed ? '#10b981' : 'transparent',
                    border: todo.completed ? '1px solid #10b981' : '1.5px solid #666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                  aria-label={todo.completed ? 'Mark uncompleted' : 'Mark completed'}
                >
                  {todo.completed && <Check size={12} color="#ffffff" strokeWidth={3} />}
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
                      borderRadius: '6px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.84rem',
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
                      fontSize: '0.84rem',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}
                  >
                    {todo.title}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                <button
                  className="icon-btn"
                  title="Edit task"
                  onClick={() => handleStartEdit(todo)}
                  style={{ width: '26px', height: '26px', border: '1px solid #282828', borderRadius: '6px' }}
                >
                  <Edit2 size={12} />
                </button>
                <button
                  className="icon-btn"
                  title="Delete task"
                  onClick={() => handleDelete(todo.id)}
                  style={{ width: '26px', height: '26px', border: '1px solid #282828', borderRadius: '6px', color: '#ef4444' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
