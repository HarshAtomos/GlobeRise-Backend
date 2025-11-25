import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import reportsController from '../controllers/reports.controller';

const router = Router();

// All reports require admin access
router.use(authenticateJWT);
router.use(requireAdmin());

// Platform Summary
router.get('/summary', reportsController.getSummary);

// Investment Volume Report
router.get('/investments', reportsController.getInvestmentReport);

// User Growth Report
router.get('/users', reportsController.getUserGrowthReport);

// Commission Report
router.get('/commissions', reportsController.getCommissionReport);

// Top Performers
router.get('/top-performers', reportsController.getTopPerformers);

export default router;

