import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../utils/response';
import { UserRole } from '../types';

// Check if user has any of the required roles
export const requireRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return ResponseHandler.unauthorized(res, 'Authentication required');
        }

        const userRole = req.user.role;

        if (!roles.includes(userRole)) {
            return ResponseHandler.forbidden(
                res,
                `Access denied. Required role(s): ${roles.join(', ')}`
            );
        }

        next();
    };
};

// Shorthand for admin-only routes
export const requireAdmin = () => {
    return requireRole(UserRole.ADMIN);
};

// Shorthand for admin or moderator routes
export const requireModeratorOrAdmin = () => {
    return requireRole(UserRole.ADMIN, UserRole.MODERATOR);
};

// Check if user is accessing their own resource
export const requireOwnerOrAdmin = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return ResponseHandler.unauthorized(res, 'Authentication required');
        }

        const targetUserId = req.params[userIdParam] || req.body[userIdParam];
        const isOwner = req.user.id === targetUserId;
        const isAdmin = req.user.role === UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
            return ResponseHandler.forbidden(res, 'You can only access your own resources');
        }

        next();
    };
};


