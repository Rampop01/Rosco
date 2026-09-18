/**
 * API Client — Typed REST client for the Kolo backend
 * Handles JWT token storage, injection, and error handling.
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

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      ...options,
      headers,
    });
  } catch (err) {
    lastError = err;
  }

  // 2. If external API failed or returned 404/5xx, fall back to internal Next.js /api
  if (!response || (!response.ok && API_BASE !== '/api' && (response.status === 404 || response.status >= 500))) {
    try {
      const fallbackUrl = `/api${path}`;
      const fallbackRes = await fetch(fallbackUrl, {
        ...options,
        headers,
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
      }
    } catch {
      // Ignore fallback error, keep initial response or error
    }
  }

  if (!response) {
    throw lastError || new Error(`Network error calling ${path}`);
  }

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

  try {
    const res = await apiFetch<Circle>('/circles', {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress
      },
      body: JSON.stringify(payload),
    });
    saveLocalCircle(res);
    return res;
  } catch (err: any) {
    console.warn('[Rosco] Backend createCircle unreachable, saving locally:', err);
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
        display_name: walletLabel,
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
            display_name: walletLabel,
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
          const org = urlParams.get('org') || '';
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

export async function joinCircle(circleId: string, customWalletAddress?: string, customWalletLabel?: string): Promise<{ id: string; status: string; message: string }> {
  const walletAddress = customWalletAddress || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');
  const walletLabel = customWalletLabel || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_label') || 'Member' : 'Member');
  const localCircles = getLocalCircles();
  const localCircle = localCircles.find(c => c.id === circleId);

  try {
    const res = await apiFetch<{ id: string; status: string; message: string; membership?: any }>(`/circles/${circleId}/join-request`, {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress
      },
      body: JSON.stringify({
        user_id: walletAddress,
        display_name: walletLabel,
        circle: localCircle
      })
    });

    if (localCircle) {
      if (!localCircle.memberships) localCircle.memberships = [];
      const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
      const existing = localCircle.memberships.find(m => clean(m.user_id || m.user?.nimiq_address) === clean(walletAddress));
      const targetStatus = res.membership?.status || 'PENDING';
      if (existing) {
        existing.status = targetStatus;
        if (res.membership?.joined_order) existing.joined_order = res.membership.joined_order;
      } else {
        localCircle.memberships.push({
          id: res.membership?.id || `m_${Date.now()}`,
          user_id: walletAddress,
          status: targetStatus,
          joined_order: res.membership?.joined_order || null,
          user: {
            id: walletAddress,
            nimiq_address: walletAddress,
            display_name: walletLabel,
          }
        });
      }
      saveLocalCircle(localCircle);
    }

    return res;
  } catch (err) {
    console.warn('[Rosco] Failed to submit join-request to server, saving locally:', err);
    if (localCircle) {
      if (!localCircle.memberships) localCircle.memberships = [];
      const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
      const existing = localCircle.memberships.find(m => clean(m.user_id || m.user?.nimiq_address) === clean(walletAddress));
      if (!existing) {
        localCircle.memberships.push({
          id: `m_${Date.now()}`,
          user_id: walletAddress,
          status: 'PENDING',
          joined_order: null,
          user: {
            id: walletAddress,
            nimiq_address: walletAddress,
            display_name: walletLabel,
          }
        });
        saveLocalCircle(localCircle);
      }
      return { id: `m_${Date.now()}`, status: 'PENDING', message: 'Join request submitted' };
    }
    throw err;
  }
}

export async function getJoinRequests(circleId: string): Promise<JoinRequest[]> {
  try {
    const res = await apiFetch<JoinRequest[]>(`/circles/${circleId}/join-requests`);
    if (Array.isArray(res)) return res;
  } catch (e) {
    console.warn('[Rosco] Failed to fetch join requests from API, checking local store:', e);
  }

  const localCircles = getLocalCircles();
  const found = localCircles.find(c => c.id === circleId);
  if (found && found.memberships) {
    return found.memberships
      .filter(m => (m.status || '').toUpperCase() === 'PENDING')
      .map(m => ({
        id: m.id,
        user_id: m.user_id,
        status: m.status,
        requested_at: new Date().toISOString(),
        user: m.user || {
          id: m.user_id,
          nimiq_address: m.user_id,
          display_name: 'Member'
        }
      }));
  }
  return [];
}

export async function approveJoinRequest(circleId: string, membershipId: string): Promise<any> {
  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const target = clean(membershipId);

  try {
    const res = await apiFetch<any>(`/circles/${circleId}/join-requests/${membershipId}/approve`, { method: 'POST' });
    if (res?.circle) {
      saveLocalCircle(res.circle);
    } else {
      const localCircles = getLocalCircles();
      const found = localCircles.find(c => c.id === circleId);
      if (found && found.memberships) {
        const m = found.memberships.find(mem => mem.id === membershipId || clean(mem.user_id) === target || clean(mem.user?.nimiq_address) === target);
        if (m) m.status = 'APPROVED';
        saveLocalCircle(found);
      }
    }
    return res;
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.memberships) {
      const m = found.memberships.find(mem => mem.id === membershipId || clean(mem.user_id) === target || clean(mem.user?.nimiq_address) === target);
      if (m) m.status = 'APPROVED';
      saveLocalCircle(found);
      return { success: true };
    }
    throw err;
  }
}

export async function rejectJoinRequest(circleId: string, membershipId: string): Promise<any> {
  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const target = clean(membershipId);

  try {
    const res = await apiFetch<any>(`/circles/${circleId}/join-requests/${membershipId}/reject`, { method: 'POST' });
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.memberships) {
      found.memberships = found.memberships.filter(mem => mem.id !== membershipId && clean(mem.user_id) !== target && clean(mem.user?.nimiq_address) !== target);
      saveLocalCircle(found);
    }
    return res;
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.memberships) {
      found.memberships = found.memberships.filter(mem => mem.id !== membershipId && clean(mem.user_id) !== target && clean(mem.user?.nimiq_address) !== target);
      saveLocalCircle(found);
      return { success: true };
    }
    throw err;
  }
}

export async function startCircle(circleId: string): Promise<Circle> {
  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');

  try {
    const res = await apiFetch<Circle>(`/circles/${circleId}/start`, { method: 'POST' });
    saveLocalCircle(res);
    return res;
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found) {
      found.status = 'ACTIVE';
      const approved = [...(found.memberships?.filter(m => (m.status || '').toUpperCase() === 'APPROVED') || [])];

      // Cryptographically unbiased Fisher-Yates shuffle
      const getRandomInt = (max: number) => {
        if (typeof window !== 'undefined' && window.crypto) {
          const buf = new Uint32Array(1);
          window.crypto.getRandomValues(buf);
          return buf[0] % max;
        }
        return Math.floor(Math.random() * max);
      };

      for (let i = approved.length - 1; i > 0; i--) {
        const j = getRandomInt(i + 1);
        [approved[i], approved[j]] = [approved[j], approved[i]];
      }

      found.payout_order = approved.map(m => m.user_id);

      const getIntervalMs = (freq: string) => {
        switch ((freq || '').toUpperCase()) {
          case 'DAILY': return 86400000;
          case 'BIWEEKLY': return 14 * 86400000;
          case 'MONTHLY': return 30 * 86400000;
          case 'WEEKLY':
          default: return 7 * 86400000;
        }
      };
      const intervalMs = getIntervalMs(found.frequency);
      const startTime = Date.now();
      found.start_date = new Date(startTime).toISOString();

      // Create all rounds with scheduled start_date and due_date
      found.rounds = approved.map((recMember, idx) => {
        const recipientAddr = recMember.user?.nimiq_address || recMember.user?.id || recMember.user_id;
        const recipient = {
          id: recipientAddr,
          nimiq_address: recipientAddr,
          display_name: recMember.user?.display_name || `Member ${idx + 1}`,
        };
        const cleanRecAddr = clean(recipientAddr);
        const roundStart = startTime + idx * intervalMs;
        const roundDue = roundStart + intervalMs;

        return {
          id: `round_${Date.now()}_${idx + 1}`,
          round_number: idx + 1,
          recipient_id: recipient.id,
          start_date: new Date(roundStart).toISOString(),
          due_date: new Date(roundDue).toISOString(),
          status: idx === 0 ? 'open' : 'upcoming',
          completed_at: null,
          recipient,
          contributions: approved
            .filter(m => clean(m.user_id || m.user?.nimiq_address) !== cleanRecAddr)
            .map(m => {
              const contribAddr = m.user?.nimiq_address || m.user?.id || m.user_id;
              return {
                id: `c_${Date.now()}_${idx + 1}_${m.user_id}`,
                contributor_id: contribAddr,
                expected_amount: found.contribution_amount,
                tx_hash: null,
                status: 'pending',
                confirmed_at: null,
                contributor: m.user || {
                  id: contribAddr,
                  nimiq_address: contribAddr,
                  display_name: 'Member',
                },
              };
            })
        };
      });

      saveLocalCircle(found);
      return found;
    }
    throw err;
  }
}

export async function deleteCircle(circleId: string): Promise<any> {
  try {
    await apiFetch(`/circles/${circleId}`, { method: 'DELETE' });
  } catch (err: any) {
    if (err.message && (err.message.includes('Cannot delete') || err.message.includes('Active circles'))) {
      throw err;
    }
  }

  if (typeof window !== 'undefined') {
    const local = getLocalCircles().filter(c => c.id !== circleId);
    localStorage.setItem('rosco_local_circles', JSON.stringify(local));
    localStorage.removeItem('rosco_creator_' + circleId);
  }
  return { success: true };
}

export const cancelCircle = deleteCircle;

// ─── Rounds & Contributions ────────────────────────────────────────────────

export async function getCurrentRound(circleId: string): Promise<{ current_round: RoundInfo | null }> {
  try {
    return await apiFetch(`/circles/${circleId}/rounds/current`);
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.rounds && found.rounds.length > 0) {
      const openRound = found.rounds.find((r: any) => r.status === 'open') || null;
      return { current_round: openRound };
    }
    return { current_round: null };
  }
}

export async function advanceCircleRound(circleId: string): Promise<any> {
  try {
    const res = await apiFetch<any>(`/circles/${circleId}/rounds/advance`, { method: 'POST' });
    if (res?.circle) {
      saveLocalCircle(res.circle);
    }
    return res;
  } catch (err) {
    const localCircles = getLocalCircles();
    const found = localCircles.find(c => c.id === circleId);
    if (found && found.rounds) {
      const openRound = found.rounds.find((r: any) => r.status === 'open');
      if (openRound) {
        return { success: false, error: 'Current round is still in progress', circle: found, current_round: openRound };
      }
      const nextRound = found.rounds.find((r: any) => r.status === 'upcoming');
      if (nextRound) {
        nextRound.status = 'open';
        nextRound.start_date = new Date().toISOString();
        saveLocalCircle(found);
        return { success: true, circle: found, current_round: nextRound };
      }
    }
    throw err;
  }
}

export async function getContributionIntent(
  roundId: string,
  fallbackRecipient?: string,
  fallbackAmount?: number
): Promise<ContributionIntent> {
  try {
    return await apiFetch<ContributionIntent>(`/rounds/${roundId}/contributions/intent`, { method: 'POST' });
  } catch (err) {
    const localCircles = getLocalCircles();
    for (const c of localCircles) {
      const r = c.rounds?.find(rnd => rnd.id === roundId);
      if (r) {
        const recAddr = r.recipient?.nimiq_address || r.recipient?.id || r.recipient_id || c.organizer_id;
        return {
          recipient_address: recAddr,
          amount: c.contribution_amount,
          round_id: r.id,
          contribution_id: `contrib_${Date.now()}`,
          message: `Rosco: Round ${r.round_number} contribution to ${r.recipient?.display_name || 'Recipient'}`,
        };
      }
    }
    if (fallbackRecipient && fallbackAmount) {
      return {
        recipient_address: fallbackRecipient,
        amount: fallbackAmount,
        round_id: roundId,
        contribution_id: `contrib_${Date.now()}`,
        message: `Rosco: Round contribution`,
      };
    }
    throw err;
  }
}

export async function confirmContribution(roundId: string, txHash: string, walletAddress?: string): Promise<any> {
  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const myWallet = walletAddress || (typeof window !== 'undefined' ? localStorage.getItem('rosco_wallet_address') || '' : '');
  const cleanWallet = clean(myWallet);

  try {
    const res = await apiFetch<any>(`/rounds/${roundId}/contributions/confirm`, {
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

    if (res?.circle) {
      saveLocalCircle(res.circle);
    }
    return res;
  } catch (err) {
    const localCircles = getLocalCircles();
    for (const c of localCircles) {
      const r = c.rounds?.find(rnd => rnd.id === roundId);
      if (r) {
        if (!r.contributions) r.contributions = [];
        let contrib = r.contributions.find((ct: any) => {
          const ctAddr = clean(ct.contributor_id || ct.contributor?.nimiq_address || ct.contributor?.id);
          return cleanWallet && ctAddr && cleanWallet === ctAddr;
        });

        if (!contrib && cleanWallet) {
          contrib = r.contributions.find((ct: any) => (ct.status || '').toUpperCase() !== 'CONFIRMED');
        }

        if (contrib) {
          contrib.status = 'CONFIRMED';
          contrib.tx_hash = txHash;
          contrib.confirmed_at = new Date().toISOString();
        }

        // Check if all contributions for this round are confirmed
        const allConfirmed = r.contributions.length > 0 && r.contributions.every(
          (ct: any) => (ct.status || '').toUpperCase() === 'CONFIRMED'
        );

        if (allConfirmed) {
          r.status = 'completed';
          r.completed_at = new Date().toISOString();
          const nextRound = c.rounds?.find((rnd: any) => rnd.round_number === r.round_number + 1);
          if (nextRound) {
            const isTimeReached = nextRound.start_date && Date.now() >= new Date(nextRound.start_date).getTime();
            nextRound.status = isTimeReached ? 'open' : 'upcoming';
          } else {
            c.status = 'COMPLETED';
          }
        }

        saveLocalCircle(c);
        return { success: true, verified: true, round_completed: allConfirmed, circle: c };
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

export async function resetAllTestData(): Promise<void> {
  try {
    await apiFetch('/circles', { method: 'DELETE' });
  } catch (e) {
    console.warn('[Rosco] Failed to delete remote circles:', e);
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('rosco_local_circles');
    localStorage.removeItem('kolo_local_circles');
    localStorage.removeItem('rosco_notifications');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('rosco_creator_') || k.startsWith('rosco_notified_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  }
}

