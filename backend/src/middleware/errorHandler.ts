import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { ZodError } from 'zod';

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Zod validation error
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
    });
  }

  // Known operational error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Unknown error
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}
