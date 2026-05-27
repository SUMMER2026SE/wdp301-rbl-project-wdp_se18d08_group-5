import rateLimit from 'express-rate-limit';
import { ENV } from '../config/env.js';

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: ENV.NODE_ENV === 'development' ? 1 * 60 * 1000 : 15 * 60 * 1000,
  max: ENV.NODE_ENV === 'development' ? 100 : 10,
  message: {
    success: false,
    message: 'Too many auth attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
