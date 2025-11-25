import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ResponseHandler } from '../utils/response';
import { TransactionType, InvestmentType, InvestmentStatus, WalletType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

class ReportsController {
  /**
   * Admin: Get Platform Summary
   * Total users, investments, withdrawals, commissions
   */
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        totalUsers,
        verifiedUsers,
        totalInvestments,
        activeInvestments,
        totalWithdrawals,
        pendingWithdrawals,
        totalCommissions,
        totalRoyalties,
        rankDistribution
      ] = await Promise.all([
        // Total Users
        prisma.user.count(),
        // Verified Users
        prisma.user.count({ where: { is_verified: true } }),
        // Total Investment Volume
        prisma.investment.aggregate({
          where: { type: InvestmentType.PACKAGE },
          _sum: { amount: true },
          _count: true
        }),
        // Active Investments
        prisma.investment.count({ where: { status: InvestmentStatus.ACTIVE } }),
        // Total Withdrawals (Completed)
        prisma.walletTransaction.aggregate({
          where: { type: TransactionType.WITHDRAWAL, status: 'COMPLETED' },
          _sum: { amount: true },
          _count: true
        }),
        // Pending Withdrawals
        prisma.walletTransaction.count({
          where: { type: TransactionType.WITHDRAWAL, status: 'PENDING' }
        }),
        // Total Commissions Paid
        prisma.walletTransaction.aggregate({
          where: { type: TransactionType.COMMISSION },
          _sum: { amount: true }
        }),
        // Total Royalties Paid
        prisma.walletTransaction.aggregate({
          where: { type: TransactionType.ROYALTY },
          _sum: { amount: true }
        }),
        // Rank Distribution
        prisma.user.groupBy({
          by: ['rank'],
          _count: true,
          orderBy: { _count: { rank: 'desc' } }
        })
      ]);

      return ResponseHandler.success(res, 'Platform summary retrieved', {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers
        },
        investments: {
          totalVolume: totalInvestments._sum.amount || new Decimal(0),
          totalCount: totalInvestments._count,
          activeCount: activeInvestments
        },
        withdrawals: {
          totalVolume: totalWithdrawals._sum.amount || new Decimal(0),
          totalCount: totalWithdrawals._count,
          pendingCount: pendingWithdrawals
        },
        commissions: {
          total: totalCommissions._sum.amount || new Decimal(0)
        },
        royalties: {
          total: totalRoyalties._sum.amount || new Decimal(0)
        },
        rankDistribution: rankDistribution.map(r => ({
          rank: r.rank,
          count: r._count
        }))
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get Investment Volume Report
   * Daily/Weekly/Monthly investment volume chart
   */
  async getInvestmentReport(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || 'daily'; // daily, weekly, monthly
      const days = parseInt(req.query.days as string) || 30;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Fetch all investments in range
      const investments = await prisma.investment.findMany({
        where: {
          type: InvestmentType.PACKAGE,
          createdAt: { gte: startDate }
        },
        select: {
          amount: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      });

      // Group by period
      const grouped: Record<string, Decimal> = {};

      for (const inv of investments) {
        let key: string;
        const date = inv.createdAt;

        if (period === 'daily') {
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'weekly') {
          // Get week number
          const weekNum = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${weekNum}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        }

        if (!grouped[key]) {
          grouped[key] = new Decimal(0);
        }
        grouped[key] = grouped[key].add(inv.amount);
      }

      // Convert to array
      const chartData = Object.entries(grouped).map(([date, volume]) => ({
        date,
        volume
      }));

      return ResponseHandler.success(res, 'Investment report retrieved', {
        period,
        days,
        data: chartData,
        total: investments.reduce((sum, inv) => sum.add(inv.amount), new Decimal(0))
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get User Growth Report
   * New users per day/week/month
   */
  async getUserGrowthReport(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Fetch all users in range
      const users = await prisma.user.findMany({
        where: {
          created_at: { gte: startDate }
        },
        select: {
          created_at: true
        },
        orderBy: { created_at: 'asc' }
      });

      // Group by day
      const grouped: Record<string, number> = {};

      for (const user of users) {
        const key = user.created_at.toISOString().split('T')[0];
        grouped[key] = (grouped[key] || 0) + 1;
      }

      // Fill in missing days with 0
      const chartData: { date: string; count: number }[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        chartData.push({
          date: key,
          count: grouped[key] || 0
        });
      }

      return ResponseHandler.success(res, 'User growth report retrieved', {
        days,
        data: chartData,
        totalNewUsers: users.length
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get Commission Report
   * Commissions paid by type
   */
  async getCommissionReport(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const commissionTypes = [
        TransactionType.COMMISSION,
        TransactionType.ROI,
        TransactionType.ROYALTY,
        TransactionType.RANK_BONUS
      ];

      const breakdown: Record<string, { total: Decimal; count: number }> = {};

      for (const type of commissionTypes) {
        const agg = await prisma.walletTransaction.aggregate({
          where: {
            type,
            destWallet: WalletType.REWARD,
            createdAt: { gte: startDate }
          },
          _sum: { amount: true },
          _count: true
        });

        breakdown[type] = {
          total: agg._sum.amount || new Decimal(0),
          count: agg._count
        };
      }

      // Daily trend for ROI (most common)
      const roiTransactions = await prisma.walletTransaction.findMany({
        where: {
          type: TransactionType.ROI,
          createdAt: { gte: startDate }
        },
        select: {
          amount: true,
          createdAt: true
        }
      });

      const dailyRoi: Record<string, Decimal> = {};
      for (const tx of roiTransactions) {
        const key = tx.createdAt.toISOString().split('T')[0];
        dailyRoi[key] = (dailyRoi[key] || new Decimal(0)).add(tx.amount);
      }

      return ResponseHandler.success(res, 'Commission report retrieved', {
        days,
        breakdown,
        dailyRoiTrend: Object.entries(dailyRoi).map(([date, amount]) => ({ date, amount }))
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get Top Performers
   * Top users by team business, earnings, referrals
   */
  async getTopPerformers(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      // Top by Total Earnings
      const topEarners = await prisma.walletTransaction.groupBy({
        by: ['userId'],
        where: {
          type: { in: [TransactionType.ROI, TransactionType.COMMISSION, TransactionType.ROYALTY, TransactionType.RANK_BONUS] },
          destWallet: WalletType.REWARD
        },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: limit
      });

      // Enrich with user details
      const earnerIds = topEarners.map(e => e.userId);
      const earnerUsers = await prisma.user.findMany({
        where: { id: { in: earnerIds } },
        select: {
          id: true,
          email: true,
          rank: true,
          profile: { select: { firstName: true, lastName: true } }
        }
      });

      const topEarnersEnriched = topEarners.map(e => {
        const user = earnerUsers.find(u => u.id === e.userId);
        return {
          userId: e.userId,
          email: user?.email || 'Unknown',
          name: user?.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : null,
          rank: user?.rank || 'NONE',
          totalEarnings: e._sum.amount
        };
      });

      // Top by Referrals
      const topReferrers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          rank: true,
          profile: { select: { firstName: true, lastName: true } },
          _count: { select: { referrals: true } }
        },
        orderBy: { referrals: { _count: 'desc' } },
        take: limit
      });

      // Top by Investment Volume
      const topInvestors = await prisma.investment.groupBy({
        by: ['userId'],
        where: { type: InvestmentType.PACKAGE },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: limit
      });

      const investorIds = topInvestors.map(i => i.userId);
      const investorUsers = await prisma.user.findMany({
        where: { id: { in: investorIds } },
        select: {
          id: true,
          email: true,
          rank: true,
          profile: { select: { firstName: true, lastName: true } }
        }
      });

      const topInvestorsEnriched = topInvestors.map(i => {
        const user = investorUsers.find(u => u.id === i.userId);
        return {
          userId: i.userId,
          email: user?.email || 'Unknown',
          name: user?.profile ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() : null,
          rank: user?.rank || 'NONE',
          totalInvested: i._sum.amount
        };
      });

      return ResponseHandler.success(res, 'Top performers retrieved', {
        topEarners: topEarnersEnriched,
        topReferrers: topReferrers.map(u => ({
          userId: u.id,
          email: u.email,
          name: u.profile ? `${u.profile.firstName || ''} ${u.profile.lastName || ''}`.trim() : null,
          rank: u.rank,
          referralCount: u._count.referrals
        })),
        topInvestors: topInvestorsEnriched
      });

    } catch (err) {
      next(err);
    }
  }

  /**
   * Helper: Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

export default new ReportsController();

