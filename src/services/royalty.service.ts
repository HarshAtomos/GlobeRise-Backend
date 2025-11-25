import prisma from '../config/database';
import { TransactionType, WalletType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';
import rankService from './rank.service';

class RoyaltyService {
  /**
   * Calculate Company Total Turnover (C.T.O) for current month
   */
  async calculateCTO(): Promise<Decimal> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const aggregate = await prisma.investment.aggregate({
      where: {
        type: 'PACKAGE',
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        amount: true
      }
    });

    return aggregate._sum.amount || new Decimal(0);
  }

  /**
   * Distribute Monthly Royalty
   */
  async distributeRoyalty(): Promise<void> {
    const cto = await this.calculateCTO();
    if (cto.lte(0)) return;

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    // Previous Month Logic (Handle Jan rollback)
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    // 1. Fetch Configured Ranks
    const rankConfigs = await prisma.rankConfig.findMany({
      where: { royaltyPercent: { gt: 0 } },
      orderBy: { order: 'asc' }
    });

    // Iterate through each Configured Rank
    for (const rankConfig of rankConfigs) {
      const rankName = rankConfig.name;
      const royaltyPercent = rankConfig.royaltyPercent;

      // 1. Calculate Pool for this Rank
      const share = royaltyPercent.div(100);
      const poolAmount = cto.mul(share);

      // 2. Find Qualifiers
      const rankedUsers = await prisma.user.findMany({
        where: { rank: rankName },
        select: { id: true }
      });

      const qualifiers: string[] = [];

      for (const user of rankedUsers) {
        // Check Growth Rule
        const currentStats = await rankService.calculateTeamStats(user.id);
        
        // Get Previous Month Snapshot
        const snapshot = await prisma.businessSnapshot.findUnique({
          where: {
            userId_month_year: {
              userId: user.id,
              month: prevMonth,
              year: prevYear
            }
          }
        });

        let target = new Decimal(0);
        if (snapshot) {
          // Target = Previous + 10%
          target = snapshot.totalTeamBusiness.mul(1.10);
        } 

        if (currentStats.total.gte(target)) {
          qualifiers.push(user.id);
        }

        // Create Snapshot for NEXT month
        await prisma.businessSnapshot.upsert({
          where: {
            userId_month_year: {
              userId: user.id,
              month: currentMonth,
              year: currentYear
            }
          },
          create: {
            userId: user.id,
            month: currentMonth,
            year: currentYear,
            totalTeamBusiness: currentStats.total
          },
          update: {
            totalTeamBusiness: currentStats.total
          }
        });
      }

      if (qualifiers.length === 0) continue;

      // 3. Distribute Pool
      const payoutPerUser = poolAmount.div(qualifiers.length);

      for (const userId of qualifiers) {
        await walletService.creditWallet(
          userId,
          WalletType.REWARD,
          payoutPerUser,
          TransactionType.ROYALTY,
          `Royalty Income for ${rankName} (CTO Share)`,
          undefined,
          'SYSTEM',
          { 
            cto: cto.toString(), 
            rank: rankName, 
            poolShare: royaltyPercent.toString(), 
            totalQualifiers: qualifiers.length 
          }
        );
      }
    }
  }
}

export default new RoyaltyService();
