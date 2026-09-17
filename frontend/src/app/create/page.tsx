'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/Header';
import { createCircle } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { addNotification } from '../../lib/notifications';

export default function CreateCirclePage() {
  const router = useRouter();
  const { wallet, user, connectWallet } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('100');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [maxMembers, setMaxMembers] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a circle name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let activeAddr = wallet?.address || user?.nimiq_address || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null);
      if (!activeAddr) {
        try {
          await connectWallet();
          activeAddr = typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : null;
        } catch {
          setError('Please connect your Nimiq Pay wallet to create a circle');
          return;
        }
      }

      if (!activeAddr) {
        setError('Please connect your Nimiq Pay wallet first');
        return;
      }

      const circle = await createCircle({
        name: name.trim(),
        contribution_amount: parseFloat(amount || '0'),
        frequency,
        max_members: parseInt(maxMembers || '5', 10),
        organizer_id: activeAddr,
        organizer_name: user?.display_name || wallet?.label || 'Organizer',
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('rosco_creator_' + circle.id, 'true');
      }

      // Trigger in-app notification for circle creation
      addNotification({
        title: 'Circle Created 🎉',
        message: `Your savings circle "${circle.name}" has been created! Share the invite link to add members.`,
        type: 'system',
        link: `/circle/${circle.id}`,
        circle_id: circle.id,
      });

      router.push(`/circle/${circle.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create circle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const poolPerRound = (parseFloat(amount || '0') * parseInt(maxMembers || '1', 10)).toLocaleString();

  return (
    <div>
      <Header />

      <main style={{ padding: '0.75rem 0', maxWidth: '580px', margin: '0 auto' }}>
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

        <form onSubmit={handleSubmit} className="glass-card animate-fade-in" style={{ padding: '1.75rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.4rem', color: '#0F172A', marginBottom: '0.35rem' }}>New Savings Circle</h3>
            <p className="text-secondary" style={{ fontSize: '0.88rem' }}>
              Set contribution rules for your rotating group savings (ROSCA / Kolo).
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#DC2626',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              fontSize: '0.88rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.4rem', display: 'block' }}>
              Circle Name
            </label>
            <input 
              className="form-input" 
              placeholder="e.g. Laptop savings, Family Circle, Dev Squad" 
              value={name} 
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.4rem', display: 'block' }}>
              Contribution Amount per Round (NIM)
            </label>
            <input 
              type="number"
              className="form-input" 
              placeholder="100" 
              min="1"
              value={amount} 
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          {/* Clean Segmented Pill Buttons for Contribution Frequency */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem', display: 'block' }}>
              Contribution Frequency
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              background: '#F1F5F9',
              padding: '0.35rem',
              borderRadius: '14px',
              border: '1px solid #E2E8F0'
            }}>
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(freq => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  style={{
                    padding: '0.65rem 0.25rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: frequency === freq ? '#0066FF' : 'transparent',
                    color: frequency === freq ? '#FFFFFF' : '#475569',
                    fontWeight: frequency === freq ? 800 : 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: frequency === freq ? '0 4px 12px rgba(0, 102, 255, 0.28)' : 'none',
                  }}
                >
                  {freq.charAt(0) + freq.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#0F172A', marginBottom: '0.4rem', display: 'block' }}>
              Maximum Members
            </label>
            <input 
              type="number"
              className="form-input" 
              min="2"
              max="50"
              value={maxMembers} 
              onChange={e => setMaxMembers(e.target.value)}
              required
            />
          </div>

          {/* Clean, Eye-Friendly Total Pool Summary Card */}
          <div style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            borderRadius: '16px',
            padding: '1.35rem',
            marginBottom: '1.75rem',
            border: '1px solid #334155',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
            color: '#FFFFFF'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '0.85rem',
              marginBottom: '0.85rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ fontSize: '0.88rem', color: '#94A3B8', fontWeight: 600 }}>
                Total Circle Pool (per round):
              </span>
              <strong style={{ fontSize: '1.45rem', color: '#38BDF8', letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                {poolPerRound} NIM
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Schedule
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#F8FAFC' }}>
                  {frequency.charAt(0) + frequency.slice(1).toLowerCase()}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Rounds
                </span>
                <strong style={{ fontSize: '0.95rem', color: '#10B981' }}>
                  {maxMembers} rounds ({maxMembers} members)
                </strong>
              </div>
            </div>
          </div>

          {/* Full Width Launch Circle Button */}
          <button 
            className="btn-primary" 
            type="submit" 
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.05rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 10px 25px -4px rgba(0, 102, 255, 0.35)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Creating Circle...' : '✨ Launch Circle'}
          </button>
        </form>
      </main>
    </div>
  );
}
