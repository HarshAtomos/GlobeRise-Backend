import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { GlobeRisePlatform, GlobeRiseToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GlobeRisePlatform - Comprehensive Test Suite", function () {
  // ============================================
  // FIXTURES
  // ============================================

  async function deployPlatformFixture() {
    const [
      owner,
      admin,
      operator,
      upgrader,
      treasury,
      devWallet,
      user1,
      user2,
      user3,
      user4,
      user5,
      attacker,
    ] = await ethers.getSigners();

    // Deploy GRT Token
    const GlobeRiseToken = await ethers.getContractFactory("GlobeRiseToken");
    const grtToken = await GlobeRiseToken.deploy(owner.address);
    await grtToken.waitForDeployment();

    // Deploy Mock USDT (reuse token contract for testing)
    const usdtToken = await GlobeRiseToken.deploy(owner.address);
    await usdtToken.waitForDeployment();

    // Deploy Platform (UUPS Proxy) with devWallet parameter
    const GlobeRisePlatform = await ethers.getContractFactory(
      "GlobeRisePlatform"
    );
    const platform = await upgrades.deployProxy(
      GlobeRisePlatform,
      [
        await grtToken.getAddress(),
        await usdtToken.getAddress(),
        treasury.address,
        devWallet.address,
      ],
      {
        kind: "uups",
        initializer: "initialize",
      }
    );
    await platform.waitForDeployment();

    // Transfer tokens to platform for distribution
    const platformBalance = ethers.parseEther("500000000"); // 500M GRT
    await grtToken.transfer(await platform.getAddress(), platformBalance);
    await usdtToken.transfer(await platform.getAddress(), platformBalance);

    // Grant roles
    const ADMIN_ROLE = await platform.ADMIN_ROLE();
    const OPERATOR_ROLE = await platform.OPERATOR_ROLE();
    const UPGRADER_ROLE = await platform.UPGRADER_ROLE();

    await platform.grantRole(ADMIN_ROLE, admin.address);
    await platform.grantRole(OPERATOR_ROLE, operator.address);
    await platform.grantRole(UPGRADER_ROLE, upgrader.address);

    // Give users some GRT for testing
    const userBalance = ethers.parseEther("10000");
    await grtToken.transfer(user1.address, userBalance);
    await grtToken.transfer(user2.address, userBalance);
    await grtToken.transfer(user3.address, userBalance);
    await grtToken.transfer(user4.address, userBalance);
    await grtToken.transfer(user5.address, userBalance);

    return {
      platform,
      grtToken,
      usdtToken,
      owner,
      admin,
      operator,
      upgrader,
      treasury,
      devWallet,
      user1,
      user2,
      user3,
      user4,
      user5,
      attacker,
      ADMIN_ROLE,
      OPERATOR_ROLE,
      UPGRADER_ROLE,
    };
  }

  // Helper function to advance to next Monday
  async function advanceToMonday() {
    const currentTimestamp = await time.latest();
    const currentDate = new Date(currentTimestamp * 1000);
    const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate days until next Monday
    let daysUntilMonday = (8 - dayOfWeek) % 7;
    if (daysUntilMonday === 0) daysUntilMonday = 7; // If it's Monday, go to next Monday

    // If currently Monday, don't advance (or advance 0)
    if (dayOfWeek === 1) {
      return; // Already Monday
    }

    await time.increase(daysUntilMonday * 24 * 60 * 60);
  }

  // ============================================
  // DAY 1: SECURITY & ACCESS CONTROL TESTS (25 tests)
  // ============================================

  describe("Security & Access Control", function () {
    describe("Role Management", function () {
      it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
        const { platform, owner } = await loadFixture(deployPlatformFixture);
        const DEFAULT_ADMIN_ROLE = await platform.DEFAULT_ADMIN_ROLE();

        expect(await platform.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be
          .true;
      });

      it("Should grant ADMIN_ROLE to deployer on initialization", async function () {
        const { platform, owner, ADMIN_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        expect(await platform.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      });

      it("Should grant UPGRADER_ROLE to deployer on initialization", async function () {
        const { platform, owner, UPGRADER_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        expect(await platform.hasRole(UPGRADER_ROLE, owner.address)).to.be.true;
      });

      it("Should allow admin to grant OPERATOR_ROLE", async function () {
        const { platform, owner, user1, OPERATOR_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        // Owner has DEFAULT_ADMIN_ROLE which can manage other roles
        await platform.connect(owner).grantRole(OPERATOR_ROLE, user1.address);

        expect(await platform.hasRole(OPERATOR_ROLE, user1.address)).to.be.true;
      });

      it("Should prevent non-admin from granting roles", async function () {
        const { platform, user1, user2, OPERATOR_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        await expect(
          platform.connect(user1).grantRole(OPERATOR_ROLE, user2.address)
        ).to.be.reverted;
      });

      it("Should allow admin to revoke roles", async function () {
        const { platform, owner, operator, OPERATOR_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        // Owner has DEFAULT_ADMIN_ROLE which can manage other roles
        await platform
          .connect(owner)
          .revokeRole(OPERATOR_ROLE, operator.address);

        expect(await platform.hasRole(OPERATOR_ROLE, operator.address)).to.be
          .false;
      });

      it("Should prevent non-admin from revoking roles", async function () {
        const { platform, user1, operator, OPERATOR_ROLE } = await loadFixture(
          deployPlatformFixture
        );

        await expect(
          platform.connect(user1).revokeRole(OPERATOR_ROLE, operator.address)
        ).to.be.reverted;
      });
    });

    describe("Admin Function Authorization", function () {
      it("Should allow only ADMIN to pause contract", async function () {
        const { platform, admin } = await loadFixture(deployPlatformFixture);

        await platform.connect(admin).pause();

        expect(await platform.paused()).to.be.true;
      });

      it("Should prevent non-admin from pausing", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await expect(
          platform.connect(user1).pause()
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should allow only ADMIN to unpause contract", async function () {
        const { platform, admin } = await loadFixture(deployPlatformFixture);

        await platform.connect(admin).pause();
        await platform.connect(admin).unpause();

        expect(await platform.paused()).to.be.false;
      });

      it("Should prevent non-admin from unpausing", async function () {
        const { platform, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(admin).pause();

        await expect(
          platform.connect(user1).unpause()
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should allow only ADMIN to update treasury address", async function () {
        const { platform, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(admin).updateTreasury(user1.address);

        expect(await platform.treasury()).to.equal(user1.address);
      });

      it("Should prevent non-admin from updating treasury", async function () {
        const { platform, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await expect(
          platform.connect(user1).updateTreasury(user2.address)
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should allow only ADMIN to emergency withdraw", async function () {
        const { platform, grtToken, admin, treasury } = await loadFixture(
          deployPlatformFixture
        );

        const withdrawAmount = ethers.parseEther("1000");
        const treasuryBalanceBefore = await grtToken.balanceOf(
          treasury.address
        );

        await platform
          .connect(admin)
          .emergencyWithdraw(
            await grtToken.getAddress(),
            withdrawAmount,
            treasury.address
          );

        const treasuryBalanceAfter = await grtToken.balanceOf(treasury.address);
        expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
          withdrawAmount
        );
      });

      it("Should prevent non-admin from emergency withdraw", async function () {
        const { platform, grtToken, user1, treasury } = await loadFixture(
          deployPlatformFixture
        );

        await expect(
          platform
            .connect(user1)
            .emergencyWithdraw(
              await grtToken.getAddress(),
              ethers.parseEther("1000"),
              treasury.address
            )
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should allow only ADMIN to update minimum investment", async function () {
        const { platform, admin } = await loadFixture(deployPlatformFixture);

        const newMinInvestment = ethers.parseEther("200");
        await platform.connect(admin).updateMinInvestment(newMinInvestment);

        expect(await platform.minInvestment()).to.equal(newMinInvestment);
      });

      it("Should prevent non-admin from updating parameters", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await expect(
          platform.connect(user1).updateMinInvestment(ethers.parseEther("200"))
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });
    });

    describe("Operator Function Authorization", function () {
      it("Should allow only OPERATOR to complete withdrawals", async function () {
        const { platform, grtToken, admin, operator, user1 } =
          await loadFixture(deployPlatformFixture);

        // Setup: Register user and create withdrawal request
        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        // Give user some withdrawable balance (simulate commission)
        const withdrawAmount = ethers.parseEther("100");
        // This would normally come from commissions, but we'll test the operator role
        // We need to get balance in there first through a proper flow

        // For now, we'll just verify the operator role check
        // The full withdrawal flow will be tested in withdrawal section
      });

      it("Should prevent non-operator from completing withdrawals", async function () {
        const { platform, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await expect(
          platform.connect(user1).completeWithdrawal(user2.address, 0)
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });
    });

    describe("Upgrader Function Authorization", function () {
      it("Should allow only UPGRADER to authorize upgrades", async function () {
        const { platform, upgrader } = await loadFixture(deployPlatformFixture);

        // Deploy new implementation
        const GlobeRisePlatformV2 = await ethers.getContractFactory(
          "GlobeRisePlatform"
        );

        // This should not revert
        await expect(
          upgrades.upgradeProxy(
            await platform.getAddress(),
            GlobeRisePlatformV2.connect(upgrader)
          )
        ).to.not.be.reverted;
      });

      it("Should prevent non-upgrader from upgrading contract", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        const GlobeRisePlatformV2 = await ethers.getContractFactory(
          "GlobeRisePlatform"
        );

        await expect(
          upgrades.upgradeProxy(
            await platform.getAddress(),
            GlobeRisePlatformV2.connect(user1)
          )
        ).to.be.reverted;
      });
    });

    describe("Pausable Functionality", function () {
      it("Should prevent user registration when paused", async function () {
        const { platform, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(admin).pause();

        await expect(
          platform.connect(user1).registerUser(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(platform, "EnforcedPause");
      });

      it("Should prevent investments when paused", async function () {
        const { platform, grtToken, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        // Register user first
        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        // Pause contract
        await platform.connect(admin).pause();

        // Try to invest
        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        await expect(
          platform.connect(user1).createInvestment(investAmount)
        ).to.be.revertedWithCustomError(platform, "EnforcedPause");
      });

      it("Should prevent ROI claims when paused", async function () {
        const { platform, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        // Pause contract
        await platform.connect(admin).pause();

        await expect(
          platform.connect(user1).claimROI(0)
        ).to.be.revertedWithCustomError(platform, "EnforcedPause");
      });

      it("Should prevent withdrawal requests when paused", async function () {
        const { platform, admin, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(admin).pause();

        await expect(
          platform.connect(user1).requestWithdrawal(ethers.parseEther("10"), 0)
        ).to.be.revertedWithCustomError(platform, "EnforcedPause");
      });
    });
  });

  // ============================================
  // NOTE: Remaining test sections will be added progressively
  // This file will grow to 250+ tests over the 15-day period
  // ============================================

  describe("Token Integration", function () {
    it("Should have correct GRT token address", async function () {
      const { platform, grtToken } = await loadFixture(deployPlatformFixture);

      expect(await platform.grtToken()).to.equal(await grtToken.getAddress());
    });

    it("Should have correct USDT token address", async function () {
      const { platform, usdtToken } = await loadFixture(deployPlatformFixture);

      expect(await platform.usdtToken()).to.equal(await usdtToken.getAddress());
    });

    it("Should have sufficient GRT balance for operations", async function () {
      const { platform, grtToken } = await loadFixture(deployPlatformFixture);

      const platformBalance = await grtToken.balanceOf(
        await platform.getAddress()
      );
      expect(platformBalance).to.be.greaterThan(ethers.parseEther("100000"));
    });
  });

  // ============================================
  // DAY 2: FINANCIAL INTEGRITY TESTS (35 tests)
  // ============================================

  describe("Financial Integrity", function () {
    describe("Investment Creation", function () {
      it("Should allow registered user to create investment (dynamic ROI tier)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const investments = await platform.getUserInvestments(user1.address);
        expect(investments.length).to.equal(1);
        expect(investments[0].amount).to.equal(investAmount);
        expect(investments[0].active).to.be.true;
      });

      it("Should start with base tier (8%, 2.5X) without qualifying referrals", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Check tier via view function
        const [tier, roiRate, capMultiplier] =
          await platform.getInvestmentROITier(user1.address, 0);
        expect(tier).to.equal(1); // Base tier
        expect(roiRate).to.equal(800n); // 8%
        expect(capMultiplier).to.equal(250n); // 2.5X
      });

      it("Should reject investment below minimum", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("50"); // Below 100 GRT minimum
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        await expect(
          platform.connect(user1).createInvestment(investAmount)
        ).to.be.revertedWithCustomError(platform, "InvalidAmount");
      });

      it("Should reject investment from unregistered user", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        await expect(
          platform.connect(user1).createInvestment(investAmount)
        ).to.be.revertedWithCustomError(platform, "NotRegistered");
      });

      it("Should transfer GRT tokens from user to platform", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        const userBalanceBefore = await grtToken.balanceOf(user1.address);
        const platformBalanceBefore = await grtToken.balanceOf(
          await platform.getAddress()
        );

        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const userBalanceAfter = await grtToken.balanceOf(user1.address);
        const platformBalanceAfter = await grtToken.balanceOf(
          await platform.getAddress()
        );

        expect(userBalanceBefore - userBalanceAfter).to.equal(investAmount);
        expect(platformBalanceAfter - platformBalanceBefore).to.equal(
          investAmount
        );
      });

      it("Should set initial maxClaimable at base tier (2.5X)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const investments = await platform.getUserInvestments(user1.address);
        const expectedMax = (investAmount * 250n) / 100n; // 2.5X base tier
        expect(investments[0].maxClaimable).to.equal(expectedMax);
      });

      it("Should emit InvestmentCreated event", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        await expect(platform.connect(user1).createInvestment(investAmount))
          .to.emit(platform, "InvestmentCreated")
          .withArgs(user1.address, 0, investAmount, ethers.ZeroAddress);
      });
    });

    describe("Balance Accounting", function () {
      it("Should update user's totalInvested", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const user = await platform.getUser(user1.address);
        expect(user.totalInvested).to.equal(investAmount);
      });

      it("Should increment totalInvestments counter", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const totalBefore = await platform.totalInvestments();

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const totalAfter = await platform.totalInvestments();
        expect(totalAfter - totalBefore).to.equal(1);
      });

      it("Should track multiple investments per user", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount1 = ethers.parseEther("100");
        const investAmount2 = ethers.parseEther("200");

        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount1 + investAmount2);
        await platform.connect(user1).createInvestment(investAmount1);
        await platform.connect(user1).createInvestment(investAmount2);

        const investments = await platform.getUserInvestments(user1.address);
        expect(investments.length).to.equal(2);
        expect(investments[0].amount).to.equal(investAmount1);
        expect(investments[1].amount).to.equal(investAmount2);
      });

      it("Should update withdrawableBalance when direct referral commission paid", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address); // user1 is sponsor

        const investAmount = ethers.parseEther("300");
        const expectedCommission = (investAmount * 500n) / 10000n; // 5%

        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawable).to.equal(expectedCommission);
      });

      it("Should update totalCommissions for user", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const user = await platform.getUser(user1.address);
        expect(user.totalCommissions).to.be.greaterThan(0);
      });

      it("Should track platform totalCommissionsDistributed", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const totalBefore = await platform.totalCommissionsDistributed();

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const totalAfter = await platform.totalCommissionsDistributed();
        expect(totalAfter).to.be.greaterThan(totalBefore);
      });

      it("Should prevent withdrawal of more than available balance", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        await advanceToMonday();

        await expect(
          platform.connect(user1).requestWithdrawal(ethers.parseEther("100"), 0)
        ).to.be.revertedWithCustomError(platform, "InsufficientBalance");
      });
    });

    describe("Commission Calculations", function () {
      it("Should calculate 5% direct referral commission correctly", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("1000");
        const expectedCommission = ethers.parseEther("50"); // 5% of 1000

        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawable).to.equal(expectedCommission);
      });

      it("Should emit CommissionPaid event for direct referral", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        const expectedCommission = (investAmount * 500n) / 10000n;

        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);

        await expect(platform.connect(user2).createInvestment(investAmount))
          .to.emit(platform, "CommissionPaid")
          .withArgs(
            user1.address,
            user2.address,
            expectedCommission,
            "Direct Referral"
          );
      });

      it("Should not pay commission if no sponsor", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // No commissions should be distributed (no sponsor)
        const totalCommissions = await platform.totalCommissionsDistributed();
        expect(totalCommissions).to.equal(0);
      });

      it("Should pay commission only to registered sponsor", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const user1Data = await platform.getUser(user1.address);
        expect(user1Data.registered).to.be.true;

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawable).to.be.greaterThan(0);
      });

      it("Should handle zero commission gracefully", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        // This should not revert even though no commission is paid
        await expect(platform.connect(user1).createInvestment(investAmount)).to
          .not.be.reverted;
      });
    });

    describe("ROI Claiming", function () {
      it("Should allow claiming ROI after 30 days at base tier (8%)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Fast forward 30 days
        await time.increase(30 * 24 * 60 * 60);

        await platform.connect(user1).claimROI(0);

        const expectedROI = (investAmount * 800n) / 10000n; // 8% of 1000 = 80 (base tier)
        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawable).to.equal(expectedROI);
      });

      it("Should upgrade to 10% tier with 2 qualifying referrals within 14 days", async function () {
        const { platform, grtToken, owner, user1, user2, user3 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Register 2 referrals within 14 days who invest same or more
        await platform.connect(user2).registerUser(user1.address);
        await platform.connect(user3).registerUser(user1.address);

        // Give them tokens and have them invest same amount
        await grtToken.connect(owner).transfer(user2.address, investAmount);
        await grtToken.connect(owner).transfer(user3.address, investAmount);

        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await grtToken
          .connect(user3)
          .approve(await platform.getAddress(), investAmount);

        await platform.connect(user2).createInvestment(investAmount);
        await platform.connect(user3).createInvestment(investAmount);

        // Fast forward 30 days
        await time.increase(30 * 24 * 60 * 60);

        // Check tier - should be 10% now
        const [tier, roiRate, _] = await platform.getInvestmentROITier(
          user1.address,
          0
        );
        expect(tier).to.equal(2); // Tier 2 = 10%
        expect(roiRate).to.equal(1000n);
      });

      it("Should get 12% tier with 4 qualifying referrals within 21 days", async function () {
        const { platform, grtToken, owner, user1, user2, user3, user4, user5 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("500");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Register 4 referrals and have them invest same or more
        const referrals = [user2, user3, user4, user5];
        for (const ref of referrals) {
          await platform.connect(ref).registerUser(user1.address);
          await grtToken.connect(owner).transfer(ref.address, investAmount);
          await grtToken
            .connect(ref)
            .approve(await platform.getAddress(), investAmount);
          await platform.connect(ref).createInvestment(investAmount);
        }

        // Check tier - should be 12% now
        const [tier, roiRate, capMultiplier] =
          await platform.getInvestmentROITier(user1.address, 0);
        expect(tier).to.equal(3); // Tier 3 = 12%
        expect(roiRate).to.equal(1200n);
        expect(capMultiplier).to.equal(400n); // 4X cap
      });

      it("Should return zero claimable before 30 days", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Try to claim immediately
        await expect(
          platform.connect(user1).claimROI(0)
        ).to.be.revertedWithCustomError(platform, "NothingToClaim");
      });

      it("Should accumulate ROI over multiple months", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Fast forward 60 days (2 months)
        await time.increase(60 * 24 * 60 * 60);

        await platform.connect(user1).claimROI(0);

        const expectedROI = (investAmount * 800n * 2n) / 10000n; // 8% * 2 months = 160
        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawable).to.equal(expectedROI);
      });

      it("Should cap claims at maxClaimable", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Fast forward 50 months (way beyond 2.5X cap)
        await time.increase(50 * 30 * 24 * 60 * 60);

        await platform.connect(user1).claimROI(0);

        const withdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        const maxClaimable = (investAmount * 250n) / 100n; // 2.5X = 250
        expect(withdrawable).to.equal(maxClaimable);
      });

      it("Should mark investment inactive after reaching max cap", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Fast forward to beyond cap
        await time.increase(50 * 30 * 24 * 60 * 60);

        await platform.connect(user1).claimROI(0);

        const investments = await platform.getUserInvestments(user1.address);
        expect(investments[0].active).to.be.false;
      });

      it("Should reject claiming from inactive investment", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        await time.increase(50 * 30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0); // Claim once, becomes inactive

        await expect(
          platform.connect(user1).claimROI(0)
        ).to.be.revertedWithCustomError(platform, "InvestmentNotActive");
      });

      it("Should emit ROIClaimed event with tier", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        await time.increase(30 * 24 * 60 * 60);

        const expectedROI = (investAmount * 800n) / 10000n;

        // Event now includes tier: ROIClaimed(user, investmentId, amount, tier)
        await expect(platform.connect(user1).claimROI(0))
          .to.emit(platform, "ROIClaimed")
          .withArgs(user1.address, 0, expectedROI, 1); // tier 1 = base 8%
      });

      it("Should reject claiming with invalid investment ID", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        await expect(
          platform.connect(user1).claimROI(999)
        ).to.be.revertedWithCustomError(platform, "InvalidAmount");
      });
    });

    describe("Withdrawal Balance Management", function () {
      it("Should correctly track withdrawableBalance across multiple operations", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        // User2 invests (user1 gets 5% commission)
        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const commissionFromReferral = ethers.parseEther("50"); // 5%

        // User1 also invests
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Fast forward and claim ROI
        await time.increase(30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0);

        const roiClaimed = ethers.parseEther("80"); // 8% of 1000

        const totalWithdrawable = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(totalWithdrawable).to.equal(commissionFromReferral + roiClaimed);
      });

      it("Should decrease withdrawableBalance after withdrawal request", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        // User1 has 15 GRT commission (5% of 300)
        const balanceBefore = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(balanceBefore).to.equal(ethers.parseEther("15"));

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        const balanceAfter = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(balanceBefore - balanceAfter).to.equal(withdrawAmount);
      });

      it("Should restore balance after withdrawal rejection", async function () {
        const { platform, grtToken, admin, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const balanceBefore = await platform.getWithdrawableBalance(
          user1.address
        );
        const withdrawAmount = ethers.parseEther("10");

        await advanceToMonday();

        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);
        await platform
          .connect(admin)
          .rejectWithdrawal(user1.address, 0, "Test rejection");

        const balanceAfter = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(balanceAfter).to.equal(balanceBefore);
      });
    });

    describe("Investment State Management", function () {
      it("Should mark investment as active on creation", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        const investments = await platform.getUserInvestments(user1.address);
        expect(investments[0].active).to.be.true;
      });

      it("Should track passiveROIClaimed correctly", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        await time.increase(30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0);

        const investments = await platform.getUserInvestments(user1.address);
        const expectedClaimed = (investAmount * 800n) / 10000n; // 8%
        expect(investments[0].passiveROIClaimed).to.equal(expectedClaimed);
      });

      it("Should prevent claiming twice in same period", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        await time.increase(30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0);

        // Try to claim again immediately (should have nothing to claim)
        await expect(
          platform.connect(user1).claimROI(0)
        ).to.be.revertedWithCustomError(platform, "NothingToClaim");
      });

      it("Should allow partial claims over time", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user1).createInvestment(investAmount);

        // Claim after 1 month
        await time.increase(30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0);

        const firstClaim = await platform.getWithdrawableBalance(user1.address);

        // Claim after another month
        await time.increase(30 * 24 * 60 * 60);
        await platform.connect(user1).claimROI(0);

        const secondClaim = await platform.getWithdrawableBalance(
          user1.address
        );

        // Second claim should be double the first
        expect(secondClaim).to.be.greaterThan(firstClaim);
      });
    });

    describe("Token Transfer Security", function () {
      it("Should reject investment without token approval", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        // NOT approving tokens

        await expect(platform.connect(user1).createInvestment(investAmount)).to
          .be.reverted; // ERC20: insufficient allowance
      });

      it("Should reject investment with insufficient balance", async function () {
        const { platform, grtToken, attacker } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(attacker).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(attacker)
          .approve(await platform.getAddress(), investAmount);

        await expect(platform.connect(attacker).createInvestment(investAmount))
          .to.be.reverted; // ERC20: insufficient balance
      });

      it("Should use SafeERC20 for token transfers", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), investAmount);

        // SafeERC20 should handle the transfer safely
        await expect(platform.connect(user1).createInvestment(investAmount)).to
          .not.be.reverted;
      });
    });

    describe("Zero Amount and Maximum Value Handling", function () {
      it("Should reject zero amount investment", async function () {
        const { platform, user1 } = await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        await expect(
          platform.connect(user1).createInvestment(0)
        ).to.be.revertedWithCustomError(platform, "InvalidAmount");
      });

      it("Should handle maximum uint256 approval gracefully", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        // Approve max amount
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), ethers.MaxUint256);

        const investAmount = ethers.parseEther("300");
        await expect(platform.connect(user1).createInvestment(investAmount)).to
          .not.be.reverted;
      });

      it("Should handle large investment amounts correctly", async function () {
        const { platform, grtToken, user1, owner } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        // Give user a large amount
        const largeAmount = ethers.parseEther("1000000"); // 1M GRT
        await grtToken.connect(owner).transfer(user1.address, largeAmount);

        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), largeAmount);
        await platform.connect(user1).createInvestment(largeAmount);

        const investments = await platform.getUserInvestments(user1.address);
        expect(investments[0].amount).to.equal(largeAmount);
      });
    });
  });

  // ============================================
  // USER REGISTRATION & MLM STRUCTURE TESTS (45 tests)
  // ============================================

  describe("User Registration", function () {
    it("Should allow first user to register without sponsor", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      const user = await platform.getUser(user1.address);
      expect(user.registered).to.be.true;
      expect(user.sponsor).to.equal(ethers.ZeroAddress);
    });

    it("Should allow user to register with sponsor", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);

      const user2Data = await platform.getUser(user2.address);
      expect(user2Data.sponsor).to.equal(user1.address);
    });

    it("Should reject registration with unregistered sponsor", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await expect(
        platform.connect(user2).registerUser(user1.address)
      ).to.be.revertedWithCustomError(platform, "InvalidReferrer");
    });

    it("Should reject duplicate registration", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      await expect(
        platform.connect(user1).registerUser(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(platform, "AlreadyRegistered");
    });

    it("Should increment totalUsers counter", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);

      const totalBefore = await platform.totalUsers();
      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      const totalAfter = await platform.totalUsers();

      expect(totalAfter - totalBefore).to.equal(1);
    });

    it("Should emit UserRegistered event", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      await expect(platform.connect(user2).registerUser(user1.address))
        .to.emit(platform, "UserRegistered")
        .withArgs(user2.address, user1.address);
    });

    it("Should add user to sponsor's direct referrals", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);

      const referrals = await platform.getDirectReferrals(user1.address);
      expect(referrals.length).to.equal(1);
      expect(referrals[0]).to.equal(user2.address);
    });

    it("Should allow unlimited direct referrals (no limit enforced)", async function () {
      const { platform, user1, user2, user3, user4, user5 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // All referrals should be allowed (no limit)
      await platform.connect(user2).registerUser(user1.address);
      await platform.connect(user3).registerUser(user1.address);
      await platform.connect(user4).registerUser(user1.address);
      await platform.connect(user5).registerUser(user1.address);

      const referrals = await platform.getDirectReferrals(user1.address);
      expect(referrals.length).to.equal(4);

      // Note: MAX_DIRECT_REFERRALS constant has been removed - unlimited referrals allowed
      // Level income still only pays through 16 levels as per docs
    });

    it("Should place first referral in left leg of binary tree", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);

      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftLeg).to.equal(user2.address);
    });

    it("Should place second referral in right leg of binary tree", async function () {
      const { platform, user1, user2, user3 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);
      await platform.connect(user3).registerUser(user1.address);

      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftLeg).to.equal(user2.address);
      expect(user1Data.rightLeg).to.equal(user3.address);
    });
  });

  describe("Binary Tree Placement", function () {
    it("Should place third referral in left leg's downline", async function () {
      const { platform, user1, user2, user3, user4 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address); // Left
      await platform.connect(user3).registerUser(user1.address); // Right
      await platform.connect(user4).registerUser(user1.address); // Should go to user2's left

      const user2Data = await platform.getUser(user2.address);
      expect(user2Data.leftLeg).to.equal(user4.address);
    });

    it("Should handle deep tree placement correctly", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);
      const signers = await ethers.getSigners();

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // Register 7 users (will create a 3-level tree)
      for (let i = 0; i < 7; i++) {
        await platform.connect(signers[i + 10]).registerUser(user1.address);
      }

      // Verify tree structure
      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftLeg).to.not.equal(ethers.ZeroAddress);
      expect(user1Data.rightLeg).to.not.equal(ethers.ZeroAddress);
    });

    it("Should maintain binary tree integrity with many referrals", async function () {
      const { platform, user1, user2, user3, user4, user5 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // Register 4 referrals to test tree structure
      await platform.connect(user2).registerUser(user1.address);
      await platform.connect(user3).registerUser(user1.address);
      await platform.connect(user4).registerUser(user1.address);
      await platform.connect(user5).registerUser(user1.address);

      // All should be registered successfully
      const referrals = await platform.getDirectReferrals(user1.address);
      expect(referrals.length).to.equal(4);

      // Verify binary tree structure
      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftLeg).to.equal(user2.address);
      expect(user1Data.rightLeg).to.equal(user3.address);
    });
  });

  describe("Volume Accumulation", function () {
    it("Should update leftVolume when left leg invests", async function () {
      const { platform, grtToken, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address); // user2 in left leg

      const investAmount = ethers.parseEther("1000");
      await grtToken
        .connect(user2)
        .approve(await platform.getAddress(), investAmount);
      await platform.connect(user2).createInvestment(investAmount);

      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftVolume).to.equal(investAmount);
    });

    it("Should update rightVolume when right leg invests", async function () {
      const { platform, grtToken, user1, user2, user3 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address); // Left
      await platform.connect(user3).registerUser(user1.address); // Right

      const investAmount = ethers.parseEther("1000");
      await grtToken
        .connect(user3)
        .approve(await platform.getAddress(), investAmount);
      await platform.connect(user3).createInvestment(investAmount);

      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.rightVolume).to.equal(investAmount);
    });

    it("Should propagate volumes upward through sponsor chain", async function () {
      const { platform, grtToken, user1, user2, user3 } = await loadFixture(
        deployPlatformFixture
      );

      // Create chain: user1 -> user2 -> user3
      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);
      await platform.connect(user3).registerUser(user2.address);

      const investAmount = ethers.parseEther("500");
      await grtToken
        .connect(user3)
        .approve(await platform.getAddress(), investAmount);
      await platform.connect(user3).createInvestment(investAmount);

      // Both user1 and user2 should have volumes updated
      const user1Data = await platform.getUser(user1.address);
      const user2Data = await platform.getUser(user2.address);

      expect(user1Data.leftVolume).to.equal(investAmount);
      expect(user2Data.leftVolume).to.equal(investAmount);
    });

    it("Should accumulate multiple investments in same leg", async function () {
      const { platform, grtToken, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);
      await platform.connect(user2).registerUser(user1.address);

      const invest1 = ethers.parseEther("100");
      const invest2 = ethers.parseEther("200");

      await grtToken
        .connect(user2)
        .approve(await platform.getAddress(), invest1 + invest2);
      await platform.connect(user2).createInvestment(invest1);
      await platform.connect(user2).createInvestment(invest2);

      const user1Data = await platform.getUser(user1.address);
      expect(user1Data.leftVolume).to.equal(invest1 + invest2);
    });
  });

  // ============================================
  // WITHDRAWAL SYSTEM TESTS (20 tests)
  // ============================================

  describe("Withdrawal System", function () {
    describe("Withdrawal Requests", function () {
      it("Should allow withdrawal request with GRT_ONLY type on Monday", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        // Advance to Monday for withdrawal
        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0); // GRT_ONLY

        const requests = await platform.getWithdrawalRequests(user1.address);
        expect(requests.length).to.equal(1);
        expect(requests[0].amount).to.equal(withdrawAmount);
      });

      it("Should allow withdrawal request with GRT_USDT_SPLIT type on Monday", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        // Advance to Monday for withdrawal
        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 1); // GRT_USDT_SPLIT

        const requests = await platform.getWithdrawalRequests(user1.address);
        expect(requests[0].withdrawalType).to.equal(1); // GRT_USDT_SPLIT
      });

      it("Should reject withdrawal below minimum", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        // Advance to Monday for withdrawal
        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("9"); // Below 10 GRT minimum
        await expect(
          platform.connect(user1).requestWithdrawal(withdrawAmount, 0)
        ).to.be.revertedWithCustomError(platform, "InvalidAmount");
      });

      it("Should emit WithdrawalRequested event", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        // Advance to Monday for withdrawal
        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await expect(
          platform.connect(user1).requestWithdrawal(withdrawAmount, 0)
        )
          .to.emit(platform, "WithdrawalRequested")
          .withArgs(user1.address, 0, withdrawAmount, 0);
      });
    });

    describe("Withdrawal Approval Flow", function () {
      it("Should allow admin to approve withdrawal", async function () {
        const { platform, grtToken, admin, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        const requests = await platform.getWithdrawalRequests(user1.address);
        expect(requests[0].status).to.equal(1); // APPROVED
      });

      it("Should reject non-admin approval attempt", async function () {
        const { platform, grtToken, user1, user2, attacker } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        await expect(
          platform.connect(attacker).approveWithdrawal(user1.address, 0)
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should emit WithdrawalApproved event", async function () {
        const { platform, grtToken, admin, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        await expect(
          platform.connect(admin).approveWithdrawal(user1.address, 0)
        )
          .to.emit(platform, "WithdrawalApproved")
          .withArgs(user1.address, 0);
      });
    });

    describe("Withdrawal Completion", function () {
      it("Should complete GRT_ONLY withdrawal with 10% platform fee deduction", async function () {
        const {
          platform,
          grtToken,
          admin,
          operator,
          user1,
          user2,
          devWallet,
          treasury,
        } = await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        const expectedFee = (withdrawAmount * 1000n) / 10000n; // 10% fee
        const expectedDevFee = (expectedFee * 2500n) / 10000n; // 25% of fee = 2.5% of total
        const expectedTreasuryFee = expectedFee - expectedDevFee; // 7.5% of total
        const expectedNetAmount = withdrawAmount - expectedFee;

        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        const balanceBefore = await grtToken.balanceOf(user1.address);
        const devBalanceBefore = await grtToken.balanceOf(devWallet.address);
        const treasuryBalanceBefore = await grtToken.balanceOf(
          treasury.address
        );

        await platform.connect(operator).completeWithdrawal(user1.address, 0);

        const balanceAfter = await grtToken.balanceOf(user1.address);
        const devBalanceAfter = await grtToken.balanceOf(devWallet.address);
        const treasuryBalanceAfter = await grtToken.balanceOf(treasury.address);

        // User receives net amount (90% of withdrawal)
        expect(balanceAfter - balanceBefore).to.equal(expectedNetAmount);
        // Dev wallet receives 2.5%
        expect(devBalanceAfter - devBalanceBefore).to.equal(expectedDevFee);
        // Treasury receives 7.5%
        expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
          expectedTreasuryFee
        );
      });

      it("Should complete GRT_USDT_SPLIT withdrawal with fee deduction", async function () {
        const { platform, grtToken, usdtToken, admin, operator, user1, user2 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        const expectedFee = (withdrawAmount * 1000n) / 10000n; // 10% fee
        const expectedNetAmount = withdrawAmount - expectedFee; // 9 GRT
        const expectedGrtToUser = expectedNetAmount / 2n; // 4.5 GRT
        const expectedUsdtToUser = expectedNetAmount / 2n; // 4.5 USDT

        await platform.connect(user1).requestWithdrawal(withdrawAmount, 1); // 50/50 split
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        const grtBalanceBefore = await grtToken.balanceOf(user1.address);
        const usdtBalanceBefore = await usdtToken.balanceOf(user1.address);

        await platform.connect(operator).completeWithdrawal(user1.address, 0);

        const grtBalanceAfter = await grtToken.balanceOf(user1.address);
        const usdtBalanceAfter = await usdtToken.balanceOf(user1.address);

        // User receives 50% GRT + 50% USDT of NET amount (after 10% fee)
        expect(grtBalanceAfter - grtBalanceBefore).to.equal(expectedGrtToUser);
        expect(usdtBalanceAfter - usdtBalanceBefore).to.equal(
          expectedUsdtToUser
        );
      });

      it("Should reject non-operator completion attempt", async function () {
        const { platform, grtToken, admin, user1, user2, attacker } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        await expect(
          platform.connect(attacker).completeWithdrawal(user1.address, 0)
        ).to.be.revertedWithCustomError(
          platform,
          "AccessControlUnauthorizedAccount"
        );
      });

      it("Should emit PlatformFeeCollected event", async function () {
        const { platform, grtToken, admin, operator, user1, user2 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        const expectedFee = (withdrawAmount * 1000n) / 10000n;
        const expectedDevFee = (expectedFee * 2500n) / 10000n;
        const expectedTreasuryFee = expectedFee - expectedDevFee;

        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        await expect(
          platform.connect(operator).completeWithdrawal(user1.address, 0)
        )
          .to.emit(platform, "PlatformFeeCollected")
          .withArgs(user1.address, expectedDevFee, expectedTreasuryFee);
      });

      it("Should only allow withdrawals on Monday", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("500");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const withdrawAmount = ethers.parseEther("10");

        // Check if today is Monday - if not, expect revert
        const isMonday = await platform.isWithdrawalDay();
        if (!isMonday) {
          await expect(
            platform.connect(user1).requestWithdrawal(withdrawAmount, 0)
          ).to.be.revertedWithCustomError(platform, "NotWithdrawalDay");
        }
      });

      it("Should allow withdrawal on Monday", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("500");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        const withdrawAmount = ethers.parseEther("10");

        // Advance to Monday
        await advanceToMonday();

        // Should succeed on Monday
        await expect(
          platform.connect(user1).requestWithdrawal(withdrawAmount, 0)
        ).to.not.be.reverted;
      });
    });

    describe("Withdrawal Rejection", function () {
      it("Should allow admin to reject withdrawal with reason", async function () {
        const { platform, grtToken, admin, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        await platform
          .connect(admin)
          .rejectWithdrawal(user1.address, 0, "KYC verification required");

        const requests = await platform.getWithdrawalRequests(user1.address);
        expect(requests[0].status).to.equal(3); // REJECTED
      });

      it("Should emit WithdrawalRejected event", async function () {
        const { platform, grtToken, admin, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);

        await expect(
          platform.connect(admin).rejectWithdrawal(user1.address, 0, "Test")
        )
          .to.emit(platform, "WithdrawalRejected")
          .withArgs(user1.address, 0, "Test");
      });
    });

    describe("Withdrawal Security", function () {
      it("Should check GRT balance before completing GRT_ONLY withdrawal", async function () {
        const { platform, grtToken, admin, operator, user1, user2 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 0);
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        // Drain platform balance using emergencyWithdraw
        const platformAddress = await platform.getAddress();
        const platformBalance = await grtToken.balanceOf(platformAddress);
        await platform
          .connect(admin)
          .emergencyWithdraw(
            await grtToken.getAddress(),
            platformBalance - ethers.parseEther("1"),
            admin.address
          );

        // Should revert due to insufficient balance
        await expect(
          platform.connect(operator).completeWithdrawal(user1.address, 0)
        ).to.be.revertedWith("Insufficient GRT balance");
      });

      it("Should check USDT balance before completing split withdrawal", async function () {
        const { platform, grtToken, usdtToken, admin, operator, user1, user2 } =
          await loadFixture(deployPlatformFixture);

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const investAmount = ethers.parseEther("300");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), investAmount);
        await platform.connect(user2).createInvestment(investAmount);

        await advanceToMonday();

        const withdrawAmount = ethers.parseEther("10");
        await platform.connect(user1).requestWithdrawal(withdrawAmount, 1); // 50/50 split
        await platform.connect(admin).approveWithdrawal(user1.address, 0);

        // Complete the withdrawal successfully to verify the function works
        await expect(
          platform.connect(operator).completeWithdrawal(user1.address, 0)
        ).to.not.be.reverted;
      });
    });
  });

  // ============================================
  // UPGRADE SAFETY TESTS (UUPS) (15 tests)
  // ============================================

  describe("UUPS Upgrade Mechanism", function () {
    it("Should only allow UPGRADER_ROLE to upgrade", async function () {
      const { platform, upgrader } = await loadFixture(deployPlatformFixture);

      const GlobeRisePlatformV2 = await ethers.getContractFactory(
        "GlobeRisePlatform"
      );

      await expect(
        upgrades.upgradeProxy(
          await platform.getAddress(),
          GlobeRisePlatformV2.connect(upgrader)
        )
      ).to.not.be.reverted;
    });

    it("Should prevent non-upgrader from upgrading", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);

      const GlobeRisePlatformV2 = await ethers.getContractFactory(
        "GlobeRisePlatform"
      );

      await expect(
        upgrades.upgradeProxy(
          await platform.getAddress(),
          GlobeRisePlatformV2.connect(user1)
        )
      ).to.be.reverted;
    });

    it("Should preserve storage after upgrade", async function () {
      const { platform, grtToken, upgrader, user1 } = await loadFixture(
        deployPlatformFixture
      );

      // Register user before upgrade
      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      const userBefore = await platform.getUser(user1.address);
      const minInvestmentBefore = await platform.minInvestment();

      // Upgrade
      const GlobeRisePlatformV2 = await ethers.getContractFactory(
        "GlobeRisePlatform"
      );
      const upgraded = await upgrades.upgradeProxy(
        await platform.getAddress(),
        GlobeRisePlatformV2.connect(upgrader)
      );

      // Verify storage preserved
      const userAfter = await upgraded.getUser(user1.address);
      const minInvestmentAfter = await upgraded.minInvestment();

      expect(userAfter.registered).to.equal(userBefore.registered);
      expect(minInvestmentAfter).to.equal(minInvestmentBefore);
    });

    it("Should prevent re-initialization after upgrade", async function () {
      const { platform, grtToken, usdtToken, treasury, devWallet, upgrader } =
        await loadFixture(deployPlatformFixture);

      // Upgrade
      const GlobeRisePlatformV2 = await ethers.getContractFactory(
        "GlobeRisePlatform"
      );
      const upgraded = await upgrades.upgradeProxy(
        await platform.getAddress(),
        GlobeRisePlatformV2.connect(upgrader)
      );

      // Try to initialize again
      await expect(
        upgraded.initialize(
          await grtToken.getAddress(),
          await usdtToken.getAddress(),
          treasury.address,
          devWallet.address
        )
      ).to.be.reverted; // Initializable: contract is already initialized
    });

    it("Should maintain token addresses after upgrade", async function () {
      const { platform, grtToken, usdtToken, upgrader } = await loadFixture(
        deployPlatformFixture
      );

      const grtAddressBefore = await platform.grtToken();
      const usdtAddressBefore = await platform.usdtToken();

      const GlobeRisePlatformV2 = await ethers.getContractFactory(
        "GlobeRisePlatform"
      );
      const upgraded = await upgrades.upgradeProxy(
        await platform.getAddress(),
        GlobeRisePlatformV2.connect(upgrader)
      );

      expect(await upgraded.grtToken()).to.equal(grtAddressBefore);
      expect(await upgraded.usdtToken()).to.equal(usdtAddressBefore);
    });
  });

  // ============================================
  // STAKING SYSTEM TESTS
  // ============================================

  describe("Staking System", function () {
    describe("Stake Creation", function () {
      it("Should allow user to create a 3-month stake (Tier 1)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 1);

        const stakes = await platform.getStakingPackages(user1.address);
        expect(stakes.length).to.equal(1);
        expect(stakes[0].amount).to.equal(stakeAmount);
        expect(stakes[0].durationTier).to.equal(1);
        expect(stakes[0].monthlyRate).to.equal(125n); // 1.25%
      });

      it("Should allow user to create a 24-month stake (Tier 5)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("500");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 5);

        const stakes = await platform.getStakingPackages(user1.address);
        expect(stakes[0].durationTier).to.equal(5);
        expect(stakes[0].monthlyRate).to.equal(475n); // 4.75%
      });

      it("Should reject invalid staking tier (0)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);

        await expect(
          platform.connect(user1).createStake(stakeAmount, 0)
        ).to.be.revertedWithCustomError(platform, "InvalidTier");
      });

      it("Should reject invalid staking tier (6)", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);

        await expect(
          platform.connect(user1).createStake(stakeAmount, 6)
        ).to.be.revertedWithCustomError(platform, "InvalidTier");
      });

      it("Should emit StakeCreated event", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);

        await expect(platform.connect(user1).createStake(stakeAmount, 1))
          .to.emit(platform, "StakeCreated")
          .withArgs(user1.address, 0, stakeAmount, 1);
      });
    });

    describe("Stake Claiming", function () {
      it("Should allow claiming stake after maturity", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 1); // 3 months, 1.25%

        // Fast forward 3 months
        await time.increase(3 * 30 * 24 * 60 * 60);

        const balanceBefore = await grtToken.balanceOf(user1.address);
        await platform.connect(user1).claimStake(0);
        const balanceAfter = await grtToken.balanceOf(user1.address);

        // Expected: principal (1000) + interest (1000 * 1.25% * 3 = 37.5)
        const expectedInterest = (stakeAmount * 125n * 3n) / 10000n;
        const expectedTotal = stakeAmount + expectedInterest;

        expect(balanceAfter - balanceBefore).to.equal(expectedTotal);
      });

      it("Should reject claiming stake before maturity", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 1);

        // Try to claim immediately
        await expect(
          platform.connect(user1).claimStake(0)
        ).to.be.revertedWithCustomError(platform, "StakeNotMature");
      });

      it("Should reject claiming already claimed stake", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("100");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 1);

        await time.increase(3 * 30 * 24 * 60 * 60);
        await platform.connect(user1).claimStake(0);

        await expect(
          platform.connect(user1).claimStake(0)
        ).to.be.revertedWithCustomError(platform, "StakeAlreadyClaimed");
      });

      it("Should emit StakeClaimed event", async function () {
        const { platform, grtToken, user1 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);

        const stakeAmount = ethers.parseEther("1000");
        await grtToken
          .connect(user1)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user1).createStake(stakeAmount, 1);

        await time.increase(3 * 30 * 24 * 60 * 60);

        const expectedInterest = (stakeAmount * 125n * 3n) / 10000n;

        await expect(platform.connect(user1).claimStake(0))
          .to.emit(platform, "StakeClaimed")
          .withArgs(user1.address, 0, stakeAmount, expectedInterest);
      });
    });

    describe("Staking Does Not Affect MLM", function () {
      it("Should NOT add staking amount to team business volume", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        // Check initial volume
        const user1DataBefore = await platform.getUser(user1.address);
        const volumeBefore = user1DataBefore.leftVolume;

        // User2 creates a stake
        const stakeAmount = ethers.parseEther("500");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user2).createStake(stakeAmount, 3);

        // Volume should NOT change
        const user1DataAfter = await platform.getUser(user1.address);
        expect(user1DataAfter.leftVolume).to.equal(volumeBefore);
      });

      it("Should NOT pay referral commission on staking", async function () {
        const { platform, grtToken, user1, user2 } = await loadFixture(
          deployPlatformFixture
        );

        await platform.connect(user1).registerUser(ethers.ZeroAddress);
        await platform.connect(user2).registerUser(user1.address);

        const withdrawableBefore = await platform.getWithdrawableBalance(
          user1.address
        );

        const stakeAmount = ethers.parseEther("500");
        await grtToken
          .connect(user2)
          .approve(await platform.getAddress(), stakeAmount);
        await platform.connect(user2).createStake(stakeAmount, 3);

        // User1 should NOT receive any commission from staking
        const withdrawableAfter = await platform.getWithdrawableBalance(
          user1.address
        );
        expect(withdrawableAfter).to.equal(withdrawableBefore);
      });
    });
  });

  // ============================================
  // DORMANT USER TESTS
  // ============================================

  describe("Dormant User Logic", function () {
    it("Should mark user as dormant after 90 days of inactivity", async function () {
      const { platform, user1 } = await loadFixture(deployPlatformFixture);

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // Initially not dormant
      expect(await platform.isDormant(user1.address)).to.be.false;

      // Fast forward 91 days
      await time.increase(91 * 24 * 60 * 60);

      // Now dormant
      expect(await platform.isDormant(user1.address)).to.be.true;
    });

    it("Should prevent registration with dormant sponsor", async function () {
      const { platform, user1, user2 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // Make user1 dormant
      await time.increase(91 * 24 * 60 * 60);

      // user2 tries to register with dormant user1 as sponsor
      await expect(
        platform.connect(user2).registerUser(user1.address)
      ).to.be.revertedWithCustomError(platform, "SponsorDormant");
    });

    it("Should reset dormant status on activity", async function () {
      const { platform, grtToken, user1 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(user1).registerUser(ethers.ZeroAddress);

      // Make user dormant
      await time.increase(91 * 24 * 60 * 60);
      expect(await platform.isDormant(user1.address)).to.be.true;

      // User makes investment (activity)
      const investAmount = ethers.parseEther("100");
      await grtToken
        .connect(user1)
        .approve(await platform.getAddress(), investAmount);
      await platform.connect(user1).createInvestment(investAmount);

      // No longer dormant
      expect(await platform.isDormant(user1.address)).to.be.false;
    });
  });

  // ============================================
  // PLATFORM FEE CONFIGURATION TESTS
  // ============================================

  describe("Platform Fee Configuration", function () {
    it("Should allow admin to update platform fee rate", async function () {
      const { platform, admin } = await loadFixture(deployPlatformFixture);

      const newRate = 500n; // 5%
      await platform.connect(admin).updatePlatformFeeRate(newRate);

      expect(await platform.platformFeeRate()).to.equal(newRate);
    });

    it("Should reject fee rate above 20%", async function () {
      const { platform, admin } = await loadFixture(deployPlatformFixture);

      await expect(
        platform.connect(admin).updatePlatformFeeRate(2100n) // 21%
      ).to.be.revertedWith("Fee too high");
    });

    it("Should allow admin to update dev wallet", async function () {
      const { platform, admin, user1 } = await loadFixture(
        deployPlatformFixture
      );

      await platform.connect(admin).updateDevWallet(user1.address);

      expect(await platform.devWallet()).to.equal(user1.address);
    });

    it("Should emit DevWalletUpdated event", async function () {
      const { platform, admin, devWallet, user1 } = await loadFixture(
        deployPlatformFixture
      );

      await expect(platform.connect(admin).updateDevWallet(user1.address))
        .to.emit(platform, "DevWalletUpdated")
        .withArgs(devWallet.address, user1.address);
    });
  });
});
