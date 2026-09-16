'use client';

import React, { useState, useEffect } from 'react';
import {
  PersonalGoal,
  getPersonalGoals,
  createPersonalGoal,
  depositToPersonalGoal,
  withdrawFromPersonalGoal,
  deletePersonalGoal
} from '../lib/target-savings';
import { requestPayment } from '../lib/nimiq-pay';
import { CountdownTimer } from './CountdownTimer';
import { addNotification } from '../lib/notifications';
import { Plus, Target, CheckCircle2, Trash2, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';

interface TargetSavingsViewProps {
  userId: string;
  userAddress: string;
}

const ROSCO_VAULT_ADDRESS = process.env.NEXT_PUBLIC_ROSCO_VAULT_ADDRESS || 'NQ87 SAV1 NGSV AULT 0000 0000 0000 0000 0000';

const CATEGORY_ICONS: Record<string, string> = {
  Tech: '💻',
  Emergency: '🛡️',
  Travel: '✈️',
  Rent: '🏠',
  Education: '🎓',
  General: '🎯',
};

export const TargetSavingsView: React.FC<TargetSavingsViewProps> = ({ userId, userAddress }) => {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeDepositGoal, setActiveDepositGoal] = useState<PersonalGoal | null>(null);
  const [activeWithdrawGoal, setActiveWithdrawGoal] = useState<PersonalGoal | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Form states for creating goal
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState<PersonalGoal['category']>('Tech');
  const [newFrequency, setNewFrequency] = useState<PersonalGoal['frequency']>('Weekly');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Form state for deposit
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Form state for withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    loadGoals();
  }, [userId]);

  const loadGoals = () => {
    const list = getPersonalGoals(userId);
    setGoals(list);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTarget) return;

    const initAmt = initialDeposit ? parseFloat(initialDeposit) : 0;
    let initTxHash: string | undefined;

    if (initAmt > 0) {
      try {
        setIsProcessing(true);
        setCreateError(null);

        // Deduct from NIM balance via Nimiq Pay native payment sheet
        const payRes = await requestPayment({
          recipient: ROSCO_VAULT_ADDRESS,
          amount: initAmt,
          message: `Rosco Vault Init: ${newTitle.trim()}`,
        });

        if (!payRes.success) {
          throw new Error(payRes.error || 'Payment was cancelled or rejected in Nimiq Pay');
        }
        initTxHash = payRes.txHash;
      } catch (err: any) {
        setCreateError(err.message || 'Payment cancelled. Goal not created.');
        setIsProcessing(false);
        return;
      } finally {
        setIsProcessing(false);
      }
    }

    createPersonalGoal({
      user_id: userId,
      title: newTitle.trim(),
      target_amount: parseFloat(newTarget),
      initial_deposit: initAmt,
      tx_hash: initTxHash,
      category: newCategory,
      frequency: newFrequency,
    });

    addNotification({
      title: 'Target Savings Created 🎯',
      message: `Goal "${newTitle.trim()}" set with a target of ${newTarget} NIM.${initAmt > 0 ? ` Initial deposit: ${initAmt} NIM.` : ''}`,
      type: 'goal_reached',
      amount: parseFloat(newTarget)
    });

    setNewTitle('');
    setNewTarget('');
    setInitialDeposit('');
    setShowCreateModal(false);
    loadGoals();
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDepositGoal || !depositAmount) return;

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    try {
      setIsProcessing(true);
      setDepositError(null);

      // Deduct from NIM balance via Nimiq Pay native payment sheet
      const payRes = await requestPayment({
        recipient: ROSCO_VAULT_ADDRESS,
        amount: amt,
        message: `Rosco Vault Deposit: ${activeDepositGoal.title}`,
      });

      if (!payRes.success) {
        throw new Error(payRes.error || 'Payment was cancelled or rejected in Nimiq Pay');
      }

      const updated = depositToPersonalGoal(activeDepositGoal.id, amt, payRes.txHash, depositNote.trim() || 'Target contribution');

      addNotification({
        title: 'Target Deposit Confirmed 💳',
        message: `Deposited ${amt} NIM into target "${activeDepositGoal.title}".`,
        type: 'payment',
        amount: amt
      });

      if (updated && updated.current_amount >= updated.target_amount) {
        addNotification({
          title: 'Goal Achieved! 🎉',
          message: `Congratulations! You reached your savings goal of ${updated.target_amount} NIM for "${updated.title}"!`,
          type: 'goal_reached',
          amount: updated.target_amount
        });
      }

      setDepositAmount('');
      setDepositNote('');
      setActiveDepositGoal(null);
      loadGoals();
    } catch (err: any) {
      setDepositError(err.message || 'Deposit cancelled');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWithdrawGoal) return;
    const amt = withdrawAmount ? parseFloat(withdrawAmount) : undefined;
    withdrawFromPersonalGoal(activeWithdrawGoal.id, amt);
    setWithdrawAmount('');
    setActiveWithdrawGoal(null);
    loadGoals();
  };

  const handleDelete = (goalId: string) => {
    if (!confirm('Are you sure you want to remove this personal savings goal?')) return;
    deletePersonalGoal(goalId);
    loadGoals();
  };

  const filteredGoals = goals.filter(g => {
    if (filter === 'ACTIVE') return !g.is_completed;
    if (filter === 'COMPLETED') return g.is_completed;
    return true;
  });

  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);
  const completedCount = goals.filter(g => g.is_completed).length;

  return (
    <div>
      {/* Top Banner Overview */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#FFFFFF',
        padding: '1.75rem',
        borderRadius: '16px',
        marginBottom: '2rem',
        border: '1px solid #334155',
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                Target Vault
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Solo Non-Custodial Vault</span>
            </div>
            <h2 style={{ fontSize: '1.8rem', color: '#FFFFFF', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Personal Savings Goals
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#CBD5E1', marginTop: '0.2rem' }}>
              Save toward personal milestones on your own schedule with zero group dependencies.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.6rem',
              fontSize: '0.98rem',
              fontWeight: 800
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            <span>New Personal Goal</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Total Vault Balance
            </span>
            <strong style={{ fontSize: '1.5rem', color: '#38BDF8', fontFamily: 'monospace' }}>
              {totalSaved.toLocaleString()} NIM
            </strong>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Cumulative Target
            </span>
            <strong style={{ fontSize: '1.5rem', color: '#F8FAFC', fontFamily: 'monospace' }}>
              {totalTarget.toLocaleString()} NIM
            </strong>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Completed Goals
            </span>
            <strong style={{ fontSize: '1.5rem', color: '#10B981' }}>
              {completedCount} / {goals.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.3rem', color: '#0F172A' }}>
          Your Goals ({filteredGoals.length})
        </h3>

        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All ({goals.length})
          </button>
          <button
            className={`filter-tab ${filter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setFilter('ACTIVE')}
          >
            In Progress ({goals.filter(g => !g.is_completed).length})
          </button>
          <button
            className={`filter-tab ${filter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setFilter('COMPLETED')}
          >
            Completed ({completedCount})
          </button>
        </div>
      </div>

      {/* Goals Display Grid */}
      {filteredGoals.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', borderRadius: '16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎯</div>
          <h4 style={{ fontSize: '1.25rem', color: '#0F172A', marginBottom: '0.4rem' }}>No Personal Goals Yet</h4>
          <p className="text-secondary" style={{ fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            Set a target for a new gadget, emergency fund, or personal project and watch your savings grow round by round.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            style={{ padding: '0.8rem 1.6rem' }}
          >
            + Create Your First Goal
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredGoals.map(goal => {
            const percent = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            const icon = CATEGORY_ICONS[goal.category] || '🎯';

            return (
              <div
                key={goal.id}
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  borderRadius: '16px',
                  border: goal.is_completed ? '1px solid #10B981' : '1px solid var(--border-color)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1.75rem' }}>{icon}</span>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', color: '#0F172A', marginBottom: '0.15rem' }}>
                          {goal.title}
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {goal.category} • {goal.frequency} Plan
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(goal.id)}
                      title="Delete Goal"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '0.2rem'
                      }}
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>

                  {/* Amount Progress */}
                  <div style={{ margin: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--primary-blue)', fontFamily: 'monospace' }}>
                        {goal.current_amount.toLocaleString()} <span style={{ fontSize: '0.85rem' }}>NIM</span>
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        of {goal.target_amount.toLocaleString()} NIM
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '10px',
                      background: '#E2E8F0',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: goal.is_completed
                          ? 'linear-gradient(90deg, #10B981, #059669)'
                          : 'linear-gradient(90deg, #0066FF, #38BDF8)',
                        borderRadius: '8px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                      <span style={{ color: goal.is_completed ? '#10B981' : '#0066FF', fontWeight: 700 }}>
                        {percent}% Saved
                      </span>
                      {goal.is_completed && (
                        <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                          <CheckCircle2 style={{ width: '13px', height: '13px' }} /> Target Reached!
                        </span>
                      )}
                    </div>

                    {/* Next Contribution Countdown for Scheduled Goals */}
                    {(() => {
                      if (goal.is_completed) return null;
                      const lastDeposit = goal.deposits && goal.deposits.length > 0 ? goal.deposits[0] : null;
                      const baseTime = lastDeposit ? new Date(lastDeposit.date).getTime() : new Date(goal.created_at).getTime();
                      let intervalMs = 0;
                      if (goal.frequency === 'Daily') intervalMs = 24 * 60 * 60 * 1000;
                      else if (goal.frequency === 'Weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
                      else if (goal.frequency === 'Monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;
                      else return null;

                      const nextTime = baseTime + intervalMs;
                      return (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem'
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Next Scheduled Deposit:</span>
                          <CountdownTimer targetDate={nextTime} compact={true} />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setActiveDepositGoal(goal)}
                    className="btn-primary"
                    style={{
                      padding: '0.6rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <ArrowDownLeft style={{ width: '14px', height: '14px' }} />
                    <span>Deposit</span>
                  </button>

                  <button
                    onClick={() => setActiveWithdrawGoal(goal)}
                    className="btn-secondary"
                    disabled={goal.current_amount <= 0}
                    style={{
                      padding: '0.6rem',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      opacity: goal.current_amount <= 0 ? 0.5 : 1
                    }}
                  >
                    <ArrowUpRight style={{ width: '14px', height: '14px' }} />
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CREATE GOAL MODAL ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.25rem'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '1.75rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#0F172A' }}>New Personal Savings Goal</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            {createError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#DC2626',
                padding: '0.6rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateGoal}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Goal Title</label>
                <input
                  className="form-input"
                  placeholder="e.g. MacBook Pro, Emergency Fund, House Rent"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Target Amount (NIM)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1000"
                  min="1"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Initial Deposit (Optional NIM)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min="0"
                  value={initialDeposit}
                  onChange={e => setInitialDeposit(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                >
                  <option value="Tech">💻 Technology & Gadgets</option>
                  <option value="Emergency">🛡️ Emergency & Health</option>
                  <option value="Rent">🏠 Rent & Housing</option>
                  <option value="Travel">✈️ Vacation & Travel</option>
                  <option value="Education">🎓 Education & Courses</option>
                  <option value="General">🎯 General Savings</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Saving Schedule</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                  {(['Daily', 'Weekly', 'Monthly', 'Flexible'] as const).map(freq => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setNewFrequency(freq)}
                      style={{
                        padding: '0.55rem 0.25rem',
                        borderRadius: '10px',
                        border: newFrequency === freq ? '2px solid #0066FF' : '1px solid #CBD5E1',
                        background: newFrequency === freq ? '#0066FF' : '#FFFFFF',
                        color: newFrequency === freq ? '#FFFFFF' : '#475569',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isProcessing}
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                {isProcessing 
                  ? 'Confirming with Nimiq Pay...' 
                  : (initialDeposit && parseFloat(initialDeposit) > 0 ? `Pay ${initialDeposit} NIM & Create Goal` : 'Create Goal')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── DEPOSIT MODAL ────────────────────────────────────────────────── */}
      {activeDepositGoal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.25rem'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#0F172A' }}>
                Deposit to {activeDepositGoal.title}
              </h3>
              <button
                onClick={() => setActiveDepositGoal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            {depositError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#DC2626',
                padding: '0.6rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {depositError}
              </div>
            )}

            <form onSubmit={handleDeposit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Deposit Amount (NIM)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 50"
                  min="0.1"
                  step="any"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Note / Tag (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Weekly contribution, Freelance bonus"
                  value={depositNote}
                  onChange={e => setDepositNote(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={isProcessing}
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 800, cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                {isProcessing 
                  ? 'Confirming with Nimiq Pay...' 
                  : (depositAmount && parseFloat(depositAmount) > 0 ? `Pay ${depositAmount} NIM via Nimiq Pay` : 'Confirm Deposit')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── WITHDRAW MODAL ───────────────────────────────────────────────── */}
      {activeWithdrawGoal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.25rem'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#0F172A' }}>
                Withdraw from {activeWithdrawGoal.title}
              </h3>
              <button
                onClick={() => setActiveWithdrawGoal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94A3B8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block' }}>Available Balance</span>
              <strong style={{ fontSize: '1.3rem', color: 'var(--primary-blue)', fontFamily: 'monospace' }}>
                {activeWithdrawGoal.current_amount.toLocaleString()} NIM
              </strong>
            </div>

            <form onSubmit={handleWithdraw}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Withdrawal Amount (NIM)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={`Max: ${activeWithdrawGoal.current_amount}`}
                  min="0.1"
                  max={activeWithdrawGoal.current_amount}
                  step="any"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Leave blank to withdraw entire balance.
                </span>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 800, background: '#10B981' }}
              >
                Withdraw Funds
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
