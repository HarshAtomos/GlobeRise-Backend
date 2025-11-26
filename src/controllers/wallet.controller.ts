import { Request, Response, NextFunction } from 'express';
import walletService from '../services/wallet.service';
import { ResponseHandler } from '../utils/response';
import { WalletType, TransactionType } from '@prisma/client';

class WalletController {
    // Get all wallet balances
    async getWallets(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);

            const balances = await walletService.getWallets(req.user.id);
            return ResponseHandler.success(res, 'Wallet balances retrieved', balances);
        } catch (err) {
            next(err);
        }
    }

    // Internal Transfer (e.g., Reward -> Withdrawal)
    // NOTE: Business logic usually restricts transfers. 
    // We only expose "Reward -> Deposit" (Compound) or "Reward -> Withdrawal" (Cashout).
    // "Fiat -> Deposit" is handled via Investment creation.
    // "Fiat -> Staking" is handled via Fixed Deposit.
    async transfer(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);
            const { fromWallet, toWallet, amount } = req.body;

            // Security: Only allow specific flows
            const allowedFlows = [
                { from: WalletType.REWARD, to: WalletType.DEPOSIT },     // Re-invest
                { from: WalletType.REWARD, to: WalletType.WITHDRAWAL },  // Cashout request preparation
                // Fiat -> Deposit is essentially "buying a package", done via Investment endpoint
            ];

            const isValidFlow = allowedFlows.some(f => f.from === fromWallet && f.to === toWallet);
            if (!isValidFlow) {
                return ResponseHandler.badRequest(res, 'Invalid transfer path');
            }

            await walletService.transfer(
                req.user.id,
                fromWallet,
                toWallet,
                amount,
                `User transfer: ${fromWallet} to ${toWallet}`
            );

            return ResponseHandler.success(res, 'Transfer successful');
        } catch (err) {
            next(err);
        }
    }

    // Admin Credit (For testing or admin manual deposit)
    async adminCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId, amount, wallet } = req.body;
            // Validation usually handled by admin middleware, but ensure params

            await walletService.creditWallet(
                userId,
                wallet as WalletType,
                amount,
                TransactionType.ADMIN_ADJUST,
                'Admin Manual Credit'
            );
            return ResponseHandler.success(res, 'Credit successful');
        } catch (err) {
            next(err);
        }
    }
}

export default new WalletController();

