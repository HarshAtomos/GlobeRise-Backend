# GlobeRise Platform - Upgrade Procedures

**Version:** 2.0.0
**Last Updated:** November 25, 2025

---

## 🔄 UUPS Upgrade Workflow

### When to Upgrade

**Valid Reasons:**
- Bug fixes (security or functionality)
- New features requested by users
- Gas optimizations
- Regulatory compliance updates

**Invalid Reasons:**
- Frequent parameter changes (use admin functions instead)
- Fee rate changes (use `updatePlatformFeeRate()`)
- Dev wallet changes (use `updateDevWallet()`)
- Cosmetic improvements
- Rushed changes without testing

### v2.0 Upgrade Notes

**New Storage Variables Added:**
```solidity
// Added in v2.0 - use __gap slots
Slot 138: devWallet (address)
Slot 139: platformFeeRate (uint256)
Slot 140: stakingPackages mapping
Slot 141: stakingRates[5]
Slot 142: stakingDurations[5]
Slot 143: lastActivityTime mapping
Slot 144: totalFeesCollected (uint256)
```

**Removed Variables:**
- `MAX_DIRECT_REFERRALS` (now unlimited)
- `withdrawalCooldown` (replaced with Monday-only)

---

## 📋 Upgrade Process (Production)

### Phase 1: Planning (1 week)

1. **Document Changes**
   - List all modifications
   - Explain rationale
   - Identify affected users

2. **Storage Compatibility Check**
   - Verify no storage reordering
   - Ensure new variables use __gap slots
   - Run `npx hardhat-upgrades validate`

3. **Security Review**
   - Code review by 2+ developers
   - Test coverage for new code
   - Static analysis (Slither)

### Phase 2: Testing (1 week)

4. **Testnet Deployment**
   ```bash
   npx hardhat run scripts/upgrade.ts --network sepolia
   ```

5. **Validation**
   - All existing data preserved
   - New features work correctly
   - No regression bugs
   - Gas costs acceptable

6. **Community Testing**
   - Invite beta testers
   - Collect feedback
   - Fix any issues

### Phase 3: Mainnet Upgrade (48+ hours)

7. **Announcement**
   - Notify users 48 hours in advance
   - Explain changes and benefits
   - Provide support contact

8. **Execute Upgrade (Via Multi-Sig)**
   ```typescript
   // Proposal in multi-sig wallet
   await platform.upgradeProxy(newImplementationAddress);

   // Requires 3-of-5 signatures
   // 48-hour timelock delay (if configured)
   ```

9. **Post-Upgrade Validation**
   - Verify storage preserved
   - Test all critical functions
   - Monitor for 24 hours
   - Respond to user issues

---

## 🚨 Emergency Rollback

**If upgrade breaks platform:**

```bash
# 1. Immediately pause
await platform.pause();

# 2. Upgrade to previous implementation
await platform.upgradeTo(previousImplementationAddress);

# 3. Verify rollback successful
await platform.unpause();

# 4. Investigate root cause
```

---

**For detailed upgrade script, see scripts/upgrade.ts**

**Last Updated:** October 29, 2025
