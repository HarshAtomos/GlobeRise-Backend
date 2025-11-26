import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import passport from './config/passport';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import adminRoutes from './routes/admin.routes';
import sessionRoutes from './routes/session.routes';
import twoFactorRoutes from './routes/two-factor.routes';
import referralRoutes from './routes/referral.routes';
import walletRoutes from './routes/wallet.routes';
import investmentRoutes from './routes/investment.routes';
import withdrawalRoutes from './routes/withdrawal.routes';
import configRoutes from './routes/config.routes';
import dashboardRoutes from './routes/dashboard.routes';
import transactionRoutes from './routes/transaction.routes';
import reportsRoutes from './routes/reports.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { config } from './config/env';
import roiService from './services/roi.service';
import rankService from './services/rank.service';
import royaltyService from './services/royalty.service';

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

// Wallet routes
app.use('/api/wallets', walletRoutes);

// Investment routes
app.use('/api/investments', investmentRoutes);

// Withdrawal routes
app.use('/api/withdrawals', withdrawalRoutes);

// Config routes
app.use('/api/config', configRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Transaction routes
app.use('/api/transactions', transactionRoutes);

// Reports routes (Admin)
app.use('/api/admin/reports', reportsRoutes);

// ==================== Scheduled Jobs ====================

// 1. Run ROI Engine daily at 00:00 UTC
cron.schedule('0 0 * * *', async () => {
    console.log('Running Daily ROI Engine...');
    try {
        const result = await roiService.processDailyRoi();
        console.log(`ROI Engine Completed. Processed: ${result.processed}, Total Payout: ${result.totalAmount}`);
    } catch (error) {
        console.error('ROI Engine Failed:', error);
    }
});

// 2. Run Rank Check daily at 01:00 UTC
cron.schedule('0 1 * * *', async () => {
    console.log('Running Daily Rank Engine...');
    try {
        await rankService.runDailyRankCheck();
        console.log('Rank Engine Completed.');
    } catch (error) {
        console.error('Rank Engine Failed:', error);
    }
});

// 3. Run Royalty Engine Monthly (1st day of month at 02:00 UTC)
cron.schedule('0 2 1 * *', async () => {
    console.log('Running Monthly Royalty Engine...');
    try {
        await royaltyService.distributeRoyalty();
        console.log('Royalty Engine Completed.');
    } catch (error) {
        console.error('Royalty Engine Failed:', error);
    }
});

// ==================== Error Handling ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
