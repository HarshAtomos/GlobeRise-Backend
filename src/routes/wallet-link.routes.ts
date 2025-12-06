import { Router } from 'express';
import walletLinkController from '../controllers/wallet-link.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// Generate signature message
router.post('/signature-message', walletLinkController.generateSignatureMessage);

// Link wallet
router.post('/link', walletLinkController.linkWallet);

// Unlink wallet
router.delete('/unlink/:id', walletLinkController.unlinkWallet);

// Get user's linked wallets
router.get('/linked', walletLinkController.getLinkedWallets);

// Get wallet balances
router.get('/balances/:address', walletLinkController.getWalletBalances);

export default router;

