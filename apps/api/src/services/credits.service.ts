import redis from '../config/redis';
import User from '../model/user.model';


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
        await User.updateOne({ id: userId }, { credits });
      }
      
      console.log(`Batch updated credits for ${updates.size} users`);
    } catch (error) {
      console.error('Error during batch credit update:', error);
    }
  }
}, BATCH_UPDATE_INTERVAL);

export class CreditsService {
  async refreshCredits(userId: string): Promise<void> {
    try {
      // First check Redis cache
      const cacheKey = `user:${userId}:credits`;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        // Return early if we have cached data
        return;
      }

      const user = await User.findOne({ clerkId: userId }).select('dailyCreditsRefresh credits');

      if (!user) {
        throw new Error('User not found');
      }

      // Cache the user data
      await redis.set(cacheKey, JSON.stringify(user), 'EX', CREDITS_CACHE_TTL);

      // Check if we need to refresh daily credits
      const lastRefreshed = user.dailyCreditsRefresh;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Only refresh if credits haven't been refreshed today or if this is the first refresh
      if (!lastRefreshed || new Date(lastRefreshed) < today) {
        

        // Update the user's credits and refresh timestamp
        

        // Update the cache with new values
        await redis.set(
          cacheKey, 
          JSON.stringify({ 
            ...user, 
            credits: BATCH_UPDATE_INTERVAL, 
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
        userData = await User.findOne({ clerkId: userId }).select('credits');

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

      const user = await User.findOne({ clerkId: userId }).select('credits');

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
