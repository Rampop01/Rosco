'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { CircleCard } from '../components/CircleCard';
import { LandingPage } from '../components/LandingPage';
import { getCircles, Circle } from '../lib/api';
import Link from 'next/link';

export default function Home() {
  const { user, wallet, isLoading, connectWallet } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [fetching, setFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'app' | 'landing'>('landing');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'FORMING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    if (user) {
      loadCircles();
    }
  }, [user]);

  const loadCircles = async () => {
    try {
      setFetching(true);
      const list = await getCircles();
      setCircles(list);
    } catch (err) {
      console.error('Failed to load circles:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleConnectAndLaunch = async (displayName?: string) => {
    await connectWallet(displayName);
    setViewMode('app');
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '2rem' }}>
        <div className="pulse-glow" style={{ width: '70px', height: '70px', borderRadius: '16px', background: 'linear-gradient(135deg, #FFD700, #E6B400)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', color: '#080B11', fontWeight: 900 }}>
          R
        </div>
        <p className="text-muted" style={{ marginTop: '1.25rem', fontWeight: 600, fontSize: '0.95rem' }}>Loading Rosco Protocol...</p>
      </div>
    );
  }

  // ─── Public Landing Page Mode ──────────────────────────────────────────────
  if (!user || !wallet || viewMode === 'landing') {
    return (
      <LandingPage 
        onConnectWallet={handleConnectAndLaunch} 
        isLoggedIn={!!user && !!wallet}
        onGoToDashboard={() => setViewMode('app')}
      />
    );
  }

  // ─── Filter & Search Logic ────────────────────────────────────────────────
  const filteredCircles = circles.filter(c => {
    const matchesFilter = filterStatus === 'ALL' || c.status === filterStatus;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCount = circles.filter(c => c.status === 'ACTIVE').length;
  const formingCount = circles.filter(c => c.status === 'FORMING').length;
  const completedCount = circles.filter(c => c.status === 'COMPLETED').length;

  const totalPotValue = circles.reduce((acc, c) => acc + (c.contribution_amount * c.max_members), 0);

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <Header 
        onShowLanding={() => setViewMode('landing')} 
        isLandingView={false}
      />

      <main>
        {/* User Hero & Stat Summary Overview */}
        <div className="glass-card" style={{
          background: 'linear-gradient(135deg, rgba(22, 28, 48, 0.9), rgba(12, 16, 28, 0.95))',
          marginBottom: '2rem',
          border: '1px solid var(--border-glow)',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>Connected</span>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Nimiq Pay Protocol</span>
              </div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>
                {user.display_name || 'Savings Member'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.3rem' }}>
                <span className="text-secondary" style={{ fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {wallet.address}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(wallet.address);
                    setAddressCopied(true);
                    setTimeout(() => setAddressCopied(false), 2000);
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    background: addressCopied ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.1)',
                    color: addressCopied ? '#10B981' : 'var(--text-secondary)',
                    borderColor: addressCopied ? '#10B981' : 'var(--border-color)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {addressCopied ? 'Copied! ✓' : '📋 Copy Address'}
                </button>
              </div>
            </div>

            <Link href="/create" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ padding: '0.9rem 1.85rem', fontSize: '1.05rem' }}>
                + Create New Circle
              </button>
            </Link>
          </div>

          {/* Stat Summary Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1.25rem',
            marginTop: '1.75rem'
          }}>
            <div className="stat-card">
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Managed Circle Volume</span>
              <div className="stat-value text-gold">{totalPotValue.toLocaleString()} NIM</div>
            </div>

            <div className="stat-card">
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Circles</span>
              <div className="stat-value">{activeCount}</div>
            </div>

            <div className="stat-card">
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Forming Circles</span>
              <div className="stat-value" style={{ color: 'var(--status-pending)' }}>{formingCount}</div>
            </div>

            <div className="stat-card">
              <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed Circles</span>
              <div className="stat-value text-cyan">{completedCount}</div>
            </div>
          </div>
        </div>

        {/* Circles Header & Filter Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>
              Savings Circles ({circles.length})
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Manage your rotating contributions and track round payouts.
            </p>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              className="form-input" 
              placeholder="🔍 Search circles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.55rem 1rem', fontSize: '0.88rem', minWidth: '220px' }}
            />

            <div className="filter-tabs">
              <button 
                className={`filter-tab ${filterStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ALL')}
              >
                All ({circles.length})
              </button>
              <button 
                className={`filter-tab ${filterStatus === 'ACTIVE' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ACTIVE')}
              >
                Active ({activeCount})
              </button>
              <button 
                className={`filter-tab ${filterStatus === 'FORMING' ? 'active' : ''}`}
                onClick={() => setFilterStatus('FORMING')}
              >
                Forming ({formingCount})
              </button>
              <button 
                className={`filter-tab ${filterStatus === 'COMPLETED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('COMPLETED')}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Circles Display Grid */}
        {fetching ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p className="text-muted" style={{ fontSize: '0.95rem' }}>Refreshing circle statuses...</p>
          </div>
        ) : filteredCircles.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
            <h4 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>No circles found</h4>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.75rem', maxWidth: '440px', margin: '0 auto 1.75rem' }}>
              {searchQuery || filterStatus !== 'ALL' 
                ? 'No circles matched your current filter. Try resetting your search.' 
                : 'Create your first rotating savings circle or join one using a shareable invite link!'}
            </p>
            <Link href="/create" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <button className="btn-primary" style={{ padding: '0.85rem 1.75rem' }}>
                + Launch New Circle
              </button>
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredCircles.map(circle => (
              <Link key={circle.id} href={`/circle/${circle.id}`} style={{ textDecoration: 'none' }}>
                <CircleCard circle={circle} onClick={() => {}} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
