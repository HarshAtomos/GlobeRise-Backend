import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import authService from '../services/auth.service';
import { ResponseHandler } from '../utils/response';
import { AuthResponse } from '../types';

class AuthController {
    // Register with email/password
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            const result = await authService.registerWithEmail(email, password);

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

            const result = await authService.verifyEmail(token);

            return ResponseHandler.success(
                res,
                'Email verified successfully',
                result
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

    // Placeholder for refresh token (future implementation)
    async refreshToken(req: Request, res: Response, next: NextFunction) {
        // TODO: Implement refresh token logic
        return ResponseHandler.error(res, 'Refresh token endpoint not implemented yet', 501);
    }
}

export default new AuthController();