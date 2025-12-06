import prisma from '../config/database';
import { InvestmentType, TransactionType, WalletType, InvestmentStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';
import commissionService from './commission.service';

class InvestmentService {
  /**
   * Create a new active package (MLM Investment)
   * Flows: Deposit Wallet -> Deposit Wallet (Locked) - User deposits from linked wallet first
   * Minimum: 100 GRT tokens
   */
  async createPackage(userId: string, amount: number | Decimal): Promise<any> {
    const investAmount = new Decimal(amount);
    const MIN_AMOUNT = new Decimal(100); // Minimum 100 GRT tokens
    
    if (investAmount.lte(0)) throw new Error('Investment amount must be positive');
    if (investAmount.lt(MIN_AMOUNT)) {
      throw new Error(`Minimum investment amount is ${MIN_AMOUNT} GRT tokens`);
    }

    // 1. Validation: Direct Referral Counting Logic
    // Next referral must invest MORE than referrer's package amount to count for cap increase
    // This is handled in the referral/cap logic, not here in package creation
    // Package creation just needs to validate minimum amount

    // 2. Execute Investment (Atomic)
    const investment = await prisma.$transaction(async (tx) => {
      // 2.1 Check Balance & Debit Deposit Wallet
      const wallets = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      if (wallets.depositBalance.lt(investAmount)) {
        throw new Error('Insufficient balance in Deposit Wallet. Please deposit from your linked wallet first.');
      }
      // Amount stays in Deposit Wallet (locked for package)
      // No transfer needed - it's already in Deposit Wallet

      // 2.2 Create Wallet Transaction Record (Investment)
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: investAmount,
          type: TransactionType.INVESTMENT,
          sourceWallet: WalletType.DEPOSIT,
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
   * Create a fixed term deposit (Staking)
   * Flows: Deposit Wallet -> Deposit Wallet (Locked for staking)
   */
  async createFixedDeposit(userId: string, amount: number | Decimal, durationMonths: number): Promise<any> {
    const investAmount = new Decimal(amount);
    if (investAmount.lte(0)) throw new Error('Amount must be positive');

    return await prisma.$transaction(async (tx) => {
      // 1. Check Balance in Deposit Wallet
      const wallets = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      if (wallets.depositBalance.lt(investAmount)) {
        throw new Error('Insufficient balance in Deposit Wallet. Please deposit from your linked wallet first.');
      }
      // Amount stays in Deposit Wallet (locked for staking)
      // No transfer needed - it's already in Deposit Wallet

      // 2. Record Tx
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: investAmount,
          type: TransactionType.INVESTMENT,
          sourceWallet: WalletType.DEPOSIT,
          destWallet: WalletType.DEPOSIT,
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
