import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  tokenSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.schema.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  '/verify-email',
  authLimiter,
  validate(tokenSchema),
  asyncHandler(authController.verifyEmail),
);

router.post(
  '/resend-verification',
  authLimiter,
  authenticate,
  asyncHandler(authController.resendVerification),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  '/google',
  authLimiter,
  validate(googleLoginSchema),
  asyncHandler(authController.googleLogin),
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  asyncHandler(authController.refreshToken),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.getMe),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(authController.logout),
);

export default router;
