import { Router } from 'express';
import adminController from '../controllers/admin.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
// import { adminRateLimit } from '../middleware/rate-limit.middleware'; // DISABLED FOR DEVELOPMENT

const router = Router();

// All admin routes require authentication, admin role, and rate limiting
router.use(authenticateJWT);
router.use(requireAdmin());
// router.use(adminRateLimit); // DISABLED FOR DEVELOPMENT

// Get all users with pagination
router.get('/users', adminController.getAllUsers);

// Get system statistics
router.get('/stats', adminController.getStats);

// Get user by ID
router.get('/users/:userId', adminController.getUserById);

// Assign role to user
router.put('/users/:userId/role', adminController.assignRole);

// Delete user
router.delete('/users/:userId', adminController.deleteUser);

// Manual Triggers
router.post('/roi/trigger', adminController.triggerDailyRoi);
router.post('/rank/trigger', adminController.triggerRankCheck);
router.post('/royalty/trigger', adminController.triggerRoyalty);

// Debug blockchain info
router.get('/debug/chain-user/:address', adminController.getOnChainUser);

export default router;
