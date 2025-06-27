import { NextFunction, Request, Response } from 'express';
import Stripe from 'stripe';
import { HTTP_STATUS_CODE } from '../../constants/constants';
import prisma from '../../prisma/prisma';

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Test endpoint to verify Stripe API connection
export const testStripeConnection = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Just fetch a list of products to verify connection works
    const products = await stripe.products.list({ limit: 1 });
    
    // Respond with success and basic info
    res.status(HTTP_STATUS_CODE.OK).json({
      success: true,
      message: 'Stripe API connection successful',
      apiVersion: '2025-05-28.basil', // Hardcoded API version
      productsCount: products.data.length,
    });
  } catch (error) {
    next(error);
  }
};

// Get the subscription status for a user
export const getSubscription = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'User ID is required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePriceId: true,
        stripeCurrentPeriodEnd: true,
        isActive: true,
      },
    });

    if (!user) {
      res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'User not found',
      });
      return;
    }

    // Check if the subscription is valid and not expired
    const isSubscriptionValid = user.isActive && user.stripeCurrentPeriodEnd
      ? new Date(user.stripeCurrentPeriodEnd) > new Date()
      : false;

    res.status(HTTP_STATUS_CODE.OK).json({
      subscription: {
        ...user,
        isSubscriptionValid,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel a user's subscription
export const cancelSubscription = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'User ID is required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeSubscriptionId) {
      res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'User or subscription not found',
      });
      return;
    }

    // Cancel the subscription at period end
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Subscription will be canceled at the end of the current billing period',
    });
  } catch (error) {
    next(error);
  }
};

// Check if user has an active subscription
export const checkSubscription = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'User ID is required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'User not found',
      });
      return;
    }

    // Check if the subscription is active and not expired
    const hasActiveSubscription = user.isActive && user.stripeCurrentPeriodEnd
      ? new Date(user.stripeCurrentPeriodEnd) > new Date()
      : false;

    res.status(HTTP_STATUS_CODE.OK).json({
      hasActiveSubscription,
    });
  } catch (error) {
    next(error);
  }
};