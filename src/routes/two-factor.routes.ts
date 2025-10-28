import { Router } from 'express';
import twoFactorController from '../controllers/two-factor.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { twoFactorRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Verify 2FA during login (public, but rate limited)
router.post('/verify-login', twoFactorRateLimit, twoFactorController.verifyLogin);

// All other 2FA routes require authentication
router.use(authenticateJWT);

// Setup 2FA (generate secret and QR code)
router.post('/setup', twoFactorController.setup);

// Enable 2FA (verify token and activate)
router.post('/enable', twoFactorRateLimit, twoFactorController.enable);

// Disable 2FA
router.post('/disable', twoFactorRateLimit, twoFactorController.disable);

// Regenerate backup codes
router.post('/backup-codes/regenerate', twoFactorController.regenerateBackupCodes);

export default router;


