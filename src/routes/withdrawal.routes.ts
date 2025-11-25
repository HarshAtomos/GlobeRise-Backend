import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import withdrawalController from '../controllers/withdrawal.controller';

const router = Router();

router.use(authenticateJWT);

// Request Withdrawal
router.post('/request', withdrawalController.requestWithdrawal);

// Admin Routes
router.get('/pending', requireAdmin(), withdrawalController.getPending);
router.post('/:transactionId/approve', requireAdmin(), withdrawalController.approveWithdrawal);
router.post('/:transactionId/reject', requireAdmin(), withdrawalController.rejectWithdrawal);

export default router;

