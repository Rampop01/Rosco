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

  circle.status = 'ACTIVE';
  const approved = [...(circle.memberships?.filter((m: any) => m.status === 'APPROVED') || [])];

  // Fisher-Yates shuffle for fair, unmanipulatable payout order
  for (let i = approved.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [approved[i], approved[j]] = [approved[j], approved[i]];
  }

  circle.payout_order = approved.map((m: any) => m.user_id);

  // Generate a round for each member in randomized order
  circle.rounds = approved.map((recMember: any, idx: number) => {
    const recipient = recMember.user || {
      id: recMember.user_id,
      nimiq_address: recMember.user_id,
      display_name: `Member ${idx + 1}`,
    };
    return {
      id: `round_${Date.now()}_${idx + 1}`,
      round_number: idx + 1,
      recipient_id: recipient.id,
      due_date: new Date(Date.now() + (idx + 1) * 7 * 86400000).toISOString(),
      status: idx === 0 ? 'open' : 'upcoming',
      completed_at: null,
      recipient,
      contributions: approved.filter((m: any) => m.user_id !== recipient.id).map((m: any) => ({
        id: `c_${Date.now()}_${idx + 1}_${m.user_id}`,
        contributor_id: m.user_id,
        expected_amount: circle.contribution_amount,
        tx_hash: null,
        status: 'pending',
        confirmed_at: null,
        contributor: m.user,
      }))
    };
  });

  saveCircle(circle);
  return NextResponse.json(circle);
}
