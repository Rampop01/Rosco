'use client';

import React from 'react';
import { Circle } from '../lib/api';
import { Users, ArrowRight } from 'lucide-react';

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

        {/* Amount & Pot Breakdown Box (High Contrast Dark Slate) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.85rem',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          border: '1px solid #334155',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)'
        }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Round Contribution
            </span>
            <strong style={{ fontSize: '1.2rem', color: '#FBBF24', fontFamily: 'monospace' }}>
              {circle.contribution_amount.toLocaleString()} NIM
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Round Pot
            </span>
            <strong style={{ fontSize: '1.2rem', color: '#38BDF8', fontFamily: 'monospace' }}>
              {totalPot.toLocaleString()} NIM
            </strong>
          </div>
        </div>

        {/* Active Round Progress */}
        {circle.status === 'ACTIVE' && (
          <div style={{ marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
              <span className="text-secondary">Round {currentRound?.round_number || 1} Progress</span>
              <span style={{ color: '#D97706', fontWeight: 700 }}>{confirmedContribs} / {requiredContribs} Paid</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer — Member Avatars, Clear Label & High-Contrast CTA Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '0.85rem',
        borderTop: '1px solid #E2E8F0',
        marginTop: '0.25rem'
      }}>
        {/* Members Count with Styled Avatar Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {approvedMemberships.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {approvedMemberships.slice(0, 3).map((m, idx) => {
                const initial = (m.user?.display_name || 'Member')[0].toUpperCase();
                const bgColors = [
                  'linear-gradient(135deg, #0066FF 0%, #0040B0 100%)',
                  'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                ];
                return (
                  <div
                    key={m.id || idx}
                    title={m.user?.display_name || 'Member'}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: bgColors[idx % bgColors.length],
                      color: '#FFFFFF',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid #FFFFFF',
                      marginLeft: idx > 0 ? '-6px' : 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                    }}
                  >
                    {initial}
                  </div>
                );
              })}
            </div>
          ) : (
            <Users style={{ width: 16, height: 16, color: '#94A3B8' }} />
          )}

          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Users style={{ width: 13, height: 13, color: '#94A3B8' }} />
            <span>{approvedMemberships.length} / {circle.max_members} members</span>
          </span>
        </div>

        {/* High-contrast CTA Button */}
        <div style={{
          color: '#0066FF',
          background: 'rgba(0, 102, 255, 0.08)',
          border: '1px solid rgba(0, 102, 255, 0.22)',
          padding: '0.42rem 0.85rem',
          borderRadius: '10px',
          fontWeight: 700,
          fontSize: '0.82rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0, 102, 255, 0.05)'
        }}>
          <span>View Details</span>
          <ArrowRight style={{ width: 14, height: 14 }} />
        </div>
      </div>
    </div>
  );
};
