import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import walletController from '../controllers/wallet.controller';

const router = Router();

router.use(authenticateJWT);

// Get my wallets
router.get('/', walletController.getWallets);

// Internal Transfer (Reward -> Deposit/Withdrawal)
router.post('/transfer', walletController.transfer);

// Admin Credit (Protected)
router.post('/admin/credit', requireAdmin(), walletController.adminCredit);

export default router;

