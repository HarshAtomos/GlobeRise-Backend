import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import dashboardController from '../controllers/dashboard.controller';

const router = Router();

router.use(authenticateJWT);

router.get('/stats', dashboardController.getStats);
router.get('/chart', dashboardController.getChartData);

export default router;

