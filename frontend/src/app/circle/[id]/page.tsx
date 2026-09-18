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
  advanceCircleRound,
  Circle,
  JoinRequest,
  RoundInfo,
  apiFetch,
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
        const activeWalletAddr = clean(wallet?.address || user?.nimiq_address || user?.id || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null));

        // Scan all rounds for incoming payments and pot awards to the active user as recipient
        if (activeWalletAddr && data.rounds) {
          data.rounds.forEach((r: any) => {
            const isMeRecip = clean(r.recipient_id) === activeWalletAddr || clean(r.recipient?.nimiq_address) === activeWalletAddr;
            if (isMeRecip) {
              (r.contributions || []).forEach((c: any) => {
                if ((c.status || '').toUpperCase() === 'CONFIRMED') {
                  const payKey = `rosco_notified_rcv_${r.id}_${c.id || clean(c.contributor_id || c.contributor?.nimiq_address)}`;
                  if (typeof window !== 'undefined' && !localStorage.getItem(payKey)) {
                    addNotification({
                      title: 'Payment Received! 💰',
                      message: `${c.contributor?.display_name || 'A circle member'} sent ${data.contribution_amount} ${data.currency} directly to your wallet for Round #${r.round_number}!`,
                      type: 'payment',
                      link: `/circle/${circleId}`,
                      circle_id: circleId,
                      amount: data.contribution_amount
                    });
                    localStorage.setItem(payKey, 'true');
                  }
                }
              });

              if (r.status === 'completed') {
                const potKey = `rosco_notified_pot_complete_${r.id}`;
                if (typeof window !== 'undefined' && !localStorage.getItem(potKey)) {
                  const potTotal = data.contribution_amount * (data.max_members || data.memberships?.length || 1);
                  addNotification({
                    title: 'Round Pot Delivered! 🎉',
                    message: `All member contributions for Round #${r.round_number} are verified! You received the full pot of ${potTotal} ${data.currency} in your wallet.`,
                    type: 'payment',
                    link: `/circle/${circleId}`,
                    circle_id: circleId,
                    amount: potTotal
                  });
                  localStorage.setItem(potKey, 'true');
                }
              }
            }
          });
        }

        let activeRound: RoundInfo | null = null;
        try {
          const roundRes = await getCurrentRound(circleId);
          if (roundRes?.current_round) activeRound = roundRes.current_round;
        } catch {}

        if (!activeRound && data.rounds && data.rounds.length > 0) {
          activeRound = data.rounds.find((r: any) => r.status === 'open') || null;
        }

        setCurrentRound(activeRound);

        if (activeRound) {
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

      const activeWallet = clean(wallet?.address || user?.nimiq_address || user?.id || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null));
      const orgWallet = clean(data.organizer_id || data.organizer?.nimiq_address);
      const isOrgCheck = isCreatorDevice || (activeWallet && orgWallet && activeWallet === orgWallet);

      if (data.status === 'FORMING') {
        // Always trust the backend for join requests — do NOT merge local cache
        const requests = await getJoinRequests(circleId);
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
        const isUserApproved = data.memberships?.some(
          (m: any) => (
            clean(m.user_id) === activeWallet ||
            clean(m.user?.nimiq_address) === activeWallet ||
            clean(m.user?.id) === activeWallet
          ) && (m.status || '').toUpperCase() === 'APPROVED'
        );

        if (isUserApproved) {
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
        } else {
          const isUserRejected = data.memberships?.some(
            (m: any) => (
              clean(m.user_id) === activeWallet ||
              clean(m.user?.nimiq_address) === activeWallet ||
              clean(m.user?.id) === activeWallet
            ) && (m.status || '').toUpperCase() === 'REJECTED'
          );
          if (isUserRejected) {
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
    user?.id ||
    (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null)
  );
  const orgAddr = clean(circle?.organizer_id || circle?.organizer?.nimiq_address);

  // The organizer is either matching wallet OR the device that created the circle
  const isCreatorDevice = typeof window !== 'undefined' && circle?.id && localStorage.getItem('rosco_creator_' + circle.id) === 'true';
  const isOrganizer = !!(
    isCreatorDevice ||
    (activeWalletAddr && orgAddr && activeWalletAddr === orgAddr)
  );

  // Find all memberships matching this active wallet
  const myMemberships = circle?.memberships?.filter(m => {
    return activeWalletAddr && (
      clean(m.user_id) === activeWalletAddr ||
      clean(m.user?.nimiq_address) === activeWalletAddr ||
      clean(m.user?.id) === activeWalletAddr
    );
  }) || [];

  const myApprovedMembership = myMemberships.find(m => (m.status || '').toUpperCase() === 'APPROVED');
  const myPendingMembership = myMemberships.find(m => (m.status || '').toUpperCase() === 'PENDING');
  const myRejectedMembership = myMemberships.find(m => (m.status || '').toUpperCase() === 'REJECTED');

  const myMembership = myApprovedMembership || myPendingMembership || myRejectedMembership || null;

  // The creator is ALWAYS automatically an approved member of their own circle!
  // If ANY membership record for this wallet is APPROVED, the user is an APPROVED member!
  const isMember = isOrganizer || !!myApprovedMembership;
  const hasRequested = !isOrganizer && !myApprovedMembership && !!myPendingMembership;

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

  const handleAdvanceRound = async () => {
    try {
      setActionLoading(true);
      await advanceCircleRound(circleId);
      addNotification({
        title: 'Next Round Opened! 🚀',
        message: `Advanced to the next scheduled round in ${circle?.name}!`,
        type: 'system',
        link: `/circle/${circleId}`,
        circle_id: circleId
      });
      await loadCircleData();
    } catch (err: any) {
      alert(err.message || 'Failed to advance round');
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

  const handleClearDebt = async (contributionId: string) => {
    if (!confirm('Are you sure you want to mark this debt as settled manually (e.g. paid in cash)?')) return;
    try {
      setActionLoading(true);
      await apiFetch(`/circles/${circleId}/debts/${contributionId}/clear`, { method: 'POST' });
      addNotification({
        title: 'Debt Cleared',
        message: `Member debt marked as manually settled.`,
        type: 'system',
        link: `/circle/${circleId}`,
      });
      await loadCircleData();
    } catch (err: any) {
      alert(err.message || 'Failed to clear debt');
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
        {circle.status === 'ACTIVE' && (
          <div>
            {currentRound ? (
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
                            onExpire={handleAdvanceRound}
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
                          onExpire={handleAdvanceRound}
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
            ) : (
              /* Waiting period between cycles */
              (() => {
                const completedRounds = (circle.rounds || []).filter((r: any) => r.status === 'completed' || r.status === 'missed_partial');
                const upcomingRounds = (circle.rounds || []).filter((r: any) => r.status === 'upcoming');
                const lastCompleted = completedRounds[completedRounds.length - 1];
                const nextUpcoming = upcomingRounds[0];

                if (!nextUpcoming) {
                  return null;
                }

                const nextStartDate = nextUpcoming.start_date || nextUpcoming.due_date || new Date(Date.now() + 7 * 86400000).toISOString();
                const totalPot = circle.contribution_amount * (circle.max_members || approvedMembers.length || 1);
                const isPartial = lastCompleted?.status === 'missed_partial';
                const missingContribs = isPartial ? (lastCompleted.contributions || []).filter((c: any) => (c.status || '').toUpperCase() !== 'CONFIRMED') : [];

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Last Completed Round Summary */}
                    {lastCompleted && (
                      <div className="glass-card" style={{
                        background: isPartial ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                        border: `1.5px solid ${isPartial ? '#F59E0B' : '#10B981'}`,
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: `0 4px 16px ${isPartial ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>{isPartial ? '⚠️' : '🎉'}</span>
                            <h3 style={{ fontSize: '1.25rem', color: isPartial ? '#B45309' : '#065F46', fontWeight: 800, margin: 0 }}>
                              Round {lastCompleted.round_number} Finished {isPartial && '(Partial)'}
                            </h3>
                          </div>
                          <span style={{
                            background: isPartial ? '#F59E0B' : '#10B981',
                            color: '#FFFFFF',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px'
                          }}>
                            {isPartial ? '⚠️ PARTIAL DISBURSEMENT' : '✓ 100% DISBURSED'}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: isPartial ? '#92400E' : '#047857', marginBottom: '1rem', lineHeight: 1.4 }}>
                          {isPartial 
                            ? `Round #${lastCompleted.round_number} time elapsed without full payment. The partial pot was delivered to ${lastCompleted.recipient?.display_name || 'the recipient'}.`
                            : `All member contributions for Round #${lastCompleted.round_number} were verified on-chain. The full round pot of ${totalPot} ${circle.currency} was delivered directly to ${lastCompleted.recipient?.display_name || 'the recipient'}.`
                          }
                        </p>

                        {isPartial && missingContribs.length > 0 && (
                          <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid #FCD34D',
                            padding: '0.75rem',
                            borderRadius: '10px',
                            marginBottom: '1rem',
                            fontSize: '0.82rem',
                            color: '#92400E'
                          }}>
                            <strong>Missing Payments from:</strong> {missingContribs.map((c: any) => c.contributor?.display_name || 'Member').join(', ')}.<br/>
                            <em>Their debt will be automatically intercepted during their payout round.</em>
                          </div>
                        )}

                        <div style={{
                          background: '#FFFFFF',
                          border: `1px solid ${isPartial ? '#FDE68A' : '#A7F3D0'}`,
                          borderRadius: '12px',
                          padding: '0.75rem 1rem',
                          fontSize: '0.82rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: isPartial ? '#B45309' : '#065F46', fontWeight: 600 }}>Round #{lastCompleted.round_number} Winner:</span>
                          <span style={{ fontFamily: 'monospace', color: isPartial ? '#92400E' : '#047857', fontWeight: 700 }}>
                            {lastCompleted.recipient?.display_name} ({lastCompleted.recipient?.nimiq_address ? `${lastCompleted.recipient.nimiq_address.slice(0, 8)}...` : ''})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Scheduled Next Round Countdown */}
                    <div className="glass-card" style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '1.75rem',
                      textAlign: 'center',
                      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)'
                    }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(0, 102, 255, 0.08)',
                        color: '#0066FF',
                        border: '1px solid rgba(0, 102, 255, 0.2)',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '1rem'
                      }}>
                        <span>⏳ Scheduled {circle.frequency} Cycle</span>
                      </div>

                      <h3 style={{ fontSize: '1.4rem', color: '#0F172A', fontWeight: 800, marginBottom: '0.4rem' }}>
                        Round {nextUpcoming.round_number} of {circle.rounds?.length || approvedMembers.length}
                      </h3>
                      <p className="text-secondary" style={{ fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 1.25rem' }}>
                        In accordance with your circle's <strong>{circle.frequency.toLowerCase()} schedule</strong>, Round {nextUpcoming.round_number} contributions will open when the scheduled interval begins.
                      </p>

                      <div style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        maxWidth: '420px',
                        margin: '0 auto 1.5rem',
                        fontSize: '0.85rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Next Round Recipient:</span>
                          <strong style={{ color: '#0066FF' }}>
                            {nextUpcoming.recipient?.display_name || 'Next Member'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748B' }}>
                          <span>Recipient Selection:</span>
                          <span>Excludes previously paid members</span>
                        </div>
                      </div>

                      <div style={{ maxWidth: '380px', margin: '0 auto' }}>
                        <CountdownTimer
                          targetDate={nextStartDate}
                          label={`Round ${nextUpcoming.round_number} Opens In`}
                          onExpire={handleAdvanceRound}
                        />
                      </div>

                      {isOrganizer && (
                        <div style={{
                          marginTop: '1.5rem',
                          paddingTop: '1.25rem',
                          borderTop: '1px solid #F1F5F9'
                        }}>
                          <button
                            className="btn-primary"
                            onClick={handleAdvanceRound}
                            disabled={actionLoading}
                            style={{
                              padding: '0.75rem 1.25rem',
                              fontSize: '0.88rem',
                              fontWeight: 800,
                              background: '#0066FF',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: actionLoading ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <span>⚡ Open Round {nextUpcoming.round_number} Now</span>
                          </button>
                          <span style={{
                            display: 'block',
                            fontSize: '0.74rem',
                            color: '#94A3B8',
                            marginTop: '0.4rem'
                          }}>
                            Organizer shortcut: open Round {nextUpcoming.round_number} early without waiting for the full {circle.frequency.toLowerCase()} interval.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
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

        {/* ─── ADMIN DEBT MANAGEMENT ─────────────────────────────────────────── */}
        {isOrganizer && (circle.status === 'ACTIVE' || circle.status === 'COMPLETED') && (
          (() => {
            const allUnsettledDebts = circle.rounds?.flatMap(r => 
              (r.status === 'completed' || r.status === 'missed_partial') 
                ? (r.contributions || []).filter(c => c.status === 'pending' || c.status === 'failed').map(c => ({...c, round_id: r.id}))
                : []
            ) || [];

            if (allUnsettledDebts.length === 0) return null;

            return (
              <div className="glass-card" style={{ marginTop: '1.5rem', border: '1.5px solid #EF4444' }}>
                <h4 style={{ color: '#EF4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚠️</span> Manage Unsettled Debts
                </h4>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                  The following members missed their payment deadline. If they paid the recipient outside the system, you can manually mark the debt as settled here.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {allUnsettledDebts.map(debt => (
                    <div key={debt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#991B1B', fontSize: '0.9rem' }}>
                          {debt.contributor?.display_name || 'Member'}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#B91C1C' }}>
                          Missed Round {circle.rounds?.find(r => r.id === debt.round_id)?.round_number} ({circle.contribution_amount} {circle.currency})
                        </span>
                      </div>
                      <button
                        onClick={() => handleClearDebt(debt.id)}
                        disabled={actionLoading}
                        style={{
                          background: '#EF4444',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Mark Settled
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
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
