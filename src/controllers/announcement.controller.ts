import { Request, Response } from 'express';
import announcementService from '../services/announcement.service';
import { ResponseHandler } from '../utils/response';
import { AnnouncementType } from '@prisma/client';

class AnnouncementController {
    // Get active announcements (public/user endpoint)
    async getActiveAnnouncements(req: Request, res: Response) {
        try {
            const announcements = await announcementService.getActiveAnnouncements();
            return ResponseHandler.success(res, 'Announcements retrieved successfully', announcements);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch announcements', 500);
        }
    }

    // Get all announcements (admin)
    async getAllAnnouncements(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;

            const result = await announcementService.getAllAnnouncements(page, limit);
            return ResponseHandler.success(res, 'Announcements retrieved successfully', result);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch announcements', 500);
        }
    }

    // Get announcement by ID
    async getAnnouncementById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const announcement = await announcementService.getAnnouncementById(id);

            if (!announcement) {
                return ResponseHandler.error(res, 'Announcement not found', 404);
            }

            return ResponseHandler.success(res, 'Announcement retrieved successfully', announcement);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch announcement', 500);
        }
    }

    // Create announcement (admin)
    async createAnnouncement(req: Request, res: Response) {
        try {
            const { title, content, type, priority, expiresAt } = req.body;
            const userId = req.user?.id;

            if (!title || !content || !type) {
                return ResponseHandler.error(res, 'Missing required fields', 400);
            }
            // userId is optional for announcements (can be null)

            const announcement = await announcementService.createAnnouncement(
                title,
                content,
                type as AnnouncementType,
                priority || 0,
                expiresAt ? new Date(expiresAt) : undefined,
                userId
            );

            return ResponseHandler.success(res, 'Announcement created successfully', announcement, 201);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to create announcement', 500);
        }
    }

    // Update announcement (admin)
    async updateAnnouncement(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { title, content, type, priority, active, expiresAt } = req.body;

            const announcement = await announcementService.updateAnnouncement(id, {
                title,
                content,
                type: type as AnnouncementType,
                priority,
                active,
                expiresAt: expiresAt ? new Date(expiresAt) : expiresAt === null ? null : undefined,
            });

            return ResponseHandler.success(res, 'Announcement updated successfully', announcement);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to update announcement', 500);
        }
    }

    // Delete announcement (admin)
    async deleteAnnouncement(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await announcementService.deleteAnnouncement(id);
            return ResponseHandler.success(res, 'Announcement deleted successfully');
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to delete announcement', 500);
        }
    }

    // Toggle active status (admin)
    async toggleActive(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const announcement = await announcementService.toggleActive(id);
            return ResponseHandler.success(res, 'Announcement status updated successfully', announcement);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to toggle announcement status', 500);
        }
    }
}

export default new AnnouncementController();

