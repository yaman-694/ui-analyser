// filepath: /Users/yamanjain/Documents/Workspace/linkedin-langchain-js/src/routes/index.ts
import { Router } from 'express';
import aiRouter from './ai.routes';
import webhookRouter from './webhook.routes';
import userRouter from './user.routes';

const router = Router();

const version = process.env.API_VERSION || 'v1';

// Mount AI routes
router.use(`/api/${version}/ai`, aiRouter);

// Mount webhook routes
router.use(`/api/${version}/webhook`, webhookRouter);

router.use(`/api/${version}/user`, userRouter)


// Health check endpoint
router.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

export default router;