import { NextRequest, NextResponse } from 'next/server';
import { getCircleById } from '../../../../../lib/server-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json([]);
  }
  const pending = (circle.memberships || [])
    .filter((m: any) => m.status === 'PENDING')
    .map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      status: m.status,
      requested_at: m.created_at || new Date().toISOString(),
      user: m.user || {
        id: m.user_id,
        nimiq_address: m.user_id,
        display_name: 'Member'
      }
    }));
  return NextResponse.json(pending);
}
