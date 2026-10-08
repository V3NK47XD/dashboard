import React from 'react';
import TodoList from '../components/TodoList';

export default function Todos() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 800, margin: '0 auto', padding: '0 1.25rem' }}>
      <div>
        <h1>Tasks & Todos</h1>
        <p>Offline-first task management • Mutations sync automatically when connected</p>
      </div>

      <TodoList />

      <div className="card" style={{ backgroundColor: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
        <h4 style={{ color: '#60a5fa', marginBottom: '0.35rem' }}>ℹ Offline Reliability Notice</h4>
        <p style={{ color: 'var(--text-secondary)' }}>
          This page works with Wi-Fi off, airplane mode enabled, or the server shut down.
          All writes are stored in local IndexedDB first and encrypted & synced to npoint.io.
        </p>
      </div>
    </div>
  );
}
