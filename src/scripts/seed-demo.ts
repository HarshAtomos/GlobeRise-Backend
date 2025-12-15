/**
 * Demo Seed Script
 * Creates 13 demo accounts with proper referral chains, investments,
 * and 2-3 months of transaction history following all business rules.
 * 
 * Business Rules Enforced:
 * - 60:40 Rule: Strongest leg must be ≤60% of total team business for rank qualification
 * - ROI: 8% monthly (paid after each 30-day cycle)
 * - Direct Bonus: 5% of investment to sponsor
 * - Level Income: Based on downline ROI
 * 
 * Hierarchy:
 * - Leader 1 (KING): User 1 + User 2
 * - Leader 2 (CROWN_PRINCE): User 3 + User 4
 * - Leader 3 (COMMANDER): User 5 + User 6
 * - Leader 4 (NAVIGATOR): User 7 + User 8
 * 
 * Usage: npx ts-node src/scripts/seed-demo.ts
 */

import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionType, WalletType, InvestmentType, InvestmentStatus, UserRole } from '@prisma/client';

const SALT_ROUNDS = 10;

// Level income rates (from seed-config)
const LEVEL_RATES: Record<number, number> = {
  1: 10, 2: 5, 3: 4, 4: 4, 5: 3,
  6: 3, 7: 3, 8: 2, 9: 2, 10: 2,
  11: 2, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1
};

// Rank thresholds (must match seed-config)
const RANK_THRESHOLDS = [
  { name: 'IMPERATOR', required: 10000000 },
  { name: 'SUPREME_LEADER', required: 8500000 },
  { name: 'EMPEROR', required: 7000000 },
  { name: 'KING', required: 5500000 },
  { name: 'CROWN_PRINCE', required: 4000000 },
  { name: 'LEGEND', required: 2500000 },
  { name: 'GRANDMASTER', required: 1500000 },
  { name: 'TRAILBLAZER', required: 1000000 },
  { name: 'STRATEGIST', required: 500000 },
  { name: 'COMMANDER', required: 350000 },
  { name: 'CHAMPION', required: 200000 },
  { name: 'NAVIGATOR', required: 100000 },
  { name: 'CHALLENGER', required: 40000 },
  { name: 'PATHFINDER', required: 15000 },
  { name: 'EXPLORER', required: 5000 },
];

// User configuration
interface DemoUser {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  sponsorEmail: string | null;
  investment: number;
  daysAgo: number; // When they joined/invested
}

const DEMO_USERS: DemoUser[] = [
  // ===================== ADMIN =====================
  {
    email: 'admin@globerise.eu',
    password: 'Admin@123',
    role: UserRole.ADMIN,
    firstName: 'System',
    lastName: 'Admin',
    sponsorEmail: null,
    investment: 0,
    daysAgo: 120
  },

  // ===================== LEADERS =====================
  // Leader 1 - Target: KING (needs $5.5M team business)
  {
    email: 'alexander@globerise.eu',
    password: 'Leader@123',
    role: UserRole.USER,
    firstName: 'Alexander',
    lastName: 'Stone',
    sponsorEmail: null,
    investment: 100000,
    daysAgo: 100
  },
  // Leader 2 - Target: CROWN_PRINCE (needs $4M team business)
  {
    email: 'victoria@globerise.eu',
    password: 'Leader@123',
    role: UserRole.USER,
    firstName: 'Victoria',
    lastName: 'Crown',
    sponsorEmail: null,
    investment: 75000,
    daysAgo: 95
  },
  // Leader 3 - Target: COMMANDER (needs $350K team business)
  {
    email: 'marcus@globerise.eu',
    password: 'Leader@123',
    role: UserRole.USER,
    firstName: 'Marcus',
    lastName: 'Reed',
    sponsorEmail: null,
    investment: 50000,
    daysAgo: 90
  },
  // Leader 4 - Target: NAVIGATOR (needs $100K team business)
  {
    email: 'elena@globerise.eu',
    password: 'Leader@123',
    role: UserRole.USER,
    firstName: 'Elena',
    lastName: 'Torres',
    sponsorEmail: null,
    investment: 25000,
    daysAgo: 85
  },

  // ===================== USERS UNDER LEADER 1 =====================
  // User 1 - $2.75M (Leg 1 for Leader 1)
  {
    email: 'james.miller@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'James',
    lastName: 'Miller',
    sponsorEmail: 'alexander@globerise.eu',
    investment: 2750000,
    daysAgo: 80
  },
  // User 2 - $2.75M (Leg 2 for Leader 1)
  {
    email: 'sophia.chen@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Sophia',
    lastName: 'Chen',
    sponsorEmail: 'alexander@globerise.eu',
    investment: 2750000,
    daysAgo: 78
  },

  // ===================== USERS UNDER LEADER 2 =====================
  // User 3 - $2M (Leg 1 for Leader 2)
  {
    email: 'daniel.kumar@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Daniel',
    lastName: 'Kumar',
    sponsorEmail: 'victoria@globerise.eu',
    investment: 2000000,
    daysAgo: 75
  },
  // User 4 - $2M (Leg 2 for Leader 2)
  {
    email: 'olivia.santos@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Olivia',
    lastName: 'Santos',
    sponsorEmail: 'victoria@globerise.eu',
    investment: 2000000,
    daysAgo: 73
  },

  // ===================== USERS UNDER LEADER 3 =====================
  // User 5 - $175K (Leg 1 for Leader 3)
  {
    email: 'ethan.wright@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Ethan',
    lastName: 'Wright',
    sponsorEmail: 'marcus@globerise.eu',
    investment: 175000,
    daysAgo: 70
  },
  // User 6 - $175K (Leg 2 for Leader 3)
  {
    email: 'emma.johnson@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Emma',
    lastName: 'Johnson',
    sponsorEmail: 'marcus@globerise.eu',
    investment: 175000,
    daysAgo: 68
  },

  // ===================== USERS UNDER LEADER 4 =====================
  // User 7 - $50K (Leg 1 for Leader 4)
  {
    email: 'noah.patel@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Noah',
    lastName: 'Patel',
    sponsorEmail: 'elena@globerise.eu',
    investment: 50000,
    daysAgo: 65
  },
  // User 8 - $50K (Leg 2 for Leader 4)
  {
    email: 'ava.williams@demo.globerise.eu',
    password: 'User@123',
    role: UserRole.USER,
    firstName: 'Ava',
    lastName: 'Williams',
    sponsorEmail: 'elena@globerise.eu',
    investment: 50000,
    daysAgo: 63
  }
];

// Generate random alphanumeric referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Calculate rank based on team business with STRICT 60:40 rule
 * Eligible only if strongest leg ≤ 60% of total team business
 */
function calculateRank(totalBusiness: number, strongestLeg: number): string {
  // 60:40 Rule Check: Strongest leg must be ≤60% of total
  if (totalBusiness > 0) {
    const strongPercent = (strongestLeg / totalBusiness) * 100;
    if (strongPercent > 60) {
      return 'NONE'; // Disqualified - violates 60:40 rule
    }
  }

  // Find highest qualifying rank
  for (const rank of RANK_THRESHOLDS) {
    if (totalBusiness >= rank.required) {
      return rank.name;
    }
  }

  return 'NONE';
}

async function seedDemoData() {
  console.log('='.repeat(70));
  console.log('GLOBERISE DEMO SEED - 13 Accounts with 60:40 Rule');
  console.log('='.repeat(70));

  // ==================== CLEANUP ====================
  console.log('\n1. Cleaning up ALL existing data...');

  console.log('   Deleting notifications...');
  await prisma.notification.deleteMany({});

  console.log('   Deleting support tickets...');
  await prisma.supportTicket.deleteMany({});

  console.log('   Deleting linked wallets...');
  await prisma.linkedWallet.deleteMany({});

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

  console.log('   Deleting 2FA...');
  await prisma.twoFactorAuth.deleteMany({});

  console.log('   Deleting sessions...');
  await prisma.userSession.deleteMany({});

  console.log('   Deleting refresh tokens...');
  await prisma.refreshToken.deleteMany({});

  console.log('   Deleting password resets...');
  await prisma.passwordReset.deleteMany({});

  console.log('   Deleting profile photos...');
  await prisma.profilePhoto.deleteMany({});

  console.log('   Deleting user profiles...');
  await prisma.userProfile.deleteMany({});

  console.log('   Deleting users...');
  await prisma.user.deleteMany({});

  console.log('   ✅ All existing data cleaned!');

  // ==================== CREATE USERS ====================
  const createdUsers: Map<string, { id: string; referralCode: string }> = new Map();

  console.log('\n2. Creating 13 demo users...');

  for (const config of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(config.password, SALT_ROUNDS);
    const referralCode = config.role !== UserRole.ADMIN ? generateReferralCode() : null;

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
        rank: 'NONE',
        referralCode,
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
            depositBalance: 0,
            rewardBalance: 0,
            withdrawalBalance: 0
          }
        }
      }
    });

    createdUsers.set(config.email, { id: user.id, referralCode: referralCode || '' });

    const roleTag = config.role === UserRole.ADMIN ? '[ADMIN]' : '[USER]';
    const sponsorTag = config.sponsorEmail ? `← ${config.sponsorEmail.split('@')[0]}` : '(ROOT)';
    console.log(`   ${roleTag} ${config.email} ${sponsorTag}`);
  }

  // ==================== CREATE INVESTMENTS ====================
  console.log('\n3. Processing investments and direct bonuses...');

  for (const config of DEMO_USERS) {
    if (config.investment <= 0) continue;

    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    const investDate = new Date();
    investDate.setDate(investDate.getDate() - config.daysAgo);

    // Fund deposit wallet
    const initialDeposit = config.investment;
    await prisma.userWallets.update({
      where: { userId: userData.id },
      data: { depositBalance: initialDeposit }
    });

    // Record deposit transaction
    await prisma.walletTransaction.create({
      data: {
        userId: userData.id,
        amount: initialDeposit,
        type: TransactionType.DEPOSIT,
        destWallet: WalletType.DEPOSIT,
        description: 'Initial Deposit from Linked Wallet',
        status: 'COMPLETED',
        createdAt: investDate
      }
    });

    // Create investment
    const investment = await prisma.investment.create({
      data: {
        userId: userData.id,
        amount: config.investment,
        type: InvestmentType.PACKAGE,
        status: InvestmentStatus.ACTIVE,
        roiRate: 8.0, // Base 8% monthly
        durationDays: 365,
        startDate: investDate,
        lastRoiDate: investDate, // Will be updated as ROI is paid
        createdAt: investDate
      }
    });

    // Record investment transaction
    await prisma.walletTransaction.create({
      data: {
        userId: userData.id,
        amount: config.investment,
        type: TransactionType.INVESTMENT,
        sourceWallet: WalletType.DEPOSIT,
        destWallet: WalletType.DEPOSIT,
        description: 'Package Purchase',
        status: 'COMPLETED',
        referenceId: investment.id,
        referenceType: 'INVESTMENT',
        createdAt: investDate
      }
    });

    console.log(`   ${config.email}: Invested $${config.investment.toLocaleString()}`);

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
            description: `Direct Referral Bonus from ${config.firstName} ${config.lastName}`,
            status: 'COMPLETED',
            referenceId: userData.id,
            referenceType: 'USER',
            metadata: { type: 'DIRECT_BONUS', fromUser: config.email, percentage: 5 },
            createdAt: investDate
          }
        });

        const sponsorConfig = DEMO_USERS.find(u => u.email === config.sponsorEmail);
        console.log(`      → ${sponsorConfig?.firstName} received $${bonus.toFixed(2)} direct bonus`);
      }
    }
  }

  // ==================== GENERATE ROI HISTORY (2-3 Months) ====================
  console.log('\n4. Generating 2-3 months of ROI history...');

  for (const config of DEMO_USERS) {
    if (config.investment <= 0) continue;

    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    // Get the investment
    const investment = await prisma.investment.findFirst({
      where: { userId: userData.id, type: InvestmentType.PACKAGE }
    });
    if (!investment) continue;

    // Calculate how many complete 30-day cycles have passed
    const completedMonths = Math.floor(config.daysAgo / 30);
    const monthsToProcess = Math.min(completedMonths, 3); // Max 3 months

    if (monthsToProcess === 0) {
      console.log(`   ${config.email}: ${config.daysAgo} days old - no ROI yet (< 30 days)`);
      continue;
    }

    let totalRoi = new Decimal(0);
    const monthlyRoi = new Decimal(config.investment).mul(0.08); // 8% monthly

    for (let month = 1; month <= monthsToProcess; month++) {
      const roiDate = new Date();
      roiDate.setDate(roiDate.getDate() - config.daysAgo + (month * 30));

      // Credit ROI to user
      await prisma.userWallets.update({
        where: { userId: userData.id },
        data: { rewardBalance: { increment: monthlyRoi } }
      });

      await prisma.walletTransaction.create({
        data: {
          userId: userData.id,
          amount: monthlyRoi,
          type: TransactionType.ROI,
          destWallet: WalletType.REWARD,
          description: `Monthly ROI (8%) - Month ${month}`,
          status: 'COMPLETED',
          referenceId: investment.id,
          referenceType: 'INVESTMENT',
          metadata: { roiRate: 8, month, type: 'MONTHLY_ROI' },
          createdAt: roiDate
        }
      });

      totalRoi = totalRoi.plus(monthlyRoi);

      // Distribute Level Income to uplines
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
          const levelIncome = monthlyRoi.mul(levelRate).div(100).toDecimalPlaces(2);

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
                description: `Level ${level} Income from ${config.firstName} ${config.lastName} - Month ${month}`,
                status: 'COMPLETED',
                referenceId: userData.id,
                referenceType: 'USER',
                metadata: { type: 'LEVEL_INCOME', level, fromUser: config.email, rate: levelRate, month },
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

    // Update last ROI date on investment
    const lastRoiDate = new Date();
    lastRoiDate.setDate(lastRoiDate.getDate() - config.daysAgo + (monthsToProcess * 30));
    await prisma.investment.update({
      where: { id: investment.id },
      data: { lastRoiDate }
    });

    console.log(`   ${config.email}: ${monthsToProcess} month(s) of ROI = $${totalRoi.toFixed(2)}`);
  }

  // ==================== CALCULATE RANKS ====================
  console.log('\n5. Calculating ranks with 60:40 rule...');

  // Calculate team business bottom-up
  const teamBusinessMap: Map<string, { total: number; strong: number; others: number }> = new Map();
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
    const legVolumes: number[] = [];

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
      legVolumes.push(legVolume);
      totalTeamBusiness += legVolume;

      if (legVolume > strongestLeg) {
        strongestLeg = legVolume;
      }
    }

    const others = totalTeamBusiness - strongestLeg;
    teamBusinessMap.set(config.email, { total: totalTeamBusiness, strong: strongestLeg, others });

    // Calculate rank with 60:40 rule
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
    const rule6040 = totalTeamBusiness > 0 && (strongestLeg / totalTeamBusiness) <= 0.6 ? '✅' : '❌';

    if (directs.length > 0) {
      console.log(`   ${config.email}:`);
      console.log(`      Team: $${totalTeamBusiness.toLocaleString()} | Strong: $${strongestLeg.toLocaleString()} (${strongPercent}%) ${rule6040}`);
      console.log(`      Legs: [${legVolumes.map(v => '$' + v.toLocaleString()).join(', ')}]`);
      console.log(`      Rank: ${rank}`);
    }
  }

  // ==================== FINAL SUMMARY ====================
  console.log('\n6. Final wallet balance summary...');

  for (const config of DEMO_USERS) {
    const userData = createdUsers.get(config.email);
    if (!userData) continue;

    const wallets = await prisma.userWallets.findUnique({
      where: { userId: userData.id }
    });

    const user = await prisma.user.findUnique({
      where: { id: userData.id },
      select: { rank: true }
    });

    if (wallets) {
      const deposit = Number(wallets.depositBalance).toLocaleString();
      const reward = Number(wallets.rewardBalance).toLocaleString();
      const withdrawal = Number(wallets.withdrawalBalance).toLocaleString();
      console.log(`   ${config.email} [${user?.rank || 'NONE'}]`);
      console.log(`      Deposit: $${deposit} | Reward: $${reward} | Withdrawal: $${withdrawal}`);
    }
  }

  // ==================== PRINT CREDENTIALS ====================
  console.log('\n' + '='.repeat(70));
  console.log('DEMO SEED COMPLETED');
  console.log('='.repeat(70));

  console.log('\n📋 Demo Credentials:');
  console.log('-'.repeat(50));

  // Admin
  console.log('\n[ADMIN]');
  console.log(`   Email:    admin@globerise.eu`);
  console.log(`   Password: Admin@123`);

  // Leaders
  console.log('\n[LEADERS]');
  const leaders = DEMO_USERS.filter(u => u.role === UserRole.USER && !u.sponsorEmail);
  for (const leader of leaders) {
    const user = await prisma.user.findUnique({
      where: { email: leader.email },
      select: { rank: true }
    });
    console.log(`   ${leader.email} (${user?.rank})`);
    console.log(`   Password: ${leader.password}`);
    console.log('');
  }

  // Users
  console.log('[USERS]');
  const users = DEMO_USERS.filter(u => u.role === UserRole.USER && u.sponsorEmail);
  for (const user of users) {
    const sponsor = DEMO_USERS.find(u2 => u2.email === user.sponsorEmail);
    console.log(`   ${user.email} → ${sponsor?.firstName || 'Unknown'}`);
  }
  console.log(`   Password: User@123 (all users)`);

  console.log('\n' + '-'.repeat(50));
  console.log('\n🌳 Referral Tree:');
  console.log('');
  console.log('  Alexander (KING)');
  console.log('  ├── James Miller ($2.75M)');
  console.log('  └── Sophia Chen ($2.75M)');
  console.log('');
  console.log('  Victoria (CROWN_PRINCE)');
  console.log('  ├── Daniel Kumar ($2M)');
  console.log('  └── Olivia Santos ($2M)');
  console.log('');
  console.log('  Marcus (COMMANDER)');
  console.log('  ├── Ethan Wright ($175K)');
  console.log('  └── Emma Johnson ($175K)');
  console.log('');
  console.log('  Elena (NAVIGATOR)');
  console.log('  ├── Noah Patel ($50K)');
  console.log('  └── Ava Williams ($50K)');

  console.log('\n' + '='.repeat(70));
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
