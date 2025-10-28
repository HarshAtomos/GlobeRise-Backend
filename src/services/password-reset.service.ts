import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { config } from '../config/env';
import emailService from './email.service';
import bcrypt from 'bcrypt';

class PasswordResetService {
    private readonly SALT_ROUNDS = 10;

    // Request password reset - generate token and send email
    async requestPasswordReset(email: string): Promise<void> {
        // Find user by email
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Don't reveal if user exists or not for security
            return;
        }

        // Generate reset token
        const resetToken = randomBytes(32).toString('hex');

        // Calculate expiry time
        const expiresAt = this.calculateExpiry(config.passwordReset.expiresIn);

        // Store reset token in database
        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                token: resetToken,
                expiresAt,
            },
        });

        // Also update user table for quick lookup
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password_reset_token: resetToken,
                password_reset_expires: expiresAt,
            },
        });

        // Send password reset email
        await emailService.sendPasswordResetEmail(email, resetToken);
    }

    // Verify reset token
    async verifyResetToken(token: string): Promise<{ userId: string; email: string }> {
        const user = await prisma.user.findUnique({
            where: { password_reset_token: token },
        });

        if (!user || !user.password_reset_expires) {
            throw new Error('Invalid or expired reset token');
        }

        // Check if token is expired
        if (user.password_reset_expires < new Date()) {
            throw new Error('Reset token has expired');
        }

        // Check if token was already used
        const resetRecord = await prisma.passwordReset.findUnique({
            where: { token },
        });

        if (resetRecord?.used) {
            throw new Error('Reset token has already been used');
        }

        return {
            userId: user.id,
            email: user.email,
        };
    }

    // Reset password with token
    async resetPassword(token: string, newPassword: string): Promise<void> {
        // Verify token
        const { userId } = await this.verifyResetToken(token);

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        // Update password and clear reset token
        await prisma.user.update({
            where: { id: userId },
            data: {
                password_hash: passwordHash,
                password_reset_token: null,
                password_reset_expires: null,
            },
        });

        // Mark token as used
        await prisma.passwordReset.updateMany({
            where: { token, used: false },
            data: { used: true },
        });

        // Revoke all refresh tokens for security (force re-login)
        await prisma.refreshToken.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });
    }

    // Clean expired reset tokens (can be run as a cron job)
    async cleanExpiredTokens(): Promise<number> {
        const result = await prisma.passwordReset.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { used: true, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Used tokens older than 7 days
                ],
            },
        });

        return result.count;
    }

    // Parse expiry string to Date (e.g., "1h" -> Date 1 hour from now)
    private calculateExpiry(expiry: string): Date {
        const match = expiry.match(/^(\d+)([dhms])$/);
        if (!match) {
            // Default to 1 hour if invalid format
            return new Date(Date.now() + 60 * 60 * 1000);
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        let milliseconds = 0;
        switch (unit) {
            case 'd':
                milliseconds = value * 24 * 60 * 60 * 1000;
                break;
            case 'h':
                milliseconds = value * 60 * 60 * 1000;
                break;
            case 'm':
                milliseconds = value * 60 * 1000;
                break;
            case 's':
                milliseconds = value * 1000;
                break;
        }

        return new Date(Date.now() + milliseconds);
    }
}

export default new PasswordResetService();


