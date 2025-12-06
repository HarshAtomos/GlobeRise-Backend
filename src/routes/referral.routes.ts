import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import ReferralController from '../controllers/referral.controller';

const router = Router();

router.get('/tree', authenticateJWT, ReferralController.getTree);
router.get('/rank-progress', authenticateJWT, ReferralController.getRankProgress);
router.get('/leaderboard', ReferralController.getLeaderboard); // Public endpoint

export default router;


