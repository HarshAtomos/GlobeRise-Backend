import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import investmentController from '../controllers/investment.controller';

const router = Router();

router.use(authenticateJWT);

// Buy Package (Fiat -> Deposit)
router.post('/package', investmentController.createPackage);

// Fixed Deposit (Fiat -> Staking)
router.post('/fixed', investmentController.createFixedDeposit);

// Get History
router.get('/my', investmentController.getHistory);

export default router;
