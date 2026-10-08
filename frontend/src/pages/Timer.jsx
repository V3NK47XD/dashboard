import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

const PRESETS = [2, 5, 10, 20, 30, 40, 45, 60, 90, 120];

export default function Timer() {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const targetEndTimeRef = useRef(null);
  const animFrameRef = useRef(null);

  const totalMs = useMemo(() => durationMinutes * 60 * 1000, [durationMinutes]);

  // Web Audio chime on completion
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
      gain1.gain.setValueAtTime(0.15, now);
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
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.8);
    } catch {
      // AudioContext unavailable or blocked by autoplay
    }
  }, []);

  // Drift-proof timer update loop using targetEndTime
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const now = Date.now();
      const left = targetEndTimeRef.current - now;

      if (left <= 0) {
        setRemainingMs(0);
        setIsRunning(false);
        setIsFinished(true);
        playChime();
      } else {
        setRemainingMs(left);
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isRunning, playChime]);

  const handleStart = () => {
    if (isFinished || remainingMs <= 0) {
      targetEndTimeRef.current = Date.now() + totalMs;
      setRemainingMs(totalMs);
    } else {
      targetEndTimeRef.current = Date.now() + remainingMs;
    }
    setIsFinished(false);
    setIsRunning(true);
  };

  const handlePause = () => {
    if (targetEndTimeRef.current) {
      const left = Math.max(0, targetEndTimeRef.current - Date.now());
      setRemainingMs(left);
    }
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsFinished(false);
    setRemainingMs(totalMs);
  };

  const handleSelectPreset = (mins) => {
    setIsRunning(false);
    setIsFinished(false);
    setDurationMinutes(mins);
    setRemainingMs(mins * 60 * 1000);
  };

  const handleSliderChange = (e) => {
    const mins = parseInt(e.target.value, 10);
    setIsRunning(false);
    setIsFinished(false);
    setDurationMinutes(mins);
    setRemainingMs(mins * 60 * 1000);
  };

  // Radial progress calculations
  const radius = 96;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const elapsedMs = totalMs - remainingMs;
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
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: '0.25rem 0.75rem',
      }}
    >
      {/* 1. Quick Presets Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '0.15rem 0.1rem',
          flexShrink: 0,
        }}
      >
        {PRESETS.map((p) => {
          const isActive = durationMinutes === p;
          return (
            <button
              key={p}
              onClick={() => handleSelectPreset(p)}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: isActive ? '1px solid #10b981' : '1px solid #262626',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.2)' : '#121212',
                color: isActive ? '#34d399' : '#888888',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {p}m
            </button>
          );
        })}
      </div>

      {/* 2. Full Circular Radial Timer UI */}
      <div
        style={{
          position: 'relative',
          width: 'min(64vw, 240px)',
          height: 'min(64vw, 240px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          margin: 'auto 0',
        }}
      >
        <svg
          viewBox="0 0 220 220"
          style={{
            width: '100%',
            height: '100%',
            transform: 'rotate(-90deg)',
            filter: isRunning ? 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.25))' : 'none',
          }}
        >
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>

          {/* Background Track Circle */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke="#181818"
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
              fontSize: formattedTime.length > 5 ? '1.85rem' : '2.35rem',
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
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: isFinished ? '#34d399' : isRunning ? '#06b6d4' : 'var(--text-muted)',
              marginTop: '0.4rem',
            }}
          >
            {isFinished ? 'Completed! ✦' : isRunning ? 'Focusing' : 'Ready'}
          </div>
        </div>
      </div>

      {/* 3. Controls & Slider Container */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0,
          marginBottom: '0.35rem',
        }}
      >
        {/* Play, Pause, Reset Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={handleReset}
            title="Reset timer"
            aria-label="Reset timer"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#161616',
              border: '1.5px solid #2a2a2a',
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
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Pause size={24} fill="#000000" />
            </button>
          ) : (
            <button
              onClick={handleStart}
              title="Start timer"
              aria-label="Start timer"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#10b981',
                border: 'none',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Play size={24} fill="#000000" style={{ marginLeft: '2px' }} />
            </button>
          )}
        </div>

        {/* Configurable Slider (1 to 120 mins) */}
        <div style={{ width: '100%', padding: '0 0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Duration Slider</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>{durationMinutes} minutes</span>
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
              opacity: isRunning ? 0.6 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
