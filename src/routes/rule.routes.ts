import { Router } from 'express';
import ruleController from '../controllers/rule.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public/user endpoints
router.get('/', ruleController.getActiveRules);
router.get('/:id', ruleController.getRuleById);

// Admin endpoints
router.use(authenticateJWT);
router.use(requireRole(UserRole.ADMIN));

router.get('/admin/all', ruleController.getAllRules);
router.post('/', ruleController.createRule);
router.put('/:id', ruleController.updateRule);
router.delete('/:id', ruleController.deleteRule);

export default router;

