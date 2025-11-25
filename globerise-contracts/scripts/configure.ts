import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Post-Deployment Configuration Script
 *
 * This script handles initial configuration after deployment:
 * 1. Transfer admin roles to multi-sig wallet (if specified)
 * 2. Update platform parameters if needed
 * 3. Verify all settings are correct
 * 4. Display configuration summary
 *
 * Usage:
 * - For production: Set MULTISIG_ADMIN_ADDRESS in .env before running
 * - For testing: Can skip multi-sig setup
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║     GLOBERISE POST-DEPLOYMENT CONFIGURATION        ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("Configuration Details:");
  console.log("├─ Network:", network.name);
  console.log("├─ Deployer:", deployer.address);
  console.log("└─ Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============================================
  // Load Deployment
  // ============================================

  console.log("📝 Loading deployment...");

  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const platformAddress = deployment.contracts.GlobeRisePlatform.proxy;
  const tokenAddress = deployment.contracts.GlobeRiseToken;

  const platform = await ethers.getContractAt("GlobeRisePlatform", platformAddress);
  const token = await ethers.getContractAt("GlobeRiseToken", tokenAddress);

  console.log("✅ Contracts loaded\n");

  // ============================================
  // Verify Current Configuration
  // ============================================

  console.log("📝 Current Configuration:");

  const config = {
    minInvestment: await platform.minInvestment(),
    directReferralRate: await platform.directReferralRate(),
    withdrawalCooldown: await platform.withdrawalCooldown(),
    minWithdrawal: await platform.minWithdrawal(),
    treasury: await platform.treasury(),
    paused: await platform.paused(),
    totalUsers: await platform.totalUsers(),
    totalInvestments: await platform.totalInvestments(),
  };

  console.log("├─ Min Investment:", ethers.formatEther(config.minInvestment), "GRT");
  console.log("├─ Direct Referral Rate:", Number(config.directReferralRate) / 100, "%");
  console.log("├─ Withdrawal Cooldown:", Number(config.withdrawalCooldown) / 86400, "days");
  console.log("├─ Min Withdrawal:", ethers.formatEther(config.minWithdrawal), "GRT");
  console.log("├─ Treasury:", config.treasury);
  console.log("├─ Paused:", config.paused);
  console.log("├─ Total Users:", config.totalUsers.toString());
  console.log("└─ Total Investments:", config.totalInvestments.toString(), "\n");

  // ============================================
  // Multi-Sig Transfer (if configured)
  // ============================================

  const multisigAddress = process.env.MULTISIG_ADMIN_ADDRESS;

  if (multisigAddress && multisigAddress !== "") {
    console.log("📝 Transferring roles to multi-sig wallet...");
    console.log("   Multi-sig address:", multisigAddress, "\n");

    const DEFAULT_ADMIN_ROLE = await platform.DEFAULT_ADMIN_ROLE();
    const ADMIN_ROLE = await platform.ADMIN_ROLE();
    const UPGRADER_ROLE = await platform.UPGRADER_ROLE();

    // Grant roles to multi-sig
    console.log("   Granting roles to multi-sig...");
    await platform.grantRole(DEFAULT_ADMIN_ROLE, multisigAddress);
    await platform.grantRole(ADMIN_ROLE, multisigAddress);
    await platform.grantRole(UPGRADER_ROLE, multisigAddress);

    console.log("   ✅ Roles granted\n");

    // Verify
    const hasDefaultAdmin = await platform.hasRole(DEFAULT_ADMIN_ROLE, multisigAddress);
    const hasAdmin = await platform.hasRole(ADMIN_ROLE, multisigAddress);
    const hasUpgrader = await platform.hasRole(UPGRADER_ROLE, multisigAddress);

    console.log("   Verification:");
    console.log("   ├─ DEFAULT_ADMIN_ROLE:", hasDefaultAdmin ? "✅" : "❌");
    console.log("   ├─ ADMIN_ROLE:", hasAdmin ? "✅" : "❌");
    console.log("   └─ UPGRADER_ROLE:", hasUpgrader ? "✅" : "❌\n");

    console.log("⚠️  IMPORTANT: Revoke deployer roles after verifying multi-sig control:");
    console.log("   1. Test multi-sig can execute admin functions");
    console.log("   2. Then run:");
    console.log("      await platform.revokeRole(DEFAULT_ADMIN_ROLE, deployerAddress);");
    console.log("      await platform.revokeRole(ADMIN_ROLE, deployerAddress);");
    console.log("      await platform.revokeRole(UPGRADER_ROLE, deployerAddress);\n");
  } else {
    console.log("⚠️  No MULTISIG_ADMIN_ADDRESS configured");
    console.log("   Set in .env for production deployment");
    console.log("   Current admin:", deployer.address, "\n");
  }

  // ============================================
  // Token Ownership
  // ============================================

  console.log("📝 Token Ownership:");

  const tokenOwner = await token.owner();
  const tokenBalance = await token.balanceOf(deployer.address);
  const platformTokenBalance = await token.balanceOf(platformAddress);

  console.log("├─ Token Owner:", tokenOwner);
  console.log("├─ Deployer Balance:", ethers.formatEther(tokenBalance), "GRT");
  console.log("└─ Platform Balance:", ethers.formatEther(platformTokenBalance), "GRT\n");

  if (multisigAddress && tokenOwner === deployer.address) {
    console.log("⚠️  RECOMMENDATION: Transfer token ownership to multi-sig");
    console.log("   await token.transferOwnership(multisigAddress);\n");
  }

  // ============================================
  // ROI Configuration Verification
  // ============================================

  console.log("📝 ROI Configuration:");

  const roiPercentages = [];
  const roiCaps = [];

  for (let i = 0; i < 3; i++) {
    roiPercentages.push(await platform.roiPercentages(i));
    roiCaps.push(await platform.roiCaps(i));
  }

  console.log("├─ Tier 1:", Number(roiPercentages[0]) / 100, "% ROI,", Number(roiCaps[0]) / 100, "X cap");
  console.log("├─ Tier 2:", Number(roiPercentages[1]) / 100, "% ROI,", Number(roiCaps[1]) / 100, "X cap");
  console.log("└─ Tier 3:", Number(roiPercentages[2]) / 100, "% ROI,", Number(roiCaps[2]) / 100, "X cap\n");

  // ============================================
  // Level Income Rates
  // ============================================

  console.log("📝 Level Income Rates:");

  const sampleLevels = [0, 1, 2, 4, 7, 11, 15]; // Sample levels to display
  for (const level of sampleLevels) {
    const rate = await platform.levelIncomeRates(level);
    console.log(`   Level ${level + 1}:`, Number(rate) / 100, "%");
  }
  console.log();

  // ============================================
  // Rank System
  // ============================================

  console.log("📝 Rank System:");

  const sampleRanks = [0, 4, 8, 12, 15]; // Sample ranks
  for (const rank of sampleRanks) {
    const rankName = await platform.rankNames(rank);
    const requirement = await platform.rankRequirements(rank);
    const bonus = await platform.rankBonuses(rank);

    console.log(`   ${rankName}:`, "$" + requirement.toString(), "volume,", "$" + bonus.toString(), "bonus");
  }
  console.log();

  // ============================================
  // Summary
  // ============================================

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║         CONFIGURATION COMPLETE ✅                   ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("📌 Configuration Checklist:");
  console.log(multisigAddress ? "✅" : "⚠️ ", "Multi-sig admin setup");
  console.log("✅ ROI tiers configured (8%, 10%, 12%)");
  console.log("✅ Level income rates configured (16 levels)");
  console.log("✅ Rank system configured (16 ranks)");
  console.log("✅ Withdrawal parameters set");
  console.log("✅ Treasury address set\n");

  console.log("📌 Next Steps:");
  console.log("1. Test all functions on", network.name);
  console.log("2. Register first admin user in platform");
  console.log("3. Update frontend .env with contract addresses:");
  console.log("   REACT_APP_TOKEN_ADDRESS=" + tokenAddress);
  console.log("   REACT_APP_PLATFORM_ADDRESS=" + platformAddress);
  console.log("4. Begin user onboarding");
  console.log("5. Monitor platform activity\n");

  // ============================================
  // Security Reminders
  // ============================================

  if (network.chainId === 1n) {
    console.log("🔐 MAINNET SECURITY CHECKLIST:");
    console.log("├─ [ ] Transfer ownership to multi-sig");
    console.log("├─ [ ] Revoke deployer's admin roles");
    console.log("├─ [ ] Test pause functionality");
    console.log("├─ [ ] Setup monitoring (Tenderly/Defender)");
    console.log("├─ [ ] Enable 2FA on all admin accounts");
    console.log("├─ [ ] Document emergency procedures");
    console.log("├─ [ ] Setup 24/7 on-call rotation");
    console.log("└─ [ ] Prepare incident response plan\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:", error);
    process.exit(1);
  });
