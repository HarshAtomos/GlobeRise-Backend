import { Router } from 'express';
import rateController from '../controllers/rate.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public endpoint for live rates
router.get('/live', rateController.getLiveRates);

// Admin endpoint to manually update rates
router.post('/update', authenticateJWT, requireRole(UserRole.ADMIN), rateController.updateRates);

export default router;

