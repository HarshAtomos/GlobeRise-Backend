import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import transactionController from '../controllers/transaction.controller';

const router = Router();

router.use(authenticateJWT);

// Get transaction history with filters
router.get('/my', transactionController.getHistory);

// Get earnings summary (breakdown by type)
router.get('/earnings', transactionController.getEarningsSummary);

export default router;

