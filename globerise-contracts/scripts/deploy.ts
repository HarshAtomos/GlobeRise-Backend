import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy GlobeRise Token and Platform Contracts
 *
 * Steps:
 * 1. Deploy GlobeRiseToken (standard ERC20)
 * 2. Deploy GlobeRisePlatform (UUPS upgradeable proxy)
 * 3. Transfer tokens to platform contract
 * 4. Grant roles
 * 5. Save deployment addresses
 *
 * Updated for Docs.pdf alignment:
 * - 10% platform fee on withdrawals (2.5% dev + 7.5% treasury)
 * - Staking system with 5 tiers
 * - Monday-only withdrawals
 * - Dormant user tracking
 * - Unlimited direct referrals
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  // Check if deployer is available
  if (!deployer) {
    console.error("❌ Error: No deployer account found!");
    console.error("   Please set DEPLOYER_PRIVATE_KEY in your .env file");
    console.error("   Example: DEPLOYER_PRIVATE_KEY=your_private_key_without_0x");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║        GLOBERISE PLATFORM DEPLOYMENT              ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("Deployment Details:");
  console.log("├─ Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("├─ Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("├─ Balance:", ethers.formatEther(balance), "ETH");
  
  // Check if balance is sufficient (need at least 0.01 ETH for deployment)
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance! You may need more ETH for gas fees.");
    console.warn("   Get Sepolia ETH from: https://sepoliafaucet.com/");
  }
  console.log("");

  // Dev wallet for gas/dev fee portion (2.5% of withdrawals)
  // In production, use a dedicated dev wallet address
  const devWallet = process.env.DEV_WALLET || deployer.address;
  console.log("├─ Dev Wallet:", devWallet, "\n");

  // ============================================
  // Step 1: Deploy GlobeRiseToken
  // ============================================

  console.log("📝 Step 1: Deploying GlobeRiseToken...");

  const GlobeRiseToken = await ethers.getContractFactory("GlobeRiseToken");
  const token = await GlobeRiseToken.deploy(deployer.address);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("✅ GlobeRiseToken deployed to:", tokenAddress);

  const totalSupply = await token.totalSupply();
  console.log("   ├─ Total Supply:", ethers.formatEther(totalSupply), "GRT");
  console.log("   └─ Owner:", await token.owner(), "\n");

  // ============================================
  // Step 2: Deploy Mock USDT (for testnets)
  // ============================================

  let usdtAddress: string;

  if (network.chainId === 1n) {
    // Mainnet - use real USDT
    usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    console.log("📝 Step 2: Using mainnet USDT:", usdtAddress, "\n");
  } else {
    // Testnet - deploy mock USDT
    console.log("📝 Step 2: Deploying Mock USDT for testnet...");

    const MockUSDT = await ethers.getContractFactory("GlobeRiseToken"); // Reuse token contract as mock
    const mockUsdt = await MockUSDT.deploy(deployer.address);
    await mockUsdt.waitForDeployment();

    usdtAddress = await mockUsdt.getAddress();
    console.log("✅ Mock USDT deployed to:", usdtAddress, "\n");
  }

  // ============================================
  // Step 3: Deploy GlobeRisePlatform (Upgradeable)
  // ============================================

  console.log("📝 Step 3: Deploying GlobeRisePlatform (UUPS Proxy)...");

  const GlobeRisePlatform = await ethers.getContractFactory("GlobeRisePlatform");

  // Use OpenZeppelin Hardhat Upgrades plugin for UUPS deployment
  // initialize(grtToken, usdtToken, treasury, devWallet)
  const platform = await upgrades.deployProxy(
    GlobeRisePlatform,
    [tokenAddress, usdtAddress, deployer.address, devWallet], // initializer arguments
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await platform.waitForDeployment();

  const platformAddress = await platform.getAddress();
  console.log("✅ GlobeRisePlatform deployed to:", platformAddress);

  const proxyAdmin = await upgrades.erc1967.getAdminAddress(platformAddress);
  const implementation = await upgrades.erc1967.getImplementationAddress(platformAddress);

  console.log("   ├─ Proxy Address:", platformAddress);
  console.log("   ├─ Implementation:", implementation);
  console.log("   ├─ Treasury:", deployer.address);
  console.log("   └─ Dev Wallet:", devWallet, "\n");

  // ============================================
  // Step 4: Transfer Tokens to Platform
  // ============================================

  console.log("📝 Step 4: Transferring 50% of GRT tokens to platform...");

  const transferAmount = totalSupply / 2n; // Transfer 50% (500M GRT)
  const transferTx = await token.transfer(platformAddress, transferAmount);
  await transferTx.wait();

  console.log("✅ Transferred:", ethers.formatEther(transferAmount), "GRT");
  console.log("   ├─ Platform Balance:", ethers.formatEther(await token.balanceOf(platformAddress)), "GRT");
  console.log("   └─ Deployer Balance:", ethers.formatEther(await token.balanceOf(deployer.address)), "GRT\n");

  // ============================================
  // Step 5: Grant Roles
  // ============================================

  console.log("📝 Step 5: Configuring roles...");

  const ADMIN_ROLE = await platform.ADMIN_ROLE();
  const OPERATOR_ROLE = await platform.OPERATOR_ROLE();
  const UPGRADER_ROLE = await platform.UPGRADER_ROLE();

  // Grant OPERATOR role to deployer (for testing)
  const grantOperatorTx = await platform.grantRole(OPERATOR_ROLE, deployer.address);
  await grantOperatorTx.wait();

  console.log("✅ Roles configured:");
  console.log("   ├─ ADMIN:", deployer.address);
  console.log("   ├─ OPERATOR:", deployer.address);
  console.log("   └─ UPGRADER:", deployer.address, "\n");

  // ============================================
  // Step 6: Verify Configuration
  // ============================================

  console.log("📝 Step 6: Verifying configuration...");

  const minInvestment = await platform.minInvestment();
  const directReferralRate = await platform.directReferralRate();
  const platformFeeRate = await platform.platformFeeRate();
  const minWithdrawal = await platform.minWithdrawal();

  console.log("✅ Platform Configuration:");
  console.log("   ├─ Min Investment:", ethers.formatEther(minInvestment), "GRT");
  console.log("   ├─ Min Withdrawal:", ethers.formatEther(minWithdrawal), "GRT");
  console.log("   ├─ Direct Referral Rate:", Number(directReferralRate) / 100, "%");
  console.log("   ├─ Platform Fee Rate:", Number(platformFeeRate) / 100, "% (on withdrawals)");
  console.log("   ├─ Withdrawal Window: Monday only");
  console.log("   ├─ Treasury:", await platform.treasury());
  console.log("   └─ Dev Wallet:", await platform.devWallet(), "\n");

  // ============================================
  // Step 7: Save Deployment Addresses
  // ============================================

  console.log("📝 Step 7: Saving deployment addresses...");

  const deployment = {
    network: network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    contracts: {
      GlobeRiseToken: tokenAddress,
      USDT: usdtAddress,
      GlobeRisePlatform: {
        proxy: platformAddress,
        implementation: implementation,
        proxyAdmin: proxyAdmin,
      },
    },
    deployer: deployer.address,
    devWallet: devWallet,
    config: {
      minInvestment: ethers.formatEther(minInvestment),
      minWithdrawal: ethers.formatEther(minWithdrawal),
      directReferralRate: Number(directReferralRate) / 100,
      platformFeeRate: Number(platformFeeRate) / 100,
      withdrawalWindow: "Monday only",
      stakingTiers: [
        { duration: "3 months", rate: "1.25%" },
        { duration: "6 months", rate: "1.75%" },
        { duration: "12 months", rate: "2.25%" },
        { duration: "18 months", rate: "4%" },
        { duration: "24 months", rate: "4.75%" },
      ],
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));

  console.log("✅ Deployment saved to:", filepath, "\n");

  // ============================================
  // Summary
  // ============================================

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║           DEPLOYMENT SUCCESSFUL ✅                 ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  console.log("📋 Contract Addresses:");
  console.log("├─ GlobeRiseToken:", tokenAddress);
  console.log("├─ USDT Token:", usdtAddress);
  console.log("└─ GlobeRisePlatform:", platformAddress, "\n");

  console.log("📌 Next Steps:");
  console.log("1. Verify contracts on Etherscan:");
  console.log("   npx hardhat verify --network", network.name, tokenAddress, deployer.address);
  console.log("   npx hardhat verify --network", network.name, implementation);
  console.log("\n2. Register first admin user in frontend");
  console.log("\n3. Update frontend .env with contract addresses");
  console.log("\n4. Test investment flow on testnet\n");

  // ============================================
  // Warnings for Mainnet
  // ============================================

  if (network.chainId === 1n) {
    console.log("⚠️  MAINNET DEPLOYMENT WARNINGS:");
    console.log("├─ Transfer ownership to multi-sig wallet");
    console.log("├─ Complete security audit before accepting real funds");
    console.log("├─ Test all functions on testnet first");
    console.log("└─ Monitor contract for suspicious activity\n");
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
