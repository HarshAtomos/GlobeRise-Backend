import { Request, Response, NextFunction } from 'express';
import twoFactorService from '../services/two-factor.service';
import authService from '../services/auth.service';
import tokenService from '../services/token.service';
import { ResponseHandler } from '../utils/response';

class TwoFactorController {
    // Setup 2FA (generate secret and QR code)
    async setup(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const result = await twoFactorService.setup(req.user.id, req.user.email);

            return ResponseHandler.success(
                res,
                '2FA setup initiated. Scan the QR code with your authenticator app and verify with a code to enable.',
                result
            );
        } catch (error) {
            next(error);
        }
    }

    // Enable 2FA after verifying a token
    async enable(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const { token } = req.body;

            if (!token) {
                return ResponseHandler.badRequest(res, '2FA token is required');
            }

            await twoFactorService.enable(req.user.id, token);

            return ResponseHandler.success(res, '2FA has been enabled successfully');
        } catch (error) {
            next(error);
        }
    }

    // Disable 2FA
    async disable(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const { password, token } = req.body;

            if (!password || !token) {
                return ResponseHandler.badRequest(res, 'Password and 2FA token are required');
            }

            await twoFactorService.disable(req.user.id, password, token);

            return ResponseHandler.success(res, '2FA has been disabled');
        } catch (error) {
            next(error);
        }
    }

    // Verify 2FA code during login
    async verifyLogin(req: Request, res: Response, next: NextFunction) {
        try {
            const { tempToken, code } = req.body;

            if (!tempToken || !code) {
                return ResponseHandler.badRequest(res, 'Temporary token and 2FA code are required');
            }

            // Verify temp token
            const payload = authService.verifyToken(tempToken);

            // Verify 2FA code
            const isValid = await twoFactorService.verifyLogin(payload.userId, code);

            if (!isValid) {
                return ResponseHandler.unauthorized(res, 'Invalid 2FA code');
            }

            // Get user
            const user = await authService.getUserById(payload.userId);
            if (!user) {
                return ResponseHandler.unauthorized(res, 'User not found');
            }

            // Generate regular tokens
            const token = authService.generateToken(user.id, user.email);
            const refreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);

            return ResponseHandler.success(res, '2FA verification successful', {
                user: authService.formatUserResponse(user),
                token,
                refreshToken,
            });
        } catch (error) {
            next(error);
        }
    }

    // Regenerate backup codes
    async regenerateBackupCodes(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const backupCodes = await twoFactorService.regenerateBackupCodes(req.user.id);

            return ResponseHandler.success(
                res,
                'New backup codes generated. Please store them securely.',
                { backupCodes }
            );
        } catch (error) {
            next(error);
        }
    }
}

export default new TwoFactorController();


