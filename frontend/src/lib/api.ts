/**
 * API Client — Typed REST client for the Kolo backend
 * Handles JWT token storage, injection, and error handling.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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
  contributor?: CircleMember;
}

export interface RoundInfo {
  id: string;
  round_number: number;
  recipient_id: string;
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

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return data as T;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function createSession(nimiqAddress: string, displayName?: string): Promise<{ token: string; user: User }> {
  const result = await apiFetch<{ token: string; user: User }>('/auth/session', {
    method: 'POST',
    body: JSON.stringify({
      nimiq_address: nimiqAddress,
      display_name: displayName,
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
}): Promise<Circle> {
  return apiFetch<Circle>('/circles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCircles(): Promise<Circle[]> {
  return apiFetch<Circle[]>('/circles');
}

export async function getCircle(id: string): Promise<Circle> {
  return apiFetch<Circle>(`/circles/${id}`);
}

export async function joinCircle(circleId: string): Promise<{ id: string; status: string; message: string }> {
  return apiFetch(`/circles/${circleId}/join-request`, { method: 'POST' });
}

export async function getJoinRequests(circleId: string): Promise<JoinRequest[]> {
  return apiFetch<JoinRequest[]>(`/circles/${circleId}/join-requests`);
}

export async function approveJoinRequest(circleId: string, membershipId: string): Promise<any> {
  return apiFetch(`/circles/${circleId}/join-requests/${membershipId}/approve`, { method: 'POST' });
}

export async function rejectJoinRequest(circleId: string, membershipId: string): Promise<any> {
  return apiFetch(`/circles/${circleId}/join-requests/${membershipId}/reject`, { method: 'POST' });
}

export async function startCircle(circleId: string): Promise<Circle> {
  return apiFetch<Circle>(`/circles/${circleId}/start`, { method: 'POST' });
}

export async function cancelCircle(circleId: string): Promise<any> {
  return apiFetch(`/circles/${circleId}/cancel`, { method: 'POST' });
}

// ─── Rounds & Contributions ────────────────────────────────────────────────

export async function getCurrentRound(circleId: string): Promise<{ current_round: RoundInfo | null }> {
  return apiFetch(`/circles/${circleId}/rounds/current`);
}

export async function getContributionIntent(roundId: string): Promise<PaymentIntent> {
  return apiFetch<PaymentIntent>(`/rounds/${roundId}/contributions/intent`, { method: 'POST' });
}

export async function confirmContribution(roundId: string, txHash: string): Promise<any> {
  return apiFetch(`/rounds/${roundId}/contributions/confirm`, {
    method: 'POST',
    body: JSON.stringify({ tx_hash: txHash }),
  });
}

export async function getContributions(roundId: string): Promise<RoundContribution[]> {
  return apiFetch<RoundContribution[]>(`/rounds/${roundId}/contributions`);
}
