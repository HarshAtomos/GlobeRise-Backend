# GlobeRise Platform - Deployment Guide

**Version:** 2.0.0
**Audience:** DevOps & Smart Contract Developers

---

## ✅ Pre-Deployment Checklist

### Required Tools
- [ ] Node.js 20+ installed
- [ ] Hardhat installed (`npm install --save-dev hardhat`)
- [ ] Git for version control
- [ ] Ethereum wallet with private key

### Required Accounts & Services
- [ ] Alchemy or Infura account (RPC URLs)
- [ ] Etherscan API key
- [ ] Multi-sig wallet address (Gnosis Safe)
- [ ] Treasury wallet address
- [ ] **Dev wallet address (NEW!)** - for gas fees portion

### Required Funds
- [ ] Deployer wallet funded:
  - Sepolia: 0.5 ETH (free from faucet)
  - Mainnet: 0.3-0.5 ETH ($900-$1500 at $3000 ETH)
- [ ] Dev wallet funded with ETH for gas operations

---

## 🧪 Testnet Deployment (Sepolia)

### Step 1: Configure Environment

Create `.env` file:
```bash
# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY

# Deployer Private Key
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Etherscan API Key
ETHERSCAN_API_KEY=your_etherscan_api_key

# NEW: Dev Wallet Address (receives 2.5% of withdrawal fees)
DEV_WALLET_ADDRESS=0xYourDevWalletAddress

# Optional: Multi-sig (leave empty for testing)
MULTISIG_ADMIN_ADDRESS=

# Treasury Address
TREASURY_ADDRESS=0xYourTreasuryAddress
```

### Step 2: Compile Contracts

```bash
npx hardhat compile

# Expected output:
# Compiled 22 Solidity files successfully
```

### Step 3: Run Tests

```bash
npx hardhat test

# Expected: 127+ tests, 100% passing
```

### Step 4: Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.ts --network sepolia

# Wait 5-10 minutes for deployment
# Save all contract addresses shown
```

**Expected output:**
```
╔════════════════════════════════════════════════════╗
║        GLOBERISE PLATFORM DEPLOYMENT              ║
╚════════════════════════════════════════════════════╝

Deployment Details:
├─ Network: sepolia (Chain ID: 11155111)
├─ Deployer: 0x...
├─ Balance: 0.5 ETH

✅ GlobeRiseToken deployed to: 0xTOKEN_ADDRESS
   ├─ Total Supply: 1000000000.0 GRT
   └─ Owner: 0x...

✅ GlobeRisePlatform deployed to: 0xPLATFORM_ADDRESS
   ├─ Proxy Address: 0xPLATFORM_ADDRESS
   ├─ Implementation: 0xIMPL_ADDRESS
   ├─ Treasury: 0x...
   ├─ Dev Wallet: 0x...                    <-- NEW!
   └─ Platform Fee: 10%                     <-- NEW!

✅ Transferred: 500000000.0 GRT to platform
```

### Step 5: Verify Contracts

```bash
npx hardhat run scripts/verify.ts --network sepolia
```

### Step 6: Configure Platform

```bash
npx hardhat run scripts/configure.ts --network sepolia
```

### Step 7: Test on Sepolia

**Manual Testing Checklist (Updated for v2.0):**
- [ ] Register 3 test users
- [ ] Create investments (no tier parameter!)
- [ ] Create staking packages (tiers 1-5)
- [ ] Wait 30 days (use timetravel) and claim ROI
- [ ] Check dynamic tier calculation
- [ ] Test Monday-only withdrawal (use timetravel to Monday)
- [ ] Complete withdrawal and verify 10% fee split
- [ ] Test dormancy (advance 90 days, try to register under dormant user)
- [ ] Test pause/unpause

---

## 🚀 Mainnet Deployment

### Pre-Mainnet Security Review

- [ ] All tests passing (127+)
- [ ] Slither analysis: Zero critical/high
- [ ] Mythril analysis: Zero critical
- [ ] 2+ weeks Sepolia testnet validation
- [ ] External audit completed (recommended)
- [ ] Multi-sig wallet set up (3-of-5 minimum)
- [ ] Dev wallet address verified
- [ ] Fee configuration reviewed
- [ ] Emergency procedures documented
- [ ] Team trained on admin operations

### Mainnet Deployment Steps

**1. Final Environment Setup**

```bash
# .env for mainnet
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
DEPLOYER_PRIVATE_KEY=your_deployer_private_key

# CRITICAL: Set multi-sig address
MULTISIG_ADMIN_ADDRESS=0x... # Gnosis Safe address

# Treasury (can be multi-sig or dedicated wallet)
TREASURY_ADDRESS=0x...

# NEW: Dev wallet for gas fees (2.5% of withdrawals)
DEV_WALLET_ADDRESS=0x...
```

**2. Pre-Flight Checks**

```bash
npx hardhat console --network mainnet
> const balance = await ethers.provider.getBalance("YOUR_ADDRESS");
> console.log(ethers.formatEther(balance), "ETH");
# Should have 0.3-0.5 ETH
```

**3. Deploy to Mainnet**

```bash
npx hardhat run scripts/deploy.ts --network mainnet

# CAREFULLY review all output
# SAVE all contract addresses immediately
```

**4. Verify on Etherscan**

```bash
npx hardhat run scripts/verify.ts --network mainnet
```

**5. Transfer to Multi-Sig**

```bash
npx hardhat run scripts/configure.ts --network mainnet

# This transfers:
# - DEFAULT_ADMIN_ROLE
# - ADMIN_ROLE  
# - UPGRADER_ROLE
# From deployer to multi-sig
```

**6. Initial Configuration Verification**

```typescript
// Verify all v2.0 settings
const devWallet = await platform.devWallet();
const treasury = await platform.treasury();
const platformFeeRate = await platform.platformFeeRate();
const isWithdrawalDay = await platform.isWithdrawalDay();

console.log("Dev Wallet:", devWallet);
console.log("Treasury:", treasury);
console.log("Platform Fee Rate:", Number(platformFeeRate) / 100, "%");
console.log("Is Withdrawal Day (Monday):", isWithdrawalDay);
```

---

## 📊 Post-Deployment Validation

### 50-Point Verification Checklist (Updated for v2.0)

**Contract Deployment:**
- [ ] 1. GlobeRiseToken deployed successfully
- [ ] 2. GlobeRisePlatform proxy deployed
- [ ] 3. Implementation deployed
- [ ] 4. Contracts verified on Etherscan
- [ ] 5. Correct Solidity version (0.8.24)

**Configuration (NEW v2.0):**
- [ ] 6. Min investment = 100 GRT
- [ ] 7. Direct referral rate = 5%
- [ ] 8. ~~Withdrawal cooldown~~ = Monday-only now
- [ ] 9. Min withdrawal = 10 GRT
- [ ] 10. Treasury address correct
- [ ] 11. **Dev wallet address correct**
- [ ] 12. **Platform fee rate = 10% (1000 basis points)**
- [ ] 13. **Staking rates configured correctly**

**Fee System:**
- [ ] 14. DEV_FEE_SHARE = 2500 (25%)
- [ ] 15. TREASURY_FEE_SHARE = 7500 (75%)
- [ ] 16. Fee deduction works on withdrawal

**Staking System:**
- [ ] 17. Tier 1: 3mo, 1.25%
- [ ] 18. Tier 2: 6mo, 1.75%
- [ ] 19. Tier 3: 12mo, 2.25%
- [ ] 20. Tier 4: 18mo, 4%
- [ ] 21. Tier 5: 24mo, 4.75%

**Dynamic ROI:**
- [ ] 22. Base ROI = 8%
- [ ] 23. Tier 2 ROI = 10% (2 refs/14 days)
- [ ] 24. Tier 3 ROI = 12% (4 refs/21 days)

**Dormancy:**
- [ ] 25. DORMANT_PERIOD = 90 days
- [ ] 26. isDormant() works correctly
- [ ] 27. SponsorDormant error thrown

**Withdrawal Day:**
- [ ] 28. isWithdrawalDay() works
- [ ] 29. NotWithdrawalDay error on non-Monday

**Token Distribution:**
- [ ] 30. Total supply = 1B GRT
- [ ] 31. Platform has ≥500M GRT
- [ ] 32. Deployer has remaining balance

**Access Control:**
- [ ] 33. Multi-sig has DEFAULT_ADMIN_ROLE
- [ ] 34. Multi-sig has ADMIN_ROLE
- [ ] 35. Multi-sig has UPGRADER_ROLE
- [ ] 36. Deployer has OPERATOR_ROLE
- [ ] 37. Deployer roles can be revoked

**Functionality:**
- [ ] 38. User registration works
- [ ] 39. Investment creation works (no tier param)
- [ ] 40. Staking creation works
- [ ] 41. Commission distribution works
- [ ] 42. Withdrawal request works (Monday only)
- [ ] 43. Fee collection works
- [ ] 44. Pause/unpause works
- [ ] 45. View functions return correct data

**Security:**
- [ ] 46. Reentrancy guards active
- [ ] 47. Balance checks functioning
- [ ] 48. Upgrade mechanism secure
- [ ] 49. Emergency pause tested
- [ ] 50. Multi-sig control verified

---

## 🔄 Rollback Procedures

### If Deployment Fails

**During deployment:**
1. Don't panic - deployment is atomic
2. Check error message carefully
3. If out of gas: Increase gas limit
4. If validation fails: Review storage layout
5. If other error: Check deployer permissions

**After deployment (if bugs found):**
1. Immediately pause platform
2. Assess severity:
   - **Critical:** Funds at risk → Emergency upgrade
   - **High:** Functionality broken → Schedule upgrade
   - **Medium:** Workaround possible → Plan upgrade
3. Test fix on testnet thoroughly
4. Deploy upgrade via UPGRADER_ROLE
5. Unpause after validation

### Emergency Upgrade Procedure

```bash
# 1. Deploy fix to testnet first
npx hardhat run scripts/upgrade.ts --network sepolia

# 2. Test extensively on testnet (48 hours minimum)

# 3. Deploy to mainnet (via multi-sig)
npx hardhat run scripts/upgrade.ts --network mainnet

# 4. Verify new implementation
npx hardhat run scripts/verify.ts --network mainnet
```

---

## 📞 Support During Deployment

**If deployment fails:**
1. Check Hardhat Discord
2. Review deployment logs
3. Contact: contracts@globerise.com

**Emergency contacts:**
- Lead Developer: [Email]
- DevOps: [Email]
- Security: [Email]

---

**Last Updated:** November 25, 2025
