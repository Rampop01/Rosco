import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, saveCircle } from '../../../../../../../lib/server-store';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; mid: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const target = clean(params.mid);
  const membership = (circle.memberships || []).find(
    (m: any) => m.id === params.mid || clean(m.user_id) === target || clean(m.user?.nimiq_address) === target || clean(m.user?.id) === target
  );

  if (!membership) {
    return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
  }

  const approvedCount = (circle.memberships || []).filter((m: any) => (m.status || '').toUpperCase() === 'APPROVED').length;
  membership.status = 'APPROVED';
  membership.joined_order = approvedCount + 1;
  saveCircle(circle);

  return NextResponse.json({ success: true, membership, circle });
}
