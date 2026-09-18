import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, saveCircle } from '../../../../../lib/server-store';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');

  circle.status = 'ACTIVE';
  const approved = [...(circle.memberships?.filter((m: any) => (m.status || '').toUpperCase() === 'APPROVED') || [])];

  if (approved.length < 2) {
    return NextResponse.json({ error: `At least 2 approved members required to start. Currently have ${approved.length}.` }, { status: 400 });
  }

  // Cryptographically unbiased Fisher-Yates shuffle
  const getRandomInt = (max: number) => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  };

  for (let i = approved.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [approved[i], approved[j]] = [approved[j], approved[i]];
  }

  circle.payout_order = approved.map((m: any) => m.user_id);

  // Generate frequency interval in ms
  const getIntervalMs = (freq: string) => {
    switch ((freq || '').toUpperCase()) {
      case 'DAILY': return 86400000;
      case 'BIWEEKLY': return 14 * 86400000;
      case 'MONTHLY': return 30 * 86400000;
      case 'WEEKLY':
      default: return 7 * 86400000;
    }
  };
  const intervalMs = getIntervalMs(circle.frequency);
  const startTime = Date.now();
  circle.start_date = new Date(startTime).toISOString();

  // Generate a round for each member in randomized order (excluding previous recipients)
  circle.rounds = approved.map((recMember: any, idx: number) => {
    const recipientAddr = recMember.user?.nimiq_address || recMember.user?.id || recMember.user_id;
    const recipient = {
      id: recipientAddr,
      nimiq_address: recipientAddr,
      display_name: recMember.user?.display_name || `Member ${idx + 1}`,
    };

    const cleanRecipientAddr = clean(recipientAddr);
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
        .filter((m: any) => clean(m.user_id || m.user?.nimiq_address) !== cleanRecipientAddr)
        .map((m: any) => {
          const contribAddr = m.user?.nimiq_address || m.user?.id || m.user_id;
          return {
            id: `c_${Date.now()}_${idx + 1}_${m.user_id}`,
            contributor_id: contribAddr,
            expected_amount: circle.contribution_amount,
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

  saveCircle(circle);
  return NextResponse.json(circle);
}
