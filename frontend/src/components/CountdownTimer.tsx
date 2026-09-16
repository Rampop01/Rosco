'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string | Date | number;
  label?: string;
  onExpire?: () => void;
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  label = 'Next Contribution In',
  onExpire,
  compact = false
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    const calculateTime = () => {
      const target = new Date(targetDate).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        if (onExpire) onExpire();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: compact ? '0.2rem 0.5rem' : '0.4rem 0.8rem',
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid #10B981',
        borderRadius: '8px',
        color: '#10B981',
        fontSize: compact ? '0.75rem' : '0.85rem',
        fontWeight: 700
      }}>
        <span>●</span>
        <span>Contribution Window Open Now</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color: '#38BDF8',
        fontFamily: 'monospace',
        fontSize: '0.82rem',
        fontWeight: 700
      }}>
        <Clock style={{ width: '13px', height: '13px' }} />
        <span>
          {timeLeft.days > 0 && `${timeLeft.days}d `}
          {String(timeLeft.hours).padStart(2, '0')}:
          {String(timeLeft.minutes).padStart(2, '0')}:
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      borderRadius: '12px',
      padding: '0.85rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#FFFFFF'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Clock style={{ width: '14px', height: '14px', color: '#38BDF8' }} />
        <span>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
        {timeLeft.days > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38BDF8', lineHeight: 1 }}>{timeLeft.days}</span>
            <span style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase' }}>days</span>
          </div>
        )}

        {timeLeft.days > 0 && <span style={{ fontSize: '1.2rem', color: '#475569' }}>:</span>}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38BDF8', lineHeight: 1 }}>
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase' }}>hrs</span>
        </div>

        <span style={{ fontSize: '1.2rem', color: '#475569' }}>:</span>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38BDF8', lineHeight: 1 }}>
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase' }}>min</span>
        </div>

        <span style={{ fontSize: '1.2rem', color: '#475569' }}>:</span>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B', lineHeight: 1 }}>
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.62rem', color: '#94A3B8', textTransform: 'uppercase' }}>sec</span>
        </div>
      </div>
    </div>
  );
};
