import { NextFunction, Request, Response } from 'express';
import creditsService from '../services/credits.service';

export const attachServices = (req: Request, res: Response, next: NextFunction): void => {
  // Attach services to the request object
  req.services = {
    credits: creditsService,
    // Add other services as needed
  };
  
  next();
};
