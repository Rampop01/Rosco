'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  onShowLanding?: () => void;
  isLandingView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onBack, onShowLanding, isLandingView }) => {
  const { wallet, user, disconnect } = useAuth();

  return (
    <header className="header-sticky">
      <div className="header-inner">
        {/* Brand & Back Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {onBack && (
            <button 
              onClick={onBack}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
            >
              ← Back
            </button>
          )}

          <div 
            onClick={onShowLanding} 
            className="brand-logo"
          >
            <div className="brand-icon">
              R
            </div>
            <div>
              <div className="brand-title">{title || 'Rosco'}</div>
            </div>
          </div>

          <div className="network-badge">
            <span className="network-dot"></span>
            Nimiq Testnet
          </div>
        </div>

        {/* Right Navigation & Wallet State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {onShowLanding && (
            <button 
              className="btn-secondary"
              onClick={onShowLanding}
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.82rem',
                background: isLandingView ? 'rgba(230, 180, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: isLandingView ? 'var(--accent-gold)' : 'var(--border-color)',
                color: isLandingView ? 'var(--accent-gold-light)' : 'var(--text-secondary)'
              }}
            >
              {isLandingView ? 'App Dashboard' : 'Landing Page'}
            </button>
          )}

          {wallet ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-full)',
                padding: '0.45rem 0.95rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>
                  {wallet.balance ? `${wallet.balance} NIM` : 'Dev Wallet'}
                </span>
                <span style={{ color: 'rgba(0,0,0,0.15)' }}>|</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {wallet.address.slice(0, 4)}...{wallet.address.slice(-4)}
                </span>
              </div>

              <button 
                onClick={disconnect}
                title="Disconnect Wallet"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  color: '#EF4444',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}>
                Connect Wallet
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
