'use client';

import React, { useState } from 'react';
import { requestPayment } from '../lib/nimiq-pay';
import { getContributionIntent, confirmContribution, RoundInfo, Circle } from '../lib/api';

interface ContributeModalProps {
  circle: Circle;
  round: RoundInfo;
  onClose: () => void;
  onSuccess: () => void;
}

export const ContributeModal: React.FC<ContributeModalProps> = ({
  circle,
  round,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'review' | 'paying' | 'verifying' | 'success' | 'error'>('review');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handlePay = async () => {
    try {
      setStep('paying');
      setErrorMsg(null);

      // 1. Fetch payment intent from backend (gets recipient address, amount, message)
      const intent = await getContributionIntent(round.id);

      // 2. Trigger Nimiq Pay SDK requestPayment
      const result = await requestPayment({
        recipient: intent.recipient_address,
        amount: intent.amount,
        message: intent.message,
      });

      if (!result.success || !result.txHash) {
        throw new Error(result.error || 'Payment cancelled or failed');
      }

      setTxHash(result.txHash);
      setStep('verifying');

      // 3. Confirm contribution with backend
      await confirmContribution(round.id, result.txHash);

      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Contribution error:', err);
      setErrorMsg(err.message || 'Payment failed. Please try again.');
      setStep('error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.25rem'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.2rem' }}>Round {round.round_number} Contribution</h3>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {step === 'review' && (
          <div>
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.25rem',
              textAlign: 'center'
            }}>
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
                You are contributing to
              </span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                {circle.name}
              </strong>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                {circle.contribution_amount} {circle.currency}
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>Recipient:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {round.recipient?.display_name || round.recipient?.nimiq_address.slice(0, 8) + '...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Verification:</span>
                <span className="text-cyan">Independent On-Chain</span>
              </div>
            </div>

            <button className="btn-primary" onClick={handlePay}>
              ⚡ Pay with Nimiq Pay
            </button>
          </div>
        )}

        {step === 'paying' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="pulse-glow" style={{
              width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-gold)',
              margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>
              💳
            </div>
            <h4>Waiting for Nimiq Pay...</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Please confirm the payment in your Nimiq Pay app.
            </p>
          </div>
        )}

        {step === 'verifying' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div className="pulse-glow" style={{
              width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-cyan)',
              margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>
              🔍
            </div>
            <h4>Verifying On-Chain...</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Transaction broadcast! Confirming with backend...
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%', background: '#10B981',
              margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#fff'
            }}>
              ✓
            </div>
            <h4 style={{ color: '#10B981' }}>Contribution Confirmed!</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Your payment of {circle.contribution_amount} {circle.currency} has been verified on-chain.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)',
              margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#EF4444'
            }}>
              ✕
            </div>
            <h4 style={{ color: '#EF4444' }}>Payment Failed</h4>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: '0.5rem 0 1.25rem' }}>
              {errorMsg}
            </p>
            <button className="btn-secondary" onClick={() => setStep('review')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
