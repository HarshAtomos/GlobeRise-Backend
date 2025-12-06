import { Request, Response } from 'express';
import notificationService from '../services/notification.service';
import { ResponseHandler } from '../utils/response';

class NotificationController {
    // SSE endpoint for real-time notifications
    async streamNotifications(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            notificationService.setupSSEConnection(userId, res);
        } catch (error: any) {
            console.error('Error setting up SSE connection:', error);
            res.status(500).json({ error: 'Failed to establish connection' });
        }
    }

    // Get user notifications
    async getNotifications(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await notificationService.getUserNotifications(userId, page, limit);
            return ResponseHandler.success(res, 'Notifications retrieved successfully', result);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch notifications', 500);
        }
    }

    // Get unread count
    async getUnreadCount(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const count = await notificationService.getUnreadCount(userId);
            return ResponseHandler.success(res, 'Unread count retrieved successfully', { count });
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch unread count', 500);
        }
    }

    // Mark notification as read
    async markAsRead(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;

            await notificationService.markAsRead(userId, id);
            return ResponseHandler.success(res, 'Notification marked as read');
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to mark notification as read', 500);
        }
    }

    // Mark all as read
    async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            await notificationService.markAllAsRead(userId);
            return ResponseHandler.success(res, 'All notifications marked as read');
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to mark all as read', 500);
        }
    }
}

export default new NotificationController();

