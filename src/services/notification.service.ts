import { PrismaClient, NotificationType } from '@prisma/client';
import prisma from '../config/database';
import { Response } from 'express';

// SSE Connection Manager
class SSEConnectionManager {
    private connections: Map<string, Response[]> = new Map();

    addConnection(userId: string, res: Response): void {
        if (!this.connections.has(userId)) {
            this.connections.set(userId, []);
        }
        this.connections.get(userId)!.push(res);

        // Clean up on disconnect
        res.on('close', () => {
            this.removeConnection(userId, res);
        });
    }

    removeConnection(userId: string, res: Response): void {
        const userConnections = this.connections.get(userId);
        if (userConnections) {
            const index = userConnections.indexOf(res);
            if (index > -1) {
                userConnections.splice(index, 1);
            }
            if (userConnections.length === 0) {
                this.connections.delete(userId);
            }
        }
    }

    sendToUser(userId: string, data: any): void {
        const userConnections = this.connections.get(userId);
        if (userConnections) {
            userConnections.forEach((res) => {
                try {
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                } catch (error) {
                    console.error('Error sending SSE to user:', error);
                    this.removeConnection(userId, res);
                }
            });
        }
    }

    sendHeartbeat(userId: string): void {
        const userConnections = this.connections.get(userId);
        if (userConnections) {
            userConnections.forEach((res) => {
                try {
                    res.write(': heartbeat\n\n');
                } catch (error) {
                    this.removeConnection(userId, res);
                }
            });
        }
    }

    getAllUserIds(): string[] {
        return Array.from(this.connections.keys());
    }
}

const sseManager = new SSEConnectionManager();

class NotificationService {
    // Create a notification and push via SSE if user is connected
    async createNotification(
        userId: string,
        type: NotificationType,
        title: string,
        message: string,
        metadata?: any
    ) {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                metadata: metadata || {},
            },
        });

        // Push to SSE if user is connected
        sseManager.sendToUser(userId, {
            type: 'notification',
            data: notification,
        });

        return notification;
    }

    // Get user notifications with pagination
    async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.notification.count({
                where: { userId },
            }),
        ]);

        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // Get unread count
    async getUnreadCount(userId: string): Promise<number> {
        return prisma.notification.count({
            where: {
                userId,
                read: false,
            },
        });
    }

    // Mark notification as read
    async markAsRead(userId: string, notificationId: string) {
        return prisma.notification.updateMany({
            where: {
                id: notificationId,
                userId, // Ensure user owns the notification
            },
            data: {
                read: true,
            },
        });
    }

    // Mark all as read
    async markAllAsRead(userId: string) {
        return prisma.notification.updateMany({
            where: {
                userId,
                read: false,
            },
            data: {
                read: true,
            },
        });
    }

    // SSE Connection methods
    setupSSEConnection(userId: string, res: Response): void {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

        // Add connection
        sseManager.addConnection(userId, res);

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
            sseManager.sendHeartbeat(userId);
        }, 30000);

        // Clean up on disconnect
        res.on('close', () => {
            clearInterval(heartbeatInterval);
            sseManager.removeConnection(userId, res);
        });
    }

    // Auto-generate notifications for various events
    async notifyROICredit(userId: string, amount: number, investmentId: string) {
        return this.createNotification(
            userId,
            NotificationType.ROI_CREDIT,
            'ROI Credit Received',
            `You received $${amount.toFixed(2)} ROI credit.`,
            { amount, investmentId }
        );
    }

    async notifyCommission(userId: string, amount: number, type: string, sourceUserId?: string) {
        return this.createNotification(
            userId,
            NotificationType.COMMISSION,
            'Commission Received',
            `You received $${amount.toFixed(2)} ${type} commission.`,
            { amount, type, sourceUserId }
        );
    }

    async notifyRankPromotion(userId: string, newRank: string) {
        return this.createNotification(
            userId,
            NotificationType.RANK_PROMOTION,
            'Rank Promotion!',
            `Congratulations! You've been promoted to ${newRank} rank.`,
            { newRank }
        );
    }

    async notifyWithdrawalApproved(userId: string, amount: number, withdrawalId: string) {
        return this.createNotification(
            userId,
            NotificationType.WITHDRAWAL_APPROVED,
            'Withdrawal Approved',
            `Your withdrawal of $${amount.toFixed(2)} has been approved.`,
            { amount, withdrawalId }
        );
    }

    async notifyWithdrawalRejected(userId: string, amount: number, withdrawalId: string, reason?: string) {
        return this.createNotification(
            userId,
            NotificationType.WITHDRAWAL_REJECTED,
            'Withdrawal Rejected',
            `Your withdrawal of $${amount.toFixed(2)} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
            { amount, withdrawalId, reason }
        );
    }
}

export default new NotificationService();
export { sseManager };

