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

  const userAddr = clean(membership.user_id || membership.user?.nimiq_address || membership.user?.id);
  const approvedCount = (circle.memberships || []).filter((m: any) => (m.status || '').toUpperCase() === 'APPROVED').length;
  
  membership.status = 'APPROVED';
  membership.joined_order = membership.joined_order || (approvedCount + 1);

  // Consolidate duplicate entries: Remove any redundant pending entries for the same user address
  if (userAddr && circle.memberships) {
    circle.memberships = circle.memberships.filter((m: any) => {
      if (m.id === membership.id) return true;
      const mAddr = clean(m.user_id || m.user?.nimiq_address || m.user?.id);
      if (mAddr && mAddr === userAddr) {
        // Redundant duplicate entry for this user
        return false;
      }
      return true;
    });
  }

  saveCircle(circle);

  return NextResponse.json({ success: true, membership, circle });
}
