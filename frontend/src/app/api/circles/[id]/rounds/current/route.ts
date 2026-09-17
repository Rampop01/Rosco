import { NextRequest, NextResponse } from 'next/server';
import { getCircleById } from '../../../../../../lib/server-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle || !circle.rounds || circle.rounds.length === 0) {
    return NextResponse.json({ current_round: null });
  }

  // Find the currently open round, or the first upcoming round, or the first round
  const openRound = circle.rounds.find((r: any) => r.status === 'open') || circle.rounds[0];
  return NextResponse.json({ current_round: openRound });
}
