'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Copy, Check } from 'lucide-react';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onBack && (
            <button 
              onClick={onBack}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
            >
              ← Back
            </button>
          )}

          <div 
            onClick={onShowLanding} 
            className="brand-logo"
            style={{ minWidth: 0 }}
          >
            <div className="brand-icon">
              R
            </div>
            {title !== '' && (
              <div 
                className="brand-title"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: title ? '1.1rem' : '1.35rem',
                  maxWidth: onBack ? '140px' : '220px'
                }}
              >
                {title || 'Rosco'}
              </div>
            )}
          </div>
        </div>

        {/* Right Navigation & Wallet State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {wallet ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div 
                onClick={handleCopyAddress}
                title="Click to copy full Nimiq wallet address"
                style={{
                  background: copied ? 'rgba(16, 185, 129, 0.1)' : '#F8FAFC',
                  border: copied ? '1px solid #10B981' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontFamily: 'monospace', color: copied ? '#10B981' : 'var(--text-primary)', fontWeight: 600 }}>
                  {copied ? 'Copied!' : `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`}
                </span>
                {copied ? (
                  <Check style={{ width: '13px', height: '13px', color: '#10B981' }} />
                ) : (
                  <Copy style={{ width: '13px', height: '13px', opacity: 0.6 }} />
                )}
              </div>

              <button 
                onClick={disconnect}
                title="Disconnect Wallet"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-full)',
                  color: '#EF4444',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}>
                Connect Wallet
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
