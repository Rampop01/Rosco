/**
 * API Client — Typed REST client for the Rosco backend
 * Handles JWT token storage, injection, and error handling.
 * Single source of truth: all circle/membership/round data comes from the backend only.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api')).replace(/^["']|["']$/g, '').replace(/\/+$/, '');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  nimiq_address: string;
  display_name: string | null;
  language: string;
  created_at: string;
}

export interface CircleMember {
  id: string;
  nimiq_address: string;
  display_name: string | null;
}

export interface MembershipInfo {
  id: string;
  user_id: string;
  status: string;
  joined_order: number | null;
  user?: CircleMember;
}

export interface RoundContribution {
  id: string;
  contributor_id: string;
  expected_amount: number;
  tx_hash: string | null;
  status: string;
  confirmed_at: string | null;
  round_id?: string;
  contributor?: CircleMember;
}

export interface RoundInfo {
  id: string;
  round_number: number;
  recipient_id: string;
  start_date?: string;
  due_date: string;
  status: string;
  completed_at: string | null;
  recipient?: CircleMember;
  contributions?: RoundContribution[];
}

export interface Circle {
  id: string;
  name: string;
  organizer_id: string;
  contribution_amount: number;
  currency: string;
  frequency: string;
  min_members: number;
  max_members: number;
  status: string;
  payout_order: string[] | null;
  start_date: string | null;
  created_at: string;
  organizer?: CircleMember;
  memberships?: MembershipInfo[];
  rounds?: RoundInfo[];
}

export interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  user: CircleMember;
}

export interface PaymentIntent {
  recipient_address: string;
  amount: number;
  round_id: string;
  contribution_id: string;
  message: string;
}

export type ContributionIntent = PaymentIntent;

// ─── Token Management ───────────────────────────────────────────────────────

let authToken: string | null = null;

export function setToken(token: string): void {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('rosco_token', token);
  }
}

export function getToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('rosco_token') || localStorage.getItem('kolo_token');
  }
  return authToken;
}

export function clearToken(): void {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('rosco_token');
    localStorage.removeItem('kolo_token');
  }
}

// ─── HTTP Helper ────────────────────────────────────────────────────────────

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response | null = null;
  let lastError: any = null;

  // 1. Try configured API_BASE
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...headers,
      },
    });
  } catch (err) {
    lastError = err;
  }

  if (!response) {
    throw lastError || new Error('Network request failed');
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      errorMessage = errBody.error || errBody.message || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function authenticateUser(
  nimiqAddress: string,
  displayName?: string,
  language?: string
): Promise<{ token: string; user: User }> {
  const result = await apiFetch<{ token: string; user: User }>('/auth/session', {
    method: 'POST',
    body: JSON.stringify({
      nimiq_address: nimiqAddress,
      display_name: displayName,
      language: language || 'en',
    }),
  });
  setToken(result.token);
  return result;
}

// ─── Circles ────────────────────────────────────────────────────────────────

export async function createCircle(data: {
  name: string;
  contribution_amount: number;
  frequency: string;
  max_members: number;
  organizer_id?: string;
  organizer_name?: string;
}): Promise<Circle> {
  const walletAddress = data.organizer_id || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');
  const walletLabel = data.organizer_name || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_label') || 'You (Organizer)' : 'You (Organizer)');

  const payload = {
    ...data,
    organizer_id: walletAddress,
    organizer_name: walletLabel,
  };

  const c = await apiFetch<Circle>('/circles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { ...c, status: (c.status || '').toUpperCase() };
}

export async function getCircles(): Promise<Circle[]> {
  const circles = await apiFetch<Circle[]>('/circles');
  return circles.map(c => ({ ...c, status: (c.status || '').toUpperCase() }));
}

export async function getCircle(id: string): Promise<Circle> {
  const c = await apiFetch<Circle>(`/circles/${id}`);
  return { ...c, status: (c.status || '').toUpperCase() };
}

export async function joinCircle(circleId: string, customWalletAddress?: string, customWalletLabel?: string): Promise<{ id: string; status: string; message: string }> {
  const walletAddress = customWalletAddress || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');
  const walletLabel = customWalletLabel || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_label') || 'Member' : 'Member');

  return await apiFetch<{ id: string; status: string; message: string }>(`/circles/${circleId}/join-request`, {
    method: 'POST',
    headers: {
      'x-wallet-address': walletAddress
    },
    body: JSON.stringify({
      user_id: walletAddress,
      display_name: walletLabel,
    })
  });
}

export async function getJoinRequests(circleId: string): Promise<JoinRequest[]> {
  const res = await apiFetch<JoinRequest[]>(`/circles/${circleId}/join-requests`);
  return Array.isArray(res) ? res : [];
}

export async function approveJoinRequest(circleId: string, membershipId: string): Promise<any> {
  return await apiFetch<any>(`/circles/${circleId}/join-requests/${membershipId}/approve`, { method: 'POST' });
}

export async function rejectJoinRequest(circleId: string, membershipId: string): Promise<any> {
  return await apiFetch<any>(`/circles/${circleId}/join-requests/${membershipId}/reject`, { method: 'POST' });
}

export async function startCircle(circleId: string): Promise<Circle> {
  return await apiFetch<Circle>(`/circles/${circleId}/start`, { method: 'POST' });
}

export async function deleteCircle(circleId: string): Promise<any> {
  await apiFetch(`/circles/${circleId}`, { method: 'DELETE' });
  return { success: true };
}

export const cancelCircle = deleteCircle;

// ─── Rounds & Contributions ─────────────────────────────────────────────────

export async function getCurrentRound(circleId: string): Promise<{ current_round: RoundInfo | null }> {
  try {
    return await apiFetch(`/circles/${circleId}/rounds/current`);
  } catch {
    return { current_round: null };
  }
}

export async function advanceCircleRound(circleId: string): Promise<any> {
  return await apiFetch<any>(`/circles/${circleId}/rounds/advance`, { method: 'POST' });
}

export async function getContributionIntent(
  roundId: string,
): Promise<ContributionIntent> {
  return await apiFetch<ContributionIntent>(`/rounds/${roundId}/contributions/intent`, { method: 'POST' });
}

export async function confirmContribution(roundId: string, txHash: string, walletAddress?: string): Promise<any> {
  const myWallet = walletAddress || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');

  return await apiFetch<any>(`/rounds/${roundId}/contributions/confirm`, {
    method: 'POST',
    headers: {
      'x-wallet-address': myWallet,
    },
    body: JSON.stringify({
      tx_hash: txHash,
      wallet_address: myWallet,
      contributor_id: myWallet,
    }),
  });
}

export async function getContributions(roundId: string): Promise<RoundContribution[]> {
  try {
    return await apiFetch<RoundContribution[]>(`/rounds/${roundId}/contributions`);
  } catch {
    return [];
  }
}

// ─── Reset (Dev/Test only) ──────────────────────────────────────────────────

export async function resetAllTestData(): Promise<void> {
  try {
    await apiFetch('/circles', { method: 'DELETE' });
  } catch (e) {
    console.warn('[Rosco] Failed to delete remote circles:', e);
  }

  if (typeof window !== 'undefined') {
    // Clean up any legacy localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('rosco_creator_') ||
        k.startsWith('rosco_notified_') ||
        k === 'rosco_local_circles' ||
        k === 'kolo_local_circles' ||
        k === 'rosco_notifications'
      )) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  }
}
