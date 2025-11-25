/**
 * Demo Seed Script
 * Creates demo users with different ranks, investment history, and transactions
 * 
 * Usage: npx ts-node src/scripts/seed-demo.ts
 */

import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionType, WalletType, InvestmentType, InvestmentStatus, UserRole } from '@prisma/client';

const SALT_ROUNDS = 10;

// Demo user configurations
const DEMO_USERS = [
  {
    email: 'admin@globerise.com',
    password: 'Admin@123',
    role: UserRole.ADMIN,
    rank: 'NONE',
    firstName: 'System',
    lastName: 'Admin',
    fiatBalance: 100000,
    rewardBalance: 50000,
    investments: []
  },
  {
    email: 'whale@globerise.com',
    password: 'Whale@123',
    role: UserRole.USER,
    rank: 'GRANDMASTER',
    firstName: 'Michael',
    lastName: 'Chen',
    fiatBalance: 50000,
    depositBalance: 100000,
    rewardBalance: 75000,
    withdrawalBalance: 10000,
    investments: [
      { amount: 50000, daysAgo: 180 },
      { amount: 50000, daysAgo: 90 }
    ]
  },
  {
    email: 'leader@globerise.com',
    password: 'Leader@123',
    role: UserRole.USER,
    rank: 'NAVIGATOR',
    firstName: 'Sarah',
    lastName: 'Johnson',
    fiatBalance: 10000,
    depositBalance: 25000,
    rewardBalance: 15000,
    withdrawalBalance: 2000,
    investments: [
      { amount: 15000, daysAgo: 120 },
      { amount: 10000, daysAgo: 60 }
    ]
  },
  {
    email: 'starter@globerise.com',
    password: 'Starter@123',
    role: UserRole.USER,
    rank: 'EXPLORER',
    firstName: 'David',
    lastName: 'Kim',
    fiatBalance: 2000,
    depositBalance: 5000,
    rewardBalance: 500,
    investments: [
      { amount: 5000, daysAgo: 30 }
    ]
  },
  {
    email: 'newbie@globerise.com',
    password: 'Newbie@123',
    role: UserRole.USER,
    rank: 'NONE',
    firstName: 'Emma',
    lastName: 'Wilson',
    fiatBalance: 1000,
    depositBalance: 1000,
    rewardBalance: 50,
    investments: [
      { amount: 1000, daysAgo: 7 }
    ]
  }
];

// Generate random alphanumeric referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function seedDemoData() {
  console.log('🚀 Starting Demo Seed...\n');

  // Clear existing demo data (optional - be careful in production!)
  console.log('🧹 Cleaning up existing demo users...');
  for (const demoUser of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: demoUser.email } });
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
    }
  }

  const createdUsers: any[] = [];
  let previousUserId: string | null = null;

  // Create users in order (to build referral chain)
  for (let i = 0; i < DEMO_USERS.length; i++) {
    const config = DEMO_USERS[i];
    console.log(`\n👤 Creating ${config.email}...`);

    const passwordHash = await bcrypt.hash(config.password, SALT_ROUNDS);
    const referralCode = generateReferralCode();

    // Create user
    const user: any = await prisma.user.create({
      data: {
        email: config.email,
        password_hash: passwordHash,
        is_verified: true,
        role: config.role,
        rank: config.rank,
        referralCode,
        referredById: i > 1 ? previousUserId : null, // Chain referrals (skip admin)
        profile: {
          create: {
            firstName: config.firstName,
            lastName: config.lastName
          }
        },
        wallets: {
          create: {
            fiatBalance: config.fiatBalance || 0,
            depositBalance: config.depositBalance || 0,
            stakingBalance: 0,
            rewardBalance: config.rewardBalance || 0,
            withdrawalBalance: config.withdrawalBalance || 0
          }
        }
      }
    });

    console.log(`   ✅ Created: ${user.email} (${config.rank})`);
    console.log(`   📧 Referral Code: ${referralCode}`);
    
    createdUsers.push({ ...user, config });

    // Save for next user's referral
    if (i >= 1) {
      previousUserId = user.id;
    }

    // Create investments
    if (config.investments && config.investments.length > 0) {
      for (const inv of config.investments) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - inv.daysAgo);

        await prisma.investment.create({
          data: {
            userId: user.id,
            amount: inv.amount,
            type: InvestmentType.PACKAGE,
            status: InvestmentStatus.ACTIVE,
            roiRate: 8.0,
            durationDays: 365,
            startDate,
            lastRoiDate: new Date()
          }
        });

        // Create investment transaction
        await prisma.walletTransaction.create({
          data: {
            userId: user.id,
            amount: inv.amount,
            type: TransactionType.INVESTMENT,
            sourceWallet: WalletType.FIAT,
            destWallet: WalletType.DEPOSIT,
            description: 'Package Purchase',
            status: 'COMPLETED',
            createdAt: startDate
          }
        });
      }
      console.log(`   💰 Created ${config.investments.length} investment(s)`);
    }

    // Generate ROI history (last 30 days)
    if (config.rewardBalance && config.rewardBalance > 0 && config.investments) {
      const roiPerDay = new Decimal(config.rewardBalance).div(30).toDecimalPlaces(2);
      
      for (let day = 29; day >= 0; day--) {
        const txDate = new Date();
        txDate.setDate(txDate.getDate() - day);
        txDate.setHours(0, 0, 0, 0);

        // Add some randomness
        const variance = roiPerDay.mul(0.2).mul(Math.random() - 0.5);
        const dailyAmount = roiPerDay.add(variance).toDecimalPlaces(2);

        if (dailyAmount.gt(0)) {
          await prisma.walletTransaction.create({
            data: {
              userId: user.id,
              amount: dailyAmount,
              type: TransactionType.ROI,
              destWallet: WalletType.REWARD,
              description: 'Daily ROI',
              status: 'COMPLETED',
              createdAt: txDate,
              metadata: { day: 30 - day }
            }
          });
        }
      }
      console.log(`   📈 Generated 30 days of ROI history`);
    }

    // Generate some commission transactions
    if (config.rank !== 'NONE' && config.rank !== 'ADMIN') {
      const commissionCount = Math.floor(Math.random() * 10) + 5;
      for (let c = 0; c < commissionCount; c++) {
        const txDate = new Date();
        txDate.setDate(txDate.getDate() - Math.floor(Math.random() * 30));
        
        await prisma.walletTransaction.create({
          data: {
            userId: user.id,
            amount: new Decimal(Math.floor(Math.random() * 500) + 50),
            type: TransactionType.COMMISSION,
            destWallet: WalletType.REWARD,
            description: `Level ${Math.floor(Math.random() * 5) + 1} Income`,
            status: 'COMPLETED',
            createdAt: txDate,
            metadata: { type: 'LEVEL_INCOME', level: Math.floor(Math.random() * 5) + 1 }
          }
        });
      }
      console.log(`   🤝 Generated ${commissionCount} commission transactions`);
    }

    // Create rank history for ranked users
    if (config.rank !== 'NONE') {
      await prisma.rankHistory.create({
        data: {
          userId: user.id,
          rank: config.rank,
          totalBusiness: config.depositBalance || 0,
          strongestLeg: (config.depositBalance || 0) * 0.6,
          otherLegs: (config.depositBalance || 0) * 0.4,
          achievedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
        }
      });
      console.log(`   🏆 Created rank history`);
    }
  }

  // Create some additional referrals for the whale/leader
  console.log('\n👥 Creating additional referral network...');
  
  const whale = createdUsers.find(u => u.email === 'whale@globerise.com');
  const leader = createdUsers.find(u => u.email === 'leader@globerise.com');

  if (whale && leader) {
    // Create 10 direct referrals for whale
    for (let i = 0; i < 10; i++) {
      const email = `team${i + 1}@demo.globerise.com`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) continue;

      await prisma.user.create({
        data: {
          email,
          password_hash: await bcrypt.hash('Demo@123', SALT_ROUNDS),
          is_verified: true,
          rank: i < 3 ? 'EXPLORER' : 'NONE',
          referralCode: generateReferralCode(),
          referredById: whale.id,
          profile: {
            create: {
              firstName: `Team`,
              lastName: `Member ${i + 1}`
            }
          },
          wallets: {
            create: {
              fiatBalance: 500,
              depositBalance: 1000 + (i * 500),
              rewardBalance: 100 + (i * 50)
            }
          }
        }
      });
    }
    console.log('   ✅ Created 10 referrals for whale@globerise.com');

    // Create 5 direct referrals for leader
    for (let i = 0; i < 5; i++) {
      const email = `member${i + 1}@demo.globerise.com`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) continue;

      await prisma.user.create({
        data: {
          email,
          password_hash: await bcrypt.hash('Demo@123', SALT_ROUNDS),
          is_verified: true,
          rank: 'NONE',
          referralCode: generateReferralCode(),
          referredById: leader.id,
          profile: {
            create: {
              firstName: `Member`,
              lastName: `#${i + 1}`
            }
          },
          wallets: {
            create: {
              fiatBalance: 200,
              depositBalance: 500,
              rewardBalance: 25
            }
          }
        }
      });
    }
    console.log('   ✅ Created 5 referrals for leader@globerise.com');
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DEMO SEED COMPLETED!');
  console.log('='.repeat(60));
  console.log('\n📋 Demo Credentials:\n');
  
  for (const config of DEMO_USERS) {
    console.log(`   ${config.role === UserRole.ADMIN ? '👑' : '👤'} ${config.email}`);
    console.log(`      Password: ${config.password}`);
    console.log(`      Rank: ${config.rank}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Additional test users: team1-10@demo.globerise.com, member1-5@demo.globerise.com');
  console.log('All demo users password: Demo@123');
  console.log('='.repeat(60));
}

// Run
seedDemoData()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

