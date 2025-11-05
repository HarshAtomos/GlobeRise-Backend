import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from './config/passport';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import adminRoutes from './routes/admin.routes';
import sessionRoutes from './routes/session.routes';
import twoFactorRoutes from './routes/two-factor.routes';
import referralRoutes from './routes/referral.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { config } from './config/env';

const app: Application = express();

// ==================== Security Middleware ====================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(
    cors({
        origin: config.frontendUrl,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// Rate limiting (DISABLED FOR DEVELOPMENT)
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // Limit each IP to 100 requests per windowMs
//     message: 'Too many requests from this IP, please try again later',
//     standardHeaders: true,
//     legacyHeaders: false,
// });

// app.use('/api/', limiter);

// ==================== Body Parsing ====================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== Passport Initialization ====================

app.use(passport.initialize());

// ==================== Routes ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Session routes
app.use('/api/sessions', sessionRoutes);

// Two-Factor Authentication routes
app.use('/api/2fa', twoFactorRoutes);

// Referral routes
app.use('/api/referrals', referralRoutes);

// ==================== Error Handling ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;