# GlobeRise Platform - Admin Operations Guide

**Version:** 2.0.0
**Last Updated:** November 25, 2025
**Audience:** Platform Administrators & Operations Team

---

## 📖 Table of Contents

1. [Admin Role Overview](#admin-role-overview)
2. [Daily Operations](#daily-operations)
3. [Withdrawal Management](#withdrawal-management)
4. [Royalty Distribution](#royalty-distribution)
5. [Emergency Procedures](#emergency-procedures)
6. [Parameter Configuration](#parameter-configuration)
7. [Fee Management](#fee-management)
8. [Treasury Management](#treasury-management)
9. [Monitoring & Alerts](#monitoring--alerts)
10. [Audit Trails](#audit-trails)
11. [Best Practices](#best-practices)

---

## Admin Role Overview

### Role Hierarchy

GlobeRise has 3 admin roles with different permissions:

| Role | Permissions | Recommended For |
|------|-------------|-----------------|
| **DEFAULT_ADMIN_ROLE** | Can grant/revoke all roles | Multi-sig wallet only |
| **ADMIN_ROLE** | Pause, treasury, parameters, withdrawals, fees | Senior admins (2-3 people) |
| **OPERATOR_ROLE** | Complete withdrawals, daily operations | Operations team (5-10 people) |
| **UPGRADER_ROLE** | Upgrade smart contracts | Tech lead + multi-sig |

### Security Best Practices

✅ **Multi-Sig Wallet (Required for Mainnet)**
- Use Gnosis Safe with 3-of-5 or 5-of-9 configuration
- All DEFAULT_ADMIN_ROLE and UPGRADER_ROLE actions require multi-sig
- Store backup keys in secure locations (safety deposit boxes)

✅ **Role Separation**
- Don't give one person all roles
- Operators should NOT have ADMIN_ROLE
- Admins should NOT have UPGRADER_ROLE (except via multi-sig)

✅ **Access Controls**
- Enable 2FA on all wallets
- Use hardware wallets (Ledger, Trezor) for admin operations
- Rotate operator access every 6 months
- Audit role assignments monthly

---

## Daily Operations

### Morning Checklist (30 minutes)

**1. Health Check**
```bash
# Check contract status
- Platform paused? (should be false)
- Total users (growing?)
- Total investments (increasing?)
- Treasury balance (sufficient?)
- Dev wallet balance (for gas)
```

**View in smart contract:**
```typescript
const paused = await platform.paused();
const totalUsers = await platform.totalUsers();
const totalInvestments = await platform.totalInvestments();
const treasuryBalance = await grtToken.balanceOf(treasuryAddress);
const devWalletBalance = await ethers.provider.getBalance(devWalletAddress);
```

**2. Pending Withdrawals Review (MONDAYS ONLY!)**
- Check withdrawal queue
- Review amounts and users
- Identify any suspicious requests (large amounts, new users)
- Flag for KYC verification if needed

**⚠️ IMPORTANT:** Withdrawal requests can only be made on Mondays. Expect higher volume on Mondays.

**3. Event Monitoring**
- Check last 24 hours of blockchain events
- Look for unusual patterns:
  - Large investments from new users
  - Multiple withdrawals from same user
  - Rapid rank progression
- Investigate anomalies

### Weekly Tasks

**Monday (Withdrawal Day):**
- Process all pending withdrawal requests
- Heavy workload expected - ensure full team coverage
- Approve/reject all requests by end of day

**Wednesday:**
- Mid-week treasury balance reconciliation
- Check dev wallet balance for gas
- Team performance review

**Friday:**
- End-of-week metrics report
- Plan Monday monitoring coverage (withdrawal day)
- Review support tickets

### Monthly Tasks

**First Week:**
- Calculate Company Turnover (CTO) for previous month
- Identify users with 10% monthly growth for royalty
- Execute royalty distribution

**Second Week:**
- Verify rank qualifications for all users
- Trigger rank updates for qualified users
- Process rank bonuses

**Third Week:**
- Monthly audit of all transactions
- Reconcile on-chain vs database records
- Generate compliance reports

**Fourth Week:**
- Review platform parameters (minInvestment, fees, etc.)
- Plan any necessary upgrades
- Prepare monthly stakeholder report

---

## Withdrawal Management

### Withdrawal Schedule

**⚠️ CRITICAL CHANGE:** Withdrawals are now **Monday-only**.

| Day | User Actions | Admin Actions |
|-----|-------------|---------------|
| Monday | Can request withdrawals | Review and approve requests |
| Tue-Sun | Cannot request | Process approved, prepare for Monday |

### Withdrawal Approval Workflow

#### Step 1: Review Request

**Check withdrawal request details:**
```typescript
const requests = await platform.getWithdrawalRequests(userAddress);

// For each pending request:
const request = requests[requestId];
const grossAmount = ethers.formatEther(request.amount);
const netAmount = Number(grossAmount) * 0.9; // 10% fee deducted
const fee = Number(grossAmount) * 0.1;

console.log("Gross Amount:", grossAmount, "GRT");
console.log("Net to User:", netAmount, "GRT");
console.log("Fee (10%):", fee, "GRT");
console.log("Type:", request.withdrawalType === 0 ? "100% GRT" : "50/50 Split");
console.log("Status:", request.status);
```

#### Step 2: Verify User Eligibility

**Check if user should be allowed to withdraw:**

1. **KYC Status** (from backend database)
   - User must be KYC verified
   - Documents must be valid
   - No red flags in profile

2. **Account Standing**
   - Not flagged for suspicious activity
   - No open support tickets about fraud
   - Account age > 7 days (for first withdrawal)

3. **Dormancy Check**
   - Is user dormant (90+ days inactive)?
   - If yes, investigate before processing

4. **Amount Reasonableness**
   - First withdrawal > $10,000? Extra scrutiny
   - Historical withdrawal pattern

#### Step 3: Approve or Reject

**To Approve:**
```typescript
// As admin
await platform.connect(admin).approveWithdrawal(userAddress, requestId);
// Gas cost: ~$5-10
```

**To Reject:**
```typescript
await platform.connect(admin).rejectWithdrawal(
  userAddress,
  requestId,
  "Reason: KYC verification required"
);
// Gas cost: ~$5-10
```

**Common Rejection Reasons:**
- "KYC verification pending"
- "Suspicious activity detected"
- "Account under review"
- "Additional documentation required"
- "Compliance hold - contact support"

#### Step 4: Operator Processes Withdrawal

**After admin approval, operator completes:**
```typescript
// As operator
await platform.connect(operator).completeWithdrawal(userAddress, requestId);
// Gas cost: ~$20-40
```

**This triggers:**
- **10% platform fee deduction**
  - 2.5% → devWallet
  - 7.5% → treasury
- Net tokens sent to user's wallet
- Event emission (WithdrawalCompleted, PlatformFeeCollected)

### Fee Breakdown Example

**User requests 100 GRT withdrawal:**
```
Gross Amount: 100 GRT
Platform Fee (10%): 10 GRT
  ├─ Dev Wallet (2.5%): 2.5 GRT
  └─ Treasury (7.5%): 7.5 GRT
Net to User: 90 GRT
```

### Monday Batch Processing

**For efficiency, process in batches:**

```typescript
// Get all pending requests (from backend)
const pendingRequests = await backend.getPendingWithdrawals();

// Filter by criteria (KYC verified, amount < $10k, etc.)
const autoApprove = pendingRequests.filter(r =>
  r.kycVerified && r.amount < 10000
);

// Approve in batch
for (const req of autoApprove) {
  await platform.approveWithdrawal(req.userAddress, req.requestId);
}

// Flag manual review
const manualReview = pendingRequests.filter(r =>
  !r.kycVerified || r.amount >= 10000
);
// Send to admin dashboard for review
```

---

## Royalty Distribution

### Monthly Royalty Process (Updated!)

**Timeline:** First week of each month for previous month

#### Step 1: Calculate Company Turnover (CTO)

**Backend calculates:**
```typescript
const previousMonth = getCurrentMonth() - 1;
const monthlyInvestments = await db.investment.findMany({
  where: {
    created_at: {
      gte: startOfMonth(previousMonth),
      lte: endOfMonth(previousMonth)
    }
  }
});

const cto = monthlyInvestments.reduce((sum, inv) => sum + inv.amount_usd, 0);
console.log("Monthly CTO:", cto, "USD");
```

#### Step 2: Identify Eligible Users (10% GROWTH Rule!)

**⚠️ CRITICAL CHANGE:** Users must have 10% **monthly growth**, not just 10% new business.

**Must meet ALL criteria:**
1. **Rank Qualification**
   - Maintained rank for full month
   - Met team volume requirements
   - 60:40 ratio maintained

2. **Monthly Growth (NEW RULE!)**
   - Generated ≥10% growth from previous month's team volume
   - Example: Previous month 10,000 → This month must be ≥ 11,000
   - Checked via: `monthlyActivity[user][month].qualifiesForRoyalty`

3. **Active Investment**
   - Has at least one active investment
   - Not suspended or banned
   - Not dormant

**Query eligible users:**
```typescript
const eligibleUsers = await db.user.findMany({
  where: {
    rank: { gte: 4 }, // RUBY and above
    kyc_status: "APPROVED",
  }
});

// For each user, check 10% GROWTH (not just new business)
const qualified = eligibleUsers.filter(user => {
  const previousMonthVolume = getTeamVolume(user, previousMonth - 1);
  const currentMonthVolume = getTeamVolume(user, previousMonth);
  const requiredVolume = previousMonthVolume * 1.1; // 10% growth
  return currentMonthVolume >= requiredVolume;
});
```

#### Step 3: Execute Distribution

```typescript
const eligibleAddresses = qualified.map(u => u.wallet_address);
const amounts = qualified.map(u => calculateShareInGRT(u));
const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0n);
const maxBudget = totalAmount * 110n / 100n; // 10% safety margin

await platform.connect(admin).distributeRoyalty(
  eligibleAddresses,
  amounts,
  maxBudget
);

console.log("✅ Royalty distributed to", eligibleAddresses.length, "users");
```

---

## Emergency Procedures

### When to Pause the Platform

**Pause immediately if:**
- 🚨 Security breach suspected
- 🚨 Smart contract bug discovered
- 🚨 Abnormal withdrawal patterns
- 🚨 Major price manipulation
- 🚨 Regulatory order received
- 🚨 Critical backend failure

### How to Pause

```typescript
// As ADMIN
await platform.connect(admin).pause();
// Gas cost: ~$10-20

console.log("✅ Platform PAUSED");
console.log("   All user operations stopped");
```

**When paused:**
- ✅ Users CANNOT: register, invest, claim ROI, stake, request withdrawals
- ✅ Admins CAN: unpause, withdraw treasury, update parameters
- ✅ View functions still work

### How to Unpause

```typescript
await platform.connect(admin).unpause();
```

---

## Parameter Configuration

### Fee Configuration

#### Update Platform Fee Rate

```typescript
// Max rate is 2000 (20%)
// Current default: 1000 (10%)
const newRate = 1500; // 15%
await platform.connect(admin).updatePlatformFeeRate(newRate);
```

**Fee Split (Fixed):**
- 25% of fee → devWallet (2.5% at 10% total)
- 75% of fee → treasury (7.5% at 10% total)

#### Update Dev Wallet

```typescript
const newDevWallet = "0x...";
await platform.connect(admin).updateDevWallet(newDevWallet);
```

**⚠️ WARNING:** Verify address carefully! Ensure it's controlled.

### Emergency Token Withdrawal

```typescript
// For stuck tokens or emergencies
const tokenAddress = "0x..."; // Token to withdraw
const amount = ethers.parseEther("1000");
const recipient = treasuryAddress;

await platform.connect(admin).emergencyWithdraw(tokenAddress, amount, recipient);
```

---

## Fee Management

### Current Fee Structure

| Parameter | Value | Can Change? |
|-----------|-------|-------------|
| Platform Fee Rate | 10% (1000 basis points) | Yes, max 20% |
| Dev Wallet Share | 25% of fee (2.5% total) | No (constant) |
| Treasury Share | 75% of fee (7.5% total) | No (constant) |

### Fee Collection Monitoring

```typescript
// Listen for fee collection
platform.on("PlatformFeeCollected", (user, devFee, treasuryFee) => {
  console.log("Fee from:", user);
  console.log("To Dev Wallet:", ethers.formatEther(devFee), "GRT");
  console.log("To Treasury:", ethers.formatEther(treasuryFee), "GRT");
});
```

### Monthly Fee Report

Generate monthly:
```markdown
## Fee Collection Report - [Month Year]

**Summary:**
- Total Withdrawals Processed: X
- Gross Withdrawal Volume: $Y
- Total Fees Collected: $Z (10%)
  - Dev Wallet: $A (2.5%)
  - Treasury: $B (7.5%)
```

---

## Treasury Management

### Treasury Balance Monitoring

```typescript
const treasuryAddress = await platform.treasury();
const devWalletAddress = await platform.devWallet();

const treasuryGRT = await grtToken.balanceOf(treasuryAddress);
const devWalletETH = await ethers.provider.getBalance(devWalletAddress);

console.log("Treasury GRT:", ethers.formatEther(treasuryGRT));
console.log("Dev Wallet ETH:", ethers.formatEther(devWalletETH));
```

**Recommended Balance:**
- Treasury: 30 days of expected withdrawals
- Dev Wallet: Enough ETH for gas (0.5-1 ETH)

---

## Monitoring & Alerts

### Key Metrics Dashboard

**Track Daily:**
- New user registrations
- Total investments
- Withdrawal requests (spike on Mondays)
- Fee collection
- Staking packages created/claimed

**Track Weekly:**
- User retention
- Dormant users (90+ days)
- Rank distribution
- Monday withdrawal volume

**Track Monthly:**
- Platform revenue (from fees)
- Royalty distribution
- Active vs dormant ratio

### Alert Configuration

**Critical Alerts:**
- Treasury balance < 30 days runway
- Withdrawal request > $50,000
- Security event detected
- Smart contract paused
- Dev wallet ETH < 0.1 (gas issues!)

**Monday-Specific Alerts:**
- Withdrawal volume > 2x normal
- Pending approvals > 100
- Approval backlog building

---

## Best Practices

### Do's ✅

1. **Process all Monday withdrawals same day**
2. **Monitor dev wallet for gas**
3. **Check 10% growth rule for royalty**
4. **Document every admin action**
5. **Use multi-sig for mainnet**
6. **Monitor dormant users monthly**
7. **Verify fee calculations weekly**

### Don'ts ❌

1. **Don't approve withdrawals on non-Mondays** (users can't request anyway)
2. **Don't ignore dormant sponsor warnings**
3. **Don't let dev wallet run out of ETH**
4. **Don't change fee rate without announcement**
5. **Don't approve withdrawals without KYC**

---

## Common Admin Tasks

### Check if User is Dormant

```typescript
const isDormant = await platform.isDormant(userAddress);
if (isDormant) {
  console.log("⚠️ User is dormant (90+ days inactive)");
  console.log("   Their referral code is inactive");
}
```

### Check Withdrawal Day

```typescript
const isWithdrawalDay = await platform.isWithdrawalDay();
console.log("Is Monday?", isWithdrawalDay);
```

### View Fee Configuration

```typescript
const platformFeeRate = await platform.platformFeeRate();
const devWallet = await platform.devWallet();
const treasury = await platform.treasury();

console.log("Platform Fee:", Number(platformFeeRate) / 100, "%");
console.log("Dev Wallet:", devWallet);
console.log("Treasury:", treasury);
```

---

**Last Updated:** November 25, 2025
**Version:** 2.0.0
**Review Frequency:** Quarterly

---

*This guide is for internal use only. Do not share with external parties.*
