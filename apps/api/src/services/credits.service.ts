import { Redis } from 'ioredis';
import prisma from '../prisma/prisma';
import { Plan } from '../../generated/prisma';
import { STRIPE } from '../constants/constants';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
});

// Set the TTL for cached credit values (1 hour in seconds)
const CREDITS_CACHE_TTL = 3600;

// Set the batch update interval (1 minute in milliseconds)
const BATCH_UPDATE_INTERVAL = 60 * 1000;

// Keep track of pending DB updates
const pendingUpdates = new Map<string, number>();

// Schedule periodic batch updates
setInterval(async () => {
  if (pendingUpdates.size > 0) {
    try {
      // Create a copy of pendingUpdates to work with
      const updates = new Map(pendingUpdates);
      pendingUpdates.clear();
      
      // Perform batch update
      for (const [userId, credits] of updates.entries()) {
        await prisma.user.update({
          where: { id: userId },
          data: { 
            credits: credits 
          }
        });
      }
      
      console.log(`Batch updated credits for ${updates.size} users`);
    } catch (error) {
      console.error('Error during batch credit update:', error);
    }
  }
}, BATCH_UPDATE_INTERVAL);

export class CreditsService {
  /**
   * Refreshes user credits based on their subscription plan
   * - Free plan: no credits refresh
   * - Base plan: up to 20 credits per day
   * - Plus plan: up to 50 credits per day
   */
  async refreshCredits(userId: string): Promise<void> {
    try {
      // First check Redis cache
      const cacheKey = `user:${userId}:credits`;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        // Return early if we have cached data
        return;
      }
      
      // Get user from database if not in cache
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentPlan: true,
          credits: true,
          dailyCreditsLastRefreshed: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Cache the user data
      await redis.set(cacheKey, JSON.stringify(user), 'EX', CREDITS_CACHE_TTL);

      // If the user is on the free plan, no credit refresh needed
      if (user.currentPlan === Plan.FREE) {
        return;
      }

      // Check if we need to refresh daily credits
      const lastRefreshed = user.dailyCreditsLastRefreshed;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Only refresh if credits haven't been refreshed today or if this is the first refresh
      if (!lastRefreshed || new Date(lastRefreshed) < today) {
        // Determine max credits based on plan
        let maxCredits = 0;
        if (user.currentPlan === Plan.BASE) {
          maxCredits = STRIPE.baseSubscriptionPlan.credit;
        } else if (user.currentPlan === Plan.PLUS) {
          maxCredits = STRIPE.plusSubscriptionPlan.credit;
        }

        // Update the user's credits and refresh timestamp
        await prisma.user.update({
          where: { id: userId },
          data: {
            credits: maxCredits,
            dailyCreditsLastRefreshed: new Date(),
          },
        });

        // Update the cache with new values
        await redis.set(
          cacheKey, 
          JSON.stringify({ 
            ...user, 
            credits: maxCredits, 
            dailyCreditsLastRefreshed: new Date() 
          }), 
          'EX', 
          CREDITS_CACHE_TTL
        );
      }
    } catch (error) {
      console.error('Error refreshing credits:', error);
      throw error;
    }
  }

  /**
   * Deducts credits from a user's account
   * Returns true if successful, false if insufficient credits
   */
  async deductCredits(userId: string, amount: number = 1): Promise<boolean> {
    try {
      // First check Redis cache
      const cacheKey = `user:${userId}:credits`;
      let userData = null;
      
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        userData = JSON.parse(cachedData);
      } else {
        // Get user from database if not in cache
        userData = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            currentPlan: true,
            credits: true,
          },
        });

        if (!userData) {
          throw new Error('User not found');
        }
        
        // Cache the user data
        await redis.set(cacheKey, JSON.stringify(userData), 'EX', CREDITS_CACHE_TTL);
      }

      // Check if user has enough credits
      if (userData.credits < amount) {
        return false;
      }

      // Calculate new credits value
      const newCredits = userData.credits - amount;
      
      // Update the cache immediately
      userData.credits = newCredits;
      await redis.set(cacheKey, JSON.stringify(userData), 'EX', CREDITS_CACHE_TTL);
      
      // Schedule for batch update instead of immediate DB update
      pendingUpdates.set(userId, newCredits);
      
      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      throw error;
    }
  }

  /**
   * Gets the current credit balance for a user
   */
  async getCredits(userId: string): Promise<number> {
    try {
      // First check Redis cache
      const cacheKey = `user:${userId}:credits`;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        const userData = JSON.parse(cachedData);
        return userData.credits;
      }
      
      // Get user from database if not in cache
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          credits: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }
      
      // Cache the user data
      await redis.set(
        cacheKey, 
        JSON.stringify({ credits: user.credits }), 
        'EX', 
        CREDITS_CACHE_TTL
      );

      return user.credits;
    } catch (error) {
      console.error('Error getting credits:', error);
      throw error;
    }
  }
}

export default new CreditsService();
