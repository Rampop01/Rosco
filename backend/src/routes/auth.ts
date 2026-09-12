import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { generateToken } from '../middleware/auth';
import { z } from 'zod';

export const authRouter: Router = Router();

const sessionSchema = z.object({
  nimiq_address: z.string().min(1, 'Nimiq address is required'),
  display_name: z.string().optional(),
});

// POST /auth/session
// Wallet-address-based auth: upserts user, returns JWT + user
authRouter.post('/session', async (req: Request, res: Response) => {
  try {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { nimiq_address, display_name } = parsed.data;

    // Upsert user — create if new, update display_name if provided
    const user = await prisma.user.upsert({
      where: { nimiqAddress: nimiq_address },
      update: {
        ...(display_name ? { displayName: display_name } : {}),
      },
      create: {
        nimiqAddress: nimiq_address,
        displayName: display_name || null,
      },
    });

    const token = generateToken({
      userId: user.id,
      nimiqAddress: user.nimiqAddress,
    });

    res.json({
      token,
      user: {
        id: user.id,
        nimiq_address: user.nimiqAddress,
        display_name: user.displayName,
        language: user.language,
        created_at: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});
