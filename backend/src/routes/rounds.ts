import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { verifyTransaction } from '../lib/nimiq-rpc';
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

// ─── POST /rounds/:id/contributions/intent — Get payment payload ────────────

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

    // Return pre-filled payment payload for the SDK
    res.json({
      recipient_address: round.recipient.nimiqAddress,
      amount: round.circle.contributionAmount,
      round_id: round.id,
      contribution_id: contribution.id,
      message: `Rosco: Round ${round.roundNumber} contribution to ${round.recipient.displayName || round.recipient.nimiqAddress}`,
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
    const recipientAddress = round.recipient.nimiqAddress;
    const expectedAmount = round.circle.contributionAmount;

    const verification = await verifyTransaction(tx_hash, senderAddress, recipientAddress, expectedAmount);

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
