import { NextFunction, Request, Response } from 'express';

/**
 * Error response interface
 */
interface ErrorResponse {
  success: boolean;
  message: string;
  stack?: string;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging
  console.error('Error:', err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  const errorResponse: ErrorResponse = {
    success: false,
    message: err.message || 'Something went wrong',
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found middleware
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
