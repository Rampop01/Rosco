import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { verifyTransaction } from '../lib/nimiq-rpc';
import { sendNotificationToUser } from '../lib/webpush';
import { z } from 'zod';

export const roundsRouter: Router = Router();

const confirmSchema = z.object({
  tx_hash: z.string().min(1, 'Transaction hash is required'),
});

// ─── GET /circles/:circleId/rounds/current — Current active round ───────────

roundsRouter.get('/circles/:circleId/rounds/current', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { circleId } = req.params;

    const circle = await prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    // Find the first open round
    const currentRound = await prisma.round.findFirst({
      where: {
        circleId,
        status: 'open',
      },
      orderBy: { roundNumber: 'asc' },
      include: {
        recipient: true,
        contributions: {
          include: { contributor: true },
        },
      },
    });

    if (!currentRound) {
      res.json({ current_round: null, message: 'No active round' });
      return;
    }

    res.json({
      current_round: {
        id: currentRound.id,
        round_number: currentRound.roundNumber,
        recipient_id: currentRound.recipientId,
        due_date: currentRound.dueDate,
        status: currentRound.status,
        recipient: {
          id: currentRound.recipient.id,
          nimiq_address: currentRound.recipient.nimiqAddress,
          display_name: currentRound.recipient.displayName,
        },
        contributions: currentRound.contributions.map(c => ({
          id: c.id,
          contributor_id: c.contributorId,
          expected_amount: c.expectedAmount,
          tx_hash: c.txHash,
          status: c.status,
          confirmed_at: c.confirmedAt,
          contributor: {
            id: c.contributor.id,
            nimiq_address: c.contributor.nimiqAddress,
            display_name: c.contributor.displayName,
          },
        })),
      },
    });
  } catch (error) {
    console.error('Get current round error:', error);
    res.status(500).json({ error: 'Failed to get current round' });
  }
});

// ─── POST /circles/:circleId/rounds/advance — Advance to next round ─────────

roundsRouter.post('/circles/:circleId/rounds/advance', authenticate, async (req: Request, res: Response) => {
  try {
    const { circleId } = req.params;

    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            contributions: true,
          },
        },
      },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const currentRound = circle.rounds.find(r => r.status === 'open');
    if (currentRound) {
      // Check if time expired
      if (new Date() < currentRound.dueDate) {
        res.status(400).json({ error: 'Round deadline has not elapsed yet.' });
        return;
      }

      const allPaid = currentRound.contributions.length > 0 && currentRound.contributions.every(c => c.status === 'confirmed');
      await prisma.round.update({
        where: { id: currentRound.id },
        data: {
          status: allPaid ? 'completed' : 'missed_partial',
          completedAt: new Date(),
        },
      });
    }

    // Find the next upcoming round
    const nextRound = circle.rounds.find(r => r.status === 'upcoming');
    if (nextRound) {
      // Find the previous round to check if its dueDate has passed
      const prevRound = circle.rounds.find(r => r.roundNumber === nextRound.roundNumber - 1);
      if (prevRound && new Date() < prevRound.dueDate) {
        res.status(400).json({ error: 'Cannot open next round before the current interval elapses.' });
        return;
      }

      await prisma.round.update({
        where: { id: nextRound.id },
        data: {
          status: 'open',
        },
      });
      
      const updatedCircle = await prisma.circle.findUnique({
        where: { id: circleId },
        include: {
          organizer: true,
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              recipient: true,
              contributions: { include: { contributor: true } },
            },
          },
        },
      });

      // Send push notifications to all members that the round has started
      const contributors = nextRound.contributions || [];
      for (const contrib of contributors) {
        if (contrib.contributorId !== nextRound.recipientId) {
          await sendNotificationToUser(contrib.contributorId, {
            title: `Round ${nextRound.roundNumber} is Open!`,
            body: `It's time to make your contribution to ${updatedCircle?.rounds.find(r => r.id === nextRound.id)?.recipient.displayName || 'the recipient'}.`,
            url: `/circle/${circleId}`
          }).catch(console.error);
        }
      }
      
      // Notify the recipient
      await sendNotificationToUser(nextRound.recipientId, {
        title: `Your Payout Round has started!`,
        body: `Round ${nextRound.roundNumber} is active. Members will now start sending their contributions to you.`,
        url: `/circle/${circleId}`
      }).catch(console.error);

      res.json({ success: true, current_round: nextRound, circle: updatedCircle });
    } else {
      // No more rounds, complete circle
      await prisma.circle.update({
        where: { id: circleId },
        data: { status: 'completed' },
      });
      res.json({ success: true, message: 'Circle completed' });
    }
  } catch (error) {
    console.error('Advance round error:', error);
    res.status(500).json({ error: 'Failed to advance round' });
  }
});

roundsRouter.post('/rounds/:id/contributions/intent', authenticate, async (req: Request, res: Response) => {
  try {
    const roundId = req.params.id;
    const userId = req.user!.userId;

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        circle: true,
        recipient: true,
        contributions: true,
      },
    });

    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }
    if (round.status !== 'open') {
      res.status(400).json({ error: 'Round is not open for contributions' });
      return;
    }

    // Check user is a member with a contribution row
    const contribution = round.contributions.find(c => c.contributorId === userId);
    if (!contribution) {
      res.status(403).json({ error: 'You are not a contributor in this round' });
      return;
    }
    if (contribution.status === 'confirmed') {
      res.status(400).json({ error: 'You have already contributed to this round' });
      return;
    }

    // Check if current recipient owes past debts
    const pastDebts = await prisma.contribution.findMany({
      where: {
        contributorId: round.recipientId,
        status: { in: ['pending', 'failed'] },
        round: {
          circleId: round.circleId,
          status: { in: ['completed', 'missed_partial'] }
        }
      },
      include: { round: { include: { recipient: true } } },
      orderBy: { round: { roundNumber: 'asc' } }
    });

    let targetRecipient = round.recipient;
    let interceptMessage = `Rosco: Round ${round.roundNumber} contribution to ${round.recipient.displayName || round.recipient.nimiqAddress}`;

    if (pastDebts.length > 0) {
      // Deterministic Routing: Sort contributors (excluding recipient) consistently
      const payingContributors = round.contributions
        .filter(c => c.contributorId !== round.recipientId)
        .sort((a, b) => a.contributorId.localeCompare(b.contributorId));
        
      const myIndex = payingContributors.findIndex(c => c.contributorId === userId);
      
      // If the current user's index maps to an unsettled debt, they are assigned to pay it!
      if (myIndex !== -1 && myIndex < pastDebts.length) {
        const assignedDebt = pastDebts[myIndex];
        targetRecipient = assignedDebt.round.recipient;
        interceptMessage = `Rosco: Routed to ${targetRecipient.displayName} (Debt Intercept for Round ${assignedDebt.round.roundNumber})`;
      }
    }

    // Return pre-filled payment payload for the SDK
    res.json({
      recipient_address: targetRecipient.nimiqAddress,
      amount: round.circle.contributionAmount,
      round_id: round.id,
      contribution_id: contribution.id,
      message: interceptMessage,
    });
  } catch (error) {
    console.error('Contribution intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// ─── POST /rounds/:id/contributions/confirm — Submit tx for verification ────

roundsRouter.post('/rounds/:id/contributions/confirm', authenticate, async (req: Request, res: Response) => {
  try {
    const roundId = req.params.id;
    const userId = req.user!.userId;

    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { tx_hash } = parsed.data;

    // Check for duplicate tx_hash
    const existingTx = await prisma.contribution.findUnique({
      where: { txHash: tx_hash },
    });
    if (existingTx) {
      res.status(400).json({ error: 'This transaction hash has already been used' });
      return;
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        circle: true,
        recipient: true,
        contributions: true,
      },
    });

    if (!round) {
      res.status(404).json({ error: 'Round not found' });
      return;
    }
    if (round.status !== 'open') {
      res.status(400).json({ error: 'Round is not open' });
      return;
    }

    const contribution = round.contributions.find(c => c.contributorId === userId);
    if (!contribution) {
      res.status(403).json({ error: 'You are not a contributor in this round' });
      return;
    }
    if (contribution.status === 'confirmed') {
      res.status(400).json({ error: 'Already confirmed' });
      return;
    }

    // Verify the transaction on-chain
    const senderAddress = req.user!.nimiqAddress;
    let expectedRecipientAddress = round.recipient.nimiqAddress;
    const expectedAmount = round.circle.contributionAmount;

    let debtContributionToSettle = null;

    // Check if there are past debts that might have been intercepted
    const pastDebts = await prisma.contribution.findMany({
      where: {
        contributorId: round.recipientId,
        status: { in: ['pending', 'failed'] },
        round: {
          circleId: round.circleId,
          status: { in: ['completed', 'missed_partial'] }
        }
      },
      include: { round: { include: { recipient: true } } },
      orderBy: { round: { roundNumber: 'asc' } }
    });

    if (pastDebts.length > 0) {
      // Check tx recipient by fetching it from RPC directly before verifyTransaction
      // Actually verifyTransaction checks against expectedRecipientAddress
      // We will loop through past debts, and if tx went to any of them, we set expectedRecipientAddress
      const { getTransaction } = require('../lib/nimiq-rpc');
      const tx = await getTransaction(tx_hash);
      if (tx) {
        const normalize = (addr: string) => addr.replace(/\s+/g, '').toUpperCase();
        for (const debt of pastDebts) {
          if (normalize(tx.to) === normalize(debt.round.recipient.nimiqAddress)) {
            expectedRecipientAddress = debt.round.recipient.nimiqAddress;
            debtContributionToSettle = debt;
            break;
          }
        }
      }
    }

    const verification = await verifyTransaction(tx_hash, senderAddress, expectedRecipientAddress, expectedAmount);

    if (!verification.valid) {
      // Store the tx_hash but mark as failed
      await prisma.contribution.update({
        where: { id: contribution.id },
        data: {
          txHash: tx_hash,
          status: 'failed',
        },
      });

      res.status(400).json({
        error: 'Transaction verification failed',
        reason: verification.reason,
      });
      return;
    }

    // Mark as confirmed
    await prisma.contribution.update({
      where: { id: contribution.id },
      data: {
        txHash: tx_hash,
        status: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    // If an intercept occurred, settle the past debt!
    if (debtContributionToSettle) {
      await prisma.contribution.update({
        where: { id: debtContributionToSettle.id },
        data: {
          status: 'settled_intercept',
          confirmedAt: new Date(),
        },
      });
      // Notify the past recipient that their debt was settled
      await sendNotificationToUser(debtContributionToSettle.round.recipientId, {
        title: `Payment Received (Debt Intercept)!`,
        body: `You received ${expectedAmount} NIM that was owed to you from Round ${debtContributionToSettle.round.roundNumber}.`,
        url: `/circle/${round.circleId}`
      }).catch(console.error);
    } else {
      // Notify the current round recipient
      await sendNotificationToUser(round.recipientId, {
        title: `Payment Received!`,
        body: `You just received a contribution of ${expectedAmount} NIM for Round ${round.roundNumber}.`,
        url: `/circle/${round.circleId}`
      }).catch(console.error);
    }

    // Check if all contributions for this round are confirmed
    const allContributions = await prisma.contribution.findMany({
      where: { roundId },
    });

    const allConfirmed = allContributions.every(c =>
      c.id === contribution.id ? true : c.status === 'confirmed'
    );

    if (allConfirmed) {
      // Mark round as completed
      await prisma.round.update({
        where: { id: roundId },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      // Check if this was the last round — if so, mark circle as completed
      const openRounds = await prisma.round.count({
        where: {
          circleId: round.circleId,
          status: 'open',
        },
      });

      // openRounds will be 0 now since we just closed the last open one
      // But we need to check if there are any remaining open rounds (other than this one)
      if (openRounds === 0) {
        await prisma.circle.update({
          where: { id: round.circleId },
          data: { status: 'completed' },
        });
        
        // Notify members that circle is complete
        const circleMembers = await prisma.membership.findMany({ where: { circleId: round.circleId, status: 'approved' }});
        for (const m of circleMembers) {
          await sendNotificationToUser(m.userId, {
            title: `Circle Completed! 🎉`,
            body: `All rounds for ${round.circle.name} have successfully finished.`,
            url: `/circle/${round.circleId}`
          }).catch(console.error);
        }
      }
    }

    res.json({
      contribution_id: contribution.id,
      status: 'confirmed',
      tx_hash,
      round_completed: allConfirmed,
    });
  } catch (error) {
    console.error('Contribution confirm error:', error);
    res.status(500).json({ error: 'Failed to confirm contribution' });
  }
});

// ─── GET /rounds/:id/contributions — Contribution statuses ──────────────────

roundsRouter.get('/rounds/:id/contributions', authenticate, async (req: Request, res: Response) => {
  try {
    const roundId = req.params.id;

    const contributions = await prisma.contribution.findMany({
      where: { roundId },
      include: { contributor: true },
      orderBy: { contributor: { displayName: 'asc' } },
    });

    res.json(contributions.map(c => ({
      id: c.id,
      contributor_id: c.contributorId,
      expected_amount: c.expectedAmount,
      tx_hash: c.txHash,
      status: c.status,
      confirmed_at: c.confirmedAt,
      contributor: {
        id: c.contributor.id,
        nimiq_address: c.contributor.nimiqAddress,
        display_name: c.contributor.displayName,
      },
    })));
  } catch (error) {
    console.error('List contributions error:', error);
    res.status(500).json({ error: 'Failed to list contributions' });
  }
});
