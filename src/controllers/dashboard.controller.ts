import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ResponseHandler } from '../utils/response';
import { WalletType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import rankService from '../services/rank.service';
import walletService from '../services/wallet.service';

class DashboardController {
  /**
   * Get Dashboard Statistics (Live)
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      // 1. Wallet Balances
      const wallets = await walletService.getWallets(userId);

      // 2. Team Business (Live Recursive Calc)
      // Optimization: rankService.calculateTeamStats is heavy. 
      // For a dashboard that loads often, we might want to rely on the "last check" snapshot or cache.
      // However, requirements said "Live".
      const teamStats = await rankService.calculateTeamStats(userId);

      // 3. Direct Business
      // Sum of active packages of direct referrals
      const directs = await prisma.user.findMany({
        where: { referredById: userId },
        select: { id: true }
      });
      
      let directBusiness = new Decimal(0);
      // We need to sum their active packages. 
      // Ideally, we can do a single aggregate query if we fetch direct IDs first.
      if (directs.length > 0) {
        const directIds = directs.map(d => d.id);
        const directAgg = await prisma.investment.aggregate({
          where: {
            userId: { in: directIds },
            type: 'PACKAGE',
            status: 'ACTIVE'
          },
          _sum: { amount: true }
        });
        directBusiness = directAgg._sum.amount || new Decimal(0);
      }

      // 4. Total Earnings
      // Sum of all REWARD wallet credits (ROI, Commission, Royalty, Bonus)
      const earningAgg = await prisma.walletTransaction.aggregate({
        where: {
          userId,
          destWallet: WalletType.REWARD,
          type: { in: [TransactionType.ROI, TransactionType.COMMISSION, TransactionType.ROYALTY, TransactionType.RANK_BONUS] }
        },
        _sum: { amount: true }
      });
      const totalEarnings = earningAgg._sum.amount || new Decimal(0);

      // 5. Last Month Business (for Royalty tracking)
      // Get snapshot for (Current Month - 1)
      const now = new Date();
      let prevMonth = now.getMonth() + 1 - 1; // 1-12
      let prevYear = now.getFullYear();
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = prevYear - 1;
      }

      const snapshot = await prisma.businessSnapshot.findUnique({
        where: {
          userId_month_year: { userId, month: prevMonth, year: prevYear }
        }
      });
      const lastMonthBusiness = snapshot?.totalTeamBusiness || new Decimal(0);

      return ResponseHandler.success(res, 'Dashboard stats retrieved', {
        rank: req.user.rank,
        totalEarnings,
        teamBusiness: teamStats.total,
        directBusiness,
        lastMonthBusiness,
        walletBalances: wallets
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Earnings Chart Data (Last 7 Days)
   */
  async getChartData(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      // Generate last 7 dates
      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
      }

      // Fetch transactions for last 7 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      const transactions = await prisma.walletTransaction.findMany({
        where: {
          userId,
          destWallet: WalletType.REWARD,
          createdAt: { gte: startDate },
          type: { in: [TransactionType.ROI, TransactionType.COMMISSION, TransactionType.ROYALTY, TransactionType.RANK_BONUS] }
        },
        select: {
          amount: true,
          createdAt: true,
          type: true
        }
      });

      // Aggregate by Date
      const data = dates.map(date => {
        const dayTx = transactions.filter(t => t.createdAt.toISOString().startsWith(date));
        const amount = dayTx.reduce((sum, t) => sum.add(t.amount), new Decimal(0));
        return { date, amount };
      });

      return ResponseHandler.success(res, 'Chart data retrieved', data);

    } catch (err) {
      next(err);
    }
  }
}

export default new DashboardController();

