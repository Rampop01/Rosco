import { NextRequest, NextResponse } from 'next/server';
import { getAllCircles, getCircleById, saveCircle, clearAllCircles, ServerCircle } from '../../../lib/server-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(getAllCircles(), {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}

export async function DELETE() {
  clearAllCircles();
  return NextResponse.json({ success: true, message: 'All circles cleared' });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const walletAddress = req.headers.get('x-wallet-address') || '';
    const orgId = body.organizer_id || walletAddress;
    const orgName = body.organizer_name || 'Organizer';

    if (!orgId) {
      return NextResponse.json({ error: 'Organizer wallet address is required to create a circle' }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Circle name is required' }, { status: 400 });
    }
    const amount = Number(body.contribution_amount);
    if (isNaN(amount) || amount < 1) {
      return NextResponse.json({ error: 'Minimum contribution amount is 1 NIM' }, { status: 400 });
    }
    const maxM = Number(body.max_members) || 5;
    if (maxM < 2 || maxM > 50) {
      return NextResponse.json({ error: 'Member capacity must be between 2 and 50' }, { status: 400 });
    }

    const circleId = body.id || `circle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existingCircle = getCircleById(circleId);

    const circle: ServerCircle = {
      id: circleId,
      name: body.name.trim(),
      organizer_id: orgId,
      contribution_amount: amount,
      currency: body.currency || 'NIM',
      frequency: (body.frequency || 'WEEKLY').toUpperCase(),
      min_members: body.min_members || 2,
      max_members: maxM,
      status: existingCircle?.status || body.status || 'FORMING',
      payout_order: existingCircle?.payout_order || body.payout_order || null,
      start_date: existingCircle?.start_date || body.start_date || null,
      created_at: existingCircle?.created_at || body.created_at || new Date().toISOString(),
      organizer: body.organizer || existingCircle?.organizer || {
        id: orgId,
        nimiq_address: orgId,
        display_name: orgName,
      },
      memberships: (existingCircle?.memberships && existingCircle.memberships.length > (body.memberships?.length || 0))
        ? existingCircle.memberships
        : (body.memberships || [
            {
              id: `m_${Date.now()}_1`,
              user_id: orgId,
              status: 'APPROVED',
              joined_order: 1,
              user: {
                id: orgId,
                nimiq_address: orgId,
                display_name: orgName,
              }
            }
          ]),
      rounds: (existingCircle?.rounds && existingCircle.rounds.length > 0)
        ? existingCircle.rounds
        : (body.rounds || [])
    };

    saveCircle(circle);
    return NextResponse.json(circle, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create circle' }, { status: 400 });
  }
}
