import prisma from '../config/database';
import rankService from './rank.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionType, WalletType, InvestmentType } from '@prisma/client';

class ReferralService {
  /**
   * Returns first-level children (max 16) with rich stats & Upline info
   * Now includes profile names for both upline and downline
   */
  async getDirectTree(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: { firstName: true, lastName: true }
        },
        referrer: {
          select: {
            id: true,
            email: true,
            rank: true,
            profile: {
              select: { firstName: true, lastName: true }
            },
            _count: { select: { referrals: true } }
          }
        }
      }
    });

    if (!user) throw new Error('User not found');

    // 1. Get Upline Info (with name)
    const upline = user.referrer ? {
      id: user.referrer.id,
      email: user.referrer.email,
      name: this.formatName(user.referrer.profile?.firstName, user.referrer.profile?.lastName, user.referrer.email),
      rank: user.referrer.rank,
      totalDownlines: user.referrer._count.referrals
    } : null;

    // 2. Get Downline (Directs) with profile
    const children = await prisma.user.findMany({
      where: { referredById: userId },
      take: 16,
      include: {
        profile: {
          select: { firstName: true, lastName: true }
        }
      },
    });

    // 3. Enrich Downline Stats
    const enriched = await Promise.all(
      children.map(async (child) => {
        // Stats
        const teamStats = await rankService.calculateTeamStats(child.id);

        // Last Month Business
        const now = new Date();
        let prevMonth = now.getMonth(); // 0-indexed, so this is "previous month" in 1-indexed context
        let prevYear = now.getFullYear();
        if (prevMonth === 0) {
          prevMonth = 12;
          prevYear = prevYear - 1;
        }
        const snapshot = await prisma.businessSnapshot.findUnique({
          where: { userId_month_year: { userId: child.id, month: prevMonth, year: prevYear } }
        });

        // Counts
        const directCount = await prisma.user.count({ where: { referredById: child.id } });
        // Recursive Team Count
        const teamCount = await this.countTeam(child.id);

        return {
          id: child.id,
          email: child.email,
          name: this.formatName(child.profile?.firstName, child.profile?.lastName, child.email),
          rank: child.rank,
          joinedAt: child.created_at,
          directCount,
          teamCount,
          totalTeamBusiness: teamStats.total,
          lastMonthBusiness: snapshot?.totalTeamBusiness || new Decimal(0)
        };
      })
    );

    return {
      myCode: user.referralCode,
      myName: this.formatName(user.profile?.firstName, user.profile?.lastName, user.email),
      upline,
      referrals: enriched,
    };
  }

  /**
   * Format display name: "FirstName LastName" or fallback to email prefix
   */
  private formatName(firstName?: string | null, lastName?: string | null, email?: string): string {
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(' ');
    }
    // Fallback: use email prefix (before @)
    if (email) {
      return email.split('@')[0];
    }
    return 'Unknown';
  }

  /**
   * Count total team members recursively (BFS)
   */
  private async countTeam(rootId: string): Promise<number> {
    const queue = [rootId];
    let count = 0;
    while (queue.length) {
      const id = queue.shift()!;
      const children = await prisma.user.findMany({ where: { referredById: id }, select: { id: true } });
      count += children.length;
      queue.push(...children.map((c) => c.id));
    }
    return count;
  }

  /**
   * Get user's rank progress information
   */
  async getRankProgress(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!user) throw new Error('User not found');

    const teamStats = await rankService.calculateTeamStats(userId);
    const rankConfigs = await prisma.rankConfig.findMany({
      orderBy: { order: 'asc' }
    });

    const currentRankIndex = rankConfigs.findIndex(r => r.name === user.rank);
    const nextRank = currentRankIndex < rankConfigs.length - 1 ? rankConfigs[currentRankIndex + 1] : null;
    const currentRankConfig = currentRankIndex >= 0 ? rankConfigs[currentRankIndex] : null;

    // Calculate progress to next rank
    let progress = 0;
    let remainingBV = 0;

    if (nextRank) {
      const currentReq = currentRankConfig?.requiredBusiness || new Decimal(0);
      const nextReq = nextRank.requiredBusiness;
      const currentBV = teamStats.total;

      // Convert Decimal to Number for calculations (handle Decimal objects properly)
      const currentBVNum = typeof currentBV === 'object' && 'toNumber' in currentBV
        ? currentBV.toNumber()
        : Number(currentBV);
      const currentReqNum = typeof currentReq === 'object' && 'toNumber' in currentReq
        ? currentReq.toNumber()
        : Number(currentReq);
      const nextReqNum = typeof nextReq === 'object' && 'toNumber' in nextReq
        ? nextReq.toNumber()
        : Number(nextReq);

      remainingBV = Math.max(0, nextReqNum - currentBVNum);

      // Calculate progress: show progress from 0 to next rank requirement (Option 2)
      // This gives a clearer picture of overall progress toward the next rank
      if (nextReqNum > 0) {
        progress = Math.min((currentBVNum / nextReqNum) * 100, 100);
      } else {
        progress = 0;
      }
    } else {
      // User is at max rank
      progress = 100;
      remainingBV = 0;
    }

    return {
      currentRank: user.rank,
      teamBusiness: teamStats.total,
      nextRank: nextRank ? {
        name: nextRank.name,
        requiredBusiness: nextRank.requiredBusiness,
        bonusAmount: nextRank.bonusAmount,
        royaltyPercent: nextRank.royaltyPercent
      } : null,
      progress,
      remainingBV,
      allRanks: rankConfigs.map(r => ({
        name: r.name,
        order: r.order,
        requiredBusiness: r.requiredBusiness,
        bonusAmount: r.bonusAmount,
        royaltyPercent: r.royaltyPercent
      }))
    };
  }

  /**
   * Get public leaderboard
   */
  async getLeaderboard(limit: number = 10, type: string = 'earnings') {
    if (type === 'earnings') {
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

      return topEarners.map((e, index) => {
        const user = earnerUsers.find(u => u.id === e.userId);
        return {
          rank: index + 1,
          userId: e.userId,
          name: this.formatName(user?.profile?.firstName, user?.profile?.lastName, user?.email),
          rankName: user?.rank || 'NONE',
          value: e._sum.amount
        };
      });
    } else if (type === 'referrals') {
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

      return topReferrers.map((u, index) => ({
        rank: index + 1,
        userId: u.id,
        name: this.formatName(u.profile?.firstName, u.profile?.lastName, u.email),
        rankName: u.rank,
        value: u._count.referrals
      }));
    } else if (type === 'investments') {
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

      return topInvestors.map((i, index) => {
        const user = investorUsers.find(u => u.id === i.userId);
        return {
          rank: index + 1,
          userId: i.userId,
          name: this.formatName(user?.profile?.firstName, user?.profile?.lastName, user?.email),
          rankName: user?.rank || 'NONE',
          value: i._sum.amount
        };
      });
    }

    return [];
  }
}

export default new ReferralService();
