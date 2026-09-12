'use client';

import React from 'react';
import { Circle } from '../lib/api';

interface CircleCardProps {
  circle: Circle;
  onClick: () => void;
}

export const CircleCard: React.FC<CircleCardProps> = ({ circle, onClick }) => {
  const approvedMemberships = circle.memberships?.filter(m => m.status === 'APPROVED') || [];
  const memberCount = approvedMemberships.length || 1;
  const totalPot = circle.contribution_amount * (circle.max_members || memberCount);

  // Active round calculation
  const currentRound = circle.rounds?.find(r => r.status === 'open') || circle.rounds?.[0];
  const confirmedContribs = currentRound?.contributions?.filter(c => c.status === 'CONFIRMED').length || 0;
  const requiredContribs = (circle.max_members || memberCount) - 1;
  const progressPercent = requiredContribs > 0 ? Math.round((confirmedContribs / requiredContribs) * 100) : 0;

  return (
    <div 
      className="glass-card glass-card-interactive"
      onClick={onClick}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <div>
        {/* Header Title & Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>{circle.name}</h3>
            <span className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>
              {circle.frequency} schedule • NIM
            </span>
          </div>
          <span className={`badge badge-${circle.status.toLowerCase()}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
            {circle.status}
          </span>
        </div>

        {/* Amount & Pot Breakdown Box */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.85rem',
          background: 'rgba(10, 14, 26, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem'
        }}>
          <div>
            <span className="text-muted" style={{ fontSize: '0.72rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Round Contribution</span>
            <strong style={{ fontSize: '1.15rem', color: 'var(--accent-gold)' }}>
              {circle.contribution_amount.toLocaleString()} NIM
            </strong>
          </div>
          <div>
            <span className="text-muted" style={{ fontSize: '0.72rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Round Pot</span>
            <strong style={{ fontSize: '1.15rem', color: 'var(--accent-cyan)' }}>
              {totalPot.toLocaleString()} NIM
            </strong>
          </div>
        </div>

        {/* Active Round Progress */}
        {circle.status === 'ACTIVE' && (
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
              <span className="text-secondary">Round {currentRound?.round_number || 1} Progress</span>
              <span className="text-gold" style={{ fontWeight: 700 }}>{confirmedContribs} / {requiredContribs} Paid</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer — Member Avatars & CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="avatar-stack">
            {approvedMemberships.slice(0, 4).map((m, idx) => (
              <div key={m.id || idx} className="avatar-pill" title={m.user?.display_name || 'Member'}>
                {(m.user?.display_name || 'M')[0].toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-muted" style={{ fontSize: '0.78rem' }}>
            {approvedMemberships.length} / {circle.max_members}
          </span>
        </div>

        <span style={{ color: 'var(--accent-gold-light)', fontWeight: 700, fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          View Details →
        </span>
      </div>
    </div>
  );
};
