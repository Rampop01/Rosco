'use client';

import React from 'react';

interface RoscoLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  className?: string;
}

export const RoscoLogo: React.FC<RoscoLogoProps> = ({
  size = 36,
  showText = false,
  textColor = '#0F172A',
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}>
      {/* Dynamic Geometric Rosco Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="roscoBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066FF" />
            <stop offset="50%" stopColor="#0052CC" />
            <stop offset="100%" stopColor="#003399" />
          </linearGradient>
          <linearGradient id="roscoCyanGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D2FF" />
            <stop offset="100%" stopColor="#0066FF" />
          </linearGradient>
          <linearGradient id="roscoGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0066FF" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Outer Rotating Savings Circle (ROSCA loop) */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#roscoBlueGrad)"
          strokeWidth="9"
          strokeDasharray="210 65"
          strokeLinecap="round"
          filter="url(#subtleGlow)"
        />

        {/* Inner Gold Accented Cycle Arc */}
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="url(#roscoGoldGrad)"
          strokeWidth="3.5"
          strokeDasharray="90 140"
          strokeLinecap="round"
          transform="rotate(65 50 50)"
        />

        {/* Cyan Orbit Ribbon */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#roscoCyanGrad)"
          strokeWidth="4"
          strokeDasharray="60 215"
          strokeLinecap="round"
          transform="rotate(190 50 50)"
        />

        {/* Stylized Modern "R" Glyph */}
        <path
          d="M 38 29
             L 38 71
             M 38 31
             L 53 31
             C 63 31, 65 47, 53 47
             L 38 47
             M 49 47
             L 63 71"
          stroke="#0066FF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Center Golden Pivot Dot */}
        <circle cx="51" cy="39" r="2.5" fill="#F59E0B" />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: `${Math.round(size * 0.65)}px`,
              fontWeight: 900,
              fontFamily: 'var(--font-heading)',
              color: textColor,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Rosco
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#0066FF',
            }}
          >
            Protocol
          </span>
        </div>
      )}
    </div>
  );
};
