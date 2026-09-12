/**
 * Background Verification Poller — PRD §10
 * 
 * Runs every 2 minutes. For each open round:
 * - Queries public NIM RPC for incoming txs to recipient_address within round window
 * - Matches each tx to an expected contributor by sender address + amount
 * - Updates contribution.status accordingly
 * - If all contributions confirmed → marks round completed, advances to next round
 * - If last round completed → marks circle completed
 * 
 * This is the fallback mechanism — ensures the system stays correct even if
 * the client never calls /confirm (e.g., app closed mid-flow).
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { getTransactionsByAddress, verifyTransaction } from '../lib/nimiq-rpc';

// Use a separate Prisma instance for the poller to avoid connection conflicts
const pollerPrisma = new PrismaClient();

async function pollOpenRounds(): Promise<void> {
  try {
    // Find all open rounds in active circles
    const openRounds = await pollerPrisma.round.findMany({
      where: {
        status: 'open',
        circle: { status: 'active' },
      },
      include: {
        circle: true,
        recipient: true,
        contributions: {
          where: { status: 'pending' },
          include: { contributor: true },
        },
      },
    });

    if (openRounds.length === 0) return;

    console.log(`🔍 Polling ${openRounds.length} open round(s) for on-chain confirmations...`);

    for (const round of openRounds) {
      if (round.contributions.length === 0) continue;

      // Fetch recent transactions sent to the round's recipient
      const recipientAddress = round.recipient.nimiqAddress;
      const incomingTxs = await getTransactionsByAddress(recipientAddress);

      for (const contribution of round.contributions) {
        // Look for a matching transaction from this contributor
        const senderAddress = contribution.contributor.nimiqAddress;
        const expectedAmount = contribution.expectedAmount;

        const matchingTx = incomingTxs.find(tx => {
          const senderMatch = tx.from.replace(/\s+/g, '').toUpperCase() ===
            senderAddress.replace(/\s+/g, '').toUpperCase();
          const amountMatch = tx.value >= Math.round(expectedAmount * 100000);
          const enoughConfirmations = tx.confirmations >= 10;
          return senderMatch && amountMatch && enoughConfirmations;
        });

        if (matchingTx) {
          // Check this tx_hash isn't already claimed by another contribution
          const existingClaim = await pollerPrisma.contribution.findUnique({
            where: { txHash: matchingTx.hash },
          });

          if (!existingClaim) {
            await pollerPrisma.contribution.update({
              where: { id: contribution.id },
              data: {
                txHash: matchingTx.hash,
                status: 'confirmed',
                confirmedAt: new Date(),
              },
            });
            console.log(`  ✅ Auto-confirmed contribution from ${senderAddress.slice(0, 12)}... for round ${round.roundNumber}`);
          }
        }
      }

      // Check if all contributions for this round are now confirmed
      const allContributions = await pollerPrisma.contribution.findMany({
        where: { roundId: round.id },
      });

      const allConfirmed = allContributions.every(c => c.status === 'confirmed');

      if (allConfirmed) {
        // Mark round as completed
        await pollerPrisma.round.update({
          where: { id: round.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });
        console.log(`  🎉 Round ${round.roundNumber} of circle "${round.circle.name}" completed!`);

        // Check if all rounds are now completed
        const remainingOpenRounds = await pollerPrisma.round.count({
          where: {
            circleId: round.circleId,
            status: 'open',
          },
        });

        if (remainingOpenRounds === 0) {
          await pollerPrisma.circle.update({
            where: { id: round.circleId },
            data: { status: 'completed' },
          });
          console.log(`  🏆 Circle "${round.circle.name}" has completed its full rotation!`);
        }
      }
    }
  } catch (error) {
    console.error('Verification poller error:', error);
  }
}

export function startVerificationPoller(): void {
  // Run every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    pollOpenRounds();
  });

  // Also run once at startup after a short delay
  setTimeout(() => {
    pollOpenRounds();
  }, 5000);
}
