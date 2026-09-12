'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/Header';
import { createCircle } from '../../lib/api';

export default function CreateCirclePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('100');
  const [frequency, setFrequency] = useState('WEEKLY');
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
      const circle = await createCircle({
        name: name.trim(),
        contribution_amount: parseFloat(amount),
        frequency,
        max_members: parseInt(maxMembers, 10),
      });

      router.push(`/circle/${circle.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create circle');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Header title="Create Circle" onBack={() => router.push('/')} />

      <main style={{ padding: '1rem 0', maxWidth: '600px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit} className="glass-card animate-fade-in">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>New Savings Circle</h3>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Circle Name</label>
            <input 
              className="form-input" 
              placeholder="e.g. Family Circle, Dev Squad" 
              value={name} 
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contribution Amount per Round (NIM)</label>
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

          <div className="form-group">
            <label className="form-label">Contribution Frequency</label>
            <select 
              className="form-select" 
              value={frequency} 
              onChange={e => setFrequency(e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Maximum Members</label>
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

          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span className="text-muted">Total Circle Pool (per round):</span>
              <strong style={{ color: 'var(--accent-gold)' }}>
                {(parseFloat(amount || '0') * parseInt(maxMembers || '1', 10)).toLocaleString()} NIM
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Rounds:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{maxMembers} rounds</strong>
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Circle...' : '✨ Launch Circle'}
          </button>
        </form>
      </main>
    </div>
  );
}
