import { NextRequest, NextResponse } from 'next/server';
import { getCircleById } from '../../../../lib/server-store';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }
  return NextResponse.json(circle);
}
