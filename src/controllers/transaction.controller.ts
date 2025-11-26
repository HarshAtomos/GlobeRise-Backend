import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ResponseHandler } from '../utils/response';
import { TransactionType, WalletType } from '@prisma/client';

class TransactionController {
  /**
   * Get User's Transaction History
   * Supports filtering by type and pagination
   */
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      // Query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string; // ROI, COMMISSION, ROYALTY, RANK_BONUS, ALL
      const wallet = req.query.wallet as string; // FIAT, DEPOSIT, STAKING, REWARD, WITHDRAWAL

      // Build where clause
      const where: any = { userId };

      // Filter by transaction type
      if (type && type !== 'ALL') {
        const typeMap: Record<string, TransactionType[]> = {
          'ROI': [TransactionType.ROI],
          'COMMISSION': [TransactionType.COMMISSION],
          'ROYALTY': [TransactionType.ROYALTY],
          'RANK_BONUS': [TransactionType.RANK_BONUS],
          'REWARDS': [TransactionType.ROI, TransactionType.COMMISSION, TransactionType.ROYALTY, TransactionType.RANK_BONUS],
          'TRANSFER': [TransactionType.TRANSFER],
          'INVESTMENT': [TransactionType.INVESTMENT],
          'WITHDRAWAL': [TransactionType.WITHDRAWAL],
          'DEPOSIT': [TransactionType.DEPOSIT],
        };

        if (typeMap[type]) {
          where.type = { in: typeMap[type] };
        }
      }

      // Filter by wallet (source or dest)
      if (wallet && wallet !== 'ALL') {
        const walletEnum = wallet as WalletType;
        where.OR = [
          { sourceWallet: walletEnum },
          { destWallet: walletEnum }
        ];
      }

      // Get total count
      const total = await prisma.walletTransaction.count({ where });

      // Fetch transactions
      const transactions = await prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          type: true,
          status: true,
          sourceWallet: true,
          destWallet: true,
          description: true,
          referenceId: true,
          referenceType: true,
          metadata: true,
          createdAt: true,
        }
      });

      return ResponseHandler.success(res, 'Transaction history retrieved', {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Earnings Summary (Breakdown by Type)
   */
  async getEarningsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      // Aggregate earnings by type
      const earningTypes = [
        TransactionType.ROI,
        TransactionType.COMMISSION,
        TransactionType.ROYALTY,
        TransactionType.RANK_BONUS,
        TransactionType.STAKING_RETURN
      ];

      const summary: Record<string, any> = {};

      for (const type of earningTypes) {
        const agg = await prisma.walletTransaction.aggregate({
          where: {
            userId,
            type,
            destWallet: WalletType.REWARD
          },
          _sum: { amount: true },
          _count: true
        });

        summary[type] = {
          total: agg._sum.amount || 0,
          count: agg._count
        };
      }

      // Total earnings
      const totalEarnings = await prisma.walletTransaction.aggregate({
        where: {
          userId,
          type: { in: earningTypes },
          destWallet: WalletType.REWARD
        },
        _sum: { amount: true }
      });

      return ResponseHandler.success(res, 'Earnings summary retrieved', {
        breakdown: summary,
        totalEarnings: totalEarnings._sum.amount || 0
      });

    } catch (err) {
      next(err);
    }
  }
}

export default new TransactionController();

