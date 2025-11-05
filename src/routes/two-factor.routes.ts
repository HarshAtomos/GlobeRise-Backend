import { Router } from 'express';
import twoFactorController from '../controllers/two-factor.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
// import { twoFactorRateLimit } from '../middleware/rate-limit.middleware'; // DISABLED FOR DEVELOPMENT

const router = Router();

// Verify 2FA during login (public, but rate limited)
router.post('/verify-login', /* twoFactorRateLimit, */ twoFactorController.verifyLogin); // DISABLED FOR DEVELOPMENT

// All other 2FA routes require authentication
router.use(authenticateJWT);

// Setup 2FA (generate secret and QR code)
router.post('/setup', twoFactorController.setup);

// Enable 2FA (verify token and activate)
router.post('/enable', /* twoFactorRateLimit, */ twoFactorController.enable); // DISABLED FOR DEVELOPMENT

// Disable 2FA
router.post('/disable', /* twoFactorRateLimit, */ twoFactorController.disable); // DISABLED FOR DEVELOPMENT

// Regenerate backup codes
router.post('/backup-codes/regenerate', twoFactorController.regenerateBackupCodes);

export default router;


