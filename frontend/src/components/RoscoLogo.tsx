'use client';

import React from 'react';

interface RoscoLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  className?: string;
  onClick?: () => void;
}

export const RoscoLogo: React.FC<RoscoLogoProps> = ({
  size = 36,
  showText = false,
  textColor = '#0F172A',
  className = '',
  onClick,
}) => {
  return (
    <div 
      className={`inline-flex items-center gap-2 ${className}`} 
      onClick={onClick}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.65rem',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >
      {/* 3D Interlocking Rotating Ribbon Emblem */}
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: 'drop-shadow(0 2px 6px rgba(0, 102, 255, 0.2))',
          transition: 'transform 0.2s ease',
        }}
      >
        <img
          src="/rosco_logo.jpg"
          alt="Rosco Logo"
          width={size}
          height={size}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            objectFit: 'contain',
            borderRadius: '50%',
            display: 'block',
          }}
        />
      </div>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: `${Math.max(16, Math.round(size * 0.62))}px`,
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
