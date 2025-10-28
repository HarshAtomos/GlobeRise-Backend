import { Response } from 'express';
import { ApiResponse } from '../types';

export class ResponseHandler {
    static success<T>(res: Response, message: string, data?: T, statusCode: number = 200) {
        const response: ApiResponse<T> = {
            success: true,
            message,
            data
        };
        return res.status(statusCode).json(response);
    }

    static error(res: Response, message: string, statusCode: number = 400, errors?: any[]) {
        const response: ApiResponse = {
            success: false,
            message,
            errors
        };
        return res.status(statusCode).json(response);
    }

    static validationError(res: Response, errors: any[]) {
        return this.error(res, 'Validation failed', 422, errors);
    }

    static badRequest(res: Response, message: string = 'Bad request') {
        return this.error(res, message, 400);
    }

    static unauthorized(res: Response, message: string = 'Unauthorized') {
        return this.error(res, message, 401);
    }

    static forbidden(res: Response, message: string = 'Forbidden') {
        return this.error(res, message, 403);
    }

    static notFound(res: Response, message: string = 'Resource not found') {
        return this.error(res, message, 404);
    }

    static serverError(res: Response, message: string = 'Internal server error') {
        return this.error(res, message, 500);
    }
}