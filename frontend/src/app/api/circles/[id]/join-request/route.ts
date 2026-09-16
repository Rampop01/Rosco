import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, saveCircle } from '../../../../../lib/server-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  const walletAddress = req.headers.get('x-wallet-address') || '';
  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address required to join circle' }, { status: 400 });
  }
  if (!circle.memberships) circle.memberships = [];

  const existing = circle.memberships.find(m => m.user_id === walletAddress);
  if (!existing) {
    circle.memberships.push({
      id: `m_${Date.now()}`,
      user_id: walletAddress,
      status: 'APPROVED',
      joined_order: circle.memberships.length + 1,
      user: {
        id: walletAddress,
        nimiq_address: walletAddress,
        display_name: 'Member',
      }
    });
    saveCircle(circle);
  }

  return NextResponse.json({ success: true, message: 'Joined circle' });
}
