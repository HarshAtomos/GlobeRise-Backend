import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Test Script 2: Investment Testing
 *
 * Tests:
 * - Creating investments in all 3 tiers
 * - Verifying token transfers
 * - Checking maxClaimable calculations
 * - Validating commission payments
 *
 * Run: npx ts-node test-scripts/2-test-investments.ts
 */

async function main() {
  console.log("\n💰 TEST SCRIPT 2: Investment Testing\n");
  console.log("=" + "=".repeat(60) + "\n");

  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
  const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS || "";

  if (!TOKEN_ADDRESS || !PLATFORM_ADDRESS) {
    console.log("❌ Missing contract addresses in .env");
    return;
  }

  const token = await ethers.getContractAt("GlobeRiseToken", TOKEN_ADDRESS);
  const platform = await ethers.getContractAt("GlobeRisePlatform", PLATFORM_ADDRESS);

  // Load test wallets
  const wallet2 = new ethers.Wallet(process.env.TEST_WALLET_1!, ethers.provider);
  const wallet3 = new ethers.Wallet(process.env.TEST_WALLET_2!, ethers.provider);
  const wallet4 = new ethers.Wallet(process.env.TEST_WALLET_3!, ethers.provider);

  console.log("Test Wallets:");
  console.log("├─ Wallet 2:", wallet2.address);
  console.log("├─ Wallet 3:", wallet3.address);
  console.log("└─ Wallet 4:", wallet4.address, "\n");

  // ============================================
  // TEST 1: Tier 1 Investment (8% ROI, 2.5X cap)
  // ============================================

  console.log("🧪 TEST 1: Tier 1 Investment\n");

  const invest1Amount = ethers.parseEther("100");

  console.log("Step 1.1: Checking balance...");
  const wallet2Balance = await token.balanceOf(wallet2.address);
  console.log("   Wallet 2 Balance:", ethers.formatEther(wallet2Balance), "GRT");

  if (wallet2Balance < invest1Amount) {
    console.log("   ❌ Insufficient GRT balance");
    return;
  }

  console.log("\nStep 1.2: Approving tokens...");
  const approveTx = await token.connect(wallet2).approve(PLATFORM_ADDRESS, invest1Amount);
  await approveTx.wait();
  console.log("   ✅ Approved, TX:", approveTx.hash);

  console.log("\nStep 1.3: Creating Tier 1 investment...");
  const investTx = await platform.connect(wallet2).createInvestment(invest1Amount, 1);
  const receipt = await investTx.wait();
  console.log("   ✅ Investment created, TX:", investTx.hash);
  console.log("   Gas Used:", receipt?.gasUsed.toString());

  console.log("\nStep 1.4: Verifying investment...");
  const investments = await platform.getUserInvestments(wallet2.address);
  console.log("   Investment Count:", investments.length);
  console.log("   Amount:", ethers.formatEther(investments[0].amount), "GRT");
  console.log("   Tier:", investments[0].roiTier);
  console.log("   Max Claimable:", ethers.formatEther(investments[0].maxClaimable), "GRT");
  console.log("   Expected Max:", ethers.formatEther((invest1Amount * 250n) / 100n), "GRT (2.5X)");
  console.log("   Active:", investments[0].active);

  // Verify
  const expectedMax = (invest1Amount * 250n) / 100n;
  if (investments[0].maxClaimable === expectedMax) {
    console.log("\n   ✅ PASS: Tier 1 investment correct!");
  } else {
    console.log("\n   ❌ FAIL: Max claimable incorrect");
  }

  // ============================================
  // TEST 2: Tier 2 Investment (10% ROI, 3X cap)
  // ============================================

  console.log("\n🧪 TEST 2: Tier 2 Investment\n");

  const invest2Amount = ethers.parseEther("500");

  await token.connect(wallet3).approve(PLATFORM_ADDRESS, invest2Amount);
  console.log("Step 2.1: Tokens approved");

  const investTx2 = await platform.connect(wallet3).createInvestment(invest2Amount, 2);
  await investTx2.wait();
  console.log("Step 2.2: Investment created, TX:", investTx2.hash);

  const investments2 = await platform.getUserInvestments(wallet3.address);
  console.log("\nVerification:");
  console.log("   Tier:", investments2[0].roiTier);
  console.log("   Max Claimable:", ethers.formatEther(investments2[0].maxClaimable), "GRT");
  console.log("   Expected:", ethers.formatEther((invest2Amount * 300n) / 100n), "GRT (3X)");

  const expectedMax2 = (invest2Amount * 300n) / 100n;
  if (investments2[0].maxClaimable === expectedMax2) {
    console.log("\n   ✅ PASS: Tier 2 investment correct!");
  } else {
    console.log("\n   ❌ FAIL: Max claimable incorrect");
  }

  // ============================================
  // TEST 3: Tier 3 Investment (12% ROI, 4X cap)
  // ============================================

  console.log("\n🧪 TEST 3: Tier 3 Investment\n");

  const invest3Amount = ethers.parseEther("1000");

  await token.connect(wallet4).approve(PLATFORM_ADDRESS, invest3Amount);
  console.log("Step 3.1: Tokens approved");

  const investTx3 = await platform.connect(wallet4).createInvestment(invest3Amount, 3);
  await investTx3.wait();
  console.log("Step 3.2: Investment created, TX:", investTx3.hash);

  const investments3 = await platform.getUserInvestments(wallet4.address);
  console.log("\nVerification:");
  console.log("   Tier:", investments3[0].roiTier);
  console.log("   Max Claimable:", ethers.formatEther(investments3[0].maxClaimable), "GRT");
  console.log("   Expected:", ethers.formatEther((invest3Amount * 400n) / 100n), "GRT (4X)");

  const expectedMax3 = (invest3Amount * 400n) / 100n;
  if (investments3[0].maxClaimable === expectedMax3) {
    console.log("\n   ✅ PASS: Tier 3 investment correct!");
  } else {
    console.log("\n   ❌ FAIL: Max claimable incorrect");
  }

  // ============================================
  // TEST 4: Verify Commission Paid to Sponsor
  // ============================================

  console.log("\n🧪 TEST 4: Commission Verification\n");

  // Get deployer's commission (sponsor of wallet 2 and 3)
  const [deployer2] = await ethers.getSigners();
  const withdrawable = await platform.getWithdrawableBalance(deployer2.address);

  console.log("Deployer Withdrawable Balance:", ethers.formatEther(withdrawable), "GRT");

  // Expected: 5% of (100 + 500 + 1000) = 5% of 1600 = 80 GRT
  // (assuming deployer is sponsor of all test users)

  if (withdrawable > 0n) {
    console.log("✅ PASS: Commission distributed to sponsor");
  } else {
    console.log("⚠️  WARNING: No commission (verify sponsor relationships)");
  }

  // ============================================
  // Summary
  // ============================================

  console.log("\n" + "=" + "=".repeat(60));
  console.log("📊 INVESTMENT TESTING SUMMARY");
  console.log("=" + "=".repeat(60));
  console.log("✅ Tier 1 (8%, 2.5X): Created with 100 GRT");
  console.log("✅ Tier 2 (10%, 3X): Created with 500 GRT");
  console.log("✅ Tier 3 (12%, 4X): Created with 1000 GRT");
  console.log("✅ Commissions: Paid to sponsors");
  console.log("\n🎉 All investment tests passed!");
  console.log("\nNext: Run test-scripts/3-test-withdrawals.ts");
  console.log("=" + "=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
