import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { config } from '../config/env';
import { TwoFactorSetupResponse } from '../types';

class TwoFactorService {
    private readonly SALT_ROUNDS = 10;
    private readonly BACKUP_CODES_COUNT = 10;

    // Generate 2FA secret
    generateSecret(email: string): { secret: string; otpauth_url: string } {
        const secret = speakeasy.generateSecret({
            name: `${config.twoFactor.appName} (${email})`,
            issuer: config.twoFactor.appName,
            length: 32,
        });

        return {
            secret: secret.base32!,
            otpauth_url: secret.otpauth_url!,
        };
    }

    // Generate QR code from otpauth URL
    async generateQRCode(otpauth_url: string): Promise<string> {
        return await QRCode.toDataURL(otpauth_url);
    }

    // Generate backup codes
    async generateBackupCodes(): Promise<string[]> {
        const codes: string[] = [];

        for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
            // Generate 8-character alphanumeric code
            const code = randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }

        return codes;
    }

    // Hash backup codes for storage
    async hashBackupCodes(codes: string[]): Promise<string[]> {
        return await Promise.all(
            codes.map((code) => bcrypt.hash(code, this.SALT_ROUNDS))
        );
    }

    // Setup 2FA for a user (generate secret, QR code, and backup codes)
    async setup(userId: string, email: string): Promise<TwoFactorSetupResponse> {
        // Check if 2FA already exists
        const existing = await prisma.twoFactorAuth.findUnique({
            where: { userId },
        });

        if (existing && existing.isEnabled) {
            throw new Error('2FA is already enabled. Please disable it first to reset.');
        }

        // Generate secret and QR code
        const { secret, otpauth_url } = this.generateSecret(email);
        const qrCode = await this.generateQRCode(otpauth_url);

        // Generate backup codes
        const backupCodes = await this.generateBackupCodes();
        const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

        // Store in database (not enabled yet)
        if (existing) {
            await prisma.twoFactorAuth.update({
                where: { userId },
                data: {
                    secret,
                    backupCodes: hashedBackupCodes,
                    isEnabled: false,
                },
            });
        } else {
            await prisma.twoFactorAuth.create({
                data: {
                    userId,
                    secret,
                    backupCodes: hashedBackupCodes,
                    isEnabled: false,
                },
            });
        }

        return {
            secret,
            qrCode,
            backupCodes, // Return plain codes to user (only time they'll see them)
        };
    }

    // Verify TOTP token
    verifyToken(secret: string, token: string): boolean {
        return speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2, // Allow 2 steps before/after for time drift
        });
    }

    // Enable 2FA after verifying a token
    async enable(userId: string, token: string): Promise<void> {
        const twoFactor = await prisma.twoFactorAuth.findUnique({
            where: { userId },
        });

        if (!twoFactor) {
            throw new Error('2FA not set up. Please set up 2FA first.');
        }

        if (twoFactor.isEnabled) {
            throw new Error('2FA is already enabled');
        }

        // Verify token
        const isValid = this.verifyToken(twoFactor.secret, token);
        if (!isValid) {
            throw new Error('Invalid 2FA token');
        }

        // Enable 2FA
        await prisma.twoFactorAuth.update({
            where: { userId },
            data: { isEnabled: true },
        });

        // Update user record
        await prisma.user.update({
            where: { id: userId },
            data: { two_factor_enabled: true },
        });
    }

    // Disable 2FA
    async disable(userId: string, password: string, token: string): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { twoFactorAuth: true },
        });

        if (!user || !user.password_hash) {
            throw new Error('User not found');
        }

        if (!user.two_factor_enabled || !user.twoFactorAuth) {
            throw new Error('2FA is not enabled');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }

        // Verify 2FA token
        const isTokenValid = this.verifyToken(user.twoFactorAuth.secret, token);
        if (!isTokenValid) {
            throw new Error('Invalid 2FA token');
        }

        // Disable 2FA
        await prisma.twoFactorAuth.update({
            where: { userId },
            data: { isEnabled: false },
        });

        await prisma.user.update({
            where: { id: userId },
            data: { two_factor_enabled: false },
        });
    }

    // Verify 2FA code during login (token or backup code)
    async verifyLogin(userId: string, code: string): Promise<boolean> {
        const twoFactor = await prisma.twoFactorAuth.findUnique({
            where: { userId },
        });

        if (!twoFactor || !twoFactor.isEnabled) {
            throw new Error('2FA is not enabled for this user');
        }

        // Try TOTP token first
        const isTokenValid = this.verifyToken(twoFactor.secret, code);
        if (isTokenValid) {
            return true;
        }

        // Try backup codes
        for (const hashedCode of twoFactor.backupCodes) {
            const isBackupCodeValid = await bcrypt.compare(code, hashedCode);
            if (isBackupCodeValid) {
                // Remove used backup code
                const updatedCodes = twoFactor.backupCodes.filter((c) => c !== hashedCode);
                await prisma.twoFactorAuth.update({
                    where: { userId },
                    data: { backupCodes: updatedCodes },
                });
                return true;
            }
        }

        return false;
    }

    // Generate new backup codes
    async regenerateBackupCodes(userId: string): Promise<string[]> {
        const twoFactor = await prisma.twoFactorAuth.findUnique({
            where: { userId },
        });

        if (!twoFactor || !twoFactor.isEnabled) {
            throw new Error('2FA is not enabled');
        }

        // Generate new backup codes
        const backupCodes = await this.generateBackupCodes();
        const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

        // Update in database
        await prisma.twoFactorAuth.update({
            where: { userId },
            data: { backupCodes: hashedBackupCodes },
        });

        return backupCodes;
    }
}

export default new TwoFactorService();