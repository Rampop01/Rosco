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

  circle.memberships = (circle.memberships || []).filter((m: any) => m.id !== params.mid);
  saveCircle(circle);

  return NextResponse.json({ success: true, message: 'Request rejected' });
}
