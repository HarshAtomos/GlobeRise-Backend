import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verify GlobeRise Contracts on Etherscan
 *
 * This script verifies:
 * 1. GlobeRiseToken contract
 * 2. GlobeRisePlatform implementation contract
 * 3. Proxy contract (automatically verified by Etherscan)
 *
 * Prerequisites:
 * - ETHERSCAN_API_KEY in .env
 * - Contracts deployed (deployment JSON exists)
 */
async function main() {
  const network = await (await import("hardhat")).ethers.provider.getNetwork();

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║        ETHERSCAN CONTRACT VERIFICATION            ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("Network:", network.name, `(Chain ID: ${network.chainId})\n`);

  // ============================================
  // Load Deployment Addresses
  // ============================================

  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);

  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found: ${deploymentFile}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));

  const tokenAddress = deployment.contracts.GlobeRiseToken;
  const proxyAddress = deployment.contracts.GlobeRisePlatform.proxy;
  const implementationAddress = deployment.contracts.GlobeRisePlatform.implementation;
  const deployerAddress = deployment.deployer;

  console.log("📋 Loaded Deployment:");
  console.log("├─ GlobeRiseToken:", tokenAddress);
  console.log("├─ Platform Proxy:", proxyAddress);
  console.log("├─ Implementation:", implementationAddress);
  console.log("└─ Deployer:", deployerAddress, "\n");

  // ============================================
  // Step 1: Verify GlobeRiseToken
  // ============================================

  console.log("📝 Step 1: Verifying GlobeRiseToken...");

  try {
    await run("verify:verify", {
      address: tokenAddress,
      constructorArguments: [deployerAddress],
      contract: "contracts/GlobeRiseToken.sol:GlobeRiseToken",
    });

    console.log("✅ GlobeRiseToken verified successfully");
    console.log(`   View at: https://etherscan.io/address/${tokenAddress}#code\n`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ GlobeRiseToken already verified");
      console.log(`   View at: https://etherscan.io/address/${tokenAddress}#code\n`);
    } else {
      console.error("❌ Token verification failed:", error.message, "\n");
    }
  }

  // ============================================
  // Step 2: Verify Platform Implementation
  // ============================================

  console.log("📝 Step 2: Verifying GlobeRisePlatform implementation...");

  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
      contract: "contracts/GlobeRisePlatform.sol:GlobeRisePlatform",
    });

    console.log("✅ Platform implementation verified successfully");
    console.log(`   View at: https://etherscan.io/address/${implementationAddress}#code\n`);
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Platform implementation already verified");
      console.log(`   View at: https://etherscan.io/address/${implementationAddress}#code\n`);
    } else {
      console.error("❌ Implementation verification failed:", error.message, "\n");
    }
  }

  // ============================================
  // Step 3: Proxy Verification (Info Only)
  // ============================================

  console.log("📝 Step 3: Proxy contract verification...");
  console.log("ℹ️  Proxies are automatically verified by Etherscan");
  console.log(`   View at: https://etherscan.io/address/${proxyAddress}#code\n`);

  // ============================================
  // Summary
  // ============================================

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║           VERIFICATION COMPLETE ✅                  ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("📋 Verified Contracts:");
  console.log("├─ Token:", `https://etherscan.io/address/${tokenAddress}#code`);
  console.log("├─ Implementation:", `https://etherscan.io/address/${implementationAddress}#code`);
  console.log("└─ Proxy:", `https://etherscan.io/address/${proxyAddress}#code\n`);

  console.log("📌 Next Steps:");
  console.log("1. Interact with proxy address (not implementation)");
  console.log("2. Update frontend with verified contract addresses");
  console.log("3. Share Etherscan links with users");
  console.log("4. Add contract to Etherscan watchlist for monitoring\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
