import prisma from '../config/database';
import { SessionResponse } from '../types';
import { Request } from 'express';

class SessionService {
    // Create a session when generating a refresh token
    async createSession(
        userId: string,
        refreshTokenId: string,
        req: Request
    ): Promise<void> {
        const ipAddress = this.getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';

        await prisma.userSession.create({
            data: {
                userId,
                refreshTokenId,
                ipAddress,
                userAgent,
            },
        });
    }

    // Update session activity
    async updateSessionActivity(refreshTokenId: string): Promise<void> {
        await prisma.userSession.updateMany({
            where: { refreshTokenId },
            data: { lastActivityAt: new Date() },
        });
    }

    // Get all active sessions for a user
    async getActiveSessions(userId: string): Promise<SessionResponse[]> {
        const sessions = await prisma.userSession.findMany({
            where: {
                userId,
                refreshToken: {
                    isRevoked: false,
                    expiresAt: { gte: new Date() },
                },
            },
            include: {
                refreshToken: true,
            },
            orderBy: { lastActivityAt: 'desc' },
        });

        return sessions.map((session) => ({
            id: session.id,
            ipAddress: session.ipAddress || undefined,
            userAgent: session.userAgent || undefined,
            lastActivityAt: session.lastActivityAt,
            createdAt: session.createdAt,
            isCurrent: false, // Will be set by controller
        }));
    }

    // Get session by refresh token ID
    async getSessionByRefreshToken(refreshTokenId: string) {
        return await prisma.userSession.findFirst({
            where: { refreshTokenId },
        });
    }

    // Revoke a specific session
    async revokeSession(sessionId: string, userId: string): Promise<void> {
        const session = await prisma.userSession.findUnique({
            where: { id: sessionId },
            include: { refreshToken: true },
        });

        if (!session || session.userId !== userId) {
            throw new Error('Session not found');
        }

        // Revoke the associated refresh token
        await prisma.refreshToken.update({
            where: { id: session.refreshTokenId },
            data: { isRevoked: true },
        });
    }

    // Clean inactive sessions (can be run as a cron job)
    async cleanInactiveSessions(): Promise<number> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await prisma.userSession.deleteMany({
            where: {
                OR: [
                    { lastActivityAt: { lt: thirtyDaysAgo } },
                    {
                        refreshToken: {
                            OR: [
                                { isRevoked: true },
                                { expiresAt: { lt: new Date() } },
                            ],
                        },
                    },
                ],
            },
        });

        return result.count;
    }

    // Get client IP address
    private getClientIp(req: Request): string {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        return req.ip || 'Unknown';
    }

    // Parse user agent for display
    parseUserAgent(userAgent: string): { browser?: string; os?: string; device?: string } {
        // Simple parsing - you could use a library like 'ua-parser-js' for more detail
        const result: { browser?: string; os?: string; device?: string } = {};

        // Browser detection
        if (userAgent.includes('Chrome')) result.browser = 'Chrome';
        else if (userAgent.includes('Firefox')) result.browser = 'Firefox';
        else if (userAgent.includes('Safari')) result.browser = 'Safari';
        else if (userAgent.includes('Edge')) result.browser = 'Edge';
        else result.browser = 'Unknown';

        // OS detection
        if (userAgent.includes('Windows')) result.os = 'Windows';
        else if (userAgent.includes('Mac')) result.os = 'macOS';
        else if (userAgent.includes('Linux')) result.os = 'Linux';
        else if (userAgent.includes('Android')) result.os = 'Android';
        else if (userAgent.includes('iOS')) result.os = 'iOS';
        else result.os = 'Unknown';

        // Device detection
        if (userAgent.includes('Mobile')) result.device = 'Mobile';
        else if (userAgent.includes('Tablet')) result.device = 'Tablet';
        else result.device = 'Desktop';

        return result;
    }
}

export default new SessionService();


