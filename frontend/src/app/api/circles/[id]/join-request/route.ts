import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, saveCircle } from '../../../../../lib/server-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  let circle = getCircleById(params.id);

  // Auto-rehydrate circle if passed in body (e.g. from invite link recipient)
  if (!circle && body.circle) {
    circle = saveCircle(body.circle);
  }

  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  const rawWallet = req.headers.get('x-wallet-address') || body.user_id || body.walletAddress || '';
  if (!rawWallet) {
    return NextResponse.json({ error: 'Wallet address required to join circle' }, { status: 400 });
  }

  const clean = (a: string) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const walletAddress = rawWallet.trim();

  if (!circle.memberships) circle.memberships = [];

  const existing = circle.memberships.find(m => clean(m.user_id || m.user?.nimiq_address) === clean(walletAddress));

  if (existing) {
    if (!existing.user) {
      existing.user = {
        id: walletAddress,
        nimiq_address: walletAddress,
        display_name: body.display_name || 'Member',
      };
    }
    saveCircle(circle);
    return NextResponse.json({ 
      success: true, 
      membership: existing, 
      message: 'Join request already submitted' 
    });
  }

  const newMembership = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: walletAddress,
    status: 'PENDING',
    joined_order: null,
    created_at: new Date().toISOString(),
    user: {
      id: walletAddress,
      nimiq_address: walletAddress,
      display_name: body.display_name || 'Member',
    }
  };

  circle.memberships.push(newMembership);
  saveCircle(circle);

  return NextResponse.json({ 
    success: true, 
    membership: newMembership, 
    message: 'Join request submitted for organizer review' 
  });
}
