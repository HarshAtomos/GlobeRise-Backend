# GlobeRise Platform - Complete API Reference

**Version:** 2.0.0
**Last Updated:** November 25, 2025

---

## 📖 Contract Addresses

**Mainnet:**
- GlobeRiseToken: `[Will be added after deployment]`
- GlobeRisePlatform: `[Will be added after deployment]`

**Sepolia Testnet:**
- GlobeRiseToken: `[Will be added after deployment]`
- GlobeRisePlatform: `[Will be added after deployment]`

---

## 🔷 GlobeRiseToken Functions

### Read Functions

#### `name() → string`
Returns token name: "GlobeRise Token"

#### `symbol() → string`  
Returns token symbol: "GRT"

#### `decimals() → uint8`
Returns decimals: 18

#### `totalSupply() → uint256`
Returns current total supply (decreases when burned)

#### `balanceOf(address account) → uint256`
Returns GRT balance of an address

#### `MAX_SUPPLY() → uint256`
Returns maximum supply: 1,000,000,000 GRT (constant)

#### `circulatingSupply() → uint256`
Returns current circulating supply (totalSupply)

#### `totalBurned() → uint256`
Returns total burned tokens (MAX_SUPPLY - totalSupply)

#### `hasSufficientBalance(address account, uint256 amount) → bool`
Checks if account has at least `amount` tokens

#### `getTokenInfo() → (string, string, uint8, uint256, uint256)`
Returns: (name, symbol, decimals, currentSupply, maxSupply)

### Write Functions

#### `transfer(address to, uint256 amount) → bool`
Transfer `amount` tokens to `to`
- **Gas:** ~50k

#### `approve(address spender, uint256 amount) → bool`
Approve `spender` to spend `amount` tokens
- **Gas:** ~45k

#### `transferFrom(address from, address to, uint256 amount) → bool`
Transfer `amount` from `from` to `to` (requires approval)
- **Gas:** ~60k

#### `burn(uint256 amount)`
Burn `amount` tokens from caller's balance
- **Gas:** ~30k

#### `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)`
Gasless approval using signature (EIP-2612)
- **Gas:** ~80k

---

## 🔷 GlobeRisePlatform Functions

### User Functions

#### `registerUser(address sponsor)`
Register a new user with optional sponsor
- **Params:** `sponsor` - Sponsor's address (use `address(0)` for no sponsor)
- **Requires:** Not already registered, sponsor must be registered and **not dormant** (if not zero)
- **Effects:** Creates user record, adds to sponsor's referrals, places in binary tree
- **Events:** `UserRegistered(user, sponsor)`
- **Gas:** ~120k-150k

**Example:**
```solidity
await platform.registerUser("0x1234..."); // With sponsor
await platform.registerUser(ethers.ZeroAddress); // No sponsor
```

#### `createInvestment(uint256 amount)`
Create a new investment (**ROI tier calculated dynamically on each claim**)
- **Params:** `amount` - Amount of GRT tokens (must be ≥ 100 GRT)
- **Requires:** User registered, token approval, amount ≥ minInvestment
- **Effects:** Transfers GRT, creates investment, distributes referral commission, updates volumes
- **Events:** `InvestmentCreated(user, investmentId, amount, referrer)`, `CommissionPaid(...)`
- **Gas:** ~200k-300k

**⚠️ IMPORTANT CHANGE:** No `tier` parameter! ROI tier is now calculated dynamically based on qualifying referrals at each claim.

**Example:**
```solidity
// Approve tokens first
await token.approve(platformAddress, ethers.parseEther("100"));

// Create investment (tier determined dynamically by referral activity)
await platform.createInvestment(ethers.parseEther("100"));
```

#### `claimROI(uint256 investmentId)`
Claim accrued ROI from an investment (tier calculated dynamically at claim time)
- **Params:** `investmentId` - Index of investment (0, 1, 2...)
- **Requires:** Investment active, ≥30 days elapsed, claimable > 0
- **Effects:** Updates passiveROIClaimed, adds to withdrawableBalance, distributes level income
- **Events:** `ROIClaimed(user, investmentId, amount, roiTier)`, `CommissionPaid(...)` (for upline)
- **Gas:** ~180k-400k (depends on upline depth)

**Example:**
```solidity
// Claim from first investment (ID = 0)
await platform.claimROI(0);
```

#### `createStake(uint256 amount, uint8 tier)`
Create a new staking package (separate from MLM, does NOT count towards team business)
- **Params:**
  - `amount` - Amount of GRT to stake (> 0)
  - `tier` - Duration tier (1=3mo, 2=6mo, 3=12mo, 4=18mo, 5=24mo)
- **Requires:** User registered, valid tier (1-5), token approval
- **Effects:** Transfers GRT to contract, creates staking record
- **Events:** `StakeCreated(user, stakeId, amount, tier)`
- **Gas:** ~150k

**Example:**
```solidity
// Approve tokens first
await token.approve(platformAddress, ethers.parseEther("500"));

// Create 12-month stake (2.25% monthly = 27% total)
await platform.createStake(ethers.parseEther("500"), 3);
```

#### `claimStake(uint256 stakeId)`
Claim matured stake (principal + interest in GRT only)
- **Params:** `stakeId` - Index of stake (0, 1, 2...)
- **Requires:** Stake exists, not already claimed, maturity time passed
- **Effects:** Marks as claimed, transfers GRT (principal + accrued interest)
- **Events:** `StakeClaimed(user, stakeId, principal, interest)`
- **Gas:** ~100k

**Example:**
```solidity
// After maturity period passed
await platform.claimStake(0);
```

#### `requestWithdrawal(uint256 amount, WithdrawalType withdrawalType)`
Request a withdrawal (**Monday only**)
- **Params:**
  - `amount` - Amount to withdraw (≥ 10 GRT)
  - `withdrawalType` - 0 (GRT_ONLY) or 1 (GRT_USDT_SPLIT)
- **Requires:** Amount ≥ minWithdrawal, amount ≤ withdrawableBalance, **today is Monday (UTC)**
- **Effects:** Locks balance, creates withdrawal request
- **Events:** `WithdrawalRequested(user, requestId, amount, withdrawalType)`
- **Gas:** ~80k-100k

**⚠️ IMPORTANT CHANGE:** Withdrawals can only be requested on Mondays. No cooldown period between withdrawals.

**Example:**
```solidity
// Only works on Mondays!
await platform.requestWithdrawal(ethers.parseEther("50"), 0);
```

### View Functions (Read-Only)

#### `getUser(address user) → User`
Get complete user data
- **Returns:** User struct with sponsor, legs, volumes, rank, commissions, registrationTime

#### `getUserInvestments(address user) → Investment[]`
Get all user's investments
- **Returns:** Array of Investment structs

#### `getDirectReferrals(address user) → address[]`
Get user's direct referrals
- **Returns:** Array of addresses (**unlimited referrals allowed**)

#### `getStakingPackages(address user) → StakingPackage[]`
Get user's staking packages
- **Returns:** Array of StakingPackage structs

#### `getWithdrawalRequests(address user) → WithdrawalRequest[]`
Get user's withdrawal requests
- **Returns:** Array of WithdrawalRequest structs

#### `getWithdrawableBalance(address user) → uint256`
Get user's available withdrawal balance
- **Returns:** Balance in wei

#### `getUserRankName(address user) → string`
Get user's rank name
- **Returns:** Rank name from the 16 ranks

#### `checkRankUpgrade(address user) → (bool canUpgrade, uint8 nextRank)`
Check if user can upgrade rank
- **Returns:** Tuple of (canUpgrade, nextRank)

#### `getCurrentMonth() → uint256`
Get current month identifier
- **Returns:** block.timestamp / 30 days

#### `isWithdrawalDay() → bool`
Check if today is Monday (withdrawal day)
- **Returns:** true if today is Monday UTC

#### `getInvestmentROITier(address user, uint256 investmentId) → (uint8 tier, uint256 roiRate, uint256 capMultiplier)`
Get current dynamic ROI tier for a specific investment
- **Returns:** Current tier (1-3), ROI rate in basis points, cap multiplier in basis points

#### `isDormant(address user) → bool`
Check if user is dormant (90+ days without activity)
- **Returns:** true if user's last activity was more than 90 days ago

### Admin Functions (ADMIN_ROLE Required)

#### `approveWithdrawal(address user, uint256 requestId)`
Approve a pending withdrawal request
- **Gas:** ~50k

#### `rejectWithdrawal(address user, uint256 requestId, string reason)`
Reject a withdrawal request with reason
- **Gas:** ~60k

#### `distributeRoyalty(address[] eligibleUsers, uint256[] amounts, uint256 maxBudget)`
Distribute monthly royalty to qualified users
- **Params:**
  - `eligibleUsers` - Array of user addresses (must have 10% monthly growth)
  - `amounts` - Array of amounts (must match eligibleUsers length)
  - `maxBudget` - Maximum total allowed (safety cap)
- **Gas:** ~100k + (50k * number of users)

#### `pause()`
Pause the platform (emergency)
- **Gas:** ~30k

#### `unpause()`
Resume platform operations
- **Gas:** ~30k

#### `updateTreasury(address newTreasury)`
Update treasury address
- **Gas:** ~45k

#### `updateDevWallet(address newDevWallet)`
Update dev wallet address (receives 2.5% of withdrawal fees)
- **Gas:** ~45k

#### `updatePlatformFeeRate(uint256 newRate)`
Update withdrawal fee rate (basis points, max 2000 = 20%)
- **Gas:** ~45k

#### `updateMinInvestment(uint256 newMinInvestment)`
Update minimum investment amount
- **Gas:** ~45k

#### `emergencyWithdraw(address token, uint256 amount, address to)`
Emergency token withdrawal (for stuck tokens)
- **Gas:** ~50k

### Operator Functions (OPERATOR_ROLE Required)

#### `completeWithdrawal(address user, uint256 requestId)`
Complete an approved withdrawal (**deducts 10% platform fee**)
- **Fee Split:** 2.5% to devWallet, 7.5% to treasury
- **Gas:** ~100k-150k (depends on withdrawal type)

### Public Functions (Anyone Can Call)

#### `updateRank(address user)`
Update a user's rank based on qualifications
- **Gas:** ~100k-150k (if bonus paid)

---

## 📊 Data Structures

### User Struct
```solidity
struct User {
    address sponsor;             // Direct upline
    address leftLeg;             // Binary tree left
    address rightLeg;            // Binary tree right
    address[] directReferrals;   // Unilevel (UNLIMITED)
    uint256 leftVolume;          // Left leg volume
    uint256 rightVolume;         // Right leg volume
    uint8 rank;                  // Current rank (0-15)
    uint256 totalCommissions;    // Lifetime commissions
    uint256 totalInvested;       // Total invested
    bool registered;             // Is registered
    uint256 registrationTime;    // When user registered (for dormant check)
}
```

### Investment Struct
```solidity
struct Investment {
    uint256 amount;              // Investment amount
    uint256 startTime;           // Start timestamp
    uint256 passiveROIClaimed;   // Passive ROI claimed (counts toward cap)
    uint256 maxClaimable;        // Max claimable (amount * multiplier)
    address referrer;            // Sponsor address
    bool active;                 // Is active
}
```

**⚠️ IMPORTANT:** `passiveROIClaimed` only tracks passive ROI. Bonuses (Direct, Level, Rank, Royalty) do NOT count towards cap.

### StakingPackage Struct
```solidity
struct StakingPackage {
    uint256 amount;              // Staked amount
    uint8 durationTier;          // 1-5 (3mo, 6mo, 12mo, 18mo, 24mo)
    uint256 startTime;           // Start timestamp
    uint256 maturityTime;        // Claimable after this time
    uint256 monthlyRate;         // Monthly rate in basis points
    bool claimed;                // Already claimed
}
```

### WithdrawalRequest Struct
```solidity
struct WithdrawalRequest {
    uint256 amount;              // Amount requested (before fee)
    WithdrawalType withdrawalType; // 0 or 1
    uint256 requestTime;         // Request timestamp
    WithdrawalStatus status;     // 0=PENDING, 1=APPROVED, 2=COMPLETED, 3=REJECTED
}
```

---

## 🎯 Events

### User Events
```solidity
event UserRegistered(address indexed user, address indexed sponsor);
event InvestmentCreated(address indexed user, uint256 indexed investmentId, uint256 amount, address indexed referrer);
event ROIClaimed(address indexed user, uint256 indexed investmentId, uint256 amount, uint8 roiTier);
event CommissionPaid(address indexed user, address indexed from, uint256 amount, string commissionType);
event RankUpdated(address indexed user, uint8 newRank, uint8 oldRank);
```

### Staking Events
```solidity
event StakeCreated(address indexed user, uint256 indexed stakeId, uint256 amount, uint8 tier);
event StakeClaimed(address indexed user, uint256 indexed stakeId, uint256 principal, uint256 interest);
```

### Withdrawal Events
```solidity
event WithdrawalRequested(address indexed user, uint256 indexed requestId, uint256 amount, WithdrawalType withdrawalType);
event WithdrawalApproved(address indexed user, uint256 indexed requestId);
event WithdrawalCompleted(address indexed user, uint256 indexed requestId, uint256 netAmount, uint256 devFee, uint256 treasuryFee);
event WithdrawalRejected(address indexed user, uint256 indexed requestId, string reason);
```

### Admin Events
```solidity
event RoyaltyDistributed(uint256 indexed month, uint256 totalAmount, uint256 maxBudget, uint256 recipientCount);
event PlatformFeeCollected(address indexed user, uint256 devFee, uint256 treasuryFee);
event DevWalletUpdated(address indexed oldWallet, address indexed newWallet);
event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);
event Paused(address account);
event Unpaused(address account);
```

---

## 🏆 Rank System Reference

### Rank Requirements

| Rank | Name | Team Volume | One-Time Bonus |
|------|------|-------------|----------------|
| 0 | BEGINNER | $0 | $0 |
| 1 | EXPLORER | $5,000 | $250 |
| 2 | PATHFINDER | $15,000 | $750 |
| 3 | CHALLENGER | $40,000 | $1,500 |
| 4 | NAVIGATOR | $100,000 | $3,000 |
| 5 | CHAMPION | $200,000 | $5,000 |
| 6 | COMMANDER | $350,000 | $7,500 |
| 7 | STRATEGIST | $500,000 | $9,000 |
| 8 | TRAILBLAZER | $1,000,000 | $15,000 |
| 9 | GRANDMASTER | $1,500,000 | $20,000 |
| 10 | LEGEND | $2,500,000 | $25,000 |
| 11 | CROWN PRINCE | $4,000,000 | $30,000 |
| 12 | KING | $5,500,000 | $35,000 |
| 13 | EMPEROR | $7,000,000 | $40,000 |
| 14 | SUPREME LEADER | $8,500,000 | $45,000 |
| 15 | IMPERATOR | $10,000,000 | $50,000 |

### Rank Qualification Rules
1. **Team Volume**: Combined left + right leg volume must meet requirement
2. **60:40 Ratio**: Weaker leg must be at least 40% of total volume
3. **No direct referral count requirement** (unlimited referrals allowed)

### ROI Tiers (Dynamic - Calculated at Claim Time)

| Tier | Monthly ROI | Cap Multiplier | Qualification |
|------|-------------|----------------|---------------|
| 1 | 8% | 2.5X | Base (no qualifying referrals) |
| 2 | 10% | 3X | 2+ referrals within 14 days who invested **same or more** |
| 3 | 12% | 4X | 4+ referrals within 21 days who invested **same or more** |

**⚠️ IMPORTANT:** Tier is calculated dynamically at each claim based on:
1. Number of direct referrals who joined within the time window (14 or 21 days from investment start)
2. Those referrals must have invested **≥ the user's investment amount**

### Level Income Rates (ROI-to-ROI)

| Level | Rate | Description |
|-------|------|-------------|
| 1 | 10% | From direct referrals' ROI |
| 2 | 5% | From level 2 downline ROI |
| 3-4 | 4% | From level 3-4 downline ROI |
| 5-7 | 3% | From level 5-7 downline ROI |
| 8-11 | 2% | From level 8-11 downline ROI |
| 12-16 | 1% | From level 12-16 downline ROI |

### Staking Tiers (Non-MLM)

| Tier | Duration | Monthly Rate | Total Return |
|------|----------|--------------|--------------|
| 1 | 3 months | 1.25% | 3.75% |
| 2 | 6 months | 1.75% | 10.5% |
| 3 | 12 months | 2.25% | 27% |
| 4 | 18 months | 4% | 72% |
| 5 | 24 months | 4.75% | 114% |

**⚠️ Note:** Staking is completely separate from MLM. Staking amounts do NOT count towards team volume or commissions. Payout is in GRT only.

---

## 💰 Fee Structure

### Platform Fee (On Withdrawals Only)
- **Total Fee:** 10% of withdrawal amount
- **Dev Wallet:** 2.5% (covers gas + development)
- **Treasury:** 7.5% (platform revenue)

**Example:** User withdraws 100 GRT → User receives 90 GRT, 2.5 GRT to devWallet, 7.5 GRT to treasury

---

## ⏰ Key Timeframes

| Feature | Timeframe |
|---------|-----------|
| ROI Claim | Every 30 days |
| Withdrawal Day | Monday only (UTC) |
| Dormant Period | 90 days of inactivity |
| Speed Bonus (Tier 2) | 2 refs within 14 days |
| Speed Bonus (Tier 3) | 4 refs within 21 days |
| Royalty Re-qualification | 10% monthly growth required |

---

**For usage examples, see INTEGRATION_GUIDE.md**

**Last Updated:** November 25, 2025
