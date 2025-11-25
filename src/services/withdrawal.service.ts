import prisma from '../config/database';
import { TransactionStatus, TransactionType, WalletType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import walletService from './wallet.service';

class WithdrawalService {
  /**
   * Request a withdrawal (Monday Only)
   */
  async requestWithdrawal(userId: string, amount: number | Decimal): Promise<any> {
    const withdrawalAmount = new Decimal(amount);
    if (withdrawalAmount.lte(0)) throw new Error('Withdrawal amount must be positive');

    // 1. Monday Constraint Check
    // Monday is day 1 (Sunday is 0)
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // Use UTC to be consistent
    
    // If today is NOT Monday (1)
    if (dayOfWeek !== 1) {
      throw new Error('Withdrawals are only open on Mondays (UTC).');
    }

    // 2. Create Transaction (Debit Withdrawal Wallet, Status: PENDING)
    // We use walletService.debitWallet, but we need to set status to PENDING.
    // However, walletService typically creates COMPLETED transactions.
    // We'll manually execute this transaction logic to handle the status correctly.
    
    return await prisma.$transaction(async (tx) => {
      // A. Check Balance & Debit
      const wallets = await tx.userWallets.findUniqueOrThrow({ where: { userId } });
      if (wallets.withdrawalBalance.lt(withdrawalAmount)) {
        throw new Error('Insufficient funds in Withdrawal Wallet');
      }

      await tx.userWallets.update({
        where: { userId },
        data: {
          withdrawalBalance: { decrement: withdrawalAmount }
        }
      });

      // B. Create Transaction Record (PENDING)
      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          amount: withdrawalAmount,
          type: TransactionType.WITHDRAWAL,
          sourceWallet: WalletType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          description: 'Withdrawal Request',
        }
      });

      return transaction;
    });
  }

  /**
   * Approve Withdrawal (Admin Only)
   * Status: PENDING -> COMPLETED
   * Apply Fee: Default 10% (Dynamic later)
   */
  async approveWithdrawal(transactionId: string, feePercentage: number = 10): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) throw new Error('Transaction not found');
      if (transaction.status !== TransactionStatus.PENDING) throw new Error('Transaction is not pending');
      if (transaction.type !== TransactionType.WITHDRAWAL) throw new Error('Not a withdrawal transaction');

      // Calculate Net Amount
      const feeFactor = new Decimal(feePercentage).div(100);
      const feeAmount = transaction.amount.mul(feeFactor);
      const netAmount = transaction.amount.minus(feeAmount);

      // Update Transaction
      const updatedTx = await tx.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.COMPLETED,
          metadata: { 
            ...(transaction.metadata as object),
            feePercentage,
            feeAmount: feeAmount.toString(),
            netAmount: netAmount.toString(),
            approvedAt: new Date()
          }
        }
      });

      return updatedTx;
    });
  }

  /**
   * Reject Withdrawal (Admin Only)
   * Status: PENDING -> REJECTED
   * Refund: Credit amount back to Withdrawal Wallet
   */
  async rejectWithdrawal(transactionId: string, reason: string): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { id: transactionId }
      });

      if (!transaction) throw new Error('Transaction not found');
      if (transaction.status !== TransactionStatus.PENDING) throw new Error('Transaction is not pending');

      // 1. Update Status
      const updatedTx = await tx.walletTransaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REJECTED,
          description: `Withdrawal Rejected: ${reason}`,
          metadata: {
            ...(transaction.metadata as object),
            rejectionReason: reason,
            rejectedAt: new Date()
          }
        }
      });

      // 2. Refund to Withdrawal Wallet
      await tx.userWallets.update({
        where: { userId: transaction.userId },
        data: {
          withdrawalBalance: { increment: transaction.amount }
        }
      });

      return updatedTx;
    });
  }

  /**
   * Get Pending Withdrawals (Admin)
   */
  async getPendingWithdrawals(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [withdrawals, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING
        },
        include: {
          user: {
            select: { email: true, id: true }
          }
        },
        orderBy: { createdAt: 'asc' }, // Oldest first
        skip,
        take: limit
      }),
      prisma.walletTransaction.count({
        where: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING
        }
      })
    ]);

    return { withdrawals, total, page, limit };
  }
}

export default new WithdrawalService();

