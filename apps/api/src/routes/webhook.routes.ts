import { Router } from 'express';
import { errorHandler } from '../middleware/error.middleware';
import clerkWebhookHandler from '../webhooks/clerk.webhook';

const webhookRouter = Router();

// Clerk webhook endpoint
webhookRouter.post('/clerk', clerkWebhookHandler, errorHandler);

export default webhookRouter;
