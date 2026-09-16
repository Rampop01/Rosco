import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = body.nimiq_address || 'NQ750000000000000000000000000000';
    const user = {
      id: address,
      nimiq_address: address,
      display_name: body.display_name || 'Nimiq Member',
      language: 'en',
      created_at: new Date().toISOString()
    };
    return NextResponse.json({
      token: `jwt_${address.replace(/\s+/g, '')}_${Date.now()}`,
      user
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid session request' }, { status: 400 });
  }
}
