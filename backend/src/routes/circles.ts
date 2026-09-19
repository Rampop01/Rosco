import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { z } from 'zod';

export const circlesRouter: Router = Router();

// ─── Validation schemas ─────────────────────────────────────────────────────

const createCircleSchema = z.object({
  name: z.string().min(1).max(100),
  contribution_amount: z.number().min(1, 'Minimum contribution is 1 NIM'),
  frequency: z.string().transform(val => val.toLowerCase()).pipe(z.enum(['daily', 'weekly', 'biweekly', 'monthly'])),
  max_members: z.number().int().min(2).max(50),
});

// ─── Helper: serialize circle for API response ──────────────────────────────

function serializeCircle(circle: any) {
  return {
    id: circle.id,
    name: circle.name,
    organizer_id: circle.organizerId,
    contribution_amount: circle.contributionAmount,
    currency: circle.currency,
    frequency: circle.frequency,
    min_members: circle.minMembers,
    max_members: circle.maxMembers,
    status: circle.status,
    payout_order: circle.payoutOrder ? JSON.parse(circle.payoutOrder) : null,
    start_date: circle.startDate,
    created_at: circle.createdAt,
    organizer: circle.organizer ? {
      id: circle.organizer.id,
      nimiq_address: circle.organizer.nimiqAddress,
      display_name: circle.organizer.displayName,
    } : undefined,
    memberships: circle.memberships?.map((m: any) => ({
      id: m.id,
      user_id: m.userId,
      status: m.status,
      joined_order: m.joinedOrder,
      user: m.user ? {
        id: m.user.id,
        nimiq_address: m.user.nimiqAddress,
        display_name: m.user.displayName,
      } : undefined,
    })),
    rounds: circle.rounds?.map((r: any) => ({
      id: r.id,
      round_number: r.roundNumber,
      recipient_id: r.recipientId,
      due_date: r.dueDate,
      status: r.status,
      completed_at: r.completedAt,
      recipient: r.recipient ? {
        id: r.recipient.id,
        nimiq_address: r.recipient.nimiqAddress,
        display_name: r.recipient.displayName,
      } : undefined,
      contributions: r.contributions?.map((c: any) => ({
        id: c.id,
        round_id: c.roundId,
        contributor_id: c.contributorId,
        status: c.status,
        tx_hash: c.txHash,
        amount: c.amount,
        created_at: c.createdAt,
        confirmed_at: c.confirmedAt,
      })),
    })),
  };
}

// ─── POST /circles — Create a new circle ────────────────────────────────────

circlesRouter.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const parsed = createCircleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { name, contribution_amount, frequency, max_members } = parsed.data;
    const userId = req.user!.userId;

    const circle = await prisma.circle.create({
      data: {
        name,
        organizerId: userId,
        contributionAmount: contribution_amount,
        frequency,
        maxMembers: max_members,
      },
    });

    // Auto-add organizer as approved member
    await prisma.membership.create({
      data: {
        circleId: circle.id,
        userId,
        status: 'approved',
        decidedAt: new Date(),
        joinedOrder: 1,
      },
    });

    const fullCircle = await prisma.circle.findUnique({
      where: { id: circle.id },
      include: {
        organizer: true,
        memberships: { include: { user: true } },
      },
    });

    res.status(201).json(serializeCircle(fullCircle));
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// ─── GET /circles — List user's circles ─────────────────────────────────────

circlesRouter.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const circles = await prisma.circle.findMany({
      where: {
        memberships: {
          some: {
            userId,
            status: { in: ['approved', 'pending'] },
          },
        },
      },
      include: {
        organizer: true,
        memberships: {
          where: { status: 'approved' },
          include: { user: true },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            recipient: true,
            contributions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(circles.map(serializeCircle));
  } catch (error) {
    console.error('List circles error:', error);
    res.status(500).json({ error: 'Failed to list circles' });
  }
});

// ─── GET /circles/:id — Circle detail ───────────────────────────────────────

circlesRouter.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const circle = await prisma.circle.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: true,
        memberships: {
          include: { user: true },
          orderBy: { joinedOrder: 'asc' },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            recipient: true,
            contributions: {
              include: { contributor: true },
            },
          },
        },
      },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    const serialized = serializeCircle(circle);

    // Add contribution details to rounds
    if (circle.rounds) {
      serialized.rounds = circle.rounds.map((r: any) => ({
        id: r.id,
        round_number: r.roundNumber,
        recipient_id: r.recipientId,
        due_date: r.dueDate,
        status: r.status,
        completed_at: r.completedAt,
        recipient: r.recipient ? {
          id: r.recipient.id,
          nimiq_address: r.recipient.nimiqAddress,
          display_name: r.recipient.displayName,
        } : undefined,
        contributions: r.contributions?.map((c: any) => ({
          id: c.id,
          contributor_id: c.contributorId,
          expected_amount: c.expectedAmount,
          tx_hash: c.txHash,
          status: c.status,
          confirmed_at: c.confirmedAt,
          contributor: c.contributor ? {
            id: c.contributor.id,
            nimiq_address: c.contributor.nimiqAddress,
            display_name: c.contributor.displayName,
          } : undefined,
        })),
      }));
    }

    res.json(serialized);
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ error: 'Failed to get circle' });
  }
});

// ─── POST /circles/:id/join-request ─────────────────────────────────────────

circlesRouter.post('/:id/join-request', authenticate, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        memberships: true,
      },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    // Check if circle is accepting requests
    if (circle.status !== 'forming') {
      res.status(403).json({ error: 'Circle is no longer accepting new members' });
      return;
    }

    // Check if already a member
    const existing = circle.memberships.find(m => m.userId === userId);

    if (existing) {
      if (existing.status === 'approved') {
        res.status(400).json({ error: 'Already a member of this circle' });
        return;
      }
      if (existing.status === 'pending') {
        res.status(400).json({ error: 'Join request already pending' });
        return;
      }
      if (existing.status === 'rejected' && circle.status === 'forming') {
        // Re-request allowed while forming — reset to pending
        const updated = await prisma.membership.update({
          where: { id: existing.id },
          data: {
            status: 'pending',
            decidedAt: null,
            requestedAt: new Date(),
          },
        });
        res.json({ id: updated.id, status: updated.status, message: 'Join request re-submitted' });
        return;
      }
      res.status(403).json({ error: 'Cannot re-request membership for this circle' });
      return;
    }

    // Check if circle is full (counting only approved members)
    const approvedCount = circle.memberships.filter(m => m.status === 'approved').length;
    if (approvedCount >= circle.maxMembers) {
      res.status(400).json({ error: 'Circle is full' });
      return;
    }

    // Create new join request
    const membership = await prisma.membership.create({
      data: {
        circleId,
        userId,
        status: 'pending',
      },
    });

    res.status(201).json({
      id: membership.id,
      status: membership.status,
      message: 'Join request submitted',
    });
  } catch (error) {
    console.error('Join request error:', error);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
});

// ─── GET /circles/:id/join-requests — List pending requests (organizer) ─────

circlesRouter.get('/:id/join-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }

    if (circle.organizerId !== userId) {
      res.status(403).json({ error: 'Only the organizer can view join requests' });
      return;
    }

    const requests = await prisma.membership.findMany({
      where: {
        circleId,
        status: 'pending',
      },
      include: { user: true },
      orderBy: { requestedAt: 'asc' },
    });

    res.json(requests.map(r => ({
      id: r.id,
      user_id: r.userId,
      status: r.status,
      requested_at: r.requestedAt,
      user: {
        id: r.user.id,
        nimiq_address: r.user.nimiqAddress,
        display_name: r.user.displayName,
      },
    })));
  } catch (error) {
    console.error('List join requests error:', error);
    res.status(500).json({ error: 'Failed to list join requests' });
  }
});

// ─── POST /circles/:id/join-requests/:membershipId/approve ──────────────────

circlesRouter.post('/:id/join-requests/:membershipId/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: circleId, membershipId } = req.params;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: { memberships: true },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }
    if (circle.organizerId !== userId) {
      res.status(403).json({ error: 'Only the organizer can approve requests' });
      return;
    }
    if (circle.status !== 'forming') {
      res.status(400).json({ error: 'Circle is no longer accepting members' });
      return;
    }

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.circleId !== circleId) {
      res.status(404).json({ error: 'Membership request not found' });
      return;
    }
    if (membership.status !== 'pending') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    // Check if circle is full
    const approvedCount = circle.memberships.filter(m => m.status === 'approved').length;
    if (approvedCount >= circle.maxMembers) {
      res.status(400).json({ error: 'Circle is already full' });
      return;
    }

    // Approve: set joined_order to next available int
    const maxOrder = Math.max(0, ...circle.memberships.filter(m => m.joinedOrder !== null).map(m => m.joinedOrder!));

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: 'approved',
        decidedAt: new Date(),
        joinedOrder: maxOrder + 1,
      },
      include: { user: true },
    });

    res.json({
      id: updated.id,
      status: updated.status,
      joined_order: updated.joinedOrder,
      user: {
        id: updated.user.id,
        nimiq_address: updated.user.nimiqAddress,
        display_name: updated.user.displayName,
      },
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ─── POST /circles/:id/join-requests/:membershipId/reject ───────────────────

circlesRouter.post('/:id/join-requests/:membershipId/reject', authenticate, async (req: Request, res: Response) => {
  try {
    const { id: circleId, membershipId } = req.params;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({ where: { id: circleId } });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }
    if (circle.organizerId !== userId) {
      res.status(403).json({ error: 'Only the organizer can reject requests' });
      return;
    }

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });

    if (!membership || membership.circleId !== circleId) {
      res.status(404).json({ error: 'Membership request not found' });
      return;
    }
    if (membership.status !== 'pending') {
      res.status(400).json({ error: 'Request is not pending' });
      return;
    }

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: 'rejected',
        decidedAt: new Date(),
      },
    });

    res.json({ id: updated.id, status: updated.status });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// ─── POST /circles/:id/start — Start the circle ────────────────────────────

circlesRouter.post('/:id/start', authenticate, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        memberships: {
          where: { status: 'approved' },
          include: { user: true },
        },
      },
    });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }
    if (circle.organizerId !== userId) {
      res.status(403).json({ error: 'Only the organizer can start the circle' });
      return;
    }
    if (circle.status !== 'forming') {
      res.status(400).json({ error: 'Circle has already been started or is cancelled' });
      return;
    }

    const approvedMembers = circle.memberships;
    if (approvedMembers.length < circle.minMembers) {
      res.status(400).json({
        error: `Need at least ${circle.minMembers} approved members to start. Currently have ${approvedMembers.length}.`,
      });
      return;
    }

    // Generate random payout order (Fisher-Yates shuffle)
    const memberIds = approvedMembers.map(m => m.userId);
    for (let i = memberIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [memberIds[i], memberIds[j]] = [memberIds[j], memberIds[i]];
    }

    // Calculate round dates based on frequency
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    // Start from next day
    startDate.setDate(startDate.getDate() + 1);

    const getNextDueDate = (roundIndex: number): Date => {
      const date = new Date(startDate);
      switch (circle.frequency) {
        case 'daily':
          date.setDate(date.getDate() + roundIndex);
          break;
        case 'weekly':
          date.setDate(date.getDate() + (roundIndex * 7));
          break;
        case 'biweekly':
          date.setDate(date.getDate() + (roundIndex * 14));
          break;
        case 'monthly':
          date.setMonth(date.getMonth() + roundIndex);
          break;
      }
      return date;
    };

    // Auto-reject any still-pending requests
    await prisma.membership.updateMany({
      where: {
        circleId,
        status: 'pending',
      },
      data: {
        status: 'rejected',
        decidedAt: new Date(),
      },
    });

    // Create all rounds with contribution rows
    const roundsData = memberIds.map((recipientId, index) => ({
      circleId,
      roundNumber: index + 1,
      recipientId,
      dueDate: getNextDueDate(index + 1),
      status: index === 0 ? 'open' : 'upcoming',
    }));

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Update circle
      await tx.circle.update({
        where: { id: circleId },
        data: {
          status: 'active',
          payoutOrder: JSON.stringify(memberIds),
          startDate,
        },
      });

      // Create rounds
      for (const roundData of roundsData) {
        const round = await tx.round.create({ data: roundData });

        // Create contribution rows for each member except the recipient
        const contributionRows = approvedMembers
          .filter(member => member.userId !== round.recipientId)
          .map(member => ({
            roundId: round.id,
            contributorId: member.userId,
            expectedAmount: circle.contributionAmount,
            status: 'pending',
          }));

        if (contributionRows.length > 0) {
          await tx.contribution.createMany({ data: contributionRows });
        }
      }
    });

    // Fetch the updated circle
    const updated = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        organizer: true,
        memberships: {
          where: { status: 'approved' },
          include: { user: true },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            recipient: true,
            contributions: { include: { contributor: true } },
          },
        },
      },
    });

    res.json(serializeCircle(updated));
  } catch (error) {
    console.error('Start circle error:', error);
    res.status(500).json({ error: 'Failed to start circle' });
  }
});

// ─── POST /circles/:id/cancel ───────────────────────────────────────────────

circlesRouter.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    const userId = req.user!.userId;

    const circle = await prisma.circle.findUnique({ where: { id: circleId } });

    if (!circle) {
      res.status(404).json({ error: 'Circle not found' });
      return;
    }
    if (circle.organizerId !== userId) {
      res.status(403).json({ error: 'Only the organizer can cancel the circle' });
      return;
    }
    if (circle.status === 'completed' || circle.status === 'cancelled') {
      res.status(400).json({ error: 'Circle is already completed or cancelled' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Cancel all open rounds
      await tx.round.updateMany({
        where: { circleId, status: 'open' },
        data: { status: 'cancelled' as any },
      });

      // Update circle status
      await tx.circle.update({
        where: { id: circleId },
        data: { status: 'cancelled' },
      });
    });

    res.json({ id: circleId, status: 'cancelled' });
  } catch (error) {
    console.error('Cancel circle error:', error);
    res.status(500).json({ error: 'Failed to cancel circle' });
  }
});
