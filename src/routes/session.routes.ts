import { Router } from 'express';
import sessionController from '../controllers/session.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All session routes require authentication
router.use(authenticateJWT);

// Get all active sessions for the current user
router.get('/', sessionController.getMySessions);

// Revoke a specific session
router.delete('/:sessionId', sessionController.revokeSession);

export default router;


