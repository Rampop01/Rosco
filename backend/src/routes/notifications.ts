import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

export const notificationsRouter: Router = Router();

// GET /api/v1/notifications/vapid-key
notificationsRouter.get('/vapid-key', (req: Request, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/v1/notifications/subscribe
notificationsRouter.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;
    const userId = req.user!.userId;

    if (!subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      if (existing.userId !== userId) {
        // Reassign to current user
        await prisma.pushSubscription.update({
          where: { id: existing.id },
          data: { userId },
        });
      }
      res.json({ success: true });
      return;
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});
