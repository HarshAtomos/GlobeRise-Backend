import { Router } from 'express';
import passport from 'passport';
import authController from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  handleValidationErrors,
} from '../validators/auth.validator';
import {
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
} from '../middleware/rate-limit.middleware';

const router = Router();

// ==================== Email/Password Auth ====================

// Register
router.post(
  '/register',
  registerRateLimit,
  registerValidator,
  handleValidationErrors,
  authController.register
);

// Login
router.post(
  '/login',
  loginRateLimit,
  loginValidator,
  handleValidationErrors,
  authController.login
);

// Verify email
router.post(
  '/verify-email',
  emailVerificationRateLimit,
  verifyEmailValidator,
  handleValidationErrors,
  authController.verifyEmail
);

// Resend verification email
router.post(
  '/resend-verification',
  emailVerificationRateLimit,
  authController.resendVerificationEmail
);

// Forgot password
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  passwordResetRateLimit,
  authController.resetPassword
);

// ==================== Google OAuth ====================

// Initiate Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

// Google OAuth callback
router.get(
  '/google/callback',
  authController.googleCallback
);

// ==================== Protected Routes ====================

// Get current user
router.get(
  '/me',
  authenticateJWT,
  authController.getCurrentUser
);

// Refresh token
router.post(
  '/refresh',
  authController.refreshToken
);

// Logout (revoke current refresh token)
router.post(
  '/logout',
  authController.logout
);

// Logout from all devices (requires authentication)
router.post(
  '/logout-all',
  authenticateJWT,
  authController.logoutAll
);

export default router;