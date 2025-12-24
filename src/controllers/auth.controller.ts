import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import authService from '../services/auth.service';
import tokenService from '../services/token.service';
import passwordResetService from '../services/password-reset.service';
import { ResponseHandler } from '../utils/response';
import { AuthResponse } from '../types';

class AuthController {
    // Register with email/password
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password, referralCode } = req.body;
            const result = await authService.registerWithEmail(email, password, referralCode, req);

            return ResponseHandler.success(
                res,
                'Registration successful. Please check your email to verify your account.',
                result,
                201
            );
        } catch (error) {
            next(error);
        }
    }

    // Login with email/password
    async login(req: Request, res: Response, next: NextFunction) {
        passport.authenticate('local', { session: false }, (err: any, result: AuthResponse) => {
            if (err || !result) {
                return ResponseHandler.unauthorized(res, 'Invalid email or password');
            }

            return ResponseHandler.success(res, 'Login successful', result);
        })(req, res, next);
    }

    // Verify email
    async verifyEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { token } = req.body;

            const result = await authService.verifyEmail(token, req);

            return ResponseHandler.success(
                res,
                'Email verified successfully',
                result
            );
        } catch (error) {
            next(error);
        }
    }

    // Resend verification email
    async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { email } = req.body;

            if (!email) {
                return ResponseHandler.badRequest(res, 'Email is required');
            }

            await authService.resendVerificationEmail(email);

            // Always return success to prevent email enumeration
            return ResponseHandler.success(
                res,
                'If an unverified account exists with that email, a new verification email has been sent.'
            );
        } catch (error) {
            next(error);
        }
    }

    // Google OAuth callback
    googleCallback(req: Request, res: Response, next: NextFunction) {
        passport.authenticate('google', { session: false }, (err: any, result: AuthResponse) => {
            if (err || !result) {
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
            }

            // Redirect to frontend with token
            return res.redirect(
                `${process.env.FRONTEND_URL}/auth/callback?token=${result.token}`
            );
        })(req, res, next);
    }

    // Get current user (protected route example)
    async getCurrentUser(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            return ResponseHandler.success(res, 'User retrieved successfully', {
                user: authService.formatUserResponse(req.user),
            });
        } catch (error) {
            next(error);
        }
    }

    // Refresh access token using refresh token
    async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return ResponseHandler.badRequest(res, 'Refresh token is required');
            }

            // Verify refresh token
            const payload = await tokenService.verifyRefreshToken(refreshToken);

            // Get user
            const user = await authService.getUserById(payload.userId);
            if (!user) {
                return ResponseHandler.unauthorized(res, 'User not found');
            }

            // Generate new access token
            const newAccessToken = authService.generateToken(user.id, user.email);

            // Generate new refresh token (token rotation)
            const newRefreshToken = await tokenService.generateRefreshToken(user.id, user.email, req);

            // Revoke old refresh token
            await tokenService.revokeRefreshToken(payload.tokenId);

            return ResponseHandler.success(res, 'Token refreshed successfully', {
                token: newAccessToken,
                refreshToken: newRefreshToken,
            });
        } catch (error) {
            next(error);
        }
    }

    // Logout (revoke current refresh token)
    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return ResponseHandler.badRequest(res, 'Refresh token is required');
            }

            // Verify and revoke refresh token
            const payload = await tokenService.verifyRefreshToken(refreshToken);
            await tokenService.revokeRefreshToken(payload.tokenId);

            return ResponseHandler.success(res, 'Logged out successfully');
        } catch (error) {
            next(error);
        }
    }

    // Logout from all devices (revoke all refresh tokens)
    async logoutAll(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            // Revoke all user's refresh tokens
            await tokenService.revokeAllUserTokens(req.user.id);

            return ResponseHandler.success(res, 'Logged out from all devices successfully');
        } catch (error) {
            next(error);
        }
    }

    // Request password reset
    async forgotPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { email } = req.body;

            if (!email) {
                return ResponseHandler.badRequest(res, 'Email is required');
            }

            await passwordResetService.requestPasswordReset(email);

            // Always return success to prevent email enumeration
            return ResponseHandler.success(
                res,
                'If an account with that email exists, a password reset link has been sent.'
            );
        } catch (error) {
            next(error);
        }
    }

    // Reset password with token
    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                return ResponseHandler.badRequest(res, 'Token and new password are required');
            }

            await passwordResetService.resetPassword(token, password);

            return ResponseHandler.success(res, 'Password has been reset successfully. Please login with your new password.');
        } catch (error) {
            next(error);
        }
    }

    // Change password (requires authentication and current password)
    async changePassword(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res);
            }

            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return ResponseHandler.badRequest(res, 'Current password and new password are required');
            }

            await authService.changePassword(req.user.id, currentPassword, newPassword);

            return ResponseHandler.success(res, 'Password changed successfully. Please login again with your new password.');
        } catch (error) {
            next(error);
        }
    }
}

export default new AuthController();