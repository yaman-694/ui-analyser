import { Router } from 'express';
import { errorHandler } from '../middleware/error.middleware';
import clerkWebhookHandler from '../webhooks/clerk.webhook';
import stripeWebhookHandler from '../webhooks/stripe.webhook';

const webhookRouter = Router();

// Clerk webhook endpoint
webhookRouter.post('/clerk', clerkWebhookHandler, errorHandler);
webhookRouter.post('/stripe', stripeWebhookHandler, errorHandler);

export default webhookRouter;
