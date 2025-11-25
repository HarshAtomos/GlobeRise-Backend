import { Request, Response, NextFunction } from 'express';
import investmentService from '../services/investment.service';
import { ResponseHandler } from '../utils/response';
import prisma from '../config/database';
import { TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

class InvestmentController {
    // Create new Package (Deposit Wallet)
    async createPackage(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);
            const { amount } = req.body;

            const investment = await investmentService.createPackage(req.user.id, amount);
            return ResponseHandler.success(res, 'Package purchased successfully', investment);
        } catch (err) {
            next(err);
        }
    }

    // Create Fixed Deposit (Staking Wallet)
    async createFixedDeposit(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);
            const { amount, durationMonths } = req.body;

            const investment = await investmentService.createFixedDeposit(req.user.id, amount, durationMonths);
            return ResponseHandler.success(res, 'Fixed deposit created successfully', investment);
        } catch (err) {
            next(err);
        }
    }

    // Get Investment History
    async getHistory(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);
            const userId = req.user.id;

            const investments = await prisma.investment.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' }
            });

            // Enrich with Total ROI Paid calculation
            const history = await Promise.all(investments.map(async (inv) => {
                const roiTx = await prisma.walletTransaction.aggregate({
                    where: {
                        userId,
                        type: TransactionType.ROI,
                        referenceId: inv.id
                    },
                    _sum: { amount: true }
                });

                return {
                    ...inv,
                    totalRoiPaid: roiTx._sum.amount || new Decimal(0)
                };
            }));

            return ResponseHandler.success(res, 'Investment history retrieved', history);
        } catch (err) {
            next(err);
        }
    }
}

export default new InvestmentController();
