import { Router } from 'express';
import {
    cancelSubscription,
    checkSubscription,
    getSubscription,
    testStripeConnection
} from '../controllers/stripe';
import { errorHandler } from '../middleware/error.middleware';

const stripeRouter = Router();

/**
 * GET /test
 * Test endpoint to verify Stripe API connectivity
 */
stripeRouter.get(
  '/test',
  testStripeConnection,
  errorHandler
);

/**
 * GET /subscription/:userId
 * Get subscription details for a user
 */
stripeRouter.get(
  '/subscription/:userId',
  getSubscription,
  errorHandler
);

/**
 * POST /subscription/:userId/cancel
 * Cancel a user's subscription
 */
stripeRouter.post(
  '/subscription/:userId/cancel',
  cancelSubscription,
  errorHandler
);

/**
 * GET /subscription/:userId/check
 * Check if a user has an active subscription
 */
stripeRouter.get(
  '/subscription/:userId/check',
  checkSubscription,
  errorHandler
);

export default stripeRouter;
