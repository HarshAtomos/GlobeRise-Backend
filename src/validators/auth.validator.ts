import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../utils/response';

// Password validation rules
const passwordRules = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false, // Set to true if you want special characters
};

const passwordValidator = body('password')
    .isLength({ min: passwordRules.minLength })
    .withMessage(`Password must be at least ${passwordRules.minLength} characters long`)
    .custom((value) => {
        if (passwordRules.requireUppercase && !/[A-Z]/.test(value)) {
            throw new Error('Password must contain at least one uppercase letter');
        }
        if (passwordRules.requireLowercase && !/[a-z]/.test(value)) {
            throw new Error('Password must contain at least one lowercase letter');
        }
        if (passwordRules.requireNumber && !/\d/.test(value)) {
            throw new Error('Password must contain at least one number');
        }
        if (passwordRules.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
            throw new Error('Password must contain at least one special character');
        }
        return true;
    });

export const registerValidator = [
    body('email')
        .isEmail()
        // .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    passwordValidator,
    body('referralCode')
        .optional()
        .isLength({ min: 8, max: 8 })
        .withMessage('Referral code must be exactly 8 characters')
        .matches(/^[A-Z0-9]{8}$/)
        .withMessage('Referral code must be uppercase alphanumeric'),
];

export const loginValidator = [
    body('email')
        .isEmail()
        // .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

export const verifyEmailValidator = [
    body('token')
        .notEmpty()
        .withMessage('Verification token is required')
        .isLength({ min: 32, max: 128 })
        .withMessage('Invalid verification token format'),
];

// Middleware to handle validation errors
export const handleValidationErrors = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((error) => ({
            field: error.type === 'field' ? error.path : 'unknown',
            message: error.msg,
        }));

        return ResponseHandler.validationError(res, formattedErrors);
    }

    next();
};