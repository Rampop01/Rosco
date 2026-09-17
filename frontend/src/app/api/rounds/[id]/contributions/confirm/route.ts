import { NextRequest, NextResponse } from 'next/server';
import { getAllCircles, saveCircle } from '../../../../../../lib/server-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const roundId = params.id;
  const body = await req.json().catch(() => ({}));
  const headerWallet = req.headers.get('x-wallet-address') || '';
  const rawWallet = body.wallet_address || body.contributor_id || headerWallet;

  const clean = (a?: string | null) => (a ? a.replace(/\s+/g, '').toUpperCase() : '');
  const cleanWallet = clean(rawWallet);

  const circles = getAllCircles();

  for (const c of circles) {
    const r = c.rounds?.find((rnd: any) => rnd.id === roundId);
    if (r) {
      if (!r.contributions) r.contributions = [];

      // Find contribution row by contributor address
      let contrib = r.contributions.find((ct: any) => {
        const ctAddr = clean(ct.contributor_id || ct.contributor?.nimiq_address || ct.contributor?.id);
        return cleanWallet && ctAddr && cleanWallet === ctAddr;
      });

      // Fallback: if single pending contribution and no address matched, or first pending
      if (!contrib && cleanWallet) {
        contrib = r.contributions.find((ct: any) => ct.status?.toUpperCase() !== 'CONFIRMED');
      }

      if (contrib) {
        contrib.status = 'CONFIRMED';
        contrib.tx_hash = body.tx_hash || contrib.tx_hash;
        contrib.confirmed_at = new Date().toISOString();
      }

      // Check if all contributions for this round are now confirmed
      const allConfirmed = r.contributions.length > 0 && r.contributions.every(
        (ct: any) => ct.status?.toUpperCase() === 'CONFIRMED'
      );

      if (allConfirmed) {
        r.status = 'completed';
        r.completed_at = new Date().toISOString();

        // Advance to the next round if available
        const nextRound = c.rounds?.find((rnd: any) => rnd.round_number === r.round_number + 1);
        if (nextRound) {
          nextRound.status = 'open';
        } else {
          // All rounds finished — circle is complete
          c.status = 'COMPLETED';
        }
      }

      saveCircle(c);

      return NextResponse.json({
        success: true,
        verified: true,
        round_completed: allConfirmed,
        circle_completed: c.status === 'COMPLETED',
        circle: c,
      });
    }
  }

  return NextResponse.json({ error: 'Round not found' }, { status: 404 });
}
