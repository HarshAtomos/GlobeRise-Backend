# GlobeRise Platform - Architecture Documentation

**Version:** 2.0.0
**Last Updated:** November 25, 2025

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│   (React/Next.js + ethers.js + MetaMask)                   │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Web3 JSON-RPC
               ├─────────────────┬────────────────┐
               │                 │                │
┌──────────────▼────┐   ┌───────▼──────┐   ┌────▼──────────┐
│  GlobeRiseToken   │   │  Platform    │   │   Backend     │
│   (ERC20)         │   │  (UUPS Proxy)│   │  (Node.js)    │
└──────────────┬────┘   └───────┬──────┘   └────┬──────────┘
               │                 │                │
               │                 │                │
               └────────┬────────┴────────────────┘
                        │
               ┌────────▼─────────┐
               │  Ethereum        │
               │  Blockchain      │
               └──────────────────┘
```

### Component Responsibilities

**Frontend:**
- User interface
- Wallet connection (MetaMask)
- Transaction signing
- Event display
- Dashboard and reports
- Monday withdrawal indicator

**Smart Contracts:**
- Token management (GRT)
- Investment logic (dynamic ROI tiers)
- Staking system (5 tiers)
- MLM structure (binary + unilevel)
- Commission calculations
- ROI distribution
- Fee collection (10% on withdrawals)
- Withdrawal approval (Monday-only)
- Access control
- Dormancy tracking

**Backend:**
- Event listening (blockchain → database)
- KYC management
- Email notifications
- Royalty calculations (CTO with 10% growth rule)
- Analytics and reporting
- API for frontend
- Transaction history

---

## 🔐 UUPS Proxy Pattern

### Why UUPS?

**Benefits:**
✅ Gas-efficient upgrades
✅ Removes upgrade logic from proxy (cheaper)
✅ Implementation controls upgrades (safer)
✅ Storage in proxy (data preserved across upgrades)

### How It Works

```
User Transaction
      ↓
┌─────────────────┐
│  Proxy Contract │ ← Storage lives here (all user data)
│  (Delegatecall) │
└────────┬────────┘
         │ delegatecall
         ↓
┌─────────────────┐
│ Implementation  │ ← Logic lives here (functions)
│ (GlobeRisePlatform) │
└─────────────────┘
```

### Storage Layout (CRITICAL)

**GlobeRisePlatform Storage Slots (v2.0):**

```solidity
Slot 0-50: Initializable + UUPS + AccessControl + ReentrancyGuard + Pausable

// Token references
Slot 51: grtToken (IERC20)
Slot 52: usdtToken (IERC20)

// Platform parameters
Slot 53: minInvestment (uint256)
Slot 54: [REMOVED - was MAX_DIRECT_REFERRALS]

// ROI configuration
Slot 55-57: roiPercentages[3] (uint256[3]) - 800, 1000, 1200
Slot 58-60: roiCaps[3] (uint256[3]) - 25000, 30000, 40000

// Commission rates
Slot 61: directReferralRate (uint256) - 500 (5%)
Slot 62-77: levelIncomeRates[16] (uint256[16])

// Rank system
Slot 78-93: rankNames[16] (string[16])
Slot 94-109: rankRequirements[16] (uint256[16])
Slot 110-125: rankBonuses[16] (uint256[16])

// Withdrawal parameters
Slot 126: [REMOVED - was withdrawalCooldown]
Slot 127: minWithdrawal (uint256)
Slot 128: treasury (address)

// User data mappings
Slot 129: users mapping
Slot 130: investments mapping
Slot 131: monthlyActivity mapping
Slot 132: withdrawalRequests mapping
Slot 133: lastWithdrawalTime mapping
Slot 134: withdrawableBalance mapping

// Counters
Slot 135: totalUsers
Slot 136: totalInvestments
Slot 137: totalCommissionsDistributed

// NEW v2.0 variables
Slot 138: devWallet (address)
Slot 139: platformFeeRate (uint256) - 1000 (10%)
Slot 140: stakingPackages mapping
Slot 141: stakingRates[5] (uint256[5])
Slot 142: stakingDurations[5] (uint8[5])
Slot 143: lastActivityTime mapping
Slot 144: totalFeesCollected (uint256)

Slot 145-194: __gap (uint256[50]) - Reserved for future upgrades
```

**⚠️ CRITICAL:** Never reorder or remove storage variables in upgrades!

---

## 💰 MLM Structure

### Binary Tree

```
                    User1 (Root)
                   /           \
              User2 (L)      User3 (R)
              /     \        /     \
         User4(L) User5(R) User6(L) User7(R)
```

**Rules:**
- Each user has max 2 binary legs (left & right)
- Placement: Left-fill algorithm
- Volume accumulates upward
- Used for rank qualification (60:40 ratio)

### Unilevel Structure

```
User1 (Sponsor)
├─ User2 (Direct 1)
├─ User3 (Direct 2)
├─ User4 (Direct 3)
└─ ... (UNLIMITED directs now!)

User2 (Level 1 of User1)
├─ User5 (Level 2 of User1)
│  └─ User6 (Level 3 of User1)
└─ ... (up to 16 levels)
```

**Rules (Updated v2.0):**
- ~~Each user has max 16 direct referrals~~ **Now unlimited!**
- Level income paid up to 16 levels deep
- Only paid to users with active investments
- Rates: 10%, 5%, 4%, 4%, 3%, 3%, 3%, 2%, 2%, 2%, 2%, 1%, 1%, 1%, 1%, 1%

---

## 💸 Fee Mechanism (NEW v2.0!)

### Withdrawal Fee Flow

```
User requests 100 GRT withdrawal
        ↓
Admin approves
        ↓
Operator completes
        ↓
┌─────────────────────────────────────┐
│     Fee Calculation (10%)           │
│  Total Fee: 10 GRT                  │
│  ├─ Dev Wallet (25%): 2.5 GRT      │
│  └─ Treasury (75%): 7.5 GRT        │
│                                     │
│  Net to User: 90 GRT               │
└─────────────────────────────────────┘
```

**Fee Constants:**
```solidity
uint256 public platformFeeRate = 1000;            // 10% default
uint256 public constant DEV_FEE_SHARE = 2500;     // 25% of fee
uint256 public constant TREASURY_FEE_SHARE = 7500; // 75% of fee
```

---

## 📦 Staking System (NEW v2.0!)

### Staking Flow

```
User stakes 1000 GRT for 12 months (Tier 3)
        ↓
Tokens transferred to contract
        ↓
12 months pass...
        ↓
User claims stake
        ↓
Receives: 1000 + 270 = 1270 GRT (27% return)
```

**Key Points:**
- Staking is **completely separate** from MLM
- Staked amounts do NOT count towards team volume
- No commissions on staking
- Payout in GRT only (no USDT option)

### Staking Tiers

```solidity
stakingRates[5] = [125, 175, 225, 400, 475];   // Basis points monthly
stakingDurations[5] = [3, 6, 12, 18, 24];      // Months
```

| Tier | Duration | Monthly | Total |
|------|----------|---------|-------|
| 1 | 3 months | 1.25% | 3.75% |
| 2 | 6 months | 1.75% | 10.5% |
| 3 | 12 months | 2.25% | 27% |
| 4 | 18 months | 4% | 72% |
| 5 | 24 months | 4.75% | 114% |

---

## 🕐 Dynamic ROI Tier System (NEW v2.0!)

### How Dynamic Tiers Work

```
Investment created at time T
        ↓
User builds referrals...
        ↓
At claim time T+30 days:
┌─────────────────────────────────────┐
│  _calculateDynamicROITier()         │
│                                     │
│  Check referrals who:               │
│  1. Joined within 14/21 days of T   │
│  2. Invested >= user's amount       │
│                                     │
│  Results:                           │
│  - 0-1 qualifying: Tier 1 (8%)      │
│  - 2-3 qualifying within 14d: Tier 2│
│  - 4+ qualifying within 21d: Tier 3 │
└─────────────────────────────────────┘
```

**Tier Logic:**
```solidity
function _calculateDynamicROITier(address user, uint256 investmentId) private view returns (uint8) {
    Investment storage investment = investments[user][investmentId];
    address[] memory referrals = users[user].directReferrals;
    
    uint256 qualifyingFor12 = 0; // 21-day window
    uint256 qualifyingFor10 = 0; // 14-day window
    
    for (uint256 i = 0; i < referrals.length; i++) {
        address ref = referrals[i];
        User storage refUser = users[ref];
        
        // Check if joined within time window of investment start
        uint256 timeSinceInvestment = refUser.registrationTime - investment.startTime;
        
        // Check if referral invested same or more
        if (refUser.totalInvested >= investment.amount) {
            if (timeSinceInvestment <= 21 days) {
                qualifyingFor12++;
            }
            if (timeSinceInvestment <= 14 days) {
                qualifyingFor10++;
            }
        }
    }
    
    if (qualifyingFor12 >= 4) return 3; // 12% ROI
    if (qualifyingFor10 >= 2) return 2; // 10% ROI
    return 1; // 8% ROI (default)
}
```

---

## 😴 Dormant User System (NEW v2.0!)

### Dormancy Flow

```
User inactive for 90 days
        ↓
isDormant(user) returns true
        ↓
Effects:
├─ Referral code becomes inactive
├─ New users cannot join under this sponsor
└─ User can still claim ROI, withdraw, etc.
        ↓
User makes any transaction
        ↓
Activity timestamp updated
        ↓
isDormant(user) returns false
```

**Implementation:**
```solidity
uint256 public constant DORMANT_PERIOD = 90 days;

mapping(address => uint256) public lastActivityTime;

function isDormant(address user) public view returns (bool) {
    if (!users[user].registered) return true;
    return block.timestamp > lastActivityTime[user] + DORMANT_PERIOD;
}

function _updateActivity(address user) private {
    lastActivityTime[user] = block.timestamp;
}
```

---

## 📅 Monday-Only Withdrawals (NEW v2.0!)

### Implementation

```solidity
modifier onlyOnMonday() {
    if (!_isMonday()) revert NotWithdrawalDay();
    _;
}

function _isMonday() private view returns (bool) {
    // Unix timestamp starts Thursday Jan 1, 1970
    // So (timestamp / 1 days + 4) % 7 gives day of week
    // 0 = Thursday, 1 = Friday, ..., 4 = Monday
    return ((block.timestamp / 1 days + 4) % 7) == 4;
}

function requestWithdrawal(...) external onlyOnMonday {
    // ... withdrawal logic
}
```

---

## 🔒 Security Model

### Access Control Layers

**Layer 1: Role-Based Access Control (RBAC)**
```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
```

**Layer 2: Registration Check**
```solidity
modifier onlyRegistered() {
    if (!users[msg.sender].registered) revert NotRegistered();
    _;
}
```

**Layer 3: Dormancy Check**
```solidity
// In registerUser
if (sponsor != address(0) && isDormant(sponsor)) revert SponsorDormant();
```

**Layer 4: Pausable (Emergency)**
```solidity
modifier whenNotPaused() {
    _requireNotPaused();
    _;
}
```

**Layer 5: Reentrancy Guard**
```solidity
modifier nonReentrant() {
    _nonReentrantBefore();
    _;
    _nonReentrantAfter();
}
```

### Checks-Effects-Interactions Pattern

**Example: completeWithdrawal (v2.0)**

```solidity
function completeWithdrawal(address user, uint256 requestId) external {
    // ✅ CHECKS
    require(hasRole(OPERATOR_ROLE, msg.sender), "Not operator");
    require(request.status == WithdrawalStatus.APPROVED, "Not approved");

    // ✅ EFFECTS (update state)
    request.status = WithdrawalStatus.COMPLETED;
    
    // Calculate fees
    uint256 fee = (amount * platformFeeRate) / 10000;
    uint256 devFee = (fee * DEV_FEE_SHARE) / 10000;
    uint256 treasuryFee = fee - devFee;
    uint256 netAmount = amount - fee;
    
    totalFeesCollected += fee;

    // ✅ INTERACTIONS (external calls last)
    grtToken.safeTransfer(devWallet, devFee);
    grtToken.safeTransfer(treasury, treasuryFee);
    grtToken.safeTransfer(user, netAmount);
    
    emit PlatformFeeCollected(user, devFee, treasuryFee);
    emit WithdrawalCompleted(user, requestId, netAmount, devFee, treasuryFee);
}
```

---

## 🛡️ Design Decisions

### Why 2 Contracts (Token + Platform)?

**Advantages:**
✅ Token can exist independently
✅ Platform is upgradeable, token is not (stability)
✅ Simpler testing and auditing
✅ Gas savings (no cross-contract calls for most operations)

### Why Fixed Token Supply?

✅ No inflation risk
✅ Deflationary (burnable)
✅ Clear tokenomics
✅ Builds trust (no surprise minting)

### Why Iterative Binary Tree (Not Recursive)?

✅ No stack overflow risk
✅ Works with deep trees (100+ levels)
✅ Gas-efficient
✅ Predictable costs

### Why Monday-Only Withdrawals?

✅ Predictable liquidity management
✅ Reduces admin workload (batch processing)
✅ Aligns with traditional banking patterns
✅ Prevents gaming/manipulation

### Why Separate Staking from MLM?

✅ Clear product differentiation
✅ No confusion about volume counting
✅ Simpler accounting
✅ Attracts different user segments

---

**For deployment procedures, see DEPLOYMENT_GUIDE.md**

**Last Updated:** November 25, 2025
