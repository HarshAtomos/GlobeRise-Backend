import { Router, Request, Response, NextFunction } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// SSE endpoint for real-time notifications (token can be in query or header)
router.get('/stream', (req: Request, res: Response, next: NextFunction) => {
    // For SSE, we need to handle auth differently since EventSource doesn't support custom headers
    // Check for token in query param first, then fall back to header
    if (req.query.token && typeof req.query.token === 'string') {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    authenticateJWT(req, res, next);
}, notificationController.streamNotifications);

// All other routes require authentication
router.use(authenticateJWT);

// Get user notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all as read
router.post('/mark-all-read', notificationController.markAllAsRead);

export default router;

