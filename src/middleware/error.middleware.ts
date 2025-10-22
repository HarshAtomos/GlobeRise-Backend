import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../utils/response';

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err);

    // Prisma errors
    if (err.code === 'P2002') {
        return ResponseHandler.error(res, 'A record with this value already exists', 409);
    }

    if (err.code === 'P2025') {
        return ResponseHandler.notFound(res, 'Record not found');
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return ResponseHandler.unauthorized(res, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return ResponseHandler.unauthorized(res, 'Token expired');
    }

    // Default error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    return ResponseHandler.error(res, message, statusCode);
};

export const notFoundHandler = (req: Request, res: Response) => {
    ResponseHandler.notFound(res, `Route ${req.originalUrl} not found`);
};