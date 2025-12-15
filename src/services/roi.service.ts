import prisma from '../config/database';
import { InvestmentStatus, InvestmentType, WalletType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';
import commissionService from './commission.service';

class RoiService {
  /**
   * Calculate the monthly ROI rate for a user based on referral performance
   * Base: 8% monthly
   * Speed Bonus 1 (2 directs in 14 days): 10% monthly
   * Speed Bonus 2 (4 directs in 21 days): 12% monthly
   */
  async calculateMonthlyRate(userId: string, userCreatedAt: Date): Promise<Decimal> {
    // Check referral counts within time windows
    const now = new Date();
    const joinDate = new Date(userCreatedAt);
    const daysSinceJoin = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

    // 1. Check for 12% Tier (4 directs within 21 days)
    // Condition: User MUST have qualified within the window. 
    // If daysSinceJoin > 21, we check if they HAD 4 directs by day 21.
    // Simplifying: We check current directs. If they have 4 directs, and (they are still within 21 days OR they achieved it previously).
    // Since we don't track "when" a referral happened easily without querying relation creation dates, we query relations.
    
    const directs = await prisma.user.findMany({
      where: { referredById: userId },
      select: { created_at: true }
    });

    const directsWithin21Days = directs.filter(d => {
      const diff = Math.floor((d.created_at.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 21;
    }).length;

    if (directsWithin21Days >= 4) {
      return new Decimal(12).div(100); // 12% monthly
    }

    // 2. Check for 10% Tier (2 directs within 14 days)
    const directsWithin14Days = directs.filter(d => {
      const diff = Math.floor((d.created_at.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 14;
    }).length;

    if (directsWithin14Days >= 2) {
      return new Decimal(10).div(100); // 10% monthly
    }

    // 3. Default Base Rate (8%)
    return new Decimal(8).div(100); // 8% monthly
  }

  /**
   * Process Monthly ROI for ALL active packages
   * Logic:
   * - Scan Active Packages
   * - Calculate Amount (8-12% monthly)
   * - Check Cap (3x Investment)
   * - Credit Reward Wallet
   * - Trigger Level Income
   */
  async processMonthlyRoi(): Promise<{ processed: number, totalAmount: Decimal }> {
    // Fetch all active packages
    const investments = await prisma.investment.findMany({
      where: {
        type: InvestmentType.PACKAGE,
        status: InvestmentStatus.ACTIVE
      },
      include: {
        user: {
          select: { id: true, created_at: true }
        }
      }
    });

    let processedCount = 0;
    let totalPayout = new Decimal(0);

    for (const investment of investments) {
      // 1. Check if 30 days have passed since last ROI payment
      const now = new Date();
      const lastRoiDate = investment.lastRoiDate || investment.startDate;
      const daysSinceLastRoi = Math.floor((now.getTime() - lastRoiDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastRoi < 30) {
        continue; // Not yet time for monthly ROI
      }

      // 2. Determine Monthly Rate (8-12%)
      const monthlyRate = await this.calculateMonthlyRate(investment.userId, investment.user.created_at);

      // 3. Calculate ROI Amount
      const roiAmount = investment.amount.mul(monthlyRate);

      // 4. Check Cap
      // Cap is 3x Investment Amount.
      // We need to know total ROI paid so far for THIS investment.
      const aggregations = await prisma.walletTransaction.aggregate({
        where: {
          referenceId: investment.id,
          type: TransactionType.ROI
        },
        _sum: {
          amount: true
        }
      });

      const totalPaid = aggregations._sum.amount || new Decimal(0);
      const capAmount = investment.amount.mul(3);
      const remainingCap = capAmount.minus(totalPaid);

      if (remainingCap.lte(0)) {
        // Cap Reached - Mark Completed
        await prisma.investment.update({
          where: { id: investment.id },
          data: { status: InvestmentStatus.COMPLETED }
        });
        continue;
      }

      // Adjust amount if it exceeds remaining cap
      let finalAmount = roiAmount;
      if (finalAmount.gt(remainingCap)) {
        finalAmount = remainingCap;
      }

      if (finalAmount.lte(0)) continue;

      // 5. Credit Wallet
      try {
        await walletService.creditWallet(
          investment.userId,
          WalletType.REWARD,
          finalAmount,
          TransactionType.ROI,
          `Monthly ROI for Package ${investment.id}`,
          investment.id,
          'INVESTMENT',
          { type: 'MONTHLY_ROI', rate: monthlyRate.toString() }
        );

        // 6. Update Last ROI Date
        await prisma.investment.update({
          where: { id: investment.id },
          data: { lastRoiDate: new Date() }
        });

        // 7. Trigger Level Income (Percentage of this ROI amount)
        await commissionService.distributeLevelIncome(investment.userId, finalAmount);

        processedCount++;
        totalPayout = totalPayout.plus(finalAmount);

      } catch (error) {
        console.error(`Failed to process ROI for investment ${investment.id}:`, error);
      }
    }

    return { processed: processedCount, totalAmount: totalPayout };
  }
}

export default new RoiService();

