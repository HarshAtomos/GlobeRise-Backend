# GlobeRise Smart Contracts - Documentation Index

**Version:** 2.0.0
**Last Updated:** November 25, 2025

---

## 📚 Documentation Structure

### For Users
- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete end-user manual
  - Getting started, wallet setup
  - Making investments (dynamic ROI: 8%, 10%, 12%)
  - Staking packages (1.25% - 4.75% monthly)
  - Understanding 5 income types
  - Claiming ROI and withdrawals (Monday only)
  - Ranks, bonuses, referral system
  - FAQ and troubleshooting

### For Admins
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Admin operations manual
  - Daily operations checklist
  - Monday withdrawal approval workflow
  - Royalty distribution (10% growth requirement)
  - Emergency procedures
  - Treasury and dev wallet management
  - Fee configuration
  - Monitoring and audit trails

### For Developers
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Frontend integration
  - Web3 setup with ethers.js v6
  - Contract interaction examples
  - Event listening patterns
  - Error handling (including NotWithdrawalDay, SponsorDormant)
  - React hooks examples

- **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete function reference
  - All 50+ public functions
  - Parameters and return values
  - Events catalog (including staking, fee events)
  - Gas cost estimates
  - Rank system reference (16 ranks)
  - Dynamic ROI tiers and staking rates
  - Fee structure details

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
  - UUPS proxy pattern
  - Storage layout
  - MLM structure (Binary + Unilevel)
  - Commission flow
  - Fee mechanism
  - Staking system
  - Security model

### For DevOps
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Step-by-step deployment
  - Testnet deployment (Sepolia)
  - Mainnet deployment checklist
  - Dev wallet configuration
  - Post-deployment validation
  - Rollback procedures

- **[MONITORING_GUIDE.md](./MONITORING_GUIDE.md)** - Operations guide
  - Key metrics dashboard
  - Critical alerts
  - Health checks
  - Analytics setup

- **[UPGRADE_PROCEDURES.md](./UPGRADE_PROCEDURES.md)** - Upgrade workflow
  - UUPS upgrade process
  - Storage compatibility
  - Emergency rollback

### For QA & Auditors
- **[MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)** - Testing guide
  - Testnet setup
  - Test scenarios (including staking, Monday withdrawals)
  - Verification checklist

- **[SECURITY_AUDIT_PREP.md](./SECURITY_AUDIT_PREP.md)** - Audit materials
  - Threat model
  - Attack vectors
  - Mitigations implemented
  - Test coverage report
  - Known limitations

---

## 🎯 Quick Navigation

| **Want to:** | **Read:** |
|---|---|
| Use the platform | USER_GUIDE.md |
| Administer the platform | ADMIN_GUIDE.md |
| Integrate frontend | INTEGRATION_GUIDE.md + API_REFERENCE.md |
| Deploy contracts | DEPLOYMENT_GUIDE.md |
| Test contracts | MANUAL_TESTING_GUIDE.md |
| Prepare for audit | SECURITY_AUDIT_PREP.md |
| Understand architecture | ARCHITECTURE.md |

---

## 📊 Smart Contracts Overview

### Contracts
| Contract | Description |
|----------|-------------|
| `GlobeRiseToken.sol` | ERC20 token (GRT) - 1 billion fixed supply |
| `GlobeRisePlatform.sol` | Main platform - investments, MLM, staking, withdrawals |

### Key Features (v2.0)
- **Dynamic ROI Tiers:** 8% (base), 10% (2 refs/14 days), 12% (4 refs/21 days)
- **5 Staking Packages:** 3-24 months, 1.25%-4.75% monthly returns
- **5 Income Types:** ROI, Direct Referral (5%), Level Income, Royalty, Bonus
- **16 Ranks:** BEGINNER to IMPERATOR with 60:40 qualification
- **MLM Structure:** Binary tree + Unilevel (unlimited direct referrals)
- **Withdrawal Options:** 100% GRT or 50/50 GRT+USDT split (Monday only)
- **Platform Fee:** 10% on withdrawals (2.5% dev + 7.5% treasury)
- **Dormant Logic:** 90 days inactivity = dormant sponsor

### Quick Commands
```bash
# Compile contracts
npm run hardhat:compile

# Run tests (127 tests)
npm run hardhat:test

# Deploy to Sepolia testnet
npm run hardhat:deploy:sepolia

# Verify on Etherscan
npm run hardhat:verify:sepolia
```

---

## 🆕 Version 2.0 Changes

| Feature | v1.0 | v2.0 |
|---------|------|------|
| ROI Tier Selection | Fixed at investment | Dynamic at each claim |
| Staking | Not available | 5 tiers (3-24 months) |
| Platform Fee | None | 10% on withdrawals |
| Withdrawal Day | 7-day cooldown | Monday only |
| Direct Referral Limit | 16 max | Unlimited |
| Dormant Users | Not tracked | 90-day inactivity |
| Royalty Qualification | 10% of total | 10% monthly growth |
| ROI Cap | Counted all income | Passive ROI only |

---

## 📋 Documentation Stats

- **Total Files:** 11 documentation files
- **User Guides:** 2 files (User, Admin)
- **Developer Docs:** 3 files (API, Integration, Architecture)
- **DevOps Docs:** 3 files (Deployment, Monitoring, Upgrades)
- **QA/Audit Docs:** 2 files (Testing, Security)

---

**All documentation is production-ready.**

**Last Updated:** November 25, 2025
