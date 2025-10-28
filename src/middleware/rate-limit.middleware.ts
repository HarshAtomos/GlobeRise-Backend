import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Rate limiter for login attempts (5 attempts per 15 minutes per IP)
export const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req: Request) => {
        // Use IP address as key
        return req.ip || 'unknown';
    },
});

// Rate limiter for registration (3 registrations per hour per IP)
export const registerRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        success: false,
        message: 'Too many accounts created from this IP. Please try again in an hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || 'unknown';
    },
});

// Rate limiter for password reset requests (3 requests per hour per IP)
export const passwordResetRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        success: false,
        message: 'Too many password reset requests. Please try again in an hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || 'unknown';
    },
});

// Rate limiter for email verification resend (3 requests per hour per IP)
export const emailVerificationRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        success: false,
        message: 'Too many verification email requests. Please try again in an hour.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || 'unknown';
    },
});

// General API rate limiter (100 requests per 15 minutes per user/IP)
export const apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        message: 'Too many requests. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return (req.user as any)?.id || req.ip || 'unknown';
    },
});

// Strict rate limiter for 2FA operations (10 attempts per 15 minutes)
export const twoFactorRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many 2FA verification attempts. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        return (req.user as any)?.id || req.ip || 'unknown';
    },
});

// Admin operations rate limiter (stricter for sensitive operations)
export const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Fewer requests for admin operations
    message: {
        success: false,
        message: 'Too many admin requests. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return (req.user as any)?.id || req.ip || 'unknown';
    },
});


