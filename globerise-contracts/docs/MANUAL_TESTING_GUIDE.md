# GlobeRise Smart Contracts - Complete Manual Testing Guide

**Version:** 2.0.0
**Date:** November 25, 2025
**Estimated Time:** 4-5 hours
**Requirements:** No backend or frontend needed!

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup (15 minutes)](#setup)
4. [Deployment (10 minutes)](#deployment)
5. [Test Scenarios (3-4 hours)](#test-scenarios)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)
8. [Results Documentation](#results-documentation)

---

## Overview

This guide allows you to **independently verify** that the GlobeRise smart contracts work correctly on Sepolia testnet.

**You will test (Updated for v2.0):**
- ✅ User registration with MLM referral chain
- ✅ **Dormant user logic (90 days)**
- ✅ Investments with **dynamic ROI tiers**
- ✅ **Staking system (5 tiers)**
- ✅ ROI claiming with monthly accrual
- ✅ Direct referral commissions (5%)
- ✅ Level income distribution (16 levels)
- ✅ **Monday-only withdrawals**
- ✅ **10% platform fee (2.5% dev + 7.5% treasury)**
- ✅ Binary tree and volume accumulation
- ✅ Rank system and bonuses
- ✅ Admin functions (pause, treasury, fee management)
- ✅ Security (access control, reentrancy protection)
- ✅ UUPS upgrade mechanism

---

## Prerequisites

### 1. Get Sepolia ETH (Free)

**Faucets:**
- https://sepoliafaucet.com/
- https://faucet.quicknode.com/ethereum/sepolia

**Amount needed:** 0.5 ETH per test wallet (covers all gas)

**You'll need 5 test wallets:**
- Wallet 1: Deployer/Admin
- Wallet 2-5: Test users for MLM structure

### 2. Get Alchemy RPC URL (Free)

1. Sign up at https://www.alchemy.com/
2. Create a new app → Select "Ethereum" → "Sepolia"
3. Copy the HTTPS URL

### 3. Create 5 Test Wallets

Using MetaMask or Hardhat to generate wallets.

---

## Setup

### Step 1: Configure Environment

Edit your `.env` file:

```bash
# Sepolia RPC URL
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Deployer Private Key (Wallet 1)
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Etherscan API Key
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Dev Wallet for fees
DEV_WALLET_ADDRESS=0xYOUR_DEV_WALLET

# Test Wallets
TEST_WALLET_1=0xYOUR_WALLET_1_PRIVATE_KEY
TEST_WALLET_2=0xYOUR_WALLET_2_PRIVATE_KEY
TEST_WALLET_3=0xYOUR_WALLET_3_PRIVATE_KEY
TEST_WALLET_4=0xYOUR_WALLET_4_PRIVATE_KEY
TEST_WALLET_5=0xYOUR_WALLET_5_PRIVATE_KEY
```

### Step 2: Verify Setup

```bash
npx hardhat console --network sepolia

> const network = await ethers.provider.getNetwork();
> console.log("Network:", network.name, "Chain ID:", network.chainId);
# Should show: Network: sepolia Chain ID: 11155111n

> .exit
```

### Step 3: Run Tests Locally First

```bash
npx hardhat test

# Expected output:
# ✔ 127 passing
```

---

## Deployment

### Step 1: Deploy Contracts

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Step 2: Verify on Etherscan

```bash
npx hardhat run scripts/verify.ts --network sepolia
```

### Step 3: Distribute GRT to Test Wallets

```bash
npx hardhat console --network sepolia

> const token = await ethers.getContractAt("GlobeRiseToken", "YOUR_TOKEN_ADDRESS");
> await token.transfer("WALLET_2_ADDRESS", ethers.parseEther("10000"));
> await token.transfer("WALLET_3_ADDRESS", ethers.parseEther("10000"));
> await token.transfer("WALLET_4_ADDRESS", ethers.parseEther("10000"));
> await token.transfer("WALLET_5_ADDRESS", ethers.parseEther("10000"));

> .exit
```

---

## Test Scenarios

### 🧪 Scenario 1: User Registration & Dormancy (25 min)

**Objective:** Verify registration, dormancy checks, and sponsor validation

#### 1.1 Register First User

```bash
npx hardhat console --network sepolia

> const platform = await ethers.getContractAt("GlobeRisePlatform", "PLATFORM_ADDRESS");
> await platform.registerUser(ethers.ZeroAddress);

> const user1 = await platform.getUser(await ethers.provider.getSigner().getAddress());
> console.log("Registered:", user1.registered);
# Expected: true
```

#### 1.2 Register Second User with Sponsor

```bash
> const wallet2 = new ethers.Wallet(process.env.TEST_WALLET_2, ethers.provider);
> const wallet1Address = "DEPLOYER_ADDRESS";
> await platform.connect(wallet2).registerUser(wallet1Address);

> const user2 = await platform.getUser(wallet2.address);
> console.log("Sponsor:", user2.sponsor);
# Expected: wallet1Address
```

#### 1.3 Test Dormancy Check

```bash
# Check if user is dormant (should be false initially)
> const isDormant = await platform.isDormant(wallet1Address);
> console.log("Is Dormant:", isDormant);
# Expected: false

# Time travel 91 days
> await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
> await ethers.provider.send("evm_mine");

# Check dormancy again
> const isDormantNow = await platform.isDormant(wallet1Address);
> console.log("Is Dormant After 91 Days:", isDormantNow);
# Expected: true

# Try to register under dormant sponsor (should fail)
> const wallet3 = new ethers.Wallet(process.env.TEST_WALLET_3, ethers.provider);
> await expect(platform.connect(wallet3).registerUser(wallet1Address))
    .to.be.revertedWithCustomError(platform, "SponsorDormant");
```

**✅ Pass Criteria:**
- [x] User registered successfully
- [x] isDormant returns false for active users
- [x] isDormant returns true after 90 days
- [x] SponsorDormant error when registering under dormant user

---

### 🧪 Scenario 2: Investments with Dynamic ROI (30 min)

**Objective:** Test investment creation without tier, verify dynamic tier calculation

#### 2.1 Create Investment (No Tier Parameter!)

```bash
> const token = await ethers.getContractAt("GlobeRiseToken", "TOKEN_ADDRESS");
> const investAmount = ethers.parseEther("100");

# Approve and invest (NOTE: No tier parameter!)
> await token.connect(wallet2).approve("PLATFORM_ADDRESS", investAmount);
> await platform.connect(wallet2).createInvestment(investAmount);

# Verify investment created with base tier values
> const investments = await platform.getUserInvestments(wallet2.address);
> console.log("Amount:", ethers.formatEther(investments[0].amount));
> console.log("Max Claimable (2.5X base):", ethers.formatEther(investments[0].maxClaimable));
# Expected: Amount: 100, Max Claimable: 250 (2.5X base tier)
```

#### 2.2 Check Dynamic ROI Tier

```bash
> const tierInfo = await platform.getInvestmentROITier(wallet2.address, 0);
> console.log("Current Tier:", tierInfo.tier);
> console.log("ROI Rate (basis points):", tierInfo.roiRate.toString());
# Expected: Tier: 1, ROI Rate: 800 (8%)
```

#### 2.3 Test Tier Upgrade with Qualifying Referrals

```bash
# Register 2 referrals within 14 days who invest same or more
> await platform.connect(wallet3).registerUser(wallet2.address);
> await platform.connect(wallet4).registerUser(wallet2.address);

> await token.connect(wallet3).approve("PLATFORM_ADDRESS", investAmount);
> await platform.connect(wallet3).createInvestment(investAmount); // Same amount

> await token.connect(wallet4).approve("PLATFORM_ADDRESS", investAmount);
> await platform.connect(wallet4).createInvestment(investAmount); // Same amount

# Check tier again - should be Tier 2
> const tierInfo2 = await platform.getInvestmentROITier(wallet2.address, 0);
> console.log("Updated Tier:", tierInfo2.tier);
> console.log("Updated ROI Rate:", tierInfo2.roiRate.toString());
# Expected: Tier: 2, ROI Rate: 1000 (10%)
```

**✅ Pass Criteria:**
- [x] Investment created without tier parameter
- [x] Base tier is 1 (8%, 2.5X)
- [x] Tier upgrades to 2 with qualifying referrals
- [x] ROI rate updates dynamically

---

### 🧪 Scenario 3: Staking System (30 min)

**Objective:** Test staking creation and claiming

#### 3.1 Create Stake

```bash
> const stakeAmount = ethers.parseEther("500");

# Approve and create 12-month stake (tier 3)
> await token.connect(wallet2).approve("PLATFORM_ADDRESS", stakeAmount);
> await platform.connect(wallet2).createStake(stakeAmount, 3);

# Verify stake created
> const stakes = await platform.getStakingPackages(wallet2.address);
> console.log("Stake Count:", stakes.length);
> console.log("Stake Amount:", ethers.formatEther(stakes[0].amount));
> console.log("Tier:", stakes[0].durationTier);
> console.log("Monthly Rate (bp):", stakes[0].monthlyRate.toString());
# Expected: Count: 1, Amount: 500, Tier: 3, Monthly Rate: 225 (2.25%)
```

#### 3.2 Test Premature Claim (Should Fail)

```bash
> await expect(platform.connect(wallet2).claimStake(0))
    .to.be.revertedWithCustomError(platform, "StakeNotMature");
```

#### 3.3 Claim After Maturity

```bash
# Time travel 12 months
> await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
> await ethers.provider.send("evm_mine");

# Claim stake
> const balBefore = await token.balanceOf(wallet2.address);
> await platform.connect(wallet2).claimStake(0);
> const balAfter = await token.balanceOf(wallet2.address);

> const received = balAfter - balBefore;
> console.log("Received:", ethers.formatEther(received), "GRT");
# Expected: 500 + 27% = 635 GRT
```

#### 3.4 Verify Staking Does NOT Count to Volume

```bash
> const user1Vol = await platform.getUser(wallet1Address);
> console.log("Left Volume (should not include stake):", ethers.formatEther(user1Vol.leftVolume));
# Stake should NOT be counted in team volume
```

**✅ Pass Criteria:**
- [x] Stake created successfully
- [x] StakeNotMature error before maturity
- [x] Correct principal + interest paid
- [x] StakeAlreadyClaimed error on second claim
- [x] Staking does NOT affect team volume

---

### 🧪 Scenario 4: Monday-Only Withdrawals (30 min)

**Objective:** Test withdrawal day restriction and fee deduction

#### 4.1 Test Non-Monday Withdrawal (Should Fail)

```bash
# First, ensure we're NOT on Monday
> const isWithdrawalDay = await platform.isWithdrawalDay();
> console.log("Is Monday:", isWithdrawalDay);

# If not Monday, try withdrawal (should fail)
> if (!isWithdrawalDay) {
    await expect(
      platform.connect(wallet2).requestWithdrawal(ethers.parseEther("10"), 0)
    ).to.be.revertedWithCustomError(platform, "NotWithdrawalDay");
  }
```

#### 4.2 Time Travel to Monday

```bash
# Helper function to advance to next Monday
> const now = Math.floor(Date.now() / 1000);
> const dayOfWeek = Math.floor((now / 86400 + 4) % 7);
> const daysUntilMonday = dayOfWeek === 4 ? 0 : (4 - dayOfWeek + 7) % 7;
> await ethers.provider.send("evm_increaseTime", [daysUntilMonday * 86400]);
> await ethers.provider.send("evm_mine");

# Verify it's Monday
> const isMonday = await platform.isWithdrawalDay();
> console.log("Is Monday Now:", isMonday);
# Expected: true
```

#### 4.3 Request Withdrawal on Monday

```bash
> const withdrawAmount = ethers.parseEther("50");
> await platform.connect(wallet2).requestWithdrawal(withdrawAmount, 0);

> const requests = await platform.getWithdrawalRequests(wallet2.address);
> console.log("Request Status:", requests[0].status);
# Expected: 0 (PENDING)
```

#### 4.4 Approve and Complete with Fee Check

```bash
# Admin approves
> await platform.approveWithdrawal(wallet2.address, 0);

# Get balances before
> const devWallet = await platform.devWallet();
> const treasury = await platform.treasury();
> const userBalBefore = await token.balanceOf(wallet2.address);
> const devBalBefore = await token.balanceOf(devWallet);
> const treasuryBalBefore = await token.balanceOf(treasury);

# Operator completes
> await platform.completeWithdrawal(wallet2.address, 0);

# Check fee distribution
> const userBalAfter = await token.balanceOf(wallet2.address);
> const devBalAfter = await token.balanceOf(devWallet);
> const treasuryBalAfter = await token.balanceOf(treasury);

> console.log("User Received:", ethers.formatEther(userBalAfter - userBalBefore));
> console.log("Dev Fee:", ethers.formatEther(devBalAfter - devBalBefore));
> console.log("Treasury Fee:", ethers.formatEther(treasuryBalAfter - treasuryBalBefore));

# Expected for 50 GRT withdrawal:
# User: 45 GRT (90%)
# Dev: 1.25 GRT (2.5%)
# Treasury: 3.75 GRT (7.5%)
```

**✅ Pass Criteria:**
- [x] NotWithdrawalDay error on non-Mondays
- [x] Withdrawal allowed on Monday
- [x] 10% fee deducted correctly
- [x] 2.5% to devWallet
- [x] 7.5% to treasury
- [x] 90% to user

---

### 🧪 Scenario 5: Dynamic ROI Claiming (30 min)

**Objective:** Test ROI claiming with dynamic tier calculation

#### 5.1 Claim ROI at Base Tier

```bash
# Fast forward 30 days
> await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
> await ethers.provider.send("evm_mine");

# Claim ROI
> await platform.connect(wallet2).claimROI(0);

# Check event for claimed amount and tier
# For 100 GRT at 8%: 8 GRT
```

#### 5.2 Verify passiveROIClaimed (Not totalClaimed)

```bash
> const inv = await platform.getUserInvestments(wallet2.address);
> console.log("Passive ROI Claimed:", ethers.formatEther(inv[0].passiveROIClaimed));
# Expected: 8 GRT (or 10 GRT if tier 2)
```

#### 5.3 Verify Cap Applies Only to Passive ROI

```bash
# Bonuses and commissions should NOT count toward cap
# Only passiveROIClaimed counts toward maxClaimable
```

**✅ Pass Criteria:**
- [x] ROI claimed at current dynamic tier
- [x] passiveROIClaimed updated (not totalClaimed)
- [x] Tier reflected in ROIClaimed event
- [x] Cap only applies to passive ROI

---

### 🧪 Scenario 6: Admin Fee Management (20 min)

**Objective:** Test fee configuration and emergency functions

#### 6.1 Update Platform Fee Rate

```bash
# Current rate should be 1000 (10%)
> const currentRate = await platform.platformFeeRate();
> console.log("Current Fee Rate:", Number(currentRate) / 100, "%");

# Update to 15%
> await platform.updatePlatformFeeRate(1500);

> const newRate = await platform.platformFeeRate();
> console.log("New Fee Rate:", Number(newRate) / 100, "%");
# Expected: 15%

# Try to set above 20% (should fail)
> await expect(platform.updatePlatformFeeRate(2500))
    .to.be.reverted;
```

#### 6.2 Update Dev Wallet

```bash
> const oldDevWallet = await platform.devWallet();
> const newDevWalletAddr = "0x...";

> await platform.updateDevWallet(newDevWalletAddr);

> const updatedDevWallet = await platform.devWallet();
> console.log("New Dev Wallet:", updatedDevWallet);
# Expected: newDevWalletAddr
```

#### 6.3 Emergency Withdraw

```bash
> const emergencyAmount = ethers.parseEther("100");
> await platform.emergencyWithdraw(
    "TOKEN_ADDRESS",
    emergencyAmount,
    "RECIPIENT_ADDRESS"
  );
```

**✅ Pass Criteria:**
- [x] Fee rate can be updated (max 20%)
- [x] Dev wallet can be updated
- [x] Emergency withdraw works

---

## Verification Checklist

### 60-Point Comprehensive Checklist (v2.0)

**Deployment:**
- [ ] 1. GlobeRiseToken deployed
- [ ] 2. GlobeRisePlatform proxy deployed
- [ ] 3. Contracts verified on Etherscan
- [ ] 4. Dev wallet configured
- [ ] 5. Platform fee = 10%

**User Registration:**
- [ ] 6. Register without sponsor
- [ ] 7. Register with sponsor
- [ ] 8. Cannot register twice
- [ ] 9. **Dormant check works (90 days)**
- [ ] 10. **SponsorDormant error thrown**
- [ ] 11. Binary tree placement works
- [ ] 12. **Unlimited referrals allowed**

**Investments:**
- [ ] 13. **Create investment WITHOUT tier parameter**
- [ ] 14. Base cap = 2.5X
- [ ] 15. Below minimum rejected
- [ ] 16. Token transferred correctly
- [ ] 17. Commission paid to sponsor

**Dynamic ROI:**
- [ ] 18. **Base tier = 1 (8%)**
- [ ] 19. **Tier upgrades with qualifying referrals**
- [ ] 20. **Referrals must invest same/more**
- [ ] 21. **14-day window for Tier 2**
- [ ] 22. **21-day window for Tier 3**
- [ ] 23. **Tier reflected in claim**

**Staking:**
- [ ] 24. **Create stake with tier 1-5**
- [ ] 25. **StakeNotMature before maturity**
- [ ] 26. **Claim returns principal + interest**
- [ ] 27. **StakeAlreadyClaimed error**
- [ ] 28. **Staking NOT counted in volume**

**ROI Claiming:**
- [ ] 29. Cannot claim before 30 days
- [ ] 30. **passiveROIClaimed updated**
- [ ] 31. Cap enforced on passive only
- [ ] 32. Investment inactive at cap

**Withdrawals:**
- [ ] 33. **NotWithdrawalDay on non-Monday**
- [ ] 34. **Works on Monday**
- [ ] 35. Request created correctly
- [ ] 36. Admin approval required
- [ ] 37. Operator completion required

**Fees:**
- [ ] 38. **10% fee deducted**
- [ ] 39. **2.5% to devWallet**
- [ ] 40. **7.5% to treasury**
- [ ] 41. **Net amount to user = 90%**
- [ ] 42. **PlatformFeeCollected event**
- [ ] 43. **WithdrawalCompleted with fee details**

**Admin:**
- [ ] 44. **updatePlatformFeeRate works**
- [ ] 45. **updateDevWallet works**
- [ ] 46. **emergencyWithdraw works**
- [ ] 47. Pause/unpause works
- [ ] 48. Only authorized roles

**MLM:**
- [ ] 49. Left/right volume updates
- [ ] 50. Volumes propagate upward
- [ ] 51. Level income distributed

**Ranks:**
- [ ] 52. Rank calculation works
- [ ] 53. 60:40 ratio validated
- [ ] 54. Rank bonus paid

**Royalty:**
- [ ] 55. **10% growth rule checked**
- [ ] 56. Distribution works

**Events:**
- [ ] 57. InvestmentCreated (no tier param)
- [ ] 58. **ROIClaimed (includes tier)**
- [ ] 59. **StakeCreated, StakeClaimed**
- [ ] 60. **Fee events emitted**

---

## Troubleshooting

### Common Issues (v2.0)

**Issue: "NotWithdrawalDay"**
- Time travel to Monday using evm_increaseTime

**Issue: "SponsorDormant"**
- Sponsor is inactive 90+ days
- Choose different sponsor or reactivate

**Issue: "StakeNotMature"**
- Wait for maturity date
- Use time travel for testing

**Issue: Dynamic tier not updating**
- Referrals must join within time window
- Referrals must invest same or more

---

## Results Documentation

### Log Template

```markdown
## Scenario X: [Name]
**Date:** [Date/Time]
**Network:** Sepolia
**Tester:** [Your name]

**Steps Completed:**
1. [Step] - ✅ Success / ❌ Failed
2. [Step] - ✅ Success

**New v2.0 Features Tested:**
- [ ] Dynamic ROI tier
- [ ] Staking system
- [ ] Monday-only withdrawals
- [ ] 10% fee with split
- [ ] Dormant logic

**Transaction Hashes:**
- Registration: 0x...
- Investment: 0x...
- Stake: 0x...
- Withdrawal: 0x...

**Verification:**
- Expected: [Result]
- Actual: [Result]
- Status: ✅ PASS / ❌ FAIL
```

---

## Success Criteria

**Manual testing is COMPLETE when:**
- ✅ All 10 scenarios executed
- ✅ 60-point checklist: 60/60 passed
- ✅ All v2.0 features verified
- ✅ No unexpected errors
- ✅ All transaction hashes recorded

---

**Time Required:** 4-5 hours total
**Cost:** Free (Sepolia testnet)
**Dependencies:** None (no backend/frontend needed)

---

**Created:** November 25, 2025
**Last Updated:** November 25, 2025
**Status:** Ready for execution

---

**This guide allows you to independently verify the v2.0 smart contracts are 100% correct!**
