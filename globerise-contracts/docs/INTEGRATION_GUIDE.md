# GlobeRise Platform - Frontend Integration Guide

**Version:** 2.0.0
**Last Updated:** November 25, 2025
**Audience:** Frontend Developers

---

## 🚀 Quick Start

### Prerequisites

```bash
npm install ethers@^6.0.0
# or
yarn add ethers@^6.0.0
```

### Basic Setup

```typescript
import { ethers } from "ethers";

// Connect to Ethereum
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Contract addresses (from deployment)
const TOKEN_ADDRESS = "0x..."; // GlobeRiseToken
const PLATFORM_ADDRESS = "0x..."; // GlobeRisePlatform

// Load contracts
const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
const platform = new ethers.Contract(PLATFORM_ADDRESS, PLATFORM_ABI, signer);
```

---

## 📋 Contract ABIs

### Getting ABIs

After compilation, ABIs are in `typechain-types/`:

```bash
# Token ABI
cat typechain-types/contracts/GlobeRiseToken.sol/GlobeRiseToken.json

# Platform ABI
cat typechain-types/contracts/GlobeRisePlatform.sol/GlobeRisePlatform.json
```

**Or use TypeChain for type-safe development:**

```typescript
import { GlobeRiseToken, GlobeRisePlatform } from "../typechain-types";

const token: GlobeRiseToken = GlobeRiseToken__factory.connect(
  TOKEN_ADDRESS,
  signer
);
const platform: GlobeRisePlatform = GlobeRisePlatform__factory.connect(
  PLATFORM_ADDRESS,
  signer
);
```

---

## 🔐 User Authentication

### Connect Wallet

```typescript
async function connectWallet() {
  try {
    // Request account access
    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    console.log("Connected:", address);
    return { provider, signer, address };
  } catch (error) {
    console.error("User rejected connection:", error);
    throw error;
  }
}
```

### Check Network

```typescript
async function checkNetwork(provider: ethers.BrowserProvider) {
  const network = await provider.getNetwork();

  const EXPECTED_CHAIN_ID = 1; // Mainnet

  if (network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
    throw new Error(
      `Please switch to Ethereum Mainnet (Chain ID: ${EXPECTED_CHAIN_ID})`
    );
  }

  return network;
}
```

### Listen for Account/Network Changes

```typescript
// Listen for account changes
window.ethereum.on("accountsChanged", (accounts: string[]) => {
  if (accounts.length === 0) {
    console.log("User disconnected wallet");
    // Redirect to login
  } else {
    console.log("Account switched to:", accounts[0]);
    // Reload user data
  }
});

// Listen for network changes
window.ethereum.on("chainChanged", (chainId: string) => {
  console.log("Network changed to:", chainId);
  // Reload page
  window.location.reload();
});
```

---

## 👤 User Registration

### Check if User is Registered

```typescript
async function isUserRegistered(address: string): Promise<boolean> {
  const user = await platform.getUser(address);
  return user.registered;
}
```

### Check if Sponsor is Dormant

```typescript
async function isSponsorDormant(sponsorAddress: string): Promise<boolean> {
  if (sponsorAddress === ethers.ZeroAddress) return false;
  return await platform.isDormant(sponsorAddress);
}
```

### Register User

```typescript
async function registerUser(sponsorAddress: string) {
  try {
    // If no sponsor, use zero address
    const sponsor = sponsorAddress || ethers.ZeroAddress;

    // Check if sponsor is dormant (90+ days inactive)
    if (sponsor !== ethers.ZeroAddress) {
      const dormant = await platform.isDormant(sponsor);
      if (dormant) {
        throw new Error(
          "Sponsor is dormant (90+ days inactive). Choose another sponsor."
        );
      }
    }

    // Estimate gas
    const gasEstimate = await platform.registerUser.estimateGas(sponsor);
    const gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer

    // Send transaction
    const tx = await platform.registerUser(sponsor, { gasLimit });

    console.log("Transaction sent:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    console.log("✅ Registered! Gas used:", receipt.gasUsed.toString());

    // Get user data
    const user = await platform.getUser(await signer.getAddress());
    return user;
  } catch (error) {
    console.error("Registration failed:", error);
    throw error;
  }
}
```

---

## 💰 Investment Functions

### Create Investment (No Tier Parameter!)

```typescript
async function createInvestment(amount: string) {
  try {
    const amountWei = ethers.parseEther(amount);

    // Step 1: Approve tokens
    console.log("Step 1: Approving tokens...");
    const approveTx = await token.approve(PLATFORM_ADDRESS, amountWei);
    await approveTx.wait();
    console.log("✅ Tokens approved");

    // Step 2: Create investment (NO tier parameter - tier is dynamic!)
    console.log("Step 2: Creating investment...");
    const investTx = await platform.createInvestment(amountWei);
    const receipt = await investTx.wait();
    console.log("✅ Investment created! TX:", receipt.hash);

    // Step 3: Get investment details
    const investments = await platform.getUserInvestments(
      await signer.getAddress()
    );
    const newInvestment = investments[investments.length - 1];

    return {
      investmentId: investments.length - 1,
      amount: ethers.formatEther(newInvestment.amount),
      maxClaimable: ethers.formatEther(newInvestment.maxClaimable),
      startTime: new Date(Number(newInvestment.startTime) * 1000),
    };
  } catch (error) {
    handleError(error);
  }
}
```

### Get User's Investments with Dynamic ROI Tier

```typescript
async function getUserInvestments(address: string) {
  const investments = await platform.getUserInvestments(address);

  const investmentsWithTiers = await Promise.all(
    investments.map(async (inv, index) => {
      // Get dynamic ROI tier for this investment
      const tierInfo = await platform.getInvestmentROITier(address, index);

      return {
        id: index,
        amount: ethers.formatEther(inv.amount),
        // Tier is now dynamic!
        currentTier: tierInfo.tier,
        currentROI: Number(tierInfo.roiRate) / 100, // Convert basis points to %
        capMultiplier: Number(tierInfo.capMultiplier) / 10000,
        startDate: new Date(Number(inv.startTime) * 1000),
        passiveROIClaimed: ethers.formatEther(inv.passiveROIClaimed),
        maxClaimable: ethers.formatEther(inv.maxClaimable),
        active: inv.active,
        referrer: inv.referrer,
      };
    })
  );

  return investmentsWithTiers;
}
```

### Claim ROI

```typescript
async function claimROI(investmentId: number) {
  try {
    const userAddress = await signer.getAddress();
    const investments = await platform.getUserInvestments(userAddress);
    const investment = investments[investmentId];

    if (!investment.active) {
      throw new Error("Investment is no longer active (reached max cap)");
    }

    // Calculate months elapsed
    const monthsElapsed = Math.floor(
      (Date.now() / 1000 - Number(investment.startTime)) / (30 * 24 * 60 * 60)
    );

    if (monthsElapsed === 0) {
      throw new Error("Cannot claim before 30 days");
    }

    // Claim ROI
    const tx = await platform.claimROI(investmentId);
    const receipt = await tx.wait();

    // Parse event to get claimed amount and tier
    const event = receipt.logs.find((log: any) => {
      try {
        return platform.interface.parseLog(log)?.name === "ROIClaimed";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = platform.interface.parseLog(event);
      const claimedAmount = parsed?.args[2];
      const roiTier = parsed?.args[3];
      console.log(
        "✅ Claimed:",
        ethers.formatEther(claimedAmount),
        "GRT at Tier",
        roiTier
      );
    }

    return receipt;
  } catch (error) {
    handleError(error);
  }
}
```

---

## 📦 Staking Functions (NEW!)

### Create Stake

```typescript
async function createStake(amount: string, tier: number) {
  try {
    if (tier < 1 || tier > 5) {
      throw new Error("Invalid tier. Must be 1-5.");
    }

    const amountWei = ethers.parseEther(amount);

    // Approve tokens
    const approveTx = await token.approve(PLATFORM_ADDRESS, amountWei);
    await approveTx.wait();

    // Create stake
    const stakeTx = await platform.createStake(amountWei, tier);
    const receipt = await stakeTx.wait();

    console.log("✅ Stake created!");

    return receipt;
  } catch (error) {
    handleError(error);
  }
}

// Staking tier info
const STAKING_TIERS = {
  1: { duration: "3 months", monthlyRate: "1.25%", totalReturn: "3.75%" },
  2: { duration: "6 months", monthlyRate: "1.75%", totalReturn: "10.5%" },
  3: { duration: "12 months", monthlyRate: "2.25%", totalReturn: "27%" },
  4: { duration: "18 months", monthlyRate: "4%", totalReturn: "72%" },
  5: { duration: "24 months", monthlyRate: "4.75%", totalReturn: "114%" },
};
```

### Get User's Stakes

```typescript
async function getUserStakes(address: string) {
  const stakes = await platform.getStakingPackages(address);

  return stakes.map((stake, index) => ({
    id: index,
    amount: ethers.formatEther(stake.amount),
    tier: stake.durationTier,
    tierInfo: STAKING_TIERS[stake.durationTier],
    startDate: new Date(Number(stake.startTime) * 1000),
    maturityDate: new Date(Number(stake.maturityTime) * 1000),
    monthlyRate: Number(stake.monthlyRate) / 100, // basis points to %
    claimed: stake.claimed,
    canClaim: !stake.claimed && Date.now() / 1000 >= Number(stake.maturityTime),
  }));
}
```

### Claim Stake

```typescript
async function claimStake(stakeId: number) {
  try {
    const tx = await platform.claimStake(stakeId);
    const receipt = await tx.wait();

    // Parse event
    const event = receipt.logs.find((log: any) => {
      try {
        return platform.interface.parseLog(log)?.name === "StakeClaimed";
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = platform.interface.parseLog(event);
      const principal = parsed?.args[2];
      const interest = parsed?.args[3];
      console.log(
        "✅ Claimed Principal:",
        ethers.formatEther(principal),
        "GRT"
      );
      console.log("✅ Claimed Interest:", ethers.formatEther(interest), "GRT");
    }

    return receipt;
  } catch (error) {
    handleError(error);
  }
}
```

---

## 💸 Withdrawal Functions

### Check if Today is Monday (Withdrawal Day)

```typescript
async function canWithdrawToday(): Promise<boolean> {
  return await platform.isWithdrawalDay();
}

// Client-side check (for UI)
function isMondayUTC(): boolean {
  const now = new Date();
  return now.getUTCDay() === 1; // 0 = Sunday, 1 = Monday
}
```

### Request Withdrawal (Monday Only!)

```typescript
async function requestWithdrawal(amount: string, type: 0 | 1) {
  try {
    // Check if today is Monday
    const isWithdrawalDay = await platform.isWithdrawalDay();
    if (!isWithdrawalDay) {
      const daysUntilMonday = getDaysUntilMonday();
      throw new Error(
        `Withdrawals only allowed on Mondays. Next withdrawal day in ${daysUntilMonday} days.`
      );
    }

    const amountWei = ethers.parseEther(amount);

    // Check minimum
    const minWithdrawal = await platform.minWithdrawal();
    if (amountWei < minWithdrawal) {
      throw new Error(
        `Minimum withdrawal: ${ethers.formatEther(minWithdrawal)} GRT`
      );
    }

    // Check available balance
    const available = await platform.getWithdrawableBalance(
      await signer.getAddress()
    );
    if (amountWei > available) {
      throw new Error(
        `Insufficient balance. Available: ${ethers.formatEther(available)} GRT`
      );
    }

    // Request withdrawal
    const tx = await platform.requestWithdrawal(amountWei, type);
    const receipt = await tx.wait();

    console.log("✅ Withdrawal requested! TX:", receipt.hash);

    // Calculate expected net amount after 10% fee
    const netAmount = Number(amount) * 0.9;

    return {
      txHash: receipt.hash,
      grossAmount: amount,
      netAmount: netAmount.toFixed(2),
      fee: (Number(amount) * 0.1).toFixed(2),
      type: type === 0 ? "100% GRT" : "50/50 GRT+USDT",
      status: "Pending admin approval",
    };
  } catch (error) {
    handleError(error);
  }
}

function getDaysUntilMonday(): number {
  const today = new Date().getUTCDay();
  if (today === 1) return 0; // Today is Monday
  return today === 0 ? 1 : 8 - today;
}
```

### Check Withdrawal Requests

```typescript
async function getWithdrawalRequests(address: string) {
  const requests = await platform.getWithdrawalRequests(address);

  return requests.map((req, index) => {
    const grossAmount = ethers.formatEther(req.amount);
    const netAmount = Number(grossAmount) * 0.9; // 10% fee

    return {
      id: index,
      grossAmount: grossAmount,
      netAmount: netAmount.toFixed(4),
      fee: (Number(grossAmount) * 0.1).toFixed(4),
      type: req.withdrawalType === 0 ? "100% GRT" : "50/50 GRT+USDT",
      requestedAt: new Date(Number(req.requestTime) * 1000),
      status: ["Pending", "Approved", "Completed", "Rejected"][req.status],
    };
  });
}
```

---

## 📊 User Dashboard Data

### Get Complete User Profile

```typescript
async function getUserProfile(address: string) {
  const user = await platform.getUser(address);
  const investments = await platform.getUserInvestments(address);
  const stakes = await platform.getStakingPackages(address);
  const referrals = await platform.getDirectReferrals(address);
  const withdrawalRequests = await platform.getWithdrawalRequests(address);
  const withdrawableBalance = await platform.getWithdrawableBalance(address);
  const rankName = await platform.getUserRankName(address);
  const isDormant = await platform.isDormant(address);

  return {
    // Basic info
    address: address,
    registered: user.registered,
    registeredAt: new Date(Number(user.registrationTime) * 1000),
    sponsor: user.sponsor,
    isDormant: isDormant,

    // MLM structure (unlimited referrals now!)
    directReferrals: referrals.length,
    leftLeg: user.leftLeg,
    rightLeg: user.rightLeg,
    leftVolume: ethers.formatEther(user.leftVolume),
    rightVolume: ethers.formatEther(user.rightVolume),

    // Rank
    rank: user.rank,
    rankName: rankName,

    // Financial
    totalInvested: ethers.formatEther(user.totalInvested),
    totalCommissions: ethers.formatEther(user.totalCommissions),
    withdrawableBalance: ethers.formatEther(withdrawableBalance),

    // Investments
    investments: investments.length,
    activeInvestments: investments.filter((inv) => inv.active).length,

    // Staking
    totalStakes: stakes.length,
    activeStakes: stakes.filter((s) => !s.claimed).length,

    // Withdrawals
    pendingWithdrawals: withdrawalRequests.filter((req) => req.status === 0)
      .length,

    // Next withdrawal day
    canWithdrawToday: isMondayUTC(),
    daysUntilWithdrawal: getDaysUntilMonday(),
  };
}
```

---

## 🎧 Event Listening

### Listen for User's Events

```typescript
async function subscribeToUserEvents(userAddress: string, callback: Function) {
  // Investment created
  platform.on(
    platform.filters.InvestmentCreated(userAddress),
    (user, investmentId, amount, referrer, event) => {
      callback({
        type: "InvestmentCreated",
        user,
        investmentId: investmentId.toString(),
        amount: ethers.formatEther(amount),
        referrer,
      });
    }
  );

  // ROI claimed (now includes tier!)
  platform.on(
    platform.filters.ROIClaimed(userAddress),
    (user, investmentId, amount, roiTier, event) => {
      callback({
        type: "ROIClaimed",
        user,
        investmentId: investmentId.toString(),
        amount: ethers.formatEther(amount),
        roiTier: roiTier,
      });
    }
  );

  // Stake created
  platform.on(
    platform.filters.StakeCreated(userAddress),
    (user, stakeId, amount, tier, event) => {
      callback({
        type: "StakeCreated",
        user,
        stakeId: stakeId.toString(),
        amount: ethers.formatEther(amount),
        tier: tier,
      });
    }
  );

  // Stake claimed
  platform.on(
    platform.filters.StakeClaimed(userAddress),
    (user, stakeId, principal, interest, event) => {
      callback({
        type: "StakeClaimed",
        user,
        stakeId: stakeId.toString(),
        principal: ethers.formatEther(principal),
        interest: ethers.formatEther(interest),
      });
    }
  );

  // Commission received
  platform.on(
    platform.filters.CommissionPaid(userAddress),
    (user, from, amount, commissionType, event) => {
      callback({
        type: "CommissionPaid",
        user,
        from,
        amount: ethers.formatEther(amount),
        commissionType,
      });
    }
  );

  // Rank updated
  platform.on(
    platform.filters.RankUpdated(userAddress),
    (user, newRank, oldRank, event) => {
      callback({
        type: "RankUpdated",
        user,
        newRank,
        oldRank,
      });
    }
  );

  // Withdrawal completed (now includes fee breakdown!)
  platform.on(
    platform.filters.WithdrawalCompleted(userAddress),
    (user, requestId, netAmount, devFee, treasuryFee, event) => {
      callback({
        type: "WithdrawalCompleted",
        user,
        requestId: requestId.toString(),
        netAmount: ethers.formatEther(netAmount),
        devFee: ethers.formatEther(devFee),
        treasuryFee: ethers.formatEther(treasuryFee),
      });
    }
  );
}
```

---

## 🔧 Error Handling

### Common Errors (Updated!)

```typescript
function handleError(error: any) {
  // NEW: Monday-only withdrawal check
  if (error.message.includes("NotWithdrawalDay")) {
    return "Withdrawals only allowed on Mondays. Please try again on Monday.";
  }

  // NEW: Dormant sponsor check
  if (error.message.includes("SponsorDormant")) {
    return "Sponsor is dormant (90+ days inactive). Please choose a different sponsor.";
  }

  // NEW: Staking errors
  if (error.message.includes("StakeNotMature")) {
    return "Stake has not reached maturity yet. Please wait until the maturity date.";
  }
  if (error.message.includes("StakeAlreadyClaimed")) {
    return "This stake has already been claimed.";
  }

  // Custom contract errors
  if (error.message.includes("NotRegistered")) {
    return "Please register before using the platform";
  }
  if (error.message.includes("InvalidAmount")) {
    return "Invalid amount. Check minimum requirements";
  }
  if (error.message.includes("InsufficientBalance")) {
    return "Insufficient balance. Check your withdrawable amount";
  }
  if (error.message.includes("EnforcedPause")) {
    return "Platform is paused for maintenance. Please try again later";
  }

  // ERC20 errors
  if (error.message.includes("ERC20InsufficientAllowance")) {
    return "Please approve tokens first";
  }
  if (error.message.includes("ERC20InsufficientBalance")) {
    return "Insufficient GRT token balance";
  }

  // User rejected
  if (error.code === "ACTION_REJECTED") {
    return "Transaction cancelled by user";
  }

  // Network errors
  if (error.code === "NETWORK_ERROR") {
    return "Network error. Please check your connection";
  }

  // Generic error
  return "Transaction failed. Please try again";
}
```

---

## 💡 Best Practices

### Gas Estimation

```typescript
async function createInvestmentWithGasEstimate(amount: string) {
  const amountWei = ethers.parseEther(amount);

  // Estimate gas (no tier parameter!)
  const gasEstimate = await platform.createInvestment.estimateGas(amountWei);
  const gasPrice = (await provider.getFeeData()).gasPrice;

  // Calculate cost
  const gasCostWei = gasEstimate * (gasPrice || 0n);
  const gasCostUSD = calculateGasCostUSD(gasCostWei); // Convert to USD

  // Show to user
  console.log("Estimated gas:", gasEstimate.toString());
  console.log("Gas price:", ethers.formatUnits(gasPrice || 0n, "gwei"), "gwei");
  console.log("Total cost:", "$" + gasCostUSD.toFixed(2));

  // Confirm with user before proceeding
  if (confirm(`Gas cost: $${gasCostUSD.toFixed(2)}. Continue?`)) {
    const tx = await platform.createInvestment(amountWei, {
      gasLimit: (gasEstimate * 120n) / 100n, // 20% buffer
    });
    return await tx.wait();
  }
}
```

### Withdrawal Day UI Helper

```typescript
// Show withdrawal countdown in UI
function getWithdrawalDayStatus() {
  const now = new Date();
  const utcDay = now.getUTCDay();

  if (utcDay === 1) {
    return {
      canWithdraw: true,
      message: "Today is withdrawal day! You can request withdrawals now.",
      nextWithdrawalDay: null,
    };
  }

  const daysUntil = utcDay === 0 ? 1 : 8 - utcDay;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntil);
  nextMonday.setUTCHours(0, 0, 0, 0);

  return {
    canWithdraw: false,
    message: `Withdrawals open in ${daysUntil} day(s)`,
    nextWithdrawalDay: nextMonday.toISOString(),
  };
}
```

---

## 📱 React Hook Example

```typescript
import { useState, useEffect } from "react";
import { ethers } from "ethers";

export function usePlatform() {
  const [platform, setPlatform] = useState<ethers.Contract | null>(null);
  const [token, setToken] = useState<ethers.Contract | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isDormant, setIsDormant] = useState(false);
  const [isWithdrawalDay, setIsWithdrawalDay] = useState(false);

  useEffect(() => {
    async function init() {
      if (!window.ethereum) return;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
      const platform = new ethers.Contract(
        PLATFORM_ADDRESS,
        PLATFORM_ABI,
        signer
      );

      const user = await platform.getUser(address);
      const dormant = await platform.isDormant(address);
      const withdrawalDay = await platform.isWithdrawalDay();

      setSigner(signer);
      setAddress(address);
      setToken(token);
      setPlatform(platform);
      setIsRegistered(user.registered);
      setIsDormant(dormant);
      setIsWithdrawalDay(withdrawalDay);
    }

    init();
  }, []);

  return {
    platform,
    token,
    signer,
    address,
    isRegistered,
    isDormant,
    isWithdrawalDay,
  };
}
```

---

## 🧪 Testing Integration

### Local Hardhat Network

```typescript
// In hardhat.config.ts, add:
networks: {
  hardhat: {
    chainId: 31337,
    mining: {
      auto: true,
      interval: 3000 // Mine every 3 seconds
    }
  }
}

// Connect frontend to localhost:8545
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
```

### Testnet (Sepolia)

```typescript
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY";
const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

// Use same contract ABIs
// Different addresses (from deployments/sepolia.json)
```

---

**For complete function reference, see API_REFERENCE.md**

**Last Updated:** November 25, 2025
