import prisma from '../config/database';
import { Prisma, WalletType, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Define balances type based on Prisma schema
export interface WalletBalances {
  deposit: Decimal;
  reward: Decimal;
  withdrawal: Decimal;
}

class WalletService {
  /**
   * Initialize wallets for a user if they don't exist
   */
  async ensureWalletsExist(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx || prisma;
    const wallets = await client.userWallets.findUnique({ where: { userId } });
    
    if (!wallets) {
      await client.userWallets.create({
        data: { userId }
      });
    }
  }

  /**
   * Get all wallet balances for a user
   */
  async getWallets(userId: string): Promise<WalletBalances> {
    const wallets = await prisma.userWallets.findUnique({
      where: { userId }
    });

    if (!wallets) {
      // If no wallets found, return zeros (and lazily create them later or now)
      return {
        deposit: new Decimal(0),
        reward: new Decimal(0),
        withdrawal: new Decimal(0),
      };
    }

    return {
      deposit: wallets.depositBalance,
      reward: wallets.rewardBalance,
      withdrawal: wallets.withdrawalBalance,
    };
  }

  /**
   * Generic internal transfer between user's own wallets
   */
  async transfer(
    userId: string,
    fromWallet: WalletType,
    toWallet: WalletType,
    amount: Decimal | number,
    description: string,
    referenceId?: string,
    referenceType?: string,
    metadata?: any
  ): Promise<void> {
    const transferAmount = new Decimal(amount);
    if (transferAmount.lte(0)) throw new Error('Transfer amount must be positive');

    await prisma.$transaction(async (tx) => {
      await this.ensureWalletsExist(userId, tx);

      // 1. Decrement Source
      await this.updateBalance(userId, fromWallet, transferAmount.negated(), tx);

      // 2. Increment Destination
      await this.updateBalance(userId, toWallet, transferAmount, tx);

      // 3. Record Transaction
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: transferAmount,
          type: TransactionType.TRANSFER,
          sourceWallet: fromWallet,
          destWallet: toWallet,
          description,
          referenceId,
          referenceType,
          metadata: metadata ? metadata : undefined,
        },
      });
    });
  }

  /**
   * External Credit (e.g., Admin deposit, Blockchain deposit)
   */
  async creditWallet(
    userId: string,
    wallet: WalletType,
    amount: Decimal | number,
    type: TransactionType,
    description: string,
    referenceId?: string,
    referenceType?: string,
    metadata?: any
  ): Promise<void> {
    const creditAmount = new Decimal(amount);
    if (creditAmount.lte(0)) throw new Error('Credit amount must be positive');

    await prisma.$transaction(async (tx) => {
      await this.ensureWalletsExist(userId, tx);

      // Update Balance
      await this.updateBalance(userId, wallet, creditAmount, tx);

      // Record Transaction
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: creditAmount,
          type, // e.g., DEPOSIT, ROI, COMMISSION
          destWallet: wallet,
          description,
          referenceId,
          referenceType,
          metadata: metadata ? metadata : undefined,
        },
      });
    });
  }

  /**
   * External Debit (e.g., Admin penalty, Withdrawal request)
   */
  async debitWallet(
    userId: string,
    wallet: WalletType,
    amount: Decimal | number,
    type: TransactionType,
    description: string,
    referenceId?: string,
    referenceType?: string,
    metadata?: any
  ): Promise<void> {
    const debitAmount = new Decimal(amount);
    if (debitAmount.lte(0)) throw new Error('Debit amount must be positive');

    await prisma.$transaction(async (tx) => {
      await this.ensureWalletsExist(userId, tx);

      // Update Balance (negative)
      await this.updateBalance(userId, wallet, debitAmount.negated(), tx);

      // Record Transaction
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: debitAmount, // Stored as positive number in amount field usually, context implies debit
          type, // e.g., WITHDRAWAL
          sourceWallet: wallet,
          description,
          referenceId,
          referenceType,
          metadata: metadata ? metadata : undefined,
        },
      });
    });
  }

  /**
   * Helper to update a specific wallet balance atomically
   */
  private async updateBalance(
    userId: string,
    wallet: WalletType,
    amount: Decimal, // can be positive or negative
    tx: Prisma.TransactionClient
  ): Promise<void> {
    // Map WalletType enum to actual column names
    const fieldMap: Record<WalletType, keyof Prisma.UserWalletsUpdateInput> = {
      [WalletType.DEPOSIT]: 'depositBalance',
      [WalletType.REWARD]: 'rewardBalance',
      [WalletType.WITHDRAWAL]: 'withdrawalBalance',
    };

    const fieldName = fieldMap[wallet];
    if (!fieldName) throw new Error(`Unknown wallet type: ${wallet}`);

    // 1. Fetch current balance to check for insufficient funds (if debiting)
    if (amount.isNegative()) {
      const current = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      // Use type assertion or access property dynamically if needed, 
      // but since we know the shape of UserWallets, we can cast or assume safely here for the check.
      // Prisma returns Decimal, so we compare.
      const currentBalance = (current as any)[fieldName] as Decimal;
      
      if (currentBalance.plus(amount).isNegative()) {
        throw new Error(`Insufficient funds in ${wallet} wallet`);
      }
    }

    // 2. Atomic Increment
    await tx.userWallets.update({
      where: { userId },
      data: {
        [fieldName]: { increment: amount },
      },
    });
  }
}

export default new WalletService();

