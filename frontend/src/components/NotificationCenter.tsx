'use client';

import React, { useState, useEffect } from 'react';
import {
  AppNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  getUnreadCount
} from '../lib/notifications';
import { Bell, CheckCheck, Trash2, X, ArrowRight, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const loadNotifications = () => {
    const list = getNotifications();
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.is_read).length);
  };

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('rosco_notifications_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('rosco_notifications_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    loadNotifications();
    if (n.link) {
      setIsOpen(false);
      router.push(n.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    loadNotifications();
  };

  const handleClear = () => {
    clearAllNotifications();
    loadNotifications();
  };

  const formatTime = (iso: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'join': return '👥';
      case 'payment': return '💳';
      case 'contribution_due': return '⏳';
      case 'round_winner': return '🏆';
      case 'goal_reached': return '🎉';
      default: return '⚡';
    }
  };

  return (
    <>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{
          position: 'relative',
          background: isOpen ? '#0066FF' : 'rgba(255, 255, 255, 0.08)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isOpen ? '#FFFFFF' : 'var(--text-primary)',
          transition: 'all 0.2s ease',
        }}
      >
        <Bell style={{ width: '17px', height: '17px' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            background: '#EF4444',
            color: '#FFFFFF',
            fontSize: '0.65rem',
            fontWeight: 800,
            borderRadius: '10px',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over Drawer / Modal Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <div
            className="glass-card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '100vh',
              background: '#FFFFFF',
              borderRadius: '0',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
              overflowY: 'auto'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '1rem',
              borderBottom: '1px solid #E2E8F0',
              marginBottom: '1rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span style={{
                      fontSize: '0.72rem',
                      background: 'rgba(0, 102, 255, 0.12)',
                      color: '#0066FF',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      fontWeight: 800
                    }}>
                      {unreadCount} new
                    </span>
                  )}
                </h3>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Quick Actions */}
            {notifications.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0066FF',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <CheckCheck style={{ width: '14px', height: '14px' }} />
                  <span>Mark all read</span>
                </button>

                <button
                  onClick={handleClear}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Trash2 style={{ width: '13px', height: '13px' }} />
                  <span>Clear</span>
                </button>
              </div>
            )}

            {/* Notification Items List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94A3B8' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔔</div>
                  <strong style={{ display: 'block', color: '#0F172A', marginBottom: '0.25rem' }}>All Caught Up!</strong>
                  <p style={{ fontSize: '0.85rem' }}>You will receive notifications here when members join, payments are made, or rounds are due.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      background: n.is_read ? '#F8FAFC' : 'rgba(0, 102, 255, 0.05)',
                      border: n.is_read ? '1px solid #E2E8F0' : '1px solid rgba(0, 102, 255, 0.25)',
                      cursor: n.link ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    {!n.is_read && (
                      <span style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: '#0066FF'
                      }} />
                    )}

                    <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{getIcon(n.type)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                          <strong style={{ fontSize: '0.88rem', color: '#0F172A' }}>{n.title}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{formatTime(n.timestamp)}</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.4, margin: '0 0 0.4rem' }}>
                          {n.message}
                        </p>
                        {n.link && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#0066FF', fontWeight: 700 }}>
                            <span>View details</span>
                            <ArrowRight style={{ width: '12px', height: '12px' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
