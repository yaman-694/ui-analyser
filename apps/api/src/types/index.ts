import { Request } from 'express';

// Extend Express Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      remainingCredits?: number;
      services?: {
        credits: {
          refreshCredits: (userId: string) => Promise<void>;
          deductCredits: (userId: string, amount?: number) => Promise<boolean>;
          getCredits: (userId: string) => Promise<number>;
        };
        // Add other services as needed
      };
    }
  }
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

/**
 * Comment generation types
 */
export interface GenerateCommentInput {
  post: string;
}

export interface GenerateCommentOutput {
  comment: string;
  remainingCredits?: number; // Add remaining credits to response
  currentPlan?: string; // User's current plan
  nextRefreshDate?: string; // When credits will refresh
}

// RequestExtended still useful for local type extensions
export interface RequestExtended extends Request {
  userId?: string; // Optional user ID from auth middleware
  remainingCredits?: number; // Optional remaining credits from credits middleware
}