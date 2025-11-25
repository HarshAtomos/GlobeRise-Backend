import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Test Script 1: Deploy and Setup
 *
 * This script:
 * 1. Deploys GlobeRiseToken and GlobeRisePlatform to Sepolia
 * 2. Distributes GRT to test wallets
 * 3. Registers test users in MLM chain
 * 4. Verifies deployment and initial setup
 *
 * Run: npx ts-node test-scripts/1-deploy-and-setup.ts
 */

async function main() {
  console.log("\n🚀 TEST SCRIPT 1: Deploy and Setup\n");
  console.log("=" + "=".repeat(60) + "\n");

  // Connect to network
  const network = await ethers.provider.getNetwork();
  console.log("📡 Network:", network.name);
  console.log("   Chain ID:", network.chainId.toString());

  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  // Step 1: Load deployed contracts (or deploy if needed)
  console.log("Step 1: Loading contract addresses...");

  // TODO: Replace with your deployed addresses
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
  const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS || "";

  if (!TOKEN_ADDRESS || !PLATFORM_ADDRESS) {
    console.log("⚠️  Contract addresses not found in .env");
    console.log("   Please deploy first using:");
    console.log("   npx hardhat run scripts/deploy.ts --network sepolia\n");
    console.log("   Then add to .env:");
    console.log("   TOKEN_ADDRESS=0x...");
    console.log("   PLATFORM_ADDRESS=0x...\n");
    return;
  }

  const token = await ethers.getContractAt("GlobeRiseToken", TOKEN_ADDRESS);
  const platform = await ethers.getContractAt("GlobeRisePlatform", PLATFORM_ADDRESS);

  console.log("✅ Token:", TOKEN_ADDRESS);
  console.log("✅ Platform:", PLATFORM_ADDRESS, "\n");

  // Step 2: Verify deployment
  console.log("Step 2: Verifying deployment...");

  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const totalSupply = await token.totalSupply();

  console.log("✅ Token Name:", tokenName);
  console.log("✅ Token Symbol:", tokenSymbol);
  console.log("✅ Total Supply:", ethers.formatEther(totalSupply), "GRT");

  const platformPaused = await platform.paused();
  const minInvestment = await platform.minInvestment();

  console.log("✅ Platform Paused:", platformPaused);
  console.log("✅ Min Investment:", ethers.formatEther(minInvestment), "GRT\n");

  // Step 3: Create test wallets
  console.log("Step 3: Setting up test wallets...");

  const testWallets = [];
  for (let i = 1; i <= 5; i++) {
    const privateKey = process.env[`TEST_WALLET_${i}`];
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, ethers.provider);
      testWallets.push(wallet);
      console.log(`   Wallet ${i}:`, wallet.address);
    }
  }

  console.log(`\n✅ ${testWallets.length} test wallets loaded\n`);

  // Step 4: Distribute GRT tokens
  console.log("Step 4: Distributing GRT to test wallets...");

  for (let i = 0; i < testWallets.length; i++) {
    const amount = ethers.parseEther("10000"); // 10k GRT each
    const currentBalance = await token.balanceOf(testWallets[i].address);

    if (currentBalance < amount) {
      console.log(`   Sending ${ethers.formatEther(amount)} GRT to Wallet ${i + 1}...`);
      const tx = await token.transfer(testWallets[i].address, amount);
      await tx.wait();
      console.log("   ✅ TX:", tx.hash);
    } else {
      console.log(`   ✅ Wallet ${i + 1} already has GRT`);
    }
  }

  console.log();

  // Step 5: Register users in MLM chain
  console.log("Step 5: Registering users in MLM chain...");

  // User 1 (deployer) - no sponsor
  const user1Registered = (await platform.getUser(deployer.address)).registered;
  if (!user1Registered) {
    console.log("   Registering User 1 (no sponsor)...");
    const tx1 = await platform.registerUser(ethers.ZeroAddress);
    await tx1.wait();
    console.log("   ✅ User 1 registered, TX:", tx1.hash);
  } else {
    console.log("   ✅ User 1 already registered");
  }

  // User 2 - sponsor: User 1
  const user2Registered = (await platform.getUser(testWallets[0].address)).registered;
  if (!user2Registered) {
    console.log("   Registering User 2 (sponsor: User 1)...");
    const tx2 = await platform.connect(testWallets[0]).registerUser(deployer.address);
    await tx2.wait();
    console.log("   ✅ User 2 registered, TX:", tx2.hash);
  } else {
    console.log("   ✅ User 2 already registered");
  }

  // User 3 - sponsor: User 1
  if (testWallets.length > 1) {
    const user3Registered = (await platform.getUser(testWallets[1].address)).registered;
    if (!user3Registered) {
      console.log("   Registering User 3 (sponsor: User 1)...");
      const tx3 = await platform.connect(testWallets[1]).registerUser(deployer.address);
      await tx3.wait();
      console.log("   ✅ User 3 registered, TX:", tx3.hash);
    } else {
      console.log("   ✅ User 3 already registered");
    }
  }

  console.log();

  // Step 6: Verify MLM structure
  console.log("Step 6: Verifying MLM structure...");

  const user1 = await platform.getUser(deployer.address);
  console.log("   User 1 Referrals:", user1.directReferrals.length);
  console.log("   Left Leg:", user1.leftLeg);
  console.log("   Right Leg:", user1.rightLeg);

  const totalUsers = await platform.totalUsers();
  console.log("   Total Users:", totalUsers.toString());

  console.log("\n✅ Setup Complete!\n");

  // Summary
  console.log("=" + "=".repeat(60));
  console.log("📊 SETUP SUMMARY");
  console.log("=" + "=".repeat(60));
  console.log("Token Address:", TOKEN_ADDRESS);
  console.log("Platform Address:", PLATFORM_ADDRESS);
  console.log("Total Users Registered:", totalUsers.toString());
  console.log("Test Wallets Funded:", testWallets.length);
  console.log("\n✅ Ready for manual testing!");
  console.log("\nNext: Run test-scripts/2-test-investments.ts");
  console.log("=" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
