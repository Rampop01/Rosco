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
  const approved = circle.memberships?.filter(m => m.status === 'APPROVED') || [];
  const recipient = approved[0]?.user || { id: circle.organizer_id, nimiq_address: circle.organizer_id, display_name: 'Member 1' };

  circle.rounds = [
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
        expected_amount: circle.contribution_amount,
        tx_hash: null,
        status: 'pending',
        confirmed_at: null,
        contributor: m.user,
      }))
    }
  ];

  saveCircle(circle);
  return NextResponse.json(circle);
}
