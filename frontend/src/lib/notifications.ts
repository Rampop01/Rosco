/**
 * Rosco In-App Notification Engine
 * Tracks important events: join requests, approved members, payments made/received,
 * countdown reminders for next contributions, and personal target milestones.
 */

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'join' | 'payment' | 'contribution_due' | 'round_winner' | 'goal_reached' | 'system';
  timestamp: string;
  is_read: boolean;
  link?: string;
  circle_id?: string;
  amount?: number;
}

const NOTIFS_KEY = 'rosco_notifications_store';

export function getNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNotifications(notifs: AppNotification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs.slice(0, 50))); // keep latest 50
    window.dispatchEvent(new Event('rosco_notifications_updated'));
  } catch (err) {
    console.warn('[Rosco] Failed to save notifications:', err);
  }
}

export function addNotification(data: Omit<AppNotification, 'id' | 'timestamp' | 'is_read'>): AppNotification {
  const notifs = getNotifications();
  const newNotif: AppNotification = {
    ...data,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    is_read: false,
  };

  notifs.unshift(newNotif);
  saveNotifications(notifs);
  return newNotif;
}

export function markAsRead(id: string): void {
  const notifs = getNotifications();
  const found = notifs.find(n => n.id === id);
  if (found) {
    found.is_read = true;
    saveNotifications(notifs);
  }
}

export function markAllAsRead(): void {
  const notifs = getNotifications();
  notifs.forEach(n => { n.is_read = true; });
  saveNotifications(notifs);
}

export function clearAllNotifications(): void {
  saveNotifications([]);
}

export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.is_read).length;
}
