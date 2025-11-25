import prisma from '../config/database';
import rankService from './rank.service';
import { Decimal } from '@prisma/client/runtime/library';

class ReferralService {
  // Returns first-level children (max 16) with rich stats & Upline info
  async getDirectTree(userId: string) {
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            rank: true,
            _count: { select: { referrals: true } } // Total direct downlines
          }
        }
      }
    });
    
    if (!user) throw new Error('User not found');

    // 1. Get Upline Info
    const upline = user.referrer ? {
      id: user.referrer.id,
      email: user.referrer.email,
      rank: user.referrer.rank,
      totalDownlines: user.referrer._count.referrals
    } : null;

    // 2. Get Downline (Directs)
    const children = await prisma.user.findMany({
      where: { referredById: userId },
      take: 16,
      select: {
        id: true,
        email: true,
        rank: true,
      },
    });

    // 3. Enrich Downline Stats
    const enriched = await Promise.all(
      children.map(async (child) => {
        // Stats
        const teamStats = await rankService.calculateTeamStats(child.id);
        
        // Last Month Business
        const now = new Date();
        let prevMonth = now.getMonth() + 1 - 1;
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
          rank: child.rank,
          directCount,
          teamCount,
          totalTeamBusiness: teamStats.total,
          lastMonthBusiness: snapshot?.totalTeamBusiness || new Decimal(0)
        };
      })
    );

    return {
      myCode: user.referralCode,
      upline,
      referrals: enriched,
    };
  }

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
}

export default new ReferralService();
