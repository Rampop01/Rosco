import { NextRequest, NextResponse } from 'next/server';
import { getCircleById, deleteCircleById } from '../../../../lib/server-store';

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const circle = getCircleById(params.id);
  if (!circle) {
    return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
  }

  // Security Rule: Active or completed circles CANNOT be deleted to prevent exit scams / default
  if (circle.status !== 'FORMING') {
    return NextResponse.json(
      { error: 'Cannot delete an active or completed circle. Active circles have live financial obligations and cannot be deleted.' },
      { status: 400 }
    );
  }

  deleteCircleById(params.id);
  return NextResponse.json({ success: true, message: 'Circle cancelled successfully' });
}
