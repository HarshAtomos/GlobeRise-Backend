import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { config } from '../config/env';
import { RefreshTokenPayload } from '../types';
import { Request } from 'express';
import sessionService from './session.service';

class TokenService {
    // Generate a refresh token
    async generateRefreshToken(userId: string, email: string, req?: Request): Promise<string> {
        // Generate a random token string
        const tokenString = randomBytes(64).toString('hex');

        // Calculate expiry date (30 days from now)
        const expiresAt = new Date();
        const expiryDays = this.parseExpiryToDays(config.jwt.refreshExpiresIn);
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        // Store token in database
        const refreshToken = await prisma.refreshToken.create({
            data: {
                token: tokenString,
                userId,
                expiresAt,
            },
        });

        // Create session if request object is provided
        if (req) {
            await sessionService.createSession(userId, refreshToken.id, req);
        }

        // Create JWT payload with tokenId for rotation
        const payload: RefreshTokenPayload = {
            userId,
            tokenId: refreshToken.id,
            email,
        };

        // Sign and return JWT
        return jwt.sign(payload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshExpiresIn as string,
        } as jwt.SignOptions);
    }

    // Verify and rotate refresh token
    async verifyRefreshToken(token: string): Promise<{ userId: string; email: string; tokenId: string }> {
        try {
            // Verify JWT
            const payload = jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;

            // Check if token exists in database and is not revoked
            const refreshToken = await prisma.refreshToken.findUnique({
                where: { id: payload.tokenId },
            });

            if (!refreshToken || refreshToken.isRevoked) {
                throw new Error('Invalid or revoked refresh token');
            }

            // Check if token is expired
            if (refreshToken.expiresAt < new Date()) {
                throw new Error('Refresh token expired');
            }

            // Update last used timestamp
            await prisma.refreshToken.update({
                where: { id: refreshToken.id },
                data: { lastUsedAt: new Date() },
            });

            return {
                userId: payload.userId,
                email: payload.email,
                tokenId: payload.tokenId,
            };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    // Revoke a specific refresh token
    async revokeRefreshToken(tokenId: string): Promise<void> {
        await prisma.refreshToken.update({
            where: { id: tokenId },
            data: { isRevoked: true },
        });
    }

    // Revoke all refresh tokens for a user (logout all devices)
    async revokeAllUserTokens(userId: string): Promise<void> {
        await prisma.refreshToken.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });
    }

    // Clean expired tokens (can be run as a cron job)
    async cleanExpiredTokens(): Promise<number> {
        const result = await prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { isRevoked: true, lastUsedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Revoked for 30+ days
                ],
            },
        });

        return result.count;
    }

    // Parse expiry string to days (e.g., "30d" -> 30, "1h" -> 0.04)
    private parseExpiryToDays(expiry: string): number {
        const match = expiry.match(/^(\d+)([dhms])$/);
        if (!match) return 30; // default to 30 days

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'd':
                return value;
            case 'h':
                return value / 24;
            case 'm':
                return value / (24 * 60);
            case 's':
                return value / (24 * 60 * 60);
            default:
                return 30;
        }
    }
}

export default new TokenService();

