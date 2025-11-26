import prisma from '../config/database';
import { InvestmentType, TransactionType, WalletType, InvestmentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';
import commissionService from './commission.service';

class InvestmentService {
  /**
   * Create a new active package (MLM Investment)
   * Flows: Fiat Wallet -> Deposit Wallet (Locked)
   */
  async createPackage(userId: string, amount: number | Decimal): Promise<any> {
    const investAmount = new Decimal(amount);
    if (investAmount.lte(0)) throw new Error('Investment amount must be positive');

    // 1. Validation: Progressive Rule
    // "Once a user invested X amount he can never invest less than X amount"
    // We check the user's MAX previous active package.
    const maxInvestment = await prisma.investment.findFirst({
      where: { 
        userId, 
        type: InvestmentType.PACKAGE,
        status: { in: [InvestmentStatus.ACTIVE, InvestmentStatus.COMPLETED] } 
      },
      orderBy: { amount: 'desc' },
    });

    if (maxInvestment && investAmount.lt(maxInvestment.amount)) {
      throw new Error(`New investment must be at least ${maxInvestment.amount} (Progressive Rule)`);
    }

    // 2. Validation: Downline Rule (Referral Validation)
    // "Referred account should pay equal or more than the parent"
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.referredById) {
      const referrerMaxPackage = await prisma.investment.findFirst({
        where: { 
          userId: user.referredById,
          type: InvestmentType.PACKAGE,
          status: InvestmentStatus.ACTIVE
        },
        orderBy: { amount: 'desc' },
      });

      if (referrerMaxPackage && investAmount.lt(referrerMaxPackage.amount)) {
        throw new Error(`Investment must be at least ${referrerMaxPackage.amount} to match your sponsor's level.`);
      }
    }

    // 3. Execute Investment (Atomic)
    const investment = await prisma.$transaction(async (tx) => {
      // 3.1 Check Balance & Debit Fiat
      const wallets = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      if (wallets.fiatBalance.lt(investAmount)) {
        throw new Error('Insufficient balance in Fiat Wallet');
      }
      await tx.userWallets.update({
        where: { userId },
        data: { 
          fiatBalance: { decrement: investAmount },
          depositBalance: { increment: investAmount } // Locked in Deposit Wallet
        }
      });

      // 3.2 Create Wallet Transaction Record (Investment)
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: investAmount,
          type: TransactionType.INVESTMENT,
          sourceWallet: WalletType.FIAT,
          destWallet: WalletType.DEPOSIT,
          description: 'Package Purchase',
        }
      });

      // 3.3 Create Investment Record
      const newInvestment = await tx.investment.create({
        data: {
          userId,
          amount: investAmount,
          type: InvestmentType.PACKAGE,
          status: InvestmentStatus.ACTIVE,
          roiRate: 8.0, // Default base rate (can be updated by ROI engine later based on rules)
          durationDays: 30 * 12, // Default 1 year? or indefinite until cap? usually indefinitely.
        }
      });

      return newInvestment;
    });

    // 4. Distribute Direct Referral Bonus (Post-transaction)
    // We do this outside the main transaction to avoid locking rows for too long, 
    // or we can keep it inside if we want strict atomicity. 
    // Since CommissionService uses its own transaction logic (via WalletService), 
    // we call it here. If it fails, the investment succeeds but commission fails (rare).
    // For strict consistency, Commission logic should support passing `tx`, but WalletService doesn't yet.
    // We'll run it asynchronously/afterwards for now.
    try {
        await commissionService.distributeDirectBonus(userId, investAmount);
    } catch (error) {
        console.error('Failed to distribute direct bonus:', error);
        // Ideally log this to a "FailedCommissions" table for retry
    }

    return investment;
  }

  /**
   * Create a fixed term deposit (Staking Wallet)
   */
  async createFixedDeposit(userId: string, amount: number | Decimal, durationMonths: number): Promise<any> {
    const investAmount = new Decimal(amount);
    if (investAmount.lte(0)) throw new Error('Amount must be positive');

    return await prisma.$transaction(async (tx) => {
      // 1. Debit Fiat -> Credit Staking
      const wallets = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      if (wallets.fiatBalance.lt(investAmount)) {
        throw new Error('Insufficient balance in Fiat Wallet');
      }

      await tx.userWallets.update({
        where: { userId },
        data: { 
          fiatBalance: { decrement: investAmount },
          stakingBalance: { increment: investAmount }
        }
      });

      // 2. Record Tx
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: investAmount,
          type: TransactionType.INVESTMENT,
          sourceWallet: WalletType.FIAT,
          destWallet: WalletType.STAKING,
          description: `Fixed Deposit (${durationMonths} months)`,
        }
      });

      // 3. Create Investment
      const investment = await tx.investment.create({
        data: {
          userId,
          amount: investAmount,
          type: InvestmentType.FIXED,
          status: InvestmentStatus.ACTIVE,
          durationDays: durationMonths * 30,
          // ROI for fixed deposits might be different, simpler interest
        }
      });

      return investment;
    });
  }
}

export default new InvestmentService();
