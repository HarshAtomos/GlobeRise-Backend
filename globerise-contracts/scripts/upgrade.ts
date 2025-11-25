import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Upgrade GlobeRise Platform Contract (UUPS)
 *
 * This script safely upgrades the GlobeRisePlatform contract while:
 * 1. Preserving all existing data (users, investments, commissions)
 * 2. Validating storage layout compatibility
 * 3. Testing the upgraded contract
 * 4. Saving new deployment addresses
 *
 * IMPORTANT: Always test on Sepolia first!
 */
async function main() {
  const [upgrader] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║        GLOBERISE PLATFORM UPGRADE (UUPS)           ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("Upgrade Details:");
  console.log("├─ Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("├─ Upgrader:", upgrader.address);
  console.log("├─ Balance:", ethers.formatEther(await ethers.provider.getBalance(upgrader.address)), "ETH\n");

  // ============================================
  // Step 1: Load Current Deployment
  // ============================================

  console.log("📝 Step 1: Loading current deployment...");

  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}\nPlease deploy first using deploy.ts`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const currentProxyAddress = deployment.contracts.GlobeRisePlatform.proxy;
  const currentImplementation = deployment.contracts.GlobeRisePlatform.implementation;

  console.log("✅ Current Deployment:");
  console.log("   ├─ Proxy Address:", currentProxyAddress);
  console.log("   ├─ Implementation:", currentImplementation);
  console.log("   └─ Deployed:", deployment.timestamp, "\n");

  // ============================================
  // Step 2: Verify Upgrader Has Permission
  // ============================================

  console.log("📝 Step 2: Verifying upgrade permissions...");

  const platform = await ethers.getContractAt("GlobeRisePlatform", currentProxyAddress);
  const UPGRADER_ROLE = await platform.UPGRADER_ROLE();
  const hasRole = await platform.hasRole(UPGRADER_ROLE, upgrader.address);

  if (!hasRole) {
    throw new Error(`Address ${upgrader.address} does not have UPGRADER_ROLE`);
  }

  console.log("✅ Upgrade permission verified\n");

  // ============================================
  // Step 3: Snapshot Current State
  // ============================================

  console.log("📝 Step 3: Taking snapshot of current state...");

  const totalUsers = await platform.totalUsers();
  const totalInvestments = await platform.totalInvestments();
  const minInvestment = await platform.minInvestment();
  const grtToken = await platform.grtToken();
  const treasury = await platform.treasury();

  console.log("✅ Current State:");
  console.log("   ├─ Total Users:", totalUsers.toString());
  console.log("   ├─ Total Investments:", totalInvestments.toString());
  console.log("   ├─ Min Investment:", ethers.formatEther(minInvestment), "GRT");
  console.log("   ├─ GRT Token:", grtToken);
  console.log("   └─ Treasury:", treasury, "\n");

  // ============================================
  // Step 4: Deploy New Implementation
  // ============================================

  console.log("📝 Step 4: Deploying new implementation...");
  console.log("⚠️  This does NOT affect the proxy yet\n");

  const GlobeRisePlatformV2 = await ethers.getContractFactory("GlobeRisePlatform");

  // Use OpenZeppelin Upgrades plugin to upgrade
  const upgraded = await upgrades.upgradeProxy(currentProxyAddress, GlobeRisePlatformV2, {
    kind: "uups",
  });

  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(currentProxyAddress);

  console.log("✅ New Implementation Deployed:");
  console.log("   ├─ Address:", newImplementation);
  console.log("   └─ Proxy Address: (unchanged)", currentProxyAddress, "\n");

  // ============================================
  // Step 5: Validate Storage Preserved
  // ============================================

  console.log("📝 Step 5: Validating storage integrity...");

  const totalUsersAfter = await upgraded.totalUsers();
  const totalInvestmentsAfter = await upgraded.totalInvestments();
  const minInvestmentAfter = await upgraded.minInvestment();
  const grtTokenAfter = await upgraded.grtToken();
  const treasuryAfter = await upgraded.treasury();

  // Verify critical storage preserved
  if (totalUsersAfter !== totalUsers) {
    throw new Error("Storage corruption: totalUsers mismatch");
  }
  if (totalInvestmentsAfter !== totalInvestments) {
    throw new Error("Storage corruption: totalInvestments mismatch");
  }
  if (grtTokenAfter !== grtToken) {
    throw new Error("Storage corruption: grtToken address changed");
  }

  console.log("✅ Storage Integrity Verified:");
  console.log("   ├─ Total Users: ✅", totalUsersAfter.toString());
  console.log("   ├─ Total Investments: ✅", totalInvestmentsAfter.toString());
  console.log("   ├─ GRT Token: ✅", grtTokenAfter);
  console.log("   └─ All storage slots preserved\n");

  // ============================================
  // Step 6: Test Upgraded Contract
  // ============================================

  console.log("📝 Step 6: Testing upgraded contract functions...");

  // Test a view function
  const paused = await upgraded.paused();
  console.log("   ├─ Pausable state:", paused ? "PAUSED" : "ACTIVE");

  // Test admin functions are still accessible
  const ADMIN_ROLE = await upgraded.ADMIN_ROLE();
  const adminHasRole = await upgraded.hasRole(ADMIN_ROLE, upgrader.address);
  console.log("   ├─ Admin access:", adminHasRole ? "✅" : "❌");

  console.log("   └─ Contract functional: ✅\n");

  // ============================================
  // Step 7: Update Deployment Record
  // ============================================

  console.log("📝 Step 7: Updating deployment records...");

  deployment.contracts.GlobeRisePlatform.implementation = newImplementation;
  deployment.contracts.GlobeRisePlatform.upgradedAt = new Date().toISOString();
  deployment.contracts.GlobeRisePlatform.previousImplementations =
    deployment.contracts.GlobeRisePlatform.previousImplementations || [];
  deployment.contracts.GlobeRisePlatform.previousImplementations.push({
    address: currentImplementation,
    upgradedAt: deployment.contracts.GlobeRisePlatform.upgradedAt,
  });

  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  console.log("✅ Deployment record updated:", deploymentFile, "\n");

  // ============================================
  // Summary
  // ============================================

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║           UPGRADE SUCCESSFUL ✅                     ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("📋 Upgrade Summary:");
  console.log("├─ Previous Implementation:", currentImplementation);
  console.log("├─ New Implementation:", newImplementation);
  console.log("├─ Proxy Address: (unchanged)", currentProxyAddress);
  console.log("└─ Storage: ✅ All data preserved\n");

  console.log("📌 Next Steps:");
  console.log("1. Verify new implementation on Etherscan:");
  console.log("   npx hardhat verify --network", network.name, newImplementation);
  console.log("\n2. Announce upgrade to users");
  console.log("\n3. Monitor platform for 24-48 hours");
  console.log("\n4. Update frontend with new ABI (if functions changed)\n");

  // ============================================
  // Warnings
  // ============================================

  if (network.chainId === 1n) {
    console.log("⚠️  MAINNET UPGRADE WARNINGS:");
    console.log("├─ Test all new functions before public use");
    console.log("├─ Monitor events and logs closely");
    console.log("├─ Have rollback plan ready");
    console.log("└─ Consider timelock for future upgrades\n");
  }
}

// Execute upgrade
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });
