import prisma from '../config/database';
import { WalletType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';

class CommissionService {
    /**
     * Distribute Direct Referral Bonus (5%)
     * Trigger: Instant when a user buys a package
     */
    async distributeDirectBonus(investorId: string, investmentAmount: Decimal | number): Promise<void> {
        const amount = new Decimal(investmentAmount);

        // 1. Find Referrer
        const investor = await prisma.user.findUnique({
            where: { id: investorId },
            select: { referredById: true }
        });

        if (!investor || !investor.referredById) {
            return; // No referrer, no bonus
        }

        const referrerId = investor.referredById;

        // 2. Calculate Bonus (5%)
        const bonusRate = new Decimal(0.05);
        const bonusAmount = amount.mul(bonusRate);

        // 3. Credit Reward Wallet
        await walletService.creditWallet(
            referrerId,
            WalletType.REWARD,
            bonusAmount,
            TransactionType.COMMISSION,
            `Direct Referral Bonus from User ${investorId}`,
            investorId, // Reference: The user who invested
            'USER',
            { type: 'DIRECT_BONUS', rate: '5%', sourceAmount: amount.toString() }
        );
    }

    /**
     * Distribute Level Income
     * Trigger: When a user receives ROI
     * Logic: 16 Levels. Rates fetched from DB Config.
     * Requirement: Must have N direct referrals to earn from Level N.
     */
    async distributeLevelIncome(earnerId: string, roiAmount: Decimal | number): Promise<void> {
        const roi = new Decimal(roiAmount);

        // 1. Fetch Dynamic Level Rates from DB
        const config = await prisma.planConfig.findUnique({
            where: { key: 'GLOBAL_SETTINGS' }
        });

        if (!config || !config.levelIncomeRates) {
            console.error('Plan Config missing or invalid level rates.');
            return;
        }

        // config.levelIncomeRates is Json type in Prisma
        // Format: { "1": 10, "2": 5, ... }
        const ratesMap = config.levelIncomeRates as Record<string, number>;
        const maxLevel = Object.keys(ratesMap).length;

        let currentUserId = earnerId;

        // Traverse up the tree
        for (let level = 1; level <= maxLevel; level++) {
            // Get current user's referrer
            const user = await prisma.user.findUnique({
                where: { id: currentUserId },
                select: { referredById: true }
            });

            if (!user || !user.referredById) {
                break; // End of chain
            }

            const referrerId = user.referredById;

            // 2. Check Qualification: "N directs for Level N"
            const referrerDirectsCount = await prisma.user.count({
                where: { referredById: referrerId }
            });

            if (referrerDirectsCount >= level) {
                // Qualified
                const ratePercent = ratesMap[level.toString()] || 0;
                if (ratePercent > 0) {
                    const rate = new Decimal(ratePercent).div(100);
                    const commission = roi.mul(rate);

                    // Credit Referrer
                    await walletService.creditWallet(
                        referrerId,
                        WalletType.REWARD,
                        commission,
                        TransactionType.COMMISSION,
                        `Level ${level} Income from User ${earnerId}`,
                        earnerId,
                        'USER',
                        { type: 'LEVEL_INCOME', level, rate: rate.toString(), sourceRoi: roi.toString() }
                    );
                }
            } else {
                // Not Qualified - Skip Payment (Flush)
                // console.log(`User ${referrerId} missed Level ${level} income. Has ${referrerDirectsCount} directs, needed ${level}.`);
            }

            // Move up
            currentUserId = referrerId;
        }
    }
}

export default new CommissionService();
