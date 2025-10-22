import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { ResponseHandler } from '../utils/response';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            is_verified: boolean;
            created_at: Date;
        }
    }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('jwt', { session: false }, (err: any, user: Express.User) => {
        if (err) {
            return ResponseHandler.serverError(res, 'Authentication error');
        }

        if (!user) {
            return ResponseHandler.unauthorized(res, 'Invalid or expired token');
        }

        req.user = user;
        next();
    })(req, res, next);
};

export const requireVerified = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.is_verified) {
        return ResponseHandler.forbidden(res, 'Email verification required');
    }
    next();
};
