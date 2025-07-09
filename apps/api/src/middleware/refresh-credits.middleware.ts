import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS_CODE } from '../constants/constants';

/**
 * Middleware to refresh user credits based on their subscription plan
 */
function refreshCredits(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  try {
    // Assuming req.userId is set by the auth middleware
    const userId = req.userId;
    
    if (!userId) {
      res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({ error: 'Unauthorized' });
      return;
    }
    
    // Check if services are attached
    if (!req.services || !req.services.credits) {
      console.error('Credits service not attached to request');
      res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: 'Credits service not available' });
      return;
    }
    
    // Call the service to refresh credits
    req.services.credits.refreshCredits(userId)
      .then(() => {
        next();
      })
      .catch((error) => {
        console.error('Error refreshing credits:', error);
        res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
      });
  } catch (error) {
    console.error('Error in refresh credits middleware:', error);
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
}

export default refreshCredits;
