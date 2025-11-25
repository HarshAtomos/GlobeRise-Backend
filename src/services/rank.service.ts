import prisma from '../config/database';
import { InvestmentType, InvestmentStatus, TransactionType, WalletType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';

class RankService {
    /**
     * Calculate Team Business with Leg Breakdown (Recursive)
     * - strongLegVolume: Max volume from a single direct referral tree.
     * - otherLegsVolume: Sum of all other direct referral trees.
     * - totalBusiness: strongLeg + otherLegs.
     */
    async calculateTeamStats(userId: string): Promise<{ total: Decimal, strong: Decimal, others: Decimal }> {
        // 1. Get all direct referrals
        const directs = await prisma.user.findMany({
            where: { referredById: userId },
            select: { id: true }
        });

        if (directs.length === 0) {
            return { total: new Decimal(0), strong: new Decimal(0), others: new Decimal(0) };
        }

        let maxLegVolume = new Decimal(0);
        let totalVolume = new Decimal(0);

        // 2. Calculate volume for each leg (subtree)
        for (const direct of directs) {
            // Leg Volume = Direct's own investment + Direct's team volume
            const legVolume = await this.getLegVolume(direct.id);

            totalVolume = totalVolume.plus(legVolume);

            if (legVolume.gt(maxLegVolume)) {
                maxLegVolume = legVolume;
            }
        }

        const otherLegsVolume = totalVolume.minus(maxLegVolume);

        return {
            total: totalVolume,
            strong: maxLegVolume,
            others: otherLegsVolume
        };
    }

    /**
     * Helper: Calculate total active investment volume for a user and their entire downline.
     */
    private async getLegVolume(userId: string): Promise<Decimal> {
        // 1. User's own active investments (Package type only)
        const ownInvestments = await prisma.investment.aggregate({
            where: {
                userId,
                type: InvestmentType.PACKAGE,
                status: InvestmentStatus.ACTIVE
            },
            _sum: { amount: true }
        });

        const ownVolume = ownInvestments._sum.amount || new Decimal(0);

        // 2. Downline volume (Recursive)
        const directs = await prisma.user.findMany({
            where: { referredById: userId },
            select: { id: true }
        });

        let teamVolume = new Decimal(0);
        for (const direct of directs) {
            teamVolume = teamVolume.plus(await this.getLegVolume(direct.id));
        }

        return ownVolume.plus(teamVolume);
    }

    /**
     * Check and Process Rank Promotion
     */
    async processRankUpdate(userId: string): Promise<void> {
        // 1. Fetch Rank Config from DB
        const rankConfigs = await prisma.rankConfig.findMany({
            orderBy: { order: 'asc' }
        });

        if (!rankConfigs.length) return;

        const stats = await this.calculateTeamStats(userId);
        const { total, strong, others } = stats;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        let newRankName = user.rank;
        let newRankOrder = -1;

        // Find current rank order
        const currentRankConfig = rankConfigs.find(r => r.name === user.rank);
        const currentRankOrder = currentRankConfig ? currentRankConfig.order : 0;

        // 2. Iterate through dynamic ranks to find highest qualification
        for (const rankConfig of rankConfigs) {
            const target = rankConfig.requiredBusiness;

            // 60:40 Rule
            const maxStrongContribution = target.mul(0.6);
            const countedStrong = strong.gt(maxStrongContribution) ? maxStrongContribution : strong;
            const qualifiedVolume = countedStrong.plus(others);

            if (qualifiedVolume.gte(target)) {
                newRankName = rankConfig.name;
                newRankOrder = rankConfig.order;
            }
        }

        // 3. If promoted (strictly higher order)
        if (newRankOrder > currentRankOrder) {
            await prisma.$transaction(async (tx) => {
                // Update User
                await tx.user.update({
                    where: { id: userId },
                    data: { rank: newRankName }
                });

                // Record History
                await tx.rankHistory.create({
                    data: {
                        userId,
                        rank: newRankName,
                        totalBusiness: total,
                        strongestLeg: strong,
                        otherLegs: others
                    }
                });

                // 4. One-time Rank Bonus (if configured)
                const newRankConfig = rankConfigs.find(r => r.order === newRankOrder);
                if (newRankConfig && newRankConfig.bonusAmount.gt(0)) {
                    // Check if bonus already paid for this rank?
                    // Assuming strictly progressive, we pay it once.
                    // Ideally we check if they hit this specific rank before.
                    // For MVP, we pay on promotion.

                    await walletService.creditWallet(
                        userId,
                        WalletType.REWARD,
                        newRankConfig.bonusAmount,
                        TransactionType.RANK_BONUS,
                        `Rank Bonus for ${newRankName}`,
                        undefined,
                        'SYSTEM',
                        { rank: newRankName, stats: { total, strong, others } }
                    );
                }
            });
        }
    }

    /**
     * Run Rank Engine for ALL users
     */
    async runDailyRankCheck(): Promise<void> {
        // Optimization: Fetch users who have at least 1 referral.
        const users = await prisma.user.findMany({
            where: {
                referrals: { some: {} }
            },
            select: { id: true }
        });

        for (const user of users) {
            await this.processRankUpdate(user.id);
        }
    }
}

export default new RankService();
