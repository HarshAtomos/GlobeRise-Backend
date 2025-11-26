/**
 * Demo Seed Script
 * Creates 10 realistic demo users with proper referral chains, investments,
 * and transactions following all business rules.
 * 
 * Business Rules Enforced:
 * - Downline Rule: Must invest >= sponsor's amount
 * - Progressive Rule: Can't invest less than previous investment
 * - 60:40 Rule: Strongest leg max 60% for rank qualification
 * - ROI Tiers: 8% base, 10% with 2 directs in 14 days, 12% with 4 directs in 21 days
 * - Direct Bonus: 5% of investment to sponsor
 * - Level Income: Based on downline ROI
 * 
 * Usage: npx ts-node src/scripts/seed-demo.ts
 */

import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionType, WalletType, InvestmentType, InvestmentStatus, UserRole } from '@prisma/client';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'Demo@123';
const INVESTMENT_AMOUNT = 5000; // All users invest $5,000

// Level income rates (from seed-config)
const LEVEL_RATES: Record<number, number> = {
  1: 10, 2: 5, 3: 4, 4: 4, 5: 3,
  6: 3, 7: 3, 8: 2, 9: 2, 10: 2,
  11: 2, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1
};

// User structure as per plan
interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  sponsorEmail: string | null; // null = ROOT
  investment: number;
  roiRate: number; // Determined by direct referrals
  daysAgo: number; // When they joined/invested
}

const DEMO_USERS: DemoUser[] = [
  // Admin - separate from MLM
  {
    email: 'admin@globerise.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
    firstName: 'System',
    lastName: 'Admin',
    sponsorEmail: null,
    investment: 0,
    roiRate: 0,
    daysAgo: 60
  },
  // Whale - ROOT of MLM tree
  {
    email: 'whale@globerise.com',
    password: 'Whale@123',
    role: UserRole.USER,
    firstName: 'Michael',
    lastName: 'Chen',
    sponsorEmail: null, // ROOT
    investment: INVESTMENT_AMOUNT,
    roiRate: 12, // Has 5 directs within 21 days
    daysAgo: 45
  },
  // Leader - Whale's direct #1
  {
    email: 'leader@globerise.com',
    password: 'Leader@123',
    role: UserRole.USER,
    firstName: 'Sarah',
    lastName: 'Johnson',
    sponsorEmail: 'whale@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 10, // Has 2 directs within 14 days
    daysAgo: 40
  },
  // Team1 - Whale's direct #2
  {
    email: 'team1@globerise.com',
    password: DEFAULT_PASSWORD,
    role: UserRole.USER,
    firstName: 'Alex',
    lastName: 'Rivera',
    sponsorEmail: 'whale@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 38
  },
  // Team2 - Whale's direct #3
  {
    email: 'team2@globerise.com',
    password: DEFAULT_PASSWORD,
    role: UserRole.USER,
    firstName: 'Jordan',
    lastName: 'Lee',
    sponsorEmail: 'whale@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 35
  },
  // Team3 - Whale's direct #4
  {
    email: 'team3@globerise.com',
    password: DEFAULT_PASSWORD,
    role: UserRole.USER,
    firstName: 'Taylor',
    lastName: 'Martinez',
    sponsorEmail: 'whale@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 32
  },
  // Team4 - Whale's direct #5
  {
    email: 'team4@globerise.com',
    password: DEFAULT_PASSWORD,
    role: UserRole.USER,
    firstName: 'Casey',
    lastName: 'Brown',
    sponsorEmail: 'whale@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 30
  },
  // Starter - Leader's direct #1
  {
    email: 'starter@globerise.com',
    password: 'Starter@123',
    role: UserRole.USER,
    firstName: 'David',
    lastName: 'Kim',
    sponsorEmail: 'leader@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 35
  },
  // Member1 - Leader's direct #2
  {
    email: 'member1@globerise.com',
    password: DEFAULT_PASSWORD,
    role: UserRole.USER,
    firstName: 'Morgan',
    lastName: 'Davis',
    sponsorEmail: 'leader@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 33
  },
  // Newbie - Starter's direct #1
  {
    email: 'newbie@globerise.com',
    password: 'Newbie@123',
    role: UserRole.USER,
    firstName: 'Emma',
    lastName: 'Wilson',
    sponsorEmail: 'starter@globerise.com',
    investment: INVESTMENT_AMOUNT,
    roiRate: 8,
    daysAgo: 25
  }
];

// Generate random alphanumeric referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Calculate rank based on team business with 60:40 rule
function calculateRank(totalBusiness: number, strongestLeg: number): string {
  // 60:40 Rule: Strongest leg can contribute max 60%
  const maxFromStrong = totalBusiness * 0.6;
  const effectiveStrong = Math.min(strongestLeg, maxFromStrong);
  const effectiveBusiness = effectiveStrong + (totalBusiness - strongestLeg);

  // Rank thresholds (from seed-config)
  if (effectiveBusiness >= 10000000) return 'IMPERATOR';
  if (effectiveBusiness >= 8500000) return 'SUPREME_LEADER';
  if (effectiveBusiness >= 7000000) return 'EMPEROR';
  if (effectiveBusiness >= 5500000) return 'KING';
  if (effectiveBusiness >= 4000000) return 'CROWN_PRINCE';
  if (effectiveBusiness >= 2500000) return 'LEGEND';
  if (effectiveBusiness >= 1500000) return 'GRANDMASTER';
  if (effectiveBusiness >= 1000000) return 'TRAILBLAZER';
  if (effectiveBusiness >= 500000) return 'STRATEGIST';
  if (effectiveBusiness >= 350000) return 'COMMANDER';
  if (effectiveBusiness >= 200000) return 'CHAMPION';
  if (effectiveBusiness >= 100000) return 'NAVIGATOR';
  if (effectiveBusiness >= 40000) return 'CHALLENGER';
  if (effectiveBusiness >= 15000) return 'PATHFINDER';
  if (effectiveBusiness >= 5000) return 'EXPLORER';
  return 'NONE';
}

async function seedDemoData() {
  console.log('='.repeat(60));
  console.log('GLOBERISE DEMO SEED');
  console.log('='.repeat(60));
  console.log('\n1. Cleaning up ALL existing data...');

  // Delete ALL data in correct order (respecting foreign keys)
  console.log('   Deleting transactions...');
  await prisma.walletTransaction.deleteMany({});
  
  console.log('   Deleting investments...');
  await prisma.investment.deleteMany({});
  
  console.log('   Deleting rank history...');
  await prisma.rankHistory.deleteMany({});
  
  console.log('   Deleting business snapshots...');
  await prisma.businessSnapshot.deleteMany({});
  
  console.log('   Deleting wallets...');
  await prisma.userWallets.deleteMany({});
  
  console.log('   Deleting user profiles...');
  await prisma.userProfile.deleteMany({});
  
  console.log('   Deleting users...');
  await prisma.user.deleteMany({});
  
  console.log('   ✅ All existing data cleaned!');

  // Store created users for reference
  const createdUsers: Map<string, { id: string; referralCode: string }> = new Map();

  console.log('\n2. Creating users...');

  // Create users in order (sponsors first)
  for (const config of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(config.password, SALT_ROUNDS);
    const referralCode = generateReferralCode();

    // Find sponsor ID
    let referredById: string | null = null;
    if (config.sponsorEmail) {
      const sponsor = createdUsers.get(config.sponsorEmail);
      if (sponsor) {
        referredById = sponsor.id;
      }
    }

    // Calculate join date
    const joinDate = new Date();
    joinDate.setDate(joinDate.getDate() - config.daysAgo);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: config.email,
        password_hash: passwordHash,
        is_verified: true,
        role: config.role,
        rank: 'NONE', // Will be updated after calculating team business
        referralCode: config.role !== UserRole.ADMIN ? referralCode : null,
        referredById,
        created_at: joinDate,
        profile: {
          create: {
            firstName: config.firstName,
            lastName: config.lastName
          }
        },
        wallets: {
          create: {
            fiatBalance: 0,
            depositBalance: 0,
            stakingBalance: 0,
            rewardBalance: 0,
            withdrawalBalance: 0
          }
        }
      }
    });

    createdUsers.set(config.email, { id: user.id, referralCode });
    console.log(`   Created: ${config.email} (${config.role})`);
  }

  console.log('\n3. Processing investments and transactions...');

  // Process investments for each user
  for (const config of DEMO_USERS) {
    if (config.investment <= 0) continue;

    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    const investDate = new Date();
    investDate.setDate(investDate.getDate() - config.daysAgo);

    // Initial fiat credit (simulating deposit)
    const initialFiat = config.investment + 1000; // Extra for fees
    await prisma.userWallets.update({
      where: { userId: userData.id },
      data: { fiatBalance: initialFiat }
    });

    await prisma.walletTransaction.create({
      data: {
        userId: userData.id,
        amount: initialFiat,
        type: TransactionType.DEPOSIT,
        destWallet: WalletType.FIAT,
        description: 'Initial Deposit',
        status: 'COMPLETED',
        createdAt: investDate
      }
    });

    // Create investment (Fiat -> Deposit)
    await prisma.userWallets.update({
      where: { userId: userData.id },
      data: {
        fiatBalance: { decrement: config.investment },
        depositBalance: { increment: config.investment }
      }
    });

    await prisma.investment.create({
      data: {
        userId: userData.id,
        amount: config.investment,
        type: InvestmentType.PACKAGE,
        status: InvestmentStatus.ACTIVE,
        roiRate: config.roiRate,
        durationDays: 365,
        startDate: investDate,
        lastRoiDate: new Date(),
        createdAt: investDate
      }
    });

    await prisma.walletTransaction.create({
      data: {
        userId: userData.id,
        amount: config.investment,
        type: TransactionType.INVESTMENT,
        sourceWallet: WalletType.FIAT,
        destWallet: WalletType.DEPOSIT,
        description: 'Package Purchase',
        status: 'COMPLETED',
        createdAt: investDate
      }
    });

    console.log(`   ${config.email}: Invested $${config.investment}`);

    // Direct Referral Bonus (5% to sponsor)
    if (config.sponsorEmail) {
      const sponsor = createdUsers.get(config.sponsorEmail);
      if (sponsor) {
        const bonus = new Decimal(config.investment).mul(0.05);
        
        await prisma.userWallets.update({
          where: { userId: sponsor.id },
          data: { rewardBalance: { increment: bonus } }
        });

        await prisma.walletTransaction.create({
          data: {
            userId: sponsor.id,
            amount: bonus,
            type: TransactionType.COMMISSION,
            destWallet: WalletType.REWARD,
            description: `Direct Referral Bonus from ${config.email}`,
            status: 'COMPLETED',
            referenceId: userData.id,
            referenceType: 'USER',
            metadata: { type: 'DIRECT_BONUS', fromUser: config.email },
            createdAt: investDate
          }
        });

        console.log(`   -> Sponsor ${config.sponsorEmail} received $${bonus} direct bonus`);
      }
    }
  }

  console.log('\n4. Generating ROI history (30 days)...');

  // Generate ROI for each user with investment
  for (const config of DEMO_USERS) {
    if (config.investment <= 0 || config.roiRate <= 0) continue;

    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    const dailyRoi = new Decimal(config.investment).mul(config.roiRate).div(100).div(30);
    const daysOfRoi = Math.min(config.daysAgo, 30);
    let totalRoi = new Decimal(0);

    for (let day = daysOfRoi; day >= 1; day--) {
      const roiDate = new Date();
      roiDate.setDate(roiDate.getDate() - day);
      roiDate.setHours(0, 0, 0, 0);

      // Add some variance
      const variance = dailyRoi.mul(new Decimal(Math.random() * 0.2 - 0.1));
      const dayAmount = dailyRoi.plus(variance).toDecimalPlaces(2);

      if (dayAmount.gt(0)) {
        totalRoi = totalRoi.plus(dayAmount);

        await prisma.walletTransaction.create({
          data: {
            userId: userData.id,
            amount: dayAmount,
            type: TransactionType.ROI,
            destWallet: WalletType.REWARD,
            description: `Daily ROI (${config.roiRate}%)`,
            status: 'COMPLETED',
            metadata: { roiRate: config.roiRate, day: daysOfRoi - day + 1 },
            createdAt: roiDate
          }
        });

        // Level Income to upline (up to 16 levels)
        let currentSponsorEmail = config.sponsorEmail;
        let level = 1;

        while (currentSponsorEmail && level <= 16) {
          const sponsorData = createdUsers.get(currentSponsorEmail);
          if (!sponsorData) break;

          // Check if sponsor has enough direct referrals for this level
          const sponsorDirectCount = await prisma.user.count({
            where: { referredById: sponsorData.id }
          });

          if (sponsorDirectCount >= level) {
            const levelRate = LEVEL_RATES[level] || 1;
            const levelIncome = dayAmount.mul(levelRate).div(100).toDecimalPlaces(2);

            if (levelIncome.gt(0)) {
              await prisma.userWallets.update({
                where: { userId: sponsorData.id },
                data: { rewardBalance: { increment: levelIncome } }
              });

              await prisma.walletTransaction.create({
                data: {
                  userId: sponsorData.id,
                  amount: levelIncome,
                  type: TransactionType.COMMISSION,
                  destWallet: WalletType.REWARD,
                  description: `Level ${level} Income from ${config.email}`,
                  status: 'COMPLETED',
                  metadata: { type: 'LEVEL_INCOME', level, fromUser: config.email, rate: levelRate },
                  createdAt: roiDate
                }
              });
            }
          }

          // Move to next upline
          const sponsorUser = DEMO_USERS.find(u => u.email === currentSponsorEmail);
          currentSponsorEmail = sponsorUser?.sponsorEmail || null;
          level++;
        }
      }
    }

    // Credit ROI to reward wallet
    await prisma.userWallets.update({
      where: { userId: userData.id },
      data: { rewardBalance: { increment: totalRoi } }
    });

    console.log(`   ${config.email}: ${daysOfRoi} days of ROI at ${config.roiRate}% = $${totalRoi.toFixed(2)}`);
  }

  console.log('\n5. Calculating ranks based on team business...');

  // Calculate team business and assign ranks
  const teamBusinessMap: Map<string, { total: number; strong: number; others: number }> = new Map();

  // Calculate from bottom up
  const orderedUsers = [...DEMO_USERS].reverse();

  for (const config of orderedUsers) {
    if (config.role === UserRole.ADMIN) continue;

    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    // Get direct referrals
    const directs = await prisma.user.findMany({
      where: { referredById: userData.id },
      select: { email: true }
    });

    let totalTeamBusiness = 0;
    let strongestLeg = 0;

    for (const direct of directs) {
      // Get direct's own investment
      const directInvestment = await prisma.investment.aggregate({
        where: {
          user: { email: direct.email },
          type: InvestmentType.PACKAGE,
          status: InvestmentStatus.ACTIVE
        },
        _sum: { amount: true }
      });

      const directOwnInvestment = Number(directInvestment._sum.amount || 0);

      // Get direct's team business (already calculated)
      const directTeamBusiness = teamBusinessMap.get(direct.email)?.total || 0;

      const legVolume = directOwnInvestment + directTeamBusiness;
      totalTeamBusiness += legVolume;

      if (legVolume > strongestLeg) {
        strongestLeg = legVolume;
      }
    }

    const others = totalTeamBusiness - strongestLeg;
    teamBusinessMap.set(config.email, { total: totalTeamBusiness, strong: strongestLeg, others });

    // Calculate rank
    const rank = calculateRank(totalTeamBusiness, strongestLeg);

    // Update user rank
    await prisma.user.update({
      where: { id: userData.id },
      data: { rank }
    });

    // Create rank history if ranked
    if (rank !== 'NONE') {
      await prisma.rankHistory.create({
        data: {
          userId: userData.id,
          rank,
          totalBusiness: totalTeamBusiness,
          strongestLeg,
          otherLegs: others,
          achievedAt: new Date()
        }
      });
    }

    const strongPercent = totalTeamBusiness > 0 ? ((strongestLeg / totalTeamBusiness) * 100).toFixed(0) : 0;
    console.log(`   ${config.email}: Team=$${totalTeamBusiness}, Strong=$${strongestLeg} (${strongPercent}%), Rank=${rank}`);
  }

  console.log('\n6. Final wallet balance summary...');

  // Print final balances
  for (const config of DEMO_USERS) {
    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    const wallets = await prisma.userWallets.findUnique({
      where: { userId: userData.id }
    });

    if (wallets) {
      console.log(`   ${config.email}:`);
      console.log(`      Fiat: $${wallets.fiatBalance}`);
      console.log(`      Deposit: $${wallets.depositBalance}`);
      console.log(`      Reward: $${wallets.rewardBalance}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('DEMO SEED COMPLETED');
  console.log('='.repeat(60));
  console.log('\nDemo Credentials:');
  console.log('-'.repeat(40));

  for (const config of DEMO_USERS) {
    const icon = config.role === UserRole.ADMIN ? '[ADMIN]' : '[USER]';
    console.log(`${icon} ${config.email}`);
    console.log(`       Password: ${config.password}`);
  }

  console.log('-'.repeat(40));
  console.log('\nReferral Structure:');
  console.log('  Whale (ROOT)');
  console.log('  +-- Leader');
  console.log('  |   +-- Starter');
  console.log('  |   |   +-- Newbie');
  console.log('  |   +-- Member1');
  console.log('  +-- Team1');
  console.log('  +-- Team2');
  console.log('  +-- Team3');
  console.log('  +-- Team4');
  console.log('='.repeat(60));
}

// Run
seedDemoData()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
