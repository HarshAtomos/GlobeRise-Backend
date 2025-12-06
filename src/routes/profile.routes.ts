import { Router } from 'express';
import profileController from '../controllers/profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All profile routes require authentication
router.use(authenticateJWT);

// Get current user's profile
router.get('/me', profileController.getMyProfile);

// Update current user's profile
router.put('/me', profileController.updateMyProfile);


// Get another user's public profile
router.get('/:userId', profileController.getUserProfile);

export default router;


