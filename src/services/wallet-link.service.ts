import { PrismaClient, WalletProvider } from '@prisma/client';
import { ethers } from 'ethers';
import prisma from '../config/database';

class WalletLinkService {
    // Verify wallet signature
    async verifySignature(
        address: string,
        message: string,
        signature: string
    ): Promise<boolean> {
        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === address.toLowerCase();
        } catch (error) {
            console.error('Error verifying signature:', error);
            return false;
        }
    }

    // Link wallet to user account
    async linkWallet(
        userId: string,
        address: string,
        provider: WalletProvider,
        chainId: number,
        signature: string,
        message: string
    ) {
        // Verify signature
        const isValid = await this.verifySignature(address, message, signature);
        if (!isValid) {
            throw new Error('Invalid signature');
        }

        // Check if wallet is already linked to another user
        const existingLink = await prisma.linkedWallet.findFirst({
            where: {
                address: address.toLowerCase(),
                chainId,
                isActive: true,
                userId: { not: userId },
            },
        });

        if (existingLink) {
            throw new Error('This wallet is already linked to another account');
        }

        // Create or update link
        return prisma.linkedWallet.upsert({
            where: {
                userId_address_chainId: {
                    userId,
                    address: address.toLowerCase(),
                    chainId,
                },
            },
            update: {
                isActive: true,
                lastSynced: new Date(),
            },
            create: {
                userId,
                address: address.toLowerCase(),
                provider,
                chainId,
                isActive: true,
                lastSynced: new Date(),
            },
        });
    }

    // Unlink wallet
    async unlinkWallet(userId: string, walletId: string) {
        const wallet = await prisma.linkedWallet.findUnique({
            where: { id: walletId },
        });

        if (!wallet || wallet.userId !== userId) {
            throw new Error('Wallet not found or access denied');
        }

        return prisma.linkedWallet.update({
            where: { id: walletId },
            data: {
                isActive: false,
            },
        });
    }

    // Get user's linked wallets
    async getUserLinkedWallets(userId: string) {
        return prisma.linkedWallet.findMany({
            where: {
                userId,
                isActive: true,
            },
            orderBy: {
                linkedAt: 'desc',
            },
        });
    }

    // Get blockchain balances for an address
    async getWalletBalances(address: string, chainId: number): Promise<{
        native: string;
        grt: string;
        usdt: string;
    }> {
        // This would integrate with your blockchain service
        // For now, return placeholder structure
        // You'll need to implement actual balance fetching using ethers.js
        // and your contract addresses

        try {
            // Example implementation (you'll need to configure RPC and contract addresses)
            // const provider = new ethers.JsonRpcProvider(RPC_URL);
            // const nativeBalance = await provider.getBalance(address);
            // const grtBalance = await grtContract.balanceOf(address);
            // const usdtBalance = await usdtContract.balanceOf(address);

            return {
                native: '0',
                grt: '0',
                usdt: '0',
            };
        } catch (error) {
            console.error('Error fetching wallet balances:', error);
            return {
                native: '0',
                grt: '0',
                usdt: '0',
            };
        }
    }

    // Generate message for signature
    generateSignatureMessage(userId: string, address: string, timestamp: number): string {
        return `GlobeRise Wallet Linking\n\nUser ID: ${userId}\nAddress: ${address}\nTimestamp: ${timestamp}\n\nBy signing this message, you confirm that you own this wallet address.`;
    }
}

export default new WalletLinkService();

