import { Router } from 'express';
import supportController from '../controllers/support.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public endpoints
router.get('/faqs', supportController.getFAQs);

// User endpoints
router.use(authenticateJWT);

router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getMyTickets);
router.get('/tickets/:id', supportController.getTicket);
router.post('/tickets/:id/response', supportController.addResponse);
router.delete('/tickets/:id', supportController.cancelTicket);

// Admin endpoints
router.use(requireRole(UserRole.ADMIN));

router.get('/admin/tickets', supportController.getAllTickets);
router.put('/admin/tickets/:id/status', supportController.updateTicketStatus);
router.post('/admin/tickets/:id/response', supportController.addAdminResponse);

router.get('/admin/faqs', supportController.getAllFAQs);
router.post('/admin/faqs', supportController.createFAQ);
router.put('/admin/faqs/:id', supportController.updateFAQ);
router.delete('/admin/faqs/:id', supportController.deleteFAQ);

export default router;

