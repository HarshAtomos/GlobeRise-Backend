import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

const RANKS = [
    { name: 'EXPLORER', order: 1, requiredBusiness: 5000, bonus: 250, royalty: 0.00 },
    { name: 'PATHFINDER', order: 2, requiredBusiness: 15000, bonus: 750, royalty: 0.00 },
    { name: 'CHALLENGER', order: 3, requiredBusiness: 40000, bonus: 1500, royalty: 0.00 },
    { name: 'NAVIGATOR', order: 4, requiredBusiness: 100000, bonus: 3000, royalty: 1.00 },
    { name: 'CHAMPION', order: 5, requiredBusiness: 200000, bonus: 5000, royalty: 0.00 },
    { name: 'COMMANDER', order: 6, requiredBusiness: 350000, bonus: 7500, royalty: 0.00 },
    { name: 'STRATEGIST', order: 7, requiredBusiness: 500000, bonus: 9000, royalty: 0.50 },
    { name: 'TRAILBLAZER', order: 8, requiredBusiness: 1000000, bonus: 15000, royalty: 0.00 },
    { name: 'GRANDMASTER', order: 9, requiredBusiness: 1500000, bonus: 20000, royalty: 0.50 },
    { name: 'LEGEND', order: 10, requiredBusiness: 2500000, bonus: 25000, royalty: 0.00 },
    { name: 'CROWN_PRINCE', order: 11, requiredBusiness: 4000000, bonus: 30000, royalty: 0.50 },
    { name: 'KING', order: 12, requiredBusiness: 5500000, bonus: 35000, royalty: 0.00 },
    { name: 'EMPEROR', order: 13, requiredBusiness: 7000000, bonus: 40000, royalty: 0.50 },
    { name: 'SUPREME_LEADER', order: 14, requiredBusiness: 8500000, bonus: 45000, royalty: 0.00 },
    { name: 'IMPERATOR', order: 15, requiredBusiness: 10000000, bonus: 50000, royalty: 0.50 },
];

const LEVELS = {
    "1": 10,
    "2": 5,
    "3": 4,
    "4": 4,
    "5": 3,
    "6": 3,
    "7": 3,
    "8": 2,
    "9": 2,
    "10": 2,
    "11": 2,
    "12": 1,
    "13": 1,
    "14": 1,
    "15": 1,
    "16": 1
};

async function seed() {
    console.log('Starting seed...');

    // 1. Seed PlanConfig (Level Income)
    await prisma.planConfig.upsert({
        where: { key: 'GLOBAL_SETTINGS' },
        update: {
            levelIncomeRates: LEVELS,
        },
        create: {
            key: 'GLOBAL_SETTINGS',
            levelIncomeRates: LEVELS,
            withdrawalFeePercent: 10.0,
            minWithdrawalAmount: 10.0
        }
    });
    console.log('✅ Plan Config seeded');

    // 2. Seed Ranks
    for (const rank of RANKS) {
        await prisma.rankConfig.upsert({
            where: { name: rank.name },
            update: {
                order: rank.order,
                requiredBusiness: rank.requiredBusiness,
                bonusAmount: rank.bonus,
                royaltyPercent: rank.royalty
            },
            create: {
                name: rank.name,
                order: rank.order,
                requiredBusiness: rank.requiredBusiness,
                bonusAmount: rank.bonus,
                royaltyPercent: rank.royalty
            }
        });
    }
    console.log(`✅ ${RANKS.length} Ranks seeded`);
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

