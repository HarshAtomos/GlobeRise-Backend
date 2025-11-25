import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import configController from '../controllers/config.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireAdmin());

// Plan Config
router.get('/plan', configController.getPlanConfig);
router.put('/plan', configController.updatePlanConfig);

// Ranks Config
router.get('/ranks', configController.getRanks);
router.post('/ranks', configController.upsertRank);
router.delete('/ranks/:name', configController.deleteRank);

export default router;

