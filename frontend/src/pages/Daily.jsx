import React, { useState, useEffect } from 'react';
import ContributionGraph from '../components/ContributionGraph';
import { getDailyLogs, getDailyLogByDate, saveDailyMetrics, DEFAULT_DAILY_METRICS } from '../db/daily';
import { subscribeDataChanges } from '../sync/npointSync';

export default function Daily({ initialDate }) {
  const [selectedDate, setSelectedDate] = useState(
    () => initialDate || new Date().toISOString().split('T')[0]
  );
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({ ...DEFAULT_DAILY_METRICS });
  const [savedNotice, setSavedNotice] = useState(false);

  const loadData = async () => {
    const allLogs = await getDailyLogs();
    setLogs(allLogs);
    const dayLog = await getDailyLogByDate(selectedDate);
    setMetrics({
      sleep_minutes: dayLog.sleep_minutes || 0,
      water_ml: dayLog.water_ml || 0,
      protein_g: dayLog.protein_g || 0,
      fiber_g: dayLog.fiber_g || 0,
      sugar_g: dayLog.sugar_g || 0,
      learning_minutes: dayLog.learning_minutes || 0,
      exercise_minutes: dayLog.exercise_minutes || 0,
      leetcode_solved: dayLog.leetcode_solved || 0,
    });
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeDataChanges(() => {
      loadData();
    });
    return () => unsub();
  }, [selectedDate]);

  const handleFieldChange = (field, val) => {
    setMetrics((prev) => ({
      ...prev,
      [field]: Math.max(0, parseFloat(val) || 0),
    }));
  };

  const handleQuickAdd = (field, amount) => {
    setMetrics((prev) => ({
      ...prev,
      [field]: Math.max(0, (prev[field] || 0) + amount),
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    await saveDailyMetrics(selectedDate, metrics);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    const allLogs = await getDailyLogs();
    setLogs(allLogs);
  };

  const setRelativeDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const sleepHours = Math.floor(metrics.sleep_minutes / 60);
  const sleepMins = metrics.sleep_minutes % 60;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Daily Tracking</h1>
          <p>Track your health, habits, and learning • Continuous offline persistence</p>
        </div>

        {/* Date Selector Shortcuts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setRelativeDate(0)}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setRelativeDate(-1)}>
            Yesterday
          </button>
          <input
            type="date"
            className="input"
            style={{ width: 'auto', padding: '0.35rem 0.6rem' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Heatmap Section */}
      <ContributionGraph
        logs={logs}
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d)}
      />

      {/* Metric Entry Form */}
      <form onSubmit={handleSave} className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Metrics for {selectedDate}</h2>
            <p style={{ fontSize: '0.85rem' }}>Update your numbers below and click Save</p>
          </div>
          {savedNotice && (
            <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
              ✓ Saved to local DB & queued for sync!
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {/* Sleep */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              😴 Sleep Time
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="number"
                className="input"
                style={{ width: '80px' }}
                value={sleepHours}
                onChange={(e) => {
                  const h = parseInt(e.target.value, 10) || 0;
                  setMetrics((p) => ({ ...p, sleep_minutes: h * 60 + sleepMins }));
                }}
                min={0}
                max={24}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>hours</span>
              <input
                type="number"
                className="input"
                style={{ width: '80px' }}
                value={sleepMins}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10) || 0;
                  setMetrics((p) => ({ ...p, sleep_minutes: sleepHours * 60 + m }));
                }}
                min={0}
                max={59}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>mins</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[6, 7, 8].map((h) => (
                <button
                  type="button"
                  key={h}
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMetrics((p) => ({ ...p, sleep_minutes: h * 60 }))}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Water */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              💧 Water Intake (ml)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.water_ml}
              onChange={(e) => handleFieldChange('water_ml', e.target.value)}
              step={50}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[250, 500, 1000].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('water_ml', amt)}
                >
                  +{amt}ml
                </button>
              ))}
            </div>
          </div>

          {/* Protein */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              🥩 Protein (g)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.protein_g}
              onChange={(e) => handleFieldChange('protein_g', e.target.value)}
              step={1}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[20, 30, 50].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('protein_g', amt)}
                >
                  +{amt}g
                </button>
              ))}
            </div>
          </div>

          {/* Fiber */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              🥦 Fiber (g)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.fiber_g}
              onChange={(e) => handleFieldChange('fiber_g', e.target.value)}
              step={1}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[5, 10, 15].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('fiber_g', amt)}
                >
                  +{amt}g
                </button>
              ))}
            </div>
          </div>

          {/* Sugar */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              🍬 Sugar (g)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.sugar_g}
              onChange={(e) => handleFieldChange('sugar_g', e.target.value)}
              step={1}
            />
          </div>

          {/* Learning */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              📚 Learning (minutes)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.learning_minutes}
              onChange={(e) => handleFieldChange('learning_minutes', e.target.value)}
              step={5}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[15, 30, 60].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('learning_minutes', amt)}
                >
                  +{amt}m
                </button>
              ))}
            </div>
          </div>

          {/* Exercise */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              🏃 Exercise (minutes)
            </label>
            <input
              type="number"
              className="input"
              value={metrics.exercise_minutes}
              onChange={(e) => handleFieldChange('exercise_minutes', e.target.value)}
              step={5}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[15, 30, 45].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('exercise_minutes', amt)}
                >
                  +{amt}m
                </button>
              ))}
            </div>
          </div>

          {/* LeetCode */}
          <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
              💡 LeetCode Problems Solved
            </label>
            <input
              type="number"
              className="input"
              value={metrics.leetcode_solved}
              onChange={(e) => handleFieldChange('leetcode_solved', e.target.value)}
              step={1}
            />
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
              {[1, 2, 3].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickAdd('leetcode_solved', amt)}
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="submit" className="btn btn-primary" style={{ minWidth: '140px' }}>
            Save Metrics
          </button>
        </div>
      </form>
    </div>
  );
}
