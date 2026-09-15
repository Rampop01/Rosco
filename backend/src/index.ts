import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth';
import { circlesRouter } from './routes/circles';
import { roundsRouter } from './routes/rounds';
import { errorHandler } from './middleware/error';
import { startVerificationPoller } from './jobs/verification-poller';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rosco-backend' });
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/circles', circlesRouter);
app.use('/api/v1/rounds', roundsRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🔵 Rosco backend running on http://localhost:${PORT}`);
  
  // Start the background verification poller
  startVerificationPoller();
  console.log('🔄 Verification poller started');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
