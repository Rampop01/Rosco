'use client';

import React, { useState, useEffect } from 'react';
import { RoscoLogo } from './RoscoLogo';

interface LandingPageProps {
  onConnectWallet: (displayName?: string) => void;
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onConnectWallet, isLoggedIn, onGoToDashboard }) => {
  const [membersCount, setMembersCount] = useState(5);
  const [contributionAmount, setContributionAmount] = useState(200);
  const [frequency, setFrequency] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Video / Product Benefit Carousel State
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const totalPot = membersCount * contributionAmount;

  const carouselSlides = [
    {
      id: 'kolo',
      badge: 'PRODUCT BENEFIT 01',
      title: 'Automated Group Savings (ROSCA)',
      headline: 'Organize circles with fixed schedules and transparent rules',
      description: 'Rosco brings traditional rotating savings circles (Kolo) to Nimiq Pay. Set contribution amounts, schedules, and member limits. When started, Rosco generates a cryptographically fair payout sequence.',
      color: '#0066FF',
      mockupData: {
        circleName: 'Family Savings Kolo',
        members: ['Alex M.', 'David K.', 'Sarah O.', 'Kwame M.', 'Elena R.'],
        status: 'Active • Round 2 of 5',
        pot: '1,000 NIM'
      }
    },
    {
      id: 'pay',
      badge: 'PRODUCT BENEFIT 02',
      title: '1-Tap Native Nimiq Pay Checkout',
      headline: 'Direct wallet-to-wallet transfers with zero platform fees',
      description: 'Members pay their round contribution using Nimiq Pay native payment sheets directly to the assigned round recipient. Funds never sit in a central pool or smart contract.',
      color: '#059669',
      mockupData: {
        sender: 'David K.',
        recipient: 'Alex M. (Round 2 Recipient)',
        amount: '200 NIM',
        status: 'Payment Approved via Nimiq Pay'
      }
    },
    {
      id: 'verify',
      badge: 'PRODUCT BENEFIT 03',
      title: 'Independent On-Chain Verification',
      headline: 'Backend RPC worker double-checks every transaction on-chain',
      description: 'No manual receipt verification needed. Our automated background worker queries Nimiq testnet RPC every 2 minutes to verify transaction hash, sender, recipient, and block confirmations.',
      color: '#D97706',
      mockupData: {
        txHash: '9a7f8c12b4e567890abcdef1234567890abcdef1',
        confirmations: '12 Blocks Confirmed',
        rpcStatus: 'Transaction Verified On-Chain'
      }
    },
    {
      id: 'payout',
      badge: 'PRODUCT BENEFIT 04',
      title: 'Guaranteed Full Pot Payouts',
      headline: 'Receive 100% of the gathered round pot in your wallet',
      description: 'When your assigned round arrives in the fair random sequence, all members transfer their round contribution to your wallet, providing you with a lump-sum payout.',
      color: '#7C3AED',
      mockupData: {
        recipientName: 'Alex M.',
        totalCollected: '1,000 NIM',
        payoutStatus: 'Round Pot Delivered (100%)'
      }
    }
  ];

  // Auto-play video carousel every 5 seconds if playing
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPlaying, carouselSlides.length]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqs = [
    {
      q: 'Is Rosco custodial? Where are the funds held?',
      a: 'Rosco is 100% non-custodial. There are no pool wallets or smart contracts holding funds. Contributions are transferred directly peer-to-peer from member wallets to the designated round recipient address using Nimiq Pay.'
    },
    {
      q: 'How does the payout order work?',
      a: 'When the circle organizer starts a circle, the backend generates a random, cryptographically fair payout sequence for all approved members. Each round, one member receives 100% of the gathered pot.'
    },
    {
      q: 'How are payments verified?',
      a: 'Rosco features an independent on-chain verification engine. When a payment is submitted, our background RPC worker verifies sender address, recipient address, exact NIM amount, and block confirmations directly on the Nimiq blockchain.'
    },
    {
      q: 'Can I test Rosco without real NIM?',
      a: 'Yes! Rosco includes a built-in Dev Mode mock SDK so you can test creating circles, inviting members, starting rounds, and simulating payments right in your browser.'
    }
  ];

  const currentSlide = carouselSlides[activeSlide];

  return (
    <div>
      {/* Top Header Navbar */}
      <header className="header">
        <div 
          onClick={isLoggedIn && onGoToDashboard ? onGoToDashboard : () => scrollToSection('hero')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
        >
          <RoscoLogo size={34} />
          <span className="brand-title">Rosco</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <nav className="nav-links nav-text-links">
            <span className="nav-link" onClick={() => scrollToSection('products')}>Products</span>
            <span className="nav-link" onClick={() => scrollToSection('showcase')}>Showcase</span>
            <span className="nav-link" onClick={() => scrollToSection('calculator')}>Calculator</span>
            <span className="nav-link" onClick={() => scrollToSection('faq')}>FAQ</span>
          </nav>

          <button 
            className="btn-primary" 
            style={{ padding: '0.6rem 1.15rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }} 
            onClick={isLoggedIn && onGoToDashboard ? onGoToDashboard : () => onConnectWallet()}
          >
            {isLoggedIn ? 'Dashboard →' : 'Launch App'}
          </button>
        </div>
      </header>

      {/* Balanced Hero Section */}
      <section id="hero" className="hero-grid">
        <div className="hero-left">
          <h1 className="hero-title">
            The Smart Way to <br />
            <span style={{ color: 'var(--primary-blue)' }}>Save Together.</span>
          </h1>

          <p className="hero-subtitle">
            Rosco brings traditional rotating savings (Kolo / ROSCA) to Nimiq Pay. 
            Save on a fixed schedule with trusted groups and collect full round pots with 0% platform fees.
          </p>

          {/* Clean Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              className="btn-primary" 
              style={{ padding: '0.95rem 2.2rem', fontSize: '1.05rem' }} 
              onClick={isLoggedIn && onGoToDashboard ? onGoToDashboard : () => onConnectWallet()}
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Launch Rosco App'}
            </button>
            
            <button 
              className="btn-secondary" 
              style={{ padding: '0.95rem 1.8rem', fontSize: '1.05rem' }} 
              onClick={() => scrollToSection('showcase')}
            >
              Explore Video Tour
            </button>
          </div>
        </div>

        {/* Right Side: High Resolution 3D Fintech Illustration */}
        <div style={{ textAlign: 'center' }}>
          <img 
            src="/hero_savings.jpg" 
            alt="Rosco Savings App Mockup" 
            style={{
              width: '100%',
              maxHeight: '500px',
              objectFit: 'contain',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 102, 255, 0.15)'
            }} 
          />
        </div>
      </section>

      {/* Trust & Proof Bar */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        margin: '1rem 0 4.5rem'
      }}>
        <div className="stat-card">
          <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--primary-blue)', display: 'block', lineHeight: 1 }}>100%</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginTop: '0.3rem', display: 'block' }}>Non-Custodial</span>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Direct wallet-to-wallet P2P payouts</p>
        </div>

        <div className="stat-card">
          <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--primary-blue)', display: 'block', lineHeight: 1 }}>0%</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginTop: '0.3rem', display: 'block' }}>Platform Fees</span>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Keep 100% of your round pot</p>
        </div>

        <div className="stat-card">
          <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--primary-blue)', display: 'block', lineHeight: 1 }}>&lt; 2 Min</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginTop: '0.3rem', display: 'block' }}>RPC Verification</span>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Automated background block scanner</p>
        </div>

        <div className="stat-card">
          <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--primary-blue)', display: 'block', lineHeight: 1 }}>1-Tap</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginTop: '0.3rem', display: 'block' }}>Nimiq Pay</span>
          <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Native payment sheet integration</p>
        </div>
      </section>

      {/* Products Showcase Grid */}
      <section id="products" style={{ margin: '6rem 0 5.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="hero-badge" style={{ marginBottom: '0.6rem' }}>OUR SAVINGS PRODUCTS</div>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', color: '#0F172A' }}>
            Products built to help you <span style={{ color: 'var(--primary-blue)' }}>save together</span>
          </h2>
          <p className="text-secondary" style={{ fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
            Choose the right rotating circle format for your group, targets, and financial goals.
          </p>
        </div>

        <div className="features-grid">
          {/* Card 1: Rotating Kolo */}
          <div className="product-card">
            <img 
              src="/feature_kolo.jpg" 
              alt="Rotating Kolo Savings" 
              style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
            />
            <div style={{ padding: '1.75rem' }}>
              <span className="badge badge-active" style={{ marginBottom: '0.75rem' }}>
                ROTATING KOLO
              </span>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#0F172A' }}>
                Rotating Savings Circle
              </h3>
              <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                Traditional ROSCA brought to Nimiq Pay. Members pool fixed contributions on a weekly or monthly schedule and take turns receiving 100% of the pot.
              </p>
            </div>
          </div>

          {/* Card 2: Target Savings */}
          <div className="product-card">
            <div style={{
              width: '100%',
              height: '200px',
              background: 'linear-gradient(135deg, #0066FF 0%, #0040A8 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              gap: '0.5rem'
            }}>
              <strong style={{ fontSize: '1.35rem', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                Rosco Target Vault
              </strong>
              <span style={{ fontSize: '0.8rem', opacity: 0.85, background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.75rem', borderRadius: '20px' }}>
                Group Goal Milestone
              </span>
            </div>
            <div style={{ padding: '1.75rem' }}>
              <span className="badge badge-completed" style={{ marginBottom: '0.75rem' }}>
                TARGET SAVINGS
              </span>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#0F172A' }}>
                Target Goals Circle
              </h3>
              <p className="text-secondary" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                Save toward shared milestones — buying equipment, paying rent, holiday trips, or funding projects with trusted friends and family.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Product Benefit Video & Carousel Showcase */}
      <section id="showcase" style={{ margin: '5.5rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="hero-badge" style={{ marginBottom: '0.6rem' }}>INTERACTIVE PRODUCT SHOWCASE</div>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', color: '#0F172A' }}>
            See how Rosco <span style={{ color: 'var(--primary-blue)' }}>transforms group savings</span>
          </h2>
          <p className="text-secondary" style={{ fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
            Watch our step-by-step product walkthrough showcasing circle creation, 1-tap Nimiq Pay checkout, and instant verification.
          </p>
        </div>

        {/* Video Player Frame Container */}
        <div className="glass-card" style={{
          padding: '0',
          overflow: 'hidden',
          border: '1px solid #CBD5E1',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px -8px rgba(0, 102, 255, 0.12)',
          background: '#FFFFFF'
        }}>
          {/* Top Player Control Header */}
          <div style={{
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: '#94A3B8', textTransform: 'uppercase' }}>
                LIVE PRODUCT SHOWCASE • SLIDE {activeSlide + 1} OF {carouselSlides.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', background: 'rgba(255,255,255,0.1)', color: '#FFF', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? 'Pause Auto-Play' : 'Play Video Tour'}
              </button>
            </div>
          </div>

          {/* Main Video Slide Viewport */}
          <div className="showcase-viewport">
            {/* Left Content Column */}
            <div>
              <span className="badge" style={{ background: `${currentSlide.color}15`, color: currentSlide.color, border: `1px solid ${currentSlide.color}30`, marginBottom: '1rem' }}>
                {currentSlide.badge}
              </span>
              <h3 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#0F172A', lineHeight: 1.2 }}>
                {currentSlide.title}
              </h3>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: currentSlide.color, marginBottom: '1rem' }}>
                {currentSlide.headline}
              </h4>
              <p className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.65', marginBottom: '1.75rem' }}>
                {currentSlide.description}
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button 
                  className="btn-primary" 
                  style={{ padding: '0.7rem 1.5rem', fontSize: '0.92rem', background: currentSlide.color }}
                  onClick={() => setIsPlaying(false)}
                >
                  Explore Feature
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary"
                    style={{ padding: '0.6rem 0.9rem' }}
                    onClick={() => setActiveSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)}
                  >
                    ←
                  </button>
                  <button 
                    className="btn-secondary"
                    style={{ padding: '0.6rem 0.9rem' }}
                    onClick={() => setActiveSlide((prev) => (prev + 1) % carouselSlides.length)}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>

            {/* Right Video Animation Screen Card */}
            <div>
              <div style={{
                background: '#0F172A',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                color: '#FFFFFF',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                border: `2px solid ${currentSlide.color}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.85rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: currentSlide.color }}>
                    {currentSlide.title}
                  </span>
                  <span className="badge badge-active" style={{ fontSize: '0.68rem' }}>Live Simulation</span>
                </div>

                {/* Dynamic Screen Mockup Content */}
                {activeSlide === 0 && (
                  <div>
                    <h4 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', color: '#FFF' }}>{currentSlide.mockupData.circleName}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{currentSlide.mockupData.status}</span>
                    <div style={{ margin: '1rem 0', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase' }}>Round Pot</span>
                      <strong style={{ fontSize: '1.6rem', color: '#FFD700', display: 'block' }}>{currentSlide.mockupData.pot}</strong>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>
                      <strong>Approved Members:</strong> {currentSlide.mockupData.members?.join(', ')}
                    </div>
                  </div>
                )}

                {activeSlide === 1 && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase' }}>Nimiq Pay Transaction</span>
                    <div style={{ margin: '0.85rem 0', background: 'rgba(5, 150, 105, 0.15)', border: '1px solid #059669', padding: '1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6EE7B7' }}>Sender: {currentSlide.mockupData.sender}</span>
                      <strong style={{ fontSize: '1.4rem', color: '#FFF', display: 'block', margin: '0.2rem 0' }}>{currentSlide.mockupData.amount}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#A7F3D0' }}>Recipient: {currentSlide.mockupData.recipient}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#10B981' }}>✓ {currentSlide.mockupData.status}</span>
                  </div>
                )}

                {activeSlide === 2 && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase' }}>RPC Blockchain Scanner</span>
                    <div style={{ margin: '0.85rem 0', background: 'rgba(217, 119, 6, 0.15)', border: '1px solid #D97706', padding: '1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#FCD34D', fontFamily: 'monospace' }}>Tx: {currentSlide.mockupData.txHash?.slice(0, 16)}...</span>
                      <strong style={{ fontSize: '1.1rem', color: '#FFF', display: 'block', margin: '0.4rem 0' }}>{currentSlide.mockupData.confirmations}</strong>
                      <span style={{ fontSize: '0.82rem', color: '#10B981' }}>{currentSlide.mockupData.rpcStatus}</span>
                    </div>
                  </div>
                )}

                {activeSlide === 3 && (
                  <div>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', textTransform: 'uppercase' }}>Full Pot Delivery</span>
                    <div style={{ margin: '0.85rem 0', background: 'rgba(124, 58, 237, 0.15)', border: '1px solid #7C3AED', padding: '1rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#C4B5FD' }}>Winner: {currentSlide.mockupData.recipientName}</span>
                      <strong style={{ fontSize: '1.8rem', color: '#FFD700', display: 'block', margin: '0.2rem 0' }}>{currentSlide.mockupData.totalCollected}</strong>
                      <span style={{ fontSize: '0.82rem', color: '#A78BFA' }}>{currentSlide.mockupData.payoutStatus}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Slide Nav Thumbnails Bar */}
          <div className="showcase-tabs">
            {carouselSlides.map((slide, idx) => (
              <div 
                key={slide.id}
                onClick={() => { setActiveSlide(idx); setIsPlaying(false); }}
                style={{
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  borderBottom: activeSlide === idx ? `4px solid ${slide.color}` : '4px solid transparent',
                  background: activeSlide === idx ? '#FFFFFF' : 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: slide.color, marginBottom: '0.2rem' }}>
                  STEP {idx + 1}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {slide.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Pot & Savings Calculator */}
      <section id="calculator" style={{ margin: '6rem 0 5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="hero-badge" style={{ marginBottom: '0.6rem' }}>INTERACTIVE CALCULATOR</div>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', color: '#0F172A' }}>
            Calculate Your Group's <span style={{ color: 'var(--primary-blue)' }}>Pot Payout</span>
          </h2>
          <p className="text-secondary" style={{ fontSize: '1rem' }}>
            See exactly how much you save and receive when your assigned payout round arrives.
          </p>
        </div>

        <div className="glass-card calculator-grid">
          <div>
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="form-label">Number of Members in Circle</span>
                <strong style={{ color: 'var(--primary-blue)', fontSize: '1.15rem' }}>{membersCount} members</strong>
              </div>
              <input 
                type="range" 
                min="3" 
                max="30" 
                className="range-slider"
                value={membersCount} 
                onChange={e => setMembersCount(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="form-label">Contribution per Round</span>
                <strong style={{ color: 'var(--primary-blue)', fontSize: '1.15rem' }}>{contributionAmount.toLocaleString()} NIM</strong>
              </div>
              <input 
                type="range" 
                min="50" 
                max="5000" 
                step="50"
                className="range-slider"
                value={contributionAmount} 
                onChange={e => setContributionAmount(parseInt(e.target.value, 10))}
              />
            </div>

            <div className="form-group">
              <span className="form-label">Round Schedule</span>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem' }}>
                <button 
                  className={`btn-secondary ${frequency === 'Weekly' ? 'active' : ''}`} 
                  style={{ flex: 1, background: frequency === 'Weekly' ? '#FFFFFF' : '', borderColor: frequency === 'Weekly' ? 'var(--primary-blue)' : '' }}
                  onClick={() => setFrequency('Weekly')}
                >
                  Weekly
                </button>
                <button 
                  className={`btn-secondary ${frequency === 'Monthly' ? 'active' : ''}`} 
                  style={{ flex: 1, background: frequency === 'Monthly' ? '#FFFFFF' : '', borderColor: frequency === 'Monthly' ? 'var(--primary-blue)' : '' }}
                  onClick={() => setFrequency('Monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <span className="text-secondary" style={{ fontSize: '0.88rem', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                Your Guaranteed Pot Payout
              </span>
              <div style={{ fontSize: '3.4rem', fontWeight: 900, color: 'var(--primary-blue)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                {totalPot.toLocaleString()} <span style={{ fontSize: '1.6rem' }}>NIM</span>
              </div>
              <p className="text-secondary" style={{ fontSize: '0.9rem', marginTop: '0.85rem', lineHeight: '1.5' }}>
                When your assigned round arrives in the fair sequence, you receive the full pooled contribution of <strong>{totalPot.toLocaleString()} NIM</strong> directly into your Nimiq Pay wallet.
              </p>
            </div>

            <div className="calculator-stats">
              <div>
                <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>Circle Duration</span>
                <strong style={{ fontSize: '1.15rem', color: '#0F172A' }}>{membersCount} {frequency === 'Weekly' ? 'Weeks' : 'Months'}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>Total Circle Savings</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--primary-blue)' }}>{totalPot.toLocaleString()} NIM</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{ margin: '5rem 0 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="hero-badge" style={{ marginBottom: '0.6rem' }}>GOT QUESTIONS?</div>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '0.5rem', color: '#0F172A' }}>
            Frequently Asked <span style={{ color: 'var(--primary-blue)' }}>Questions</span>
          </h2>
        </div>

        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              className="glass-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>{faq.q}</strong>
                <span style={{ fontSize: '1.3rem', color: 'var(--primary-blue)', fontWeight: 800 }}>
                  {activeFaq === idx ? '−' : '+'}
                </span>
              </div>
              {activeFaq === idx && (
                <p className="text-secondary" style={{ fontSize: '0.92rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)', lineHeight: '1.6' }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section style={{ margin: '5rem 0 3rem' }}>
        <div className="cta-banner">
          <h2 style={{ fontSize: '2.6rem', marginBottom: '0.85rem', color: '#FFFFFF' }}>
            Start your rotating savings circle today.
          </h2>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2.2rem', color: '#E2E8F0' }}>
            Join thousands of savers building financial disciplined habits with 0% platform fees on Nimiq Pay.
          </p>
          <button 
            className="btn-primary" 
            style={{ padding: '1.1rem 2.4rem', fontSize: '1.1rem', background: '#FFFFFF', color: 'var(--primary-blue)' }}
            onClick={isLoggedIn && onGoToDashboard ? onGoToDashboard : () => onConnectWallet()}
          >
            {isLoggedIn ? 'Go to Dashboard' : 'Connect Wallet & Launch App'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '2.5rem',
        paddingBottom: '2.5rem',
        marginTop: '4rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        fontSize: '0.9rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <RoscoLogo size={28} />
          <strong style={{ color: '#0F172A' }}>Rosco Protocol</strong> — Rotating Savings Circles for Nimiq Pay
        </div>
        <div>
          Built with Next.js, Express & Prisma • 100% Non-Custodial P2P
        </div>
      </footer>
    </div>
  );
};
