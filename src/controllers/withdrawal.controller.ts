import { Request, Response, NextFunction } from 'express';
import withdrawalService from '../services/withdrawal.service';
import { ResponseHandler } from '../utils/response';

class WithdrawalController {
  // Request Withdrawal (User)
  async requestWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return ResponseHandler.unauthorized(res);
      const { amount } = req.body;

      const transaction = await withdrawalService.requestWithdrawal(req.user.id, amount);
      return ResponseHandler.success(res, 'Withdrawal requested successfully', transaction);
    } catch (err) {
      next(err);
    }
  }

  // Approve Withdrawal (Admin)
  async approveWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const { feePercentage } = req.body; // Optional

      const result = await withdrawalService.approveWithdrawal(transactionId, feePercentage);
      return ResponseHandler.success(res, 'Withdrawal approved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  // Reject Withdrawal (Admin)
  async rejectWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;

      const result = await withdrawalService.rejectWithdrawal(transactionId, reason);
      return ResponseHandler.success(res, 'Withdrawal rejected successfully', result);
    } catch (err) {
      next(err);
    }
  }

  // Get Pending (Admin)
  async getPending(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query;
      const result = await withdrawalService.getPendingWithdrawals(Number(page), Number(limit));
      return ResponseHandler.success(res, 'Pending withdrawals retrieved', result);
    } catch (err) {
      next(err);
    }
  }
}

export default new WithdrawalController();

