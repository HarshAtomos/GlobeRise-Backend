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

      // Get user rank
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { rank: true }
      });

      // Check 60-40 rule validity
      const rule6040 = await rankService.check6040Rule(userId);

      return ResponseHandler.success(res, 'Dashboard stats retrieved', {
        rank: user?.rank || 'NONE',
        totalEarnings,
        teamBusiness: teamStats.total,
        directBusiness,
        lastMonthBusiness,
        walletBalances: {
          deposit: wallets.deposit,
          reward: wallets.reward,
          withdrawal: wallets.withdrawal
        },
        rule6040: {
          isValid: rule6040.isValid,
          strongerLegPercent: rule6040.strongerLegPercent,
          strongerLeg: rule6040.strongerLeg,
          totalBusiness: rule6040.totalBusiness
        }
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
        return { date, amount: Number(amount) };
      });

      return ResponseHandler.success(res, 'Chart data retrieved', data);

    } catch (err) {
      next(err);
    }
  }

  /**
   * Get User Earnings Report (with date range)
   */
  async getEarningsReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
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
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group by type
      const breakdown: Record<string, { total: Decimal; count: number }> = {};
      for (const tx of transactions) {
        const type = tx.type;
        if (!breakdown[type]) {
          breakdown[type] = { total: new Decimal(0), count: 0 };
        }
        breakdown[type].total = breakdown[type].total.add(tx.amount);
        breakdown[type].count += 1;
      }

      // Daily aggregation for chart
      const dailyData: Record<string, Decimal> = {};
      for (const tx of transactions) {
        const date = tx.createdAt.toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = new Decimal(0);
        }
        dailyData[date] = dailyData[date].add(tx.amount);
      }

      const chartData = Object.entries(dailyData).map(([date, amount]) => ({
        date,
        amount: Number(amount)
      })).sort((a, b) => a.date.localeCompare(b.date));

      return ResponseHandler.success(res, 'Earnings report retrieved', {
        breakdown: Object.fromEntries(
          Object.entries(breakdown).map(([k, v]) => [k, { total: Number(v.total), count: v.count }])
        ),
        chartData,
        total: Number(transactions.reduce((sum, t) => sum.add(t.amount), new Decimal(0)))
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Get User Investment Report
   */
  async getInvestmentReport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const userId = req.user.id;

      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const investments = await prisma.investment.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        select: {
          amount: true,
          type: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group by type
      const byType: Record<string, { total: Decimal; count: number }> = {};
      for (const inv of investments) {
        const type = inv.type;
        if (!byType[type]) {
          byType[type] = { total: new Decimal(0), count: 0 };
        }
        byType[type].total = byType[type].total.add(inv.amount);
        byType[type].count += 1;
      }

      // Daily aggregation
      const dailyData: Record<string, Decimal> = {};
      for (const inv of investments) {
        const date = inv.createdAt.toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = new Decimal(0);
        }
        dailyData[date] = dailyData[date].add(inv.amount);
      }

      const chartData = Object.entries(dailyData).map(([date, amount]) => ({
        date,
        amount: Number(amount)
      })).sort((a, b) => a.date.localeCompare(b.date));

      return ResponseHandler.success(res, 'Investment report retrieved', {
        byType: Object.fromEntries(
          Object.entries(byType).map(([k, v]) => [k, { total: Number(v.total), count: v.count }])
        ),
        chartData,
        total: Number(investments.reduce((sum, i) => sum.add(i.amount), new Decimal(0)))
      });

    } catch (err) {
      next(err);
    }
  }
}

export default new DashboardController();

