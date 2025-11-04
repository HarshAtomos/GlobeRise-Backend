import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import ReferralController from '../controllers/referral.controller';

const router = Router();

router.get('/tree', authenticateJWT, ReferralController.getTree);

export default router;


