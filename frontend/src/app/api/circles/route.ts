import { NextRequest, NextResponse } from 'next/server';
import { getAllCircles, saveCircle, ServerCircle } from '../../../lib/server-store';

export async function GET() {
  return NextResponse.json(getAllCircles());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const walletAddress = req.headers.get('x-wallet-address') || 'NQ750000000000000000000000000000';

    const circleId = body.id || `circle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const orgId = body.organizer_id || walletAddress;

    const circle: ServerCircle = {
      id: circleId,
      name: body.name,
      organizer_id: orgId,
      contribution_amount: body.contribution_amount,
      currency: body.currency || 'NIM',
      frequency: body.frequency || 'WEEKLY',
      min_members: body.min_members || 3,
      max_members: body.max_members || 5,
      status: body.status || 'FORMING',
      payout_order: body.payout_order || null,
      start_date: body.start_date || null,
      created_at: body.created_at || new Date().toISOString(),
      organizer: body.organizer || {
        id: orgId,
        nimiq_address: orgId,
        display_name: 'Organizer',
      },
      memberships: body.memberships || [
        {
          id: `m_${Date.now()}_1`,
          user_id: orgId,
          status: 'APPROVED',
          joined_order: 1,
          user: {
            id: orgId,
            nimiq_address: orgId,
            display_name: 'Organizer',
          }
        }
      ],
      rounds: body.rounds || []
    };

    saveCircle(circle);
    return NextResponse.json(circle, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create circle' }, { status: 400 });
  }
}
