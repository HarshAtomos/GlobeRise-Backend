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

const router = Router();

// ==================== Email/Password Auth ====================

// Register
router.post(
  '/register',
  registerValidator,
  handleValidationErrors,
  authController.register
);

// Login
router.post(
  '/login',
  loginValidator,
  handleValidationErrors,
  authController.login
);

// Verify email
router.post(
  '/verify-email',
  verifyEmailValidator,
  handleValidationErrors,
  authController.verifyEmail
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

// Refresh token (placeholder for future implementation)
router.post(
  '/refresh',
  authController.refreshToken
);

export default router;