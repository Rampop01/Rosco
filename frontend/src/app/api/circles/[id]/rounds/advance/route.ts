import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, saveCircle } from '../../../../../../lib/server-store';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle || !circle.rounds || circle.rounds.length === 0) {
    return NextResponse.json({ error: 'Circle has no rounds' }, { status: 400 });
  }

  const openRound = circle.rounds.find((r: any) => r.status === 'open');
  if (openRound) {
    return NextResponse.json({ error: 'Current round is still in progress' }, { status: 400 });
  }

  // Find the next upcoming round
  const nextRound = circle.rounds.find((r: any) => r.status === 'upcoming');
  if (!nextRound) {
    return NextResponse.json({ error: 'No upcoming rounds available to advance' }, { status: 400 });
  }

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

  const now = Date.now();
  nextRound.status = 'open';
  nextRound.start_date = new Date(now).toISOString();
  nextRound.due_date = new Date(now + intervalMs).toISOString();

  saveCircle(circle);

  return NextResponse.json({
    success: true,
    message: `Advanced to Round ${nextRound.round_number}`,
    circle,
    current_round: nextRound,
  });
}
