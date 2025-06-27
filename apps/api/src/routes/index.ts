// filepath: /Users/yamanjain/Documents/Workspace/linkedin-langchain-js/src/routes/index.ts
import { NextFunction, Request, Response, Router } from 'express';
import { errorHandler } from '../middleware/error.middleware';
import prisma from '../prisma/prisma';
import aiRouter from './ai.routes';
import stripeRouter from './stripe.routes';
import webhookRouter from './webhook.routes';

const router = Router();

const version = process.env.API_VERSION || 'v1';

// Mount AI routes
router.use(`/api/${version}/ai`, aiRouter);

// Mount Stripe routes
router.use(`/api/${version}/stripe`, stripeRouter);

// Mount webhook routes
router.use(`/api/${version}/webhook`, webhookRouter);

router.post(`/test`, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: `test${Date.now()}@example.com`, // Make email unique
        name: 'Test User',
        isActive: true,
      }
    });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}, errorHandler);

router.use(`/api/${version}/stripe`, stripeRouter);

// Health check endpoint
router.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

export default router;