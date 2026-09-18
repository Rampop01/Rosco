'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { CircleCard } from '../components/CircleCard';
import { LandingPage } from '../components/LandingPage';
import { getCircles, resetAllTestData, Circle } from '../lib/api';
import { addNotification } from '../lib/notifications';
import { TargetSavingsView } from '../components/TargetSavingsView';
import { RoscoLogo } from '../components/RoscoLogo';
import Link from 'next/link';
import { Copy, Check, Users, Target } from 'lucide-react';

export default function Home() {
  const { user, wallet, isLoading, connectWallet } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [fetching, setFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'app' | 'landing'>('landing');
  const [appSection, setAppSection] = useState<'circles' | 'targets'>('circles');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'FORMING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    if (user && wallet) {
      setViewMode('app');
    }
  }, [user, wallet]);

  useEffect(() => {
    if (user) {
      loadCircles();
    }
  }, [user, wallet]);

  const loadCircles = async () => {
    try {
      setFetching(true);
      const list = await getCircles();
      setCircles(list);

      // Automated scan: Alert recipient if contributions have landed in their wallet
      const activeWalletAddr = (wallet?.address || user?.nimiq_address || '').replace(/\s+/g, '').toUpperCase();
      if (activeWalletAddr && list && list.length > 0) {
        const clean = (addr?: string) => (addr || '').replace(/\s+/g, '').toUpperCase();
        list.forEach((circle: any) => {
          if (!circle.rounds || !Array.isArray(circle.rounds)) return;
          circle.rounds.forEach((r: any) => {
            const isMeRecip = clean(r.recipient_id) === activeWalletAddr || clean(r.recipient?.nimiq_address) === activeWalletAddr;
            if (isMeRecip) {
              (r.contributions || []).forEach((c: any) => {
                if ((c.status || '').toUpperCase() === 'CONFIRMED') {
                  const payKey = `rosco_notified_rcv_${r.id}_${c.id || clean(c.contributor_id || c.contributor?.nimiq_address)}`;
                  if (typeof window !== 'undefined' && !localStorage.getItem(payKey)) {
                    addNotification({
                      title: 'Payment Received! 💰',
                      message: `${c.contributor?.display_name || 'A circle member'} sent ${circle.contribution_amount} ${circle.currency || 'NIM'} directly to your wallet for Round #${r.round_number} of ${circle.name}!`,
                      type: 'payment',
                      link: `/circle/${circle.id}`,
                      circle_id: circle.id,
                      amount: circle.contribution_amount
                    });
                    localStorage.setItem(payKey, 'true');
                  }
                }
              });

              if (r.status === 'completed') {
                const potKey = `rosco_notified_pot_complete_${r.id}`;
                if (typeof window !== 'undefined' && !localStorage.getItem(potKey)) {
                  const potTotal = circle.contribution_amount * (circle.max_members || circle.memberships?.length || 1);
                  addNotification({
                    title: 'Round Pot Delivered! 🎉',
                    message: `All member contributions for Round #${r.round_number} in ${circle.name} are verified! You received the full pot of ${potTotal} ${circle.currency || 'NIM'} in your wallet.`,
                    type: 'payment',
                    link: `/circle/${circle.id}`,
                    circle_id: circle.id,
                    amount: potTotal
                  });
                  localStorage.setItem(potKey, 'true');
                }
              }
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to load circles:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleResetTestCircles = async () => {
    if (!confirm('Clear all test circles and start with a fresh slate? This will remove all test circles, join requests, and test notifications.')) return;
    try {
      setFetching(true);
      await resetAllTestData();
      await loadCircles();
    } catch (err) {
      console.error('Failed to reset test data:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleConnectAndLaunch = async (displayName?: string) => {
    try {
      await connectWallet(displayName);
      setViewMode('app');
    } catch (err) {
      console.warn('[Rosco] Connect and launch error:', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '2rem' }}>
        <div className="pulse-glow" style={{ padding: '0.65rem', borderRadius: '50%', background: 'rgba(0, 102, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RoscoLogo size={76} />
        </div>
        <h3 style={{ marginTop: '1.25rem', fontWeight: 800, fontSize: '1.25rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
          Rosco Protocol
        </h3>
        <p className="text-muted" style={{ marginTop: '0.25rem', fontWeight: 500, fontSize: '0.85rem' }}>
          Connecting to Nimiq Network...
        </p>
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
        {/* Savings Type Switcher (Circles vs Personal Targets) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.65rem',
          marginBottom: '1.5rem',
          background: '#F1F5F9',
          padding: '0.4rem',
          borderRadius: '16px',
          border: '1px solid #E2E8F0'
        }}>
          <button
            onClick={() => setAppSection('circles')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: appSection === 'circles' ? '#0066FF' : 'transparent',
              color: appSection === 'circles' ? '#FFFFFF' : '#475569',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: appSection === 'circles' ? '0 4px 14px rgba(0, 102, 255, 0.28)' : 'none'
            }}
          >
            <Users style={{ width: '18px', height: '18px' }} />
            <span>Rotating Circles (Group)</span>
          </button>

          <button
            onClick={() => setAppSection('targets')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: appSection === 'targets' ? '#0066FF' : 'transparent',
              color: appSection === 'targets' ? '#FFFFFF' : '#475569',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: appSection === 'targets' ? '0 4px 14px rgba(0, 102, 255, 0.28)' : 'none'
            }}
          >
            <Target style={{ width: '18px', height: '18px' }} />
            <span>Target Savings (Personal)</span>
          </button>
        </div>

        {appSection === 'targets' ? (
          <TargetSavingsView userId={user.id} userAddress={wallet.address} />
        ) : (
          <>
            {/* User Hero & Stat Summary Overview */}
            <div className="glass-card" style={{
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              marginBottom: '2rem',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <span className="badge badge-active" style={{ fontSize: '0.72rem', fontWeight: 700 }}>● Connected</span>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Nimiq Pay Protocol</span>
                  </div>
                  <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.4rem', color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                    {user.display_name || 'Savings Member'}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      color: '#F8FAFC',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      letterSpacing: '0.5px',
                      wordBreak: 'break-all',
                      fontWeight: 600
                    }}>
                      {wallet.address}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(wallet.address);
                        setAddressCopied(true);
                        setTimeout(() => setAddressCopied(false), 2000);
                      }}
                      title="Copy full wallet address"
                      style={{
                        padding: '0.42rem 0.9rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: addressCopied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                        color: addressCopied ? '#34D399' : '#FFFFFF',
                        border: addressCopied ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {addressCopied ? (
                        <>
                          <Check style={{ width: '14px', height: '14px', color: '#34D399' }} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy style={{ width: '14px', height: '14px', color: '#FFFFFF' }} />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <Link href="/create" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ padding: '0.9rem 1.85rem', fontSize: '1.05rem', boxShadow: '0 4px 18px rgba(0, 102, 255, 0.4)' }}>
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

            {circles.length > 0 && (
              <button
                onClick={handleResetTestCircles}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                title="Clear all test circles and start with a clean slate"
              >
                <span>🗑️</span>
                <span>Clear Test Data</span>
              </button>
            )}
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
        </>
        )}
      </main>
    </div>
  );
}
