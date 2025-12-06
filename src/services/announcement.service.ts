import { PrismaClient, AnnouncementType } from '@prisma/client';
import prisma from '../config/database';

class AnnouncementService {
    // Create announcement (admin only)
    async createAnnouncement(
        title: string,
        content: string,
        type: AnnouncementType,
        priority: number = 0,
        expiresAt?: Date,
        createdBy?: string
    ) {
        return prisma.announcement.create({
            data: {
                title,
                content,
                type,
                priority,
                expiresAt,
                createdBy,
                active: true,
            },
        });
    }

    // Get active announcements for users
    async getActiveAnnouncements() {
        const now = new Date();

        return prisma.announcement.findMany({
            where: {
                active: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' },
            ],
        });
    }

    // Get all announcements (admin)
    async getAllAnnouncements(page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [announcements, total] = await Promise.all([
            prisma.announcement.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.announcement.count(),
        ]);

        return {
            announcements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Get announcement by ID
    async getAnnouncementById(id: string) {
        return prisma.announcement.findUnique({
            where: { id },
        });
    }

    // Update announcement
    async updateAnnouncement(
        id: string,
        data: {
            title?: string;
            content?: string;
            type?: AnnouncementType;
            priority?: number;
            active?: boolean;
            expiresAt?: Date | null;
        }
    ) {
        return prisma.announcement.update({
            where: { id },
            data,
        });
    }

    // Delete announcement
    async deleteAnnouncement(id: string) {
        return prisma.announcement.delete({
            where: { id },
        });
    }

    // Toggle active status
    async toggleActive(id: string) {
        const announcement = await prisma.announcement.findUnique({
            where: { id },
        });

        if (!announcement) {
            throw new Error('Announcement not found');
        }

        return prisma.announcement.update({
            where: { id },
            data: {
                active: !announcement.active,
            },
        });
    }
}

export default new AnnouncementService();

