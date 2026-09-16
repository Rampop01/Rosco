import { NextRequest, NextResponse } from 'next/server';
import { getAllCircles } from '../../../../../../lib/server-store';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roundId = params.id;
  const circles = getAllCircles();

  for (const c of circles) {
    const r = c.rounds?.find((rnd: any) => rnd.id === roundId);
    if (r) {
      return NextResponse.json({
        recipient_address: r.recipient?.nimiq_address || c.organizer_id,
        amount: c.contribution_amount,
        round_id: r.id,
        contribution_id: `contrib_${Date.now()}`,
        message: `Rosco: Round ${r.round_number} contribution to ${r.recipient?.display_name || 'Recipient'}`,
      });
    }
  }

  return NextResponse.json({ error: 'Round not found' }, { status: 404 });
}
