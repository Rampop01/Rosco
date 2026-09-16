import { NextRequest, NextResponse } from 'next/server';
import { getAllCircles, saveCircle } from '../../../../../../lib/server-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roundId = params.id;
  const body = await req.json();
  const walletAddress = req.headers.get('x-wallet-address') || '';
  const circles = getAllCircles();

  for (const c of circles) {
    const r = c.rounds?.find((rnd: any) => rnd.id === roundId);
    if (r) {
      const contrib = r.contributions?.find((ct: any) => ct.contributor_id === walletAddress || ct.contributor?.nimiq_address === walletAddress);
      if (contrib) {
        contrib.status = 'CONFIRMED';
        contrib.tx_hash = body.tx_hash;
        contrib.confirmed_at = new Date().toISOString();
        saveCircle(c);
      }
      return NextResponse.json({ success: true, verified: true });
    }
  }

  return NextResponse.json({ success: true });
}
