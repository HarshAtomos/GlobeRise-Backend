# GlobeRise Platform - Monitoring & Operations Guide

**Version:** 2.0.0
**Last Updated:** November 25, 2025

---

## 📊 Key Metrics Dashboard

### Daily Metrics (Track Every Day)

| Metric | Formula | Alert If |
|--------|---------|----------|
| **New Users** | Daily registrations | < 10/day or > 1000/day |
| **Total Investments** | Sum of all investments | Sudden spike (>50% daily) |
| **Total Stakes** | Sum of all staking packages | N/A (new feature) |
| **Withdrawal Rate** | Withdrawals / Available Balance | > 30% daily |
| **Treasury Runway** | Balance / Daily Outflow | < 30 days |
| **Fee Collection** | Total fees collected | Track trending |
| **Dormant Users** | Users inactive 90+ days | > 20% of total |
| **Commission Payout** | Total commissions distributed | > 2X revenue |
| **GRT Price** | External oracle/DEX | ±20% change |

### Health Check Queries (Updated for v2.0)

```typescript
// Daily health check
const health = {
  paused: await platform.paused(),
  totalUsers: await platform.totalUsers(),
  totalInvestments: await platform.totalInvestments(),
  totalCommissions: await platform.totalCommissionsDistributed(),
  totalFeesCollected: await platform.totalFeesCollected(),
  treasuryBalance: await token.balanceOf(treasuryAddress),
  devWalletBalance: await token.balanceOf(devWalletAddress),
  platformBalance: await token.balanceOf(platformAddress),
  isWithdrawalDay: await platform.isWithdrawalDay(),
  platformFeeRate: await platform.platformFeeRate()
};

console.log("Platform Health:", health);
```

### Monday-Specific Monitoring

```typescript
// Run every Monday
const mondayMetrics = {
  pendingWithdrawals: await countPendingWithdrawals(),
  estimatedFeeCollection: pendingWithdrawals * 0.10,
  estimatedDevFee: estimatedFeeCollection * 0.25,
  estimatedTreasuryFee: estimatedFeeCollection * 0.75
};
```

---

## 🚨 Critical Alerts

### Immediate Action Required

**Setup Alerts For:**

1. **Pause Event** → Platform paused
   - SMS all admins
   - Check reason immediately
   - Prepare emergency response

2. **Large Withdrawal** → Request > $50k

3. **Dev Wallet Low ETH** → < 0.1 ETH
   - Operations may fail due to gas

4. **Monday Withdrawal Backlog** → > 100 pending
   - Scale up processing team

5. **Fee Rate Changed** → PlatformFeeRateUpdated event
   - Verify authorized change
   - Extra KYC review
   - Senior admin approval
   - Fraud check

3. **Treasury Low** → < 30 days runway
   - Alert CFO
   - Prepare funding round
   - Consider pausing new investments

4. **Suspicious Activity** → Multiple failed transactions
   - Possible attack attempt
   - Review logs
   - Consider temporary pause

---

## 📈 Analytics Setup

### Dune Analytics Dashboard

Create queries for:
- Daily active users
- Investment volume trends
- Rank distribution
- Top performers
- Commission payouts by type

**Sample Query:**
```sql
SELECT
  DATE_TRUNC('day', block_time) as date,
  COUNT(DISTINCT user) as new_users,
  SUM(amount) as total_invested
FROM globerise.InvestmentCreated
GROUP BY 1
ORDER BY 1 DESC;
```

---

**For complete procedures, see ADMIN_GUIDE.md**

**Last Updated:** October 29, 2025
