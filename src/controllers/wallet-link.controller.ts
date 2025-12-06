import { Request, Response } from 'express';
import walletLinkService from '../services/wallet-link.service';
import { ResponseHandler } from '../utils/response';
import { WalletProvider } from '@prisma/client';

class WalletLinkController {
    // Link wallet
    async linkWallet(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { address, provider, chainId, signature, message } = req.body;

            if (!address || !provider || !chainId || !signature || !message) {
                return ResponseHandler.error(res, 'Missing required fields', 400);
            }

            const linkedWallet = await walletLinkService.linkWallet(
                userId,
                address,
                provider as WalletProvider,
                chainId,
                signature,
                message
            );

            return ResponseHandler.success(res, 'Wallet linked successfully', linkedWallet, 201);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to link wallet', 500);
        }
    }

    // Unlink wallet
    async unlinkWallet(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;

            await walletLinkService.unlinkWallet(userId, id);
            return ResponseHandler.success(res, 'Wallet unlinked successfully');
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to unlink wallet', 500);
        }
    }

    // Get user's linked wallets
    async getLinkedWallets(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const wallets = await walletLinkService.getUserLinkedWallets(userId);
            return ResponseHandler.success(res, 'Linked wallets retrieved successfully', wallets);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch linked wallets', 500);
        }
    }

    // Get wallet balances
    async getWalletBalances(req: Request, res: Response) {
        try {
            const { address } = req.params;
            const chainId = parseInt(req.query.chainId as string) || 1;

            const balances = await walletLinkService.getWalletBalances(address, chainId);
            return ResponseHandler.success(res, 'Wallet balances retrieved successfully', balances);
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to fetch wallet balances', 500);
        }
    }

    // Generate signature message
    async generateSignatureMessage(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { address } = req.body;

            if (!address) {
                return ResponseHandler.error(res, 'Address is required', 400);
            }

            const timestamp = Date.now();
            const message = walletLinkService.generateSignatureMessage(userId, address, timestamp);

            return ResponseHandler.success(res, 'Signature message generated', {
                message,
                timestamp,
            });
        } catch (error: any) {
            return ResponseHandler.error(res, error.message || 'Failed to generate signature message', 500);
        }
    }
}

export default new WalletLinkController();

