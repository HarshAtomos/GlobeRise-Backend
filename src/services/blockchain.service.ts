/**
 * Blockchain Service
 * Integrates with GlobeRisePlatform smart contract
 * 
 * This service reads on-chain data and can trigger admin operations.
 * User transactions (invest, withdraw) are done via frontend wallet signing.
 */

import { ethers } from 'ethers';
import { config } from '../config/env';

// Contract ABIs (simplified - add full ABIs from typechain-types after deployment)
const PLATFORM_ABI = [
    // Read functions
    'function getUser(address user) view returns (tuple(address sponsor, address leftLeg, address rightLeg, address[] directReferrals, uint256 leftVolume, uint256 rightVolume, uint8 rank, uint256 totalCommissions, uint256 totalInvested, bool registered, uint256 registrationTime))',
    'function getUserInvestments(address user) view returns (tuple(uint256 amount, uint256 startTime, uint256 passiveROIClaimed, uint256 maxClaimable, address referrer, bool active)[])',
    'function getWithdrawableBalance(address user) view returns (uint256)',
    'function getUserRankName(address user) view returns (string)',
    'function getDirectReferrals(address user) view returns (address[])',
    'function isDormant(address user) view returns (bool)',
    'function isWithdrawalDay() view returns (bool)',
    'function totalUsers() view returns (uint256)',
    'function totalInvestments() view returns (uint256)',
    'function totalCommissionsDistributed() view returns (uint256)',
    'function getStakingPackages(address user) view returns (tuple(uint256 amount, uint8 durationTier, uint256 startTime, uint256 maturityTime, uint256 monthlyRate, bool claimed)[])',
    // Events for listening
    'event UserRegistered(address indexed user, address indexed sponsor)',
    'event InvestmentCreated(address indexed user, uint256 indexed investmentId, uint256 amount, address indexed referrer)',
    'event ROIClaimed(address indexed user, uint256 indexed investmentId, uint256 amount, uint8 roiTier)',
    'event CommissionPaid(address indexed user, address indexed from, uint256 amount, string commissionType)',
    'event WithdrawalCompleted(address indexed user, uint256 indexed requestId, uint256 netAmount, uint256 devFee, uint256 treasuryFee)'
];

const TOKEN_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
];

export interface ChainUser {
    sponsor: string;
    leftLeg: string;
    rightLeg: string;
    directReferrals: string[];
    leftVolume: bigint;
    rightVolume: bigint;
    rank: number;
    totalCommissions: bigint;
    totalInvested: bigint;
    registered: boolean;
    registrationTime: bigint;
}

export interface ChainInvestment {
    amount: bigint;
    startTime: bigint;
    passiveROIClaimed: bigint;
    maxClaimable: bigint;
    referrer: string;
    active: boolean;
}

export interface ChainStake {
    amount: bigint;
    durationTier: number;
    startTime: bigint;
    maturityTime: bigint;
    monthlyRate: bigint;
    claimed: boolean;
}

class BlockchainService {
    private provider: ethers.JsonRpcProvider | null = null;
    private platform: ethers.Contract | null = null;
    private token: ethers.Contract | null = null;
    private initialized = false;

    /**
     * Initialize blockchain connection
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const rpcUrl = process.env.RPC_URL;
        const platformAddress = process.env.PLATFORM_ADDRESS;
        const tokenAddress = process.env.TOKEN_ADDRESS;

        if (!rpcUrl || !platformAddress || !tokenAddress) {
            console.warn('⚠️ Blockchain env vars not set. Running in mock mode.');
            return;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            this.platform = new ethers.Contract(platformAddress, PLATFORM_ABI, this.provider);
            this.token = new ethers.Contract(tokenAddress, TOKEN_ABI, this.provider);

            // Test connection
            const network = await this.provider.getNetwork();
            console.log(`✅ Connected to blockchain: Chain ID ${network.chainId}`);

            this.initialized = true;
        } catch (error) {
            console.error('❌ Blockchain connection failed:', error);
            throw error;
        }
    }

    /**
     * Check if service is connected
     */
    isConnected(): boolean {
        return this.initialized && this.platform !== null;
    }

    /**
     * Get on-chain user data
     */
    async getUser(walletAddress: string): Promise<ChainUser | null> {
        if (!this.platform) return null;

        try {
            const user = await this.platform.getUser(walletAddress);
            return {
                sponsor: user.sponsor,
                leftLeg: user.leftLeg,
                rightLeg: user.rightLeg,
                directReferrals: user.directReferrals,
                leftVolume: user.leftVolume,
                rightVolume: user.rightVolume,
                rank: user.rank,
                totalCommissions: user.totalCommissions,
                totalInvested: user.totalInvested,
                registered: user.registered,
                registrationTime: user.registrationTime
            };
        } catch (error) {
            console.error('Failed to get user:', error);
            return null;
        }
    }

    /**
     * Get user's investments from chain
     */
    async getUserInvestments(walletAddress: string): Promise<ChainInvestment[]> {
        if (!this.platform) return [];

        try {
            const investments = await this.platform.getUserInvestments(walletAddress);
            return investments.map((inv: any) => ({
                amount: inv.amount,
                startTime: inv.startTime,
                passiveROIClaimed: inv.passiveROIClaimed,
                maxClaimable: inv.maxClaimable,
                referrer: inv.referrer,
                active: inv.active
            }));
        } catch (error) {
            console.error('Failed to get investments:', error);
            return [];
        }
    }

    /**
     * Get user's staking packages from chain
     */
    async getUserStakes(walletAddress: string): Promise<ChainStake[]> {
        if (!this.platform) return [];

        try {
            const stakes = await this.platform.getStakingPackages(walletAddress);
            return stakes.map((stake: any) => ({
                amount: stake.amount,
                durationTier: stake.durationTier,
                startTime: stake.startTime,
                maturityTime: stake.maturityTime,
                monthlyRate: stake.monthlyRate,
                claimed: stake.claimed
            }));
        } catch (error) {
            console.error('Failed to get stakes:', error);
            return [];
        }
    }

    /**
     * Get withdrawable balance from chain
     */
    async getWithdrawableBalance(walletAddress: string): Promise<string> {
        if (!this.platform) return '0';

        try {
            const balance = await this.platform.getWithdrawableBalance(walletAddress);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Failed to get withdrawable balance:', error);
            return '0';
        }
    }

    /**
     * Check if today is withdrawal day (Monday)
     */
    async isWithdrawalDay(): Promise<boolean> {
        if (!this.platform) {
            // Fallback: check locally
            const day = new Date().getUTCDay();
            return day === 1; // Monday
        }

        try {
            return await this.platform.isWithdrawalDay();
        } catch (error) {
            console.error('Failed to check withdrawal day:', error);
            return false;
        }
    }

    /**
     * Check if user is dormant (90+ days inactive)
     */
    async isDormant(walletAddress: string): Promise<boolean> {
        if (!this.platform) return false;

        try {
            return await this.platform.isDormant(walletAddress);
        } catch (error) {
            console.error('Failed to check dormant status:', error);
            return false;
        }
    }

    /**
     * Get user's rank name from chain
     */
    async getUserRankName(walletAddress: string): Promise<string> {
        if (!this.platform) return 'UNKNOWN';

        try {
            return await this.platform.getUserRankName(walletAddress);
        } catch (error) {
            console.error('Failed to get rank name:', error);
            return 'UNKNOWN';
        }
    }

    /**
     * Get token balance
     */
    async getTokenBalance(walletAddress: string): Promise<string> {
        if (!this.token) return '0';

        try {
            const balance = await this.token.balanceOf(walletAddress);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Failed to get token balance:', error);
            return '0';
        }
    }

    /**
     * Get platform statistics
     */
    async getPlatformStats(): Promise<{
        totalUsers: number;
        totalInvestments: string;
        totalCommissions: string;
    } | null> {
        if (!this.platform) return null;

        try {
            const [totalUsers, totalInvestments, totalCommissions] = await Promise.all([
                this.platform.totalUsers(),
                this.platform.totalInvestments(),
                this.platform.totalCommissionsDistributed()
            ]);

            return {
                totalUsers: Number(totalUsers),
                totalInvestments: ethers.formatEther(totalInvestments),
                totalCommissions: ethers.formatEther(totalCommissions)
            };
        } catch (error) {
            console.error('Failed to get platform stats:', error);
            return null;
        }
    }

    /**
     * Listen to contract events
     */
    onEvent(eventName: string, callback: (...args: any[]) => void): void {
        if (!this.platform) {
            console.warn('Cannot listen to events: not connected');
            return;
        }

        this.platform.on(eventName, callback);
        console.log(`📡 Listening to ${eventName} events`);
    }

    /**
     * Stop listening to events
     */
    removeAllListeners(): void {
        if (this.platform) {
            this.platform.removeAllListeners();
        }
    }

    /**
     * Format wei to ether
     */
    formatEther(wei: bigint): string {
        return ethers.formatEther(wei);
    }

    /**
     * Parse ether to wei
     */
    parseEther(ether: string): bigint {
        return ethers.parseEther(ether);
    }
}

// Export singleton
export const blockchainService = new BlockchainService();
export default blockchainService;

