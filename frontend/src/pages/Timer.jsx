import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import {
  getTimerState,
  syncSaveTimer,
  syncClearTimer,
  subscribeDataChanges,
} from '../sync/npointSync';

const PRESETS = [2, 5, 10, 20, 30, 40, 45, 60, 90, 120];

export default function Timer() {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const totalMs = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes]);

  // Audio completion chime via native Web Audio API
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1: E5 (659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: B5 (987.77Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.15);
      gain2.gain.setValueAtTime(0.18, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.9);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }, []);

  // Sync state with cloud / local stored timer
  const syncWithStoredTimer = useCallback(() => {
    const timer = getTimerState();
    if (!timer) {
      if (isRunning) {
        setIsRunning(false);
      }
      return;
    }

    if (timer.durationMinutes) {
      setDurationMinutes(timer.durationMinutes);
    }

    if (timer.isPaused) {
      setIsRunning(false);
      setIsFinished(false);
      setRemainingMs(timer.pausedRemainingMs || 0);
    } else if (timer.targetEndAt) {
      const now = Date.now();
      const left = timer.targetEndAt - now;
      if (left <= 0) {
        setRemainingMs(0);
        setIsRunning(false);
        setIsFinished(true);
        syncClearTimer(); // Null/remove when ended
      } else {
        setRemainingMs(left);
        setIsRunning(true);
        setIsFinished(false);
      }
    }
  }, [isRunning]);

  // Initial load and listen for remote changes (e.g. phone <-> laptop sync)
  useEffect(() => {
    syncWithStoredTimer();
    const unsub = subscribeDataChanges(() => {
      syncWithStoredTimer();
    });
    return () => unsub();
  }, [syncWithStoredTimer]);

  // Drift-proof timer update loop: computes remaining = targetEndAt - Date.now()
  useEffect(() => {
    if (!isRunning) return;

    let animId = null;

    const tick = () => {
      const timer = getTimerState();
      if (!timer || timer.isPaused || !timer.targetEndAt) {
        setIsRunning(false);
        return;
      }

      const now = Date.now();
      const left = timer.targetEndAt - now;

      if (left <= 0) {
        setRemainingMs(0);
        setIsRunning(false);
        setIsFinished(true);
        playChime();
        syncClearTimer(); // Remove from cloud when timer ends
      } else {
        setRemainingMs(left);
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isRunning, playChime]);

  // Start or resume timer
  const handleStart = () => {
    const now = Date.now();
    const timer = getTimerState();
    let targetEndAt;

    if (timer && timer.isPaused && timer.pausedRemainingMs > 0) {
      targetEndAt = now + timer.pausedRemainingMs;
    } else if (isFinished || remainingMs <= 0 || !timer) {
      targetEndAt = now + totalMs;
      setRemainingMs(totalMs);
    } else {
      targetEndAt = now + remainingMs;
    }

    const timerPayload = {
      durationMinutes,
      startedAt: timer?.startedAt || now,
      targetEndAt,
      isPaused: false,
      pausedRemainingMs: null,
    };

    setIsRunning(true);
    setIsFinished(false);
    syncSaveTimer(timerPayload);
  };

  // Pause timer
  const handlePause = () => {
    const timer = getTimerState();
    if (!timer || !timer.targetEndAt) {
      setIsRunning(false);
      return;
    }

    const now = Date.now();
    const left = Math.max(0, timer.targetEndAt - now);

    const timerPayload = {
      ...timer,
      isPaused: true,
      pausedRemainingMs: left,
      targetEndAt: null,
    };

    setRemainingMs(left);
    setIsRunning(false);
    syncSaveTimer(timerPayload);
  };

  // Reset timer
  const handleReset = () => {
    setIsRunning(false);
    setIsFinished(false);
    setRemainingMs(totalMs);
    syncClearTimer(); // Clear timer in jsonbin and local storage
  };

  // Select preset duration
  const handleSelectPreset = (mins) => {
    if (isRunning) return;
    setDurationMinutes(mins);
    setRemainingMs(mins * 60 * 1000);
    setIsFinished(false);
  };

  // Slider change
  const handleSliderChange = (e) => {
    if (isRunning) return;
    const mins = parseInt(e.target.value, 10);
    setDurationMinutes(mins);
    setRemainingMs(mins * 60 * 1000);
    setIsFinished(false);
  };

  // Radial progress calculations
  const radius = 96;
  const stroke = 11;
  const circumference = 2 * Math.PI * radius;
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, elapsedMs / totalMs)) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  // Time format string
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const formattedTime = useMemo(() => {
    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [totalSeconds]);

  return (
    <div
      className="page-responsive-container fixed-viewport-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: '0.5rem 1rem',
      }}
    >
      {/* Centered Desktop Card Shell */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          backgroundColor: '#121212',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          borderTop: '3px solid #10b981',
          borderRadius: '20px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.08)',
          gap: '1rem',
          overflow: 'hidden',
        }}
      >
        {/* 1. Presets Header Strip */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            flexWrap: 'wrap',
          }}
        >
          {PRESETS.map((p) => {
            const isActive = durationMinutes === p;
            return (
              <button
                key={p}
                onClick={() => handleSelectPreset(p)}
                disabled={isRunning}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  border: isActive ? '1px solid #10b981' : '1px solid #282828',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : '#181818',
                  color: isActive ? '#34d399' : '#888888',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunning && !isActive ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {p}m
              </button>
            );
          })}
        </div>

        {/* 2. Full Circular Radial Timer UI (Responsive for PC & Mobile) */}
        <div
          style={{
            position: 'relative',
            width: 'clamp(230px, 28vw, 290px)',
            height: 'clamp(230px, 28vw, 290px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            margin: '0.25rem 0',
          }}
        >
          <svg
            viewBox="0 0 220 220"
            style={{
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
              filter: isRunning ? 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.3))' : 'none',
            }}
          >
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Background Track Circle */}
            <circle
              cx="110"
              cy="110"
              r={radius}
              stroke="#1a1a1a"
              strokeWidth={stroke}
              fill="none"
            />

            {/* Radially Loading Progress Circle */}
            <circle
              cx="110"
              cy="110"
              r={radius}
              stroke="url(#timerGradient)"
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              style={{
                transition: isRunning ? 'stroke-dashoffset 0.1s linear' : 'stroke-dashoffset 0.3s ease',
              }}
            />
          </svg>

          {/* Center Countdown Display */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: formattedTime.length > 5 ? 'clamp(1.9rem, 3.2vw, 2.7rem)' : 'clamp(2.5rem, 4.2vw, 3.4rem)',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                color: isFinished ? '#10b981' : '#ffffff',
                lineHeight: 1,
              }}
            >
              {formattedTime}
            </div>

            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: isFinished ? '#34d399' : isRunning ? '#06b6d4' : 'var(--text-muted)',
                backgroundColor: isRunning ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                marginTop: '0.55rem',
                border: `1px solid ${isRunning ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              }}
            >
              {isFinished ? 'Completed! ✦' : isRunning ? 'Focusing (Synced)' : 'Ready'}
            </div>
          </div>
        </div>

        {/* 3. Controls (Play, Pause, Reset) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={handleReset}
            title="Reset timer"
            aria-label="Reset timer"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: '#181818',
              border: '1.5px solid #2e2e2e',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={18} />
          </button>

          {isRunning ? (
            <button
              onClick={handlePause}
              title="Pause timer"
              aria-label="Pause timer"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              <Pause size={26} fill="#000000" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              title="Start timer"
              aria-label="Start timer"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              <Play size={26} fill="#000000" style={{ marginLeft: '3px' }} />
            </button>
          )}
        </div>

        {/* 4. Configurable Slider (1 to 120 mins) */}
        <div style={{ width: '100%', maxWidth: '440px', padding: '0 0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Duration Slider</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399' }}>
              {durationMinutes} minutes
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="120"
            step="1"
            value={durationMinutes}
            onChange={handleSliderChange}
            disabled={isRunning}
            style={{
              width: '100%',
              accentColor: '#10b981',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.45 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
