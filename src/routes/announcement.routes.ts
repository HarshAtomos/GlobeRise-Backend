import { Router } from 'express';
import announcementController from '../controllers/announcement.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public/user endpoint - get active announcements
router.get('/active', announcementController.getActiveAnnouncements);

// Admin routes
router.use(authenticateJWT);
router.use(requireRole(UserRole.ADMIN));

// Get all announcements (admin)
router.get('/', announcementController.getAllAnnouncements);

// Get announcement by ID
router.get('/:id', announcementController.getAnnouncementById);

// Create announcement
router.post('/', announcementController.createAnnouncement);

// Update announcement
router.put('/:id', announcementController.updateAnnouncement);

// Delete announcement
router.delete('/:id', announcementController.deleteAnnouncement);

// Toggle active status
router.patch('/:id/toggle', announcementController.toggleActive);

export default router;

