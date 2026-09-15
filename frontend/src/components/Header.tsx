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
  const [copied, setCopied] = React.useState(false);

  const handleCopyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
              <div 
                onClick={handleCopyAddress}
                title="Click to copy full Nimiq wallet address"
                style={{
                  background: copied ? 'rgba(16, 185, 129, 0.1)' : '#F8FAFC',
                  border: copied ? '1px solid #10B981' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>
                  {wallet.balance !== undefined ? `${wallet.balance} NIM` : 'Nimiq Wallet'}
                </span>
                <span style={{ color: 'rgba(0,0,0,0.15)' }}>|</span>
                <span style={{ fontFamily: 'monospace', color: copied ? '#10B981' : 'var(--text-secondary)', fontWeight: copied ? 700 : 400 }}>
                  {copied ? 'Copied! ✓' : `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`}
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
