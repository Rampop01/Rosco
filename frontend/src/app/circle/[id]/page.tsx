'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '../../../components/Header';
import { ContributeModal } from '../../../components/ContributeModal';
import { CountdownTimer } from '../../../components/CountdownTimer';
import { useAuth } from '../../../context/AuthContext';
import { CheckCircle2, Lock } from 'lucide-react';
import {
  getCircle,
  joinCircle,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  startCircle,
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
    if (circleId) {
      loadCircleData();
    }
  }, [circleId, user?.id, wallet?.address]);

  const loadCircleData = async () => {
    try {
      setLoading(true);
      const data = await getCircle(circleId);

      // Auto-heal dummy address if creator visits with real wallet
      const myRealAddr = wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null);
      if (myRealAddr && data.organizer_id && data.organizer_id.startsWith('NQ750000000000000000000000000000')) {
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
        const roundRes = await getCurrentRound(circleId);
        if (roundRes?.current_round) {
          setCurrentRound(roundRes.current_round);

          // Alert user of upcoming contribution if not already notified
          const notifKey = `rosco_notified_round_${roundRes.current_round.id}`;
          if (typeof window !== 'undefined' && !localStorage.getItem(notifKey)) {
            addNotification({
              title: 'Next Contribution Due',
              message: `Round #${roundRes.current_round.round_number} of ${data.name} is active. Contribution of ${data.contribution_amount} NIM is due.`,
              type: 'contribution_due',
              link: `/circle/${circleId}`,
              circle_id: circleId,
              amount: data.contribution_amount
            });
            localStorage.setItem(notifKey, 'true');
          }

          // Alert user if they are the winner/recipient of this round
          const winnerKey = `rosco_notified_winner_${roundRes.current_round.id}`;
          if (user && roundRes.current_round.recipient_id === user.id && !localStorage.getItem(winnerKey)) {
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
      const orgWallet = clean(data.organizer_id);
      const isOrgCheck = activeWallet && orgWallet && activeWallet === orgWallet;

      if (isOrgCheck && data.status === 'FORMING') {
        const requests = await getJoinRequests(circleId);
        setJoinRequests(requests);
        const pendingCount = requests.filter(r => r.status === 'PENDING').length;
        const reqKey = `rosco_notified_req_${circleId}_${pendingCount}`;
        if (pendingCount > 0 && typeof window !== 'undefined' && !sessionStorage.getItem(reqKey)) {
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
    } catch (err: any) {
      console.error('Failed to load circle:', err);
      setErrorMsg(err.message || 'Failed to load circle');
    } finally {
      setLoading(false);
    }
  };

  const activeWalletAddr = clean(
    wallet?.address ||
    user?.nimiq_address ||
    (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null)
  );
  const orgAddr = clean(circle?.organizer_id || circle?.organizer?.nimiq_address);

  // The organizer is the creator of the circle
  const isOrganizer = !!(activeWalletAddr && orgAddr && activeWalletAddr === orgAddr);

  // Find membership
  const myMembership = circle?.memberships?.find(m => {
    const memberAddr = clean(m.user_id || m.user?.nimiq_address);
    return activeWalletAddr && memberAddr && activeWalletAddr === memberAddr;
  });

  // The creator is ALWAYS automatically an approved member of their own circle!
  const isMember = isOrganizer || myMembership?.status === 'APPROVED';
  const hasRequested = !isOrganizer && myMembership?.status === 'PENDING';

  const handleJoin = async () => {
    try {
      setActionLoading(true);
      if (!user) {
        await connectWallet();
      }
      await joinCircle(circleId);
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

  if (loading) {
    return (
      <div>
        <Header onBack={() => router.push('/')} />
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p className="text-muted">Loading circle details...</p>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div>
        <Header onBack={() => router.push('/')} />
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p className="text-muted">{errorMsg || 'Circle not found'}</p>
        </div>
      </div>
    );
  }

  const approvedMembers = circle.memberships?.filter(m => m.status === 'APPROVED') || [];
  const pendingCount = joinRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <Header title={circle.name} onBack={() => router.push('/')} />

      <main style={{ padding: '1rem 0' }}>
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
                <h4 style={{ fontSize: '1rem', marginBottom: '0.85rem' }}>Pending Join Requests</h4>
                {joinRequests.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>No pending requests.</p>
                ) : (
                  joinRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', display: 'block' }}>{req.user.display_name}</strong>
                        <span className="text-muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {req.user.nimiq_address.slice(0, 10)}...
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn-success" onClick={() => handleApprove(req.id)} disabled={actionLoading}>
                          Approve
                        </button>
                        <button className="btn-danger" onClick={() => handleReject(req.id)} disabled={actionLoading}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {isOrganizer && approvedMembers.length >= circle.min_members && (
              <button className="btn-primary" onClick={handleStart} disabled={actionLoading}>
                🚀 Start Circle (Assign Random Payout Order)
              </button>
            )}
          </div>
        )}

        {/* ─── ACTIVE STATE ─────────────────────────────────────────────────── */}
        {circle.status === 'ACTIVE' && currentRound && (
          <div>
            {/* Screen 5: Active Round Banner */}
            <div className="glass-card pulse-glow" style={{
              background: 'linear-gradient(135deg, rgba(30, 37, 62, 0.9), rgba(18, 22, 38, 0.95))',
              borderColor: 'var(--accent-gold)',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
                  Round {currentRound.round_number} of {circle.max_members}
                </h3>
                <span className="badge badge-active">IN PROGRESS</span>
              </div>

              {/* Recipient Card */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem'
              }}>
                <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>
                  🎁 Round Recipient (Gets Full Pot)
                </span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'block' }}>
                  {currentRound.recipient?.display_name || 'Circle Member'}
                </strong>
                <span className="text-cyan" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                  {currentRound.recipient?.nimiq_address}
                </span>

                {user && (currentRound.recipient_id === user.id || currentRound.recipient?.nimiq_address === user.nimiq_address) && (
                  <div style={{ marginTop: '0.65rem', background: 'rgba(5, 213, 170, 0.15)', border: '1px solid var(--accent-cyan)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700, textAlign: 'center' }}>
                    🎉 You are the recipient for this round! You will receive the gathered pot directly to your wallet.
                  </div>
                )}
              </div>

              {/* Action Button & Contribution Lock with Countdown */}
              {isMember && (
                (() => {
                  const isRecipient = user && (currentRound.recipient_id === user.id || currentRound.recipient?.nimiq_address === user.nimiq_address);
                  const myContrib = currentRound.contributions?.find(
                    c => c.contributor_id === user?.id || c.contributor?.nimiq_address === user?.nimiq_address
                  );
                  const hasPaid = myContrib?.status === 'CONFIRMED';
                  const roundDueDate = currentRound.due_date || new Date(Date.now() + 7 * 86400000).toISOString();

                  if (isRecipient) {
                    return null;
                  }

                  if (hasPaid) {
                    return (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10B981',
                          borderRadius: '12px',
                          padding: '0.85rem 1rem',
                          textAlign: 'center',
                          color: '#10B981'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 800 }}>
                            <CheckCircle2 style={{ width: '18px', height: '18px' }} />
                            <span>Round {currentRound.round_number} Contribution Paid</span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '0.25rem' }}>
                            You cannot contribute again until the current round finishes and the next round begins.
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

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <CountdownTimer 
                        targetDate={roundDueDate} 
                        label="Round Contribution Deadline" 
                      />

                      <button className="btn-primary" onClick={() => setShowPayModal(true)} style={{ width: '100%', padding: '0.9rem' }}>
                        💳 Pay Round ({circle.contribution_amount} {circle.currency})
                      </button>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Round Contributions Tracker */}
            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', marginBottom: '0.85rem' }}>
                Contributions Status ({currentRound.contributions?.filter(c => c.status === 'CONFIRMED').length || 0} / {circle.max_members - 1})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {currentRound.contributions?.map(contrib => (
                  <div key={contrib.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>{contrib.contributor?.display_name || 'Member'}</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {contrib.contributor?.nimiq_address.slice(0, 10)}...
                      </span>
                    </div>

                    {contrib.status === 'CONFIRMED' ? (
                      <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                        ✓ Paid
                      </span>
                    ) : (
                      <span className="badge badge-forming" style={{ fontSize: '0.7rem' }}>
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
