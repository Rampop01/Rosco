'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '../../../components/Header';
import { ContributeModal } from '../../../components/ContributeModal';
import { CountdownTimer } from '../../../components/CountdownTimer';
import { useAuth } from '../../../context/AuthContext';
import { CheckCircle2, Lock, Check, X } from 'lucide-react';
import {
  getCircle,
  joinCircle,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  startCircle,
  deleteCircle,
  getCurrentRound,
  Circle,
  JoinRequest,
  RoundInfo,
} from '../../../lib/api';
import { addNotification } from '../../../lib/notifications';

export default function CircleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const circleId = params.id as string;
  const { wallet, user, connectWallet } = useAuth();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [currentRound, setCurrentRound] = useState<RoundInfo | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'requests' | 'history'>('details');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clean = (addr?: string | null) => (addr ? addr.replace(/\s+/g, '').toUpperCase() : '');

  useEffect(() => {
    if (!circleId) return;
    loadCircleData();

    // Auto-poll in background every 4s when circle is forming so requests appear in real time
    const interval = setInterval(() => {
      loadCircleData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [circleId, user?.id, wallet?.address]);

  const loadCircleData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await getCircle(circleId);

      // Auto-heal dummy address ONLY if the circle was actually created on this device
      const isCreatorDevice = typeof window !== 'undefined' && localStorage.getItem('rosco_creator_' + circleId) === 'true';
      const myRealAddr = wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null);
      if (isCreatorDevice && myRealAddr && data.organizer_id && data.organizer_id.startsWith('NQ750000000000000000000000000000')) {
        data.organizer_id = myRealAddr;
        if (data.organizer) {
          data.organizer.id = myRealAddr;
          data.organizer.nimiq_address = myRealAddr;
          data.organizer.display_name = user?.display_name || wallet?.label || 'Organizer';
        }
        if (data.memberships && data.memberships.length > 0 && data.memberships[0].user_id.startsWith('NQ750000000000000000000000000000')) {
          data.memberships[0].user_id = myRealAddr;
          if (data.memberships[0].user) {
            data.memberships[0].user.id = myRealAddr;
            data.memberships[0].user.nimiq_address = myRealAddr;
            data.memberships[0].user.display_name = user?.display_name || wallet?.label || 'Organizer';
          }
        }
        try {
          fetch('/api/circles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
        } catch {}
      }

      setCircle(data);

      if (data.status === 'ACTIVE') {
        let activeRound: RoundInfo | null = null;
        try {
          const roundRes = await getCurrentRound(circleId);
          if (roundRes?.current_round) activeRound = roundRes.current_round;
        } catch {}

        if (!activeRound && data.rounds && data.rounds.length > 0) {
          activeRound = data.rounds.find((r: any) => r.status === 'open') || data.rounds[0];
        }

        if (activeRound) {
          setCurrentRound(activeRound);

          // Alert user of upcoming contribution if not already notified
          const notifKey = `rosco_notified_round_${activeRound.id}`;
          if (typeof window !== 'undefined' && !localStorage.getItem(notifKey)) {
            addNotification({
              title: 'Next Contribution Due',
              message: `Round #${activeRound.round_number} of ${data.name} is active. Contribution of ${data.contribution_amount} NIM is due.`,
              type: 'contribution_due',
              link: `/circle/${circleId}`,
              circle_id: circleId,
              amount: data.contribution_amount
            });
            localStorage.setItem(notifKey, 'true');
          }

          // Alert user if they are the winner/recipient of this round
          const activeWalletAddr = clean(wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null));
          const winnerKey = `rosco_notified_winner_${activeRound.id}`;
          const isMeWinner = activeWalletAddr && (clean(activeRound.recipient_id) === activeWalletAddr || clean(activeRound.recipient?.nimiq_address) === activeWalletAddr);
          if (isMeWinner && !localStorage.getItem(winnerKey)) {
            addNotification({
              title: 'You Are The Round Recipient! 🏆',
              message: `You are scheduled to receive the round payout in ${data.name}!`,
              type: 'round_winner',
              link: `/circle/${circleId}`,
              circle_id: circleId
            });
            localStorage.setItem(winnerKey, 'true');
          }
        }
      }

      const activeWallet = clean(wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null));
      const orgWallet = clean(data.organizer_id || data.organizer?.nimiq_address);
      const isOrgCheck = isCreatorDevice || (activeWallet && orgWallet && activeWallet === orgWallet);

      if (data.status === 'FORMING') {
        let requests = await getJoinRequests(circleId);
        const approvedUserAddrs = new Set(
          (data.memberships || [])
            .filter((m: any) => (m.status || '').toUpperCase() === 'APPROVED')
            .map((m: any) => clean(m.user_id || m.user?.nimiq_address))
        );

        if (data.memberships) {
          const directPending = data.memberships
            .filter((m: any) => (m.status || '').toUpperCase() === 'PENDING' && !approvedUserAddrs.has(clean(m.user_id || m.user?.nimiq_address)) && !requests.some(r => r.id === m.id || clean(r.user_id) === clean(m.user_id)))
            .map((m: any) => ({
              id: m.id,
              user_id: m.user_id,
              status: m.status,
              requested_at: m.created_at || new Date().toISOString(),
              user: m.user || {
                id: m.user_id,
                nimiq_address: m.user_id,
                display_name: 'Member'
              }
            }));
          if (directPending.length > 0) {
            requests = [...requests, ...directPending];
          }
        }

        // Strictly exclude any members who have already been approved
        requests = requests.filter(r => !approvedUserAddrs.has(clean(r.user_id || r.user?.nimiq_address)));
        setJoinRequests(requests);
        const pendingCount = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;
        const reqKey = `rosco_notified_req_${circleId}_${pendingCount}`;
        if (isOrgCheck && pendingCount > 0 && typeof window !== 'undefined' && !sessionStorage.getItem(reqKey)) {
          addNotification({
            title: 'New Join Requests 👥',
            message: `${pendingCount} member(s) requested to join ${data.name}. Review them now.`,
            type: 'join',
            link: `/circle/${circleId}`,
            circle_id: circleId
          });
          sessionStorage.setItem(reqKey, 'true');
        }
      }

      // Check if current user is a member whose request was approved or rejected
      if (!isOrgCheck && activeWallet) {
        const userMem = data.memberships?.find((m: any) => clean(m.user_id || m.user?.nimiq_address) === activeWallet);
        if ((userMem?.status || '').toUpperCase() === 'APPROVED') {
          const approvedNotifKey = `rosco_notified_approved_${circleId}`;
          if (typeof window !== 'undefined' && !localStorage.getItem(approvedNotifKey)) {
            addNotification({
              title: 'Request Approved! 🚀',
              message: `Your request to join ${data.name} was approved! You are now an active member.`,
              type: 'join',
              link: `/circle/${circleId}`,
              circle_id: circleId
            });
            localStorage.setItem(approvedNotifKey, 'true');
          }
        } else if ((userMem?.status || '').toUpperCase() === 'REJECTED') {
          const rejectedNotifKey = `rosco_notified_rejected_${circleId}`;
          if (typeof window !== 'undefined' && !localStorage.getItem(rejectedNotifKey)) {
            addNotification({
              title: 'Join Request Declined',
              message: `Your request to join ${data.name} was not accepted by the organizer.`,
              type: 'system',
              link: `/circle/${circleId}`,
              circle_id: circleId
            });
            localStorage.setItem(rejectedNotifKey, 'true');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load circle:', err);
      if (!silent) setErrorMsg(err.message || 'Failed to load circle');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const activeWalletAddr = clean(
    wallet?.address ||
    user?.nimiq_address ||
    (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null)
  );
  const orgAddr = clean(circle?.organizer_id || circle?.organizer?.nimiq_address);

  // The organizer is either matching wallet OR the device that created the circle
  const isCreatorDevice = typeof window !== 'undefined' && circle?.id && localStorage.getItem('rosco_creator_' + circle.id) === 'true';
  const isOrganizer = !!(
    isCreatorDevice ||
    (activeWalletAddr && orgAddr && activeWalletAddr === orgAddr)
  );

  // Find membership
  const myMembership = circle?.memberships?.find(m => {
    const memberAddr = clean(m.user_id || m.user?.nimiq_address);
    return activeWalletAddr && memberAddr && activeWalletAddr === memberAddr;
  });

  // The creator is ALWAYS automatically an approved member of their own circle!
  const isMember = isOrganizer || (myMembership?.status || '').toUpperCase() === 'APPROVED';
  const hasRequested = !isOrganizer && (myMembership?.status || '').toUpperCase() === 'PENDING';

  const handleJoin = async () => {
    try {
      setActionLoading(true);
      if (!user && !wallet) {
        await connectWallet();
      }
      const myAddr = wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');
      const myLabel = user?.display_name || wallet?.label || 'Member';
      await joinCircle(circleId, myAddr, myLabel);
      addNotification({
        title: 'Joined Circle 👥',
        message: `You requested or joined ${circle?.name || 'the circle'}!`,
        type: 'join',
        link: `/circle/${circleId}`,
        circle_id: circleId
      });
      await loadCircleData();
    } catch (err: any) {
      alert(err.message || 'Failed to request join');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (membershipId: string) => {
    try {
      setActionLoading(true);
      await approveJoinRequest(circleId, membershipId);
      addNotification({
        title: 'Member Approved 👥',
        message: `A member request was approved in ${circle?.name}.`,
        type: 'join',
        link: `/circle/${circleId}`,
        circle_id: circleId
      });
      await loadCircleData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (membershipId: string) => {
    try {
      setActionLoading(true);
      await rejectJoinRequest(circleId, membershipId);
      await loadCircleData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!confirm('Are you sure you want to start this circle? Payout order will be randomly assigned.')) return;
    try {
      setActionLoading(true);
      await startCircle(circleId);
      addNotification({
        title: 'Circle Started! 🚀',
        message: `${circle?.name} is now active! Payout order has been generated.`,
        type: 'system',
        link: `/circle/${circleId}`,
        circle_id: circleId
      });
      await loadCircleData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!circle) return;
    const params = new URLSearchParams({
      name: circle.name,
      amt: String(circle.contribution_amount),
      freq: circle.frequency,
      max: String(circle.max_members),
      org: circle.organizer_id,
      curr: circle.currency || 'NIM',
      status: circle.status || 'FORMING'
    });
    const url = `${window.location.origin}/circle/${circle.id}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDeleteCircle = async () => {
    if (!circle) return;
    if (circle.status !== 'FORMING') {
      alert('Active circles cannot be deleted to protect member contributions and scheduled round payouts.');
      return;
    }
    if (!confirm(`Are you sure you want to cancel and delete "${circle.name}"? Since it hasn't started, all pending requests will be cancelled.`)) {
      return;
    }
    try {
      setActionLoading(true);
      await deleteCircle(circleId);
      addNotification({
        title: 'Circle Cancelled',
        message: `Circle "${circle.name}" was cancelled and removed.`,
        type: 'system',
        link: '/',
      });
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel circle');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p className="text-muted">Loading circle details...</p>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div>
        <Header />
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p className="text-muted">{errorMsg || 'Circle not found'}</p>
        </div>
      </div>
    );
  }

  const approvedMembers = circle.memberships?.filter(m => (m.status || '').toUpperCase() === 'APPROVED') || [];
  const pendingCount = joinRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <Header />

      <main style={{ padding: '0.75rem 0' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)',
            background: '#FFFFFF',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          ← Back to Dashboard
        </button>

        {/* Page Title Block */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            {circle.name}
          </h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
            Created by {isOrganizer ? 'You (Organizer)' : (circle.organizer?.display_name || 'Organizer')}
          </p>
        </div>

        {!user && (
          <div className="glass-card animate-fade-in" style={{ textAlign: 'center', marginBottom: '1.25rem', border: '1px solid var(--border-glow)' }}>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Join this Rosco Savings Circle</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Connect your Nimiq Pay wallet to request membership or participate in round payouts.
            </p>
            <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', margin: '0 auto' }} onClick={() => connectWallet()}>
              ⚡ Connect with Nimiq Pay
            </button>
          </div>
        )}

        {/* Status Header Banner */}
        <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className={`badge badge-${circle.status.toLowerCase()}`}>
              {circle.status}
            </span>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              {circle.frequency} • {circle.currency}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Contribution</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
                {circle.contribution_amount} {circle.currency}
              </strong>
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Members</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>
                {approvedMembers.length} / {circle.max_members}
              </strong>
            </div>
          </div>

          <button className="btn-secondary" style={{ width: '100%', fontSize: '0.85rem' }} onClick={copyInviteLink}>
            {copiedLink ? '✓ Link Copied!' : '🔗 Copy Shareable Invite Link'}
          </button>
        </div>

        {/* ─── FORMING STATE ────────────────────────────────────────────────── */}
        {circle.status === 'FORMING' && (
          <div>
            {!isOrganizer && !isMember && !hasRequested && (
              <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <h4>Join this Savings Circle</h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 1rem' }}>
                  Contribute {circle.contribution_amount} {circle.currency} per round with {approvedMembers.length} other members.
                </p>
                <button className="btn-primary" onClick={handleJoin} disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : '✋ Request to Join'}
                </button>
              </div>
            )}

            {hasRequested && (
              <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.25rem', borderColor: 'var(--status-pending)' }}>
                <h4 style={{ color: 'var(--status-pending)' }}>⏳ Request Pending</h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                  The circle organizer will review your request shortly.
                </p>
              </div>
            )}

            {(myMembership?.status || '').toUpperCase() === 'REJECTED' && !isOrganizer && (
              <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.25rem', borderColor: '#EF4444' }}>
                <h4 style={{ color: '#EF4444' }}>❌ Request Declined</h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                  The circle organizer was unable to accept your request for this circle.
                </p>
              </div>
            )}

            {isMember && !isOrganizer && (
              <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                <h4 style={{ color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 style={{ width: '18px', height: '18px' }} />
                  You are a Member
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  Waiting for the organizer to start the circle. You will be notified when Round 1 begins!
                </p>
              </div>
            )}

            {isOrganizer && (
              <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.25rem', borderColor: 'rgba(0, 102, 255, 0.3)' }}>
                <h4 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  👑 You are the Circle Organizer
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  Share the invite link with friends to fill all {circle.max_members} spots, then launch the circle.
                </p>
              </div>
            )}

            {/* Prominent Pending Requests Alert Banner for Organizer */}
            {isOrganizer && circle.status === 'FORMING' && pendingCount > 0 && activeTab !== 'requests' && (
              <div 
                onClick={() => setActiveTab('requests')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.9rem 1.1rem',
                  background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.08) 0%, rgba(0, 102, 255, 0.16) 100%)',
                  border: '1.5px solid rgba(0, 102, 255, 0.35)',
                  borderRadius: '14px',
                  marginBottom: '1.25rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 102, 255, 0.08)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>👥</span>
                  <div>
                    <strong style={{ color: '#0066FF', fontSize: '0.95rem', display: 'block' }}>
                      {pendingCount} Pending Member Request{pendingCount > 1 ? 's' : ''}!
                    </strong>
                    <span style={{ color: '#475569', fontSize: '0.8rem' }}>
                      Click here to review and approve members into this circle.
                    </span>
                  </div>
                </div>
                <span style={{
                  background: '#0066FF',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  padding: '0.4rem 0.85rem',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  Review ({pendingCount}) →
                </span>
              </div>
            )}

            {/* Organizer Tabs */}
            {isOrganizer && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                background: '#F1F5F9',
                padding: '0.35rem',
                borderRadius: '14px',
                marginBottom: '1.25rem',
                border: '1px solid #E2E8F0'
              }}>
                <button 
                  onClick={() => setActiveTab('details')}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === 'details' ? '#0066FF' : 'transparent',
                    color: activeTab === 'details' ? '#FFFFFF' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Members ({approvedMembers.length})
                </button>
                <button 
                  onClick={() => setActiveTab('requests')}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeTab === 'requests' ? '#0066FF' : 'transparent',
                    color: activeTab === 'requests' ? '#FFFFFF' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Join Requests {pendingCount > 0 && `(${pendingCount})`}
                </button>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.85rem' }}>Approved Members</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {approvedMembers.map((m, idx) => {
                    const isThisOrg = clean(m.user_id || m.user?.nimiq_address) === orgAddr;
                    const rawAddr = (m.user?.nimiq_address || '').replace(/\s+/g, '');
                    const shortAddr = rawAddr ? `${rawAddr.slice(0, 4)}...${rawAddr.slice(-4)}` : 'Nimiq Wallet';

                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                            #{idx + 1}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.92rem', display: 'block', color: '#0F172A' }}>
                              {m.user?.display_name || (isThisOrg ? 'Organizer' : 'Member')}
                            </strong>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                              {shortAddr}
                            </span>
                          </div>
                        </div>
                        {isThisOrg && (
                          <span className="badge badge-active" style={{ fontSize: '0.7rem', fontWeight: 700 }}>Organizer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'requests' && isOrganizer && (
              <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                  <h4 style={{ fontSize: '1.05rem', color: '#0F172A', fontWeight: 800 }}>Pending Join Requests</h4>
                  {joinRequests.length > 0 && (
                    <span className="badge" style={{ background: 'rgba(0, 102, 255, 0.08)', color: '#0066FF', border: '1px solid rgba(0, 102, 255, 0.2)', fontSize: '0.72rem', fontWeight: 800 }}>
                      {joinRequests.length} pending
                    </span>
                  )}
                </div>

                {joinRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No pending join requests.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {joinRequests.map(req => {
                      const initial = (req.user.display_name || 'Member')[0].toUpperCase();
                      return (
                        <div
                          key={req.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            padding: '0.85rem 1rem',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: '14px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #0066FF 0%, #0040B0 100%)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              flexShrink: 0
                            }}>
                              {initial}
                            </div>
                            <div>
                              <strong style={{ fontSize: '0.95rem', color: '#0F172A', display: 'block' }}>
                                {req.user.display_name}
                              </strong>
                              <span style={{ fontSize: '0.76rem', color: '#64748B', fontFamily: 'monospace' }}>
                                {req.user.nimiq_address.slice(0, 10)}...{req.user.nimiq_address.slice(-4)}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              className="btn-success"
                              onClick={() => handleApprove(req.id)}
                              disabled={actionLoading}
                              title="Approve Member"
                            >
                              <Check style={{ width: 15, height: 15 }} />
                              <span>Approve</span>
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => handleReject(req.id)}
                              disabled={actionLoading}
                              title="Reject Request"
                            >
                              <X style={{ width: 15, height: 15 }} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isOrganizer && approvedMembers.length >= circle.min_members && (
              <button className="btn-primary" onClick={handleStart} disabled={actionLoading}>
                🚀 Start Circle (Assign Random Payout Order)
              </button>
            )}

            {/* Cancel / Delete Circle — Allowed ONLY when circle is still FORMING */}
            {isOrganizer && (
              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                <button
                  onClick={handleDeleteCircle}
                  disabled={actionLoading}
                  style={{
                    background: 'transparent',
                    border: '1px solid #CBD5E1',
                    color: '#64748B',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#EF4444';
                    e.currentTarget.style.color = '#EF4444';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.color = '#64748B';
                  }}
                  title="Cancel and delete this circle while still forming"
                >
                  <span>🗑️</span>
                  <span>Cancel & Delete Circle</span>
                </button>
                <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.35rem' }}>
                  Circles can only be deleted while still forming. Once active, deletion is locked to safeguard all member funds.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── ACTIVE STATE ─────────────────────────────────────────────────── */}
        {circle.status === 'ACTIVE' && currentRound && (
          <div>
            {/* Screen 5: Active Round Banner */}
            <div className="glass-card" style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  Round {currentRound.round_number} of {circle.rounds?.length || approvedMembers.length}
                </h3>
                <span style={{
                  background: '#ECFDF5',
                  color: '#059669',
                  border: '1px solid #A7F3D0',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em'
                }}>
                  IN PROGRESS
                </span>
              </div>

              {/* Recipient Card */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '1rem 1.15rem',
                borderRadius: '12px',
                marginBottom: '1.25rem'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                  🎁 Round Recipient (Gets Full Pot)
                </span>
                <strong style={{ fontSize: '1.2rem', color: '#0F172A', fontWeight: 800, display: 'block', marginBottom: '0.2rem' }}>
                  {currentRound.recipient?.display_name || 'Circle Member'}
                </strong>
                <span style={{ fontSize: '0.82rem', color: '#0066FF', fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all', display: 'block' }}>
                  {currentRound.recipient?.nimiq_address}
                </span>

                {(() => {
                  const myAddr = clean(wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null));
                  const recAddr = clean(currentRound.recipient_id || currentRound.recipient?.nimiq_address || currentRound.recipient?.id);
                  if (myAddr && recAddr && myAddr === recAddr) {
                    return (
                      <div style={{
                        marginTop: '0.85rem',
                        background: '#ECFDF5',
                        border: '1px solid #10B981',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.88rem',
                        color: '#065F46',
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.5
                      }}>
                        🎉 You are the recipient for this round! You will receive the gathered pot directly to your wallet.
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Action Button & Contribution Lock with Countdown */}
              {(() => {
                const myWallet = clean(
                  wallet?.address ||
                  user?.nimiq_address ||
                  (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null)
                );
                const recWallet = clean(currentRound.recipient_id || currentRound.recipient?.nimiq_address || currentRound.recipient?.id);
                const isRecipient = !!(myWallet && recWallet && myWallet === recWallet);

                const myContrib = currentRound.contributions?.find(c => {
                  const cAddr = clean(c.contributor_id || c.contributor?.nimiq_address || c.contributor?.id);
                  return myWallet && cAddr && myWallet === cAddr;
                });
                const hasPaid = (myContrib?.status || '').toUpperCase() === 'CONFIRMED';
                const roundDueDate = currentRound.due_date || new Date(Date.now() + 7 * 86400000).toISOString();

                // Not connected yet
                if (!myWallet) {
                  return (
                    <div style={{ marginTop: '0.85rem' }}>
                      <button 
                        className="btn-primary" 
                        onClick={() => connectWallet()}
                        style={{
                          width: '100%',
                          padding: '0.95rem',
                          fontSize: '1rem',
                          fontWeight: 800,
                          background: 'linear-gradient(135deg, #0066FF 0%, #0040B0 100%)',
                          boxShadow: '0 4px 14px rgba(0, 102, 255, 0.25)',
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Connect Nimiq Wallet to Pay Round ({circle.contribution_amount} {circle.currency})
                      </button>
                    </div>
                  );
                }

                // If user is the recipient for this round
                if (isRecipient) {
                  return (
                    <div style={{
                      marginTop: '0.85rem',
                      background: '#ECFDF5',
                      border: '1.5px solid #10B981',
                      borderRadius: '12px',
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#065F46'
                    }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🏆</div>
                      <strong style={{ fontSize: '1.05rem', display: 'block', marginBottom: '0.25rem' }}>
                        You are the Recipient for Round #{currentRound.round_number}!
                      </strong>
                      <p style={{ fontSize: '0.85rem', color: '#047857', margin: 0 }}>
                        All other members contribute {circle.contribution_amount} {circle.currency} directly to your wallet this round.
                      </p>
                    </div>
                  );
                }

                // If user has already paid their contribution
                if (hasPaid) {
                  return (
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1.5px solid #10B981',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        textAlign: 'center',
                        color: '#065F46'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800 }}>
                          <CheckCircle2 style={{ width: '18px', height: '18px', color: '#10B981' }} />
                          <span>Round #{currentRound.round_number} Contribution Paid</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.25rem', marginBottom: 0 }}>
                          Your contribution is verified on-chain. Locked until Round #{currentRound.round_number + 1} begins.
                        </p>
                      </div>

                      <CountdownTimer 
                        targetDate={roundDueDate} 
                        label="Next Round Contribution Opens In" 
                      />

                      <button 
                        className="btn-secondary" 
                        disabled 
                        style={{
                          width: '100%',
                          opacity: 0.6,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.75rem'
                        }}
                      >
                        <Lock style={{ width: '15px', height: '15px' }} />
                        <span>Contribution Locked Until Next Round</span>
                      </button>
                    </div>
                  );
                }

                // Member needs to pay!
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.85rem' }}>
                    <CountdownTimer 
                      targetDate={roundDueDate} 
                      label="Round Contribution Deadline" 
                    />

                    <button 
                      className="btn-primary" 
                      onClick={() => setShowPayModal(true)} 
                      style={{ 
                        width: '100%', 
                        padding: '1rem',
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #0066FF 0%, #0040B0 100%)',
                        boxShadow: '0 4px 16px rgba(0, 102, 255, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      💳 Pay Round ({circle.contribution_amount} {circle.currency}) to {currentRound.recipient?.display_name || 'Recipient'}
                    </button>
                  </div>
                );
              })()}

              {/* Security notice: active circles are locked against deletion */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.8rem',
                background: '#F8FAFC',
                borderRadius: '10px',
                color: '#475569',
                fontSize: '0.76rem',
                fontWeight: 600,
                marginTop: '1.25rem',
                border: '1px solid #E2E8F0'
              }}>
                <span>🔒</span>
                <span>Non-Custodial Lock: Active circles cannot be deleted to prevent default and protect round payouts.</span>
              </div>
            </div>

            {/* Round Contributions Tracker */}
            <div className="glass-card" style={{
              background: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
              marginBottom: '1.25rem'
            }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem' }}>
                Contributions Status ({currentRound.contributions?.filter(c => (c.status || '').toUpperCase() === 'CONFIRMED').length || 0} / {currentRound.contributions?.length || Math.max(1, approvedMembers.length - 1)} Paid)
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {currentRound.contributions?.map(contrib => (
                  <div key={contrib.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px'
                  }}>
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 700, display: 'block' }}>
                        {contrib.contributor?.display_name || 'Member'}
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace', fontWeight: 500 }}>
                        {contrib.contributor?.nimiq_address ? `${contrib.contributor.nimiq_address.slice(0, 10)}...` : 'Nimiq Wallet'}
                      </span>
                    </div>

                    {(contrib.status || '').toUpperCase() === 'CONFIRMED' ? (
                      <span style={{
                        background: '#ECFDF5',
                        color: '#059669',
                        border: '1px solid #A7F3D0',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        ✓ Paid
                      </span>
                    ) : (
                      <span style={{
                        background: '#FEF3C7',
                        color: '#B45309',
                        border: '1px solid #FDE68A',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}>
                        Pending
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── COMPLETED STATE ──────────────────────────────────────────────── */}
        {circle.status === 'COMPLETED' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
            <h3 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>Circle Completed!</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              All rounds have finished successfully. Total pot distributed across members.
            </p>
          </div>
        )}
      </main>

      {/* Pay Modal */}
      {showPayModal && currentRound && (
        <ContributeModal
          circle={circle}
          round={currentRound}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => {
            setShowPayModal(false);
            loadCircleData();
          }}
        />
      )}
    </div>
  );
}
