import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS_CODE } from '../constants/constants';

/**
 * Middleware to check if user has sufficient credits
 * This should be applied after the refreshCredits middleware
 */
async function checkCredits(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
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
    
    try {
      // Check if user has credits available
      const currentCredits = await req.services.credits.getCredits(userId);
      
      if (currentCredits <= 0) {
        res.status(HTTP_STATUS_CODE.PAYMENT_REQUIRED).json({ 
          error: 'Insufficient credits', 
          message: 'You have used all your available credits for today. Please upgrade your plan or wait until tomorrow for your credits to refresh.' 
        });
        return;
      }


      next();
      
    } catch (serviceError) {
      console.error('Error with credits service:', serviceError);
      res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
    }
  } catch (error) {
    console.error('Error checking credits:', error);
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({ error: 'Internal Server Error' });
  }
}

export default checkCredits;
