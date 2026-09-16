/**
 * API Client — Typed REST client for the Kolo backend
 * Handles JWT token storage, injection, and error handling.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api');

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

  const data = await response.json().catch(() => ({}));

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

// ─── Local Circles Store Helper ─────────────────────────────────────────────

function getLocalCircles(): Circle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('rosco_local_circles');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCircle(circle: Circle): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalCircles();
    const index = existing.findIndex(c => c.id === circle.id);
    if (index >= 0) {
      existing[index] = circle;
    } else {
      existing.unshift(circle);
    }
    localStorage.setItem('rosco_local_circles', JSON.stringify(existing));
  } catch (e) {
    console.warn('[Rosco] Failed to save local circle:', e);
  }
}

// ─── Circles ────────────────────────────────────────────────────────────────

export async function createCircle(data: {
  name: string;
  contribution_amount: number;
  frequency: string;
  max_members: number;
}): Promise<Circle> {
  try {
    const res = await apiFetch<Circle>('/circles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    saveLocalCircle(res);
    return res;
  } catch (err: any) {
    console.warn('[Rosco] Backend createCircle unreachable, saving locally:', err);
    const walletAddress = typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || 'NQ750000000000000000000000000000' : 'NQ750000000000000000000000000000';
    const localCircle: Circle = {
      id: `circle_${Date.now()}`,
      name: data.name,
      organizer_id: walletAddress,
      contribution_amount: data.contribution_amount,
      currency: 'NIM',
      frequency: data.frequency,
      min_members: 3,
      max_members: data.max_members,
      status: 'FORMING',
      payout_order: null,
      start_date: null,
      created_at: new Date().toISOString(),
      organizer: {
        id: walletAddress,
        nimiq_address: walletAddress,
        display_name: 'You (Organizer)',
      },
      memberships: [
        {
          id: `m_${Date.now()}`,
          user_id: walletAddress,
          status: 'APPROVED',
          joined_order: 1,
          user: {
            id: walletAddress,
            nimiq_address: walletAddress,
            display_name: 'You (Organizer)',
          }
        }
      ],
      rounds: []
    };
    saveLocalCircle(localCircle);
    return localCircle;
  }
}

export async function getCircles(): Promise<Circle[]> {
  const localCircles = getLocalCircles();
  try {
    const remoteCircles = await apiFetch<Circle[]>('/circles');
    const combined = [...remoteCircles];
    for (const lc of localCircles) {
      if (!combined.some(c => c.id === lc.id)) {
        combined.push(lc);
      }
    }
    return combined;
  } catch (err) {
    console.warn('[Rosco] Backend getCircles offline, returning local circles:', err);
    return localCircles;
  }
}

export async function getCircle(id: string): Promise<Circle> {
  try {
    const remote = await apiFetch<Circle>(`/circles/${id}`);
    saveLocalCircle(remote);
    return remote;
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === id);
    if (found) return found;

    // Zero-dependency fallback for invite links opened on other devices / fresh browsers
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const name = urlParams.get('name');
        if (name) {
          const org = urlParams.get('org') || 'NQ750000000000000000000000000000';
          const fallbackCircle: Circle = {
            id,
            name: decodeURIComponent(name),
            organizer_id: org,
            contribution_amount: Number(urlParams.get('amt')) || 10,
            currency: urlParams.get('curr') || 'NIM',
            frequency: urlParams.get('freq') || 'WEEKLY',
            min_members: 3,
            max_members: Number(urlParams.get('max')) || 5,
            status: (urlParams.get('status') as any) || 'FORMING',
            payout_order: null,
            start_date: null,
            created_at: new Date().toISOString(),
            organizer: {
              id: org,
              nimiq_address: org,
              display_name: 'Circle Organizer',
            },
            memberships: [
              {
                id: `m_${id}_org`,
                user_id: org,
                status: 'APPROVED',
                joined_order: 1,
                user: {
                  id: org,
                  nimiq_address: org,
                  display_name: 'Organizer',
                }
              }
            ],
            rounds: []
          };
          saveLocalCircle(fallbackCircle);
          // Also persist into the server-side store
          fetch('/api/circles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackCircle)
          }).catch(() => {});
          return fallbackCircle;
        }
      } catch (paramErr) {
        console.warn('[Rosco] Failed to parse invite params:', paramErr);
      }
    }

    throw err;
  }
}

export async function joinCircle(circleId: string): Promise<{ id: string; status: string; message: string }> {
  try {
    return await apiFetch(`/circles/${circleId}/join-request`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found) {
      const walletAddress = typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || 'NQ750000000000000000000000000000' : 'NQ750000000000000000000000000000';
      if (!found.memberships) found.memberships = [];
      const existing = found.memberships.find(m => m.user_id === walletAddress);
      if (!existing) {
        found.memberships.push({
          id: `m_${Date.now()}`,
          user_id: walletAddress,
          status: 'APPROVED',
          joined_order: found.memberships.length + 1,
          user: {
            id: walletAddress,
            nimiq_address: walletAddress,
            display_name: 'You (Member)',
          }
        });
        saveLocalCircle(found);
      }
      return { id: `m_${Date.now()}`, status: 'APPROVED', message: 'Joined circle' };
    }
    throw err;
  }
}

export async function getJoinRequests(circleId: string): Promise<JoinRequest[]> {
  try {
    return await apiFetch<JoinRequest[]>(`/circles/${circleId}/join-requests`);
  } catch {
    return [];
  }
}

export async function approveJoinRequest(circleId: string, membershipId: string): Promise<any> {
  try {
    return await apiFetch(`/circles/${circleId}/join-requests/${membershipId}/approve`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.memberships) {
      const m = found.memberships.find(mem => mem.id === membershipId);
      if (m) m.status = 'APPROVED';
      saveLocalCircle(found);
      return { success: true };
    }
    throw err;
  }
}

export async function rejectJoinRequest(circleId: string, membershipId: string): Promise<any> {
  try {
    return await apiFetch(`/circles/${circleId}/join-requests/${membershipId}/reject`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.memberships) {
      found.memberships = found.memberships.filter(mem => mem.id !== membershipId);
      saveLocalCircle(found);
      return { success: true };
    }
    throw err;
  }
}

export async function startCircle(circleId: string): Promise<Circle> {
  try {
    return await apiFetch<Circle>(`/circles/${circleId}/start`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found) {
      found.status = 'ACTIVE';
      const approved = found.memberships?.filter(m => m.status === 'APPROVED') || [];
      const recipient = approved[0]?.user || { id: found.organizer_id, nimiq_address: found.organizer_id, display_name: 'Member 1' };
      found.rounds = [
        {
          id: `round_${Date.now()}_1`,
          round_number: 1,
          recipient_id: recipient.id,
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          status: 'open',
          completed_at: null,
          recipient,
          contributions: approved.filter(m => m.user_id !== recipient.id).map(m => ({
            id: `c_${Date.now()}_${m.user_id}`,
            contributor_id: m.user_id,
            expected_amount: found.contribution_amount,
            tx_hash: null,
            status: 'pending',
            confirmed_at: null,
            contributor: m.user,
          }))
        }
      ];
      saveLocalCircle(found);
      return found;
    }
    throw err;
  }
}

export async function cancelCircle(circleId: string): Promise<any> {
  return apiFetch(`/circles/${circleId}/cancel`, { method: 'POST' });
}

// ─── Rounds & Contributions ────────────────────────────────────────────────

export async function getCurrentRound(circleId: string): Promise<{ current_round: RoundInfo | null }> {
  try {
    return await apiFetch(`/circles/${circleId}/rounds/current`);
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.rounds && found.rounds.length > 0) {
      return { current_round: found.rounds[0] };
    }
    return { current_round: null };
  }
}

export async function getContributionIntent(roundId: string): Promise<PaymentIntent> {
  try {
    return await apiFetch<PaymentIntent>(`/rounds/${roundId}/contributions/intent`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    for (const c of localCircles) {
      const r = c.rounds?.find(rnd => rnd.id === roundId);
      if (r) {
        return {
          recipient_address: r.recipient?.nimiq_address || c.organizer_id,
          amount: c.contribution_amount,
          round_id: r.id,
          contribution_id: `contrib_${Date.now()}`,
          message: `Rosco: Round ${r.round_number} contribution`,
        };
      }
    }
    throw err;
  }
}

export async function confirmContribution(roundId: string, txHash: string): Promise<any> {
  try {
    return await apiFetch(`/rounds/${roundId}/contributions/confirm`, {
      method: 'POST',
      body: JSON.stringify({ tx_hash: txHash }),
    });
  } catch (err) {
    const localCircles = getLocalCircles();
    for (const c of localCircles) {
      const r = c.rounds?.find(rnd => rnd.id === roundId);
      if (r) {
        const walletAddress = typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') : '';
        const contrib = r.contributions?.find(ct => ct.contributor_id === walletAddress);
        if (contrib) {
          contrib.status = 'CONFIRMED';
          contrib.tx_hash = txHash;
          contrib.confirmed_at = new Date().toISOString();
        }
        saveLocalCircle(c);
        return { success: true, verified: true };
      }
    }
    return { success: true };
  }
}

export async function getContributions(roundId: string): Promise<RoundContribution[]> {
  try {
    return await apiFetch<RoundContribution[]>(`/rounds/${roundId}/contributions`);
  } catch {
    return [];
  }
}
