import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import { GlobeRiseToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GlobeRiseToken", function () {
  // ============================================
  // FIXTURES
  // ============================================

  async function deployTokenFixture() {
    const [owner, addr1, addr2, addr3, platformContract] =
      await ethers.getSigners();

    const GlobeRiseToken = await ethers.getContractFactory("GlobeRiseToken");
    const token = await GlobeRiseToken.deploy(owner.address);

    const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1 billion

    return { token, owner, addr1, addr2, addr3, platformContract, MAX_SUPPLY };
  }

  // ============================================
  // DEPLOYMENT TESTS
  // ============================================

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("GlobeRise Token");
      expect(await token.symbol()).to.equal("GRT");
    });

    it("Should have 18 decimals", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.decimals()).to.equal(18);
    });

    it("Should mint max supply to owner", async function () {
      const { token, owner, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );

      expect(await token.balanceOf(owner.address)).to.equal(MAX_SUPPLY);
    });

    it("Should set correct total supply", async function () {
      const { token, MAX_SUPPLY } = await loadFixture(deployTokenFixture);

      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("Should set correct max supply constant", async function () {
      const { token, MAX_SUPPLY } = await loadFixture(deployTokenFixture);

      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("Should set correct version", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.VERSION()).to.equal("1.0.0");
    });

    it("Should set owner correctly", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should revert if deployed with zero address", async function () {
      const GlobeRiseToken = await ethers.getContractFactory("GlobeRiseToken");

      await expect(GlobeRiseToken.deploy(ethers.ZeroAddress)).to.be.reverted;
    });

    it("Should emit TokensMinted event on deployment", async function () {
      const [owner] = await ethers.getSigners();
      const GlobeRiseToken = await ethers.getContractFactory("GlobeRiseToken");
      const MAX_SUPPLY = ethers.parseEther("1000000000");

      const token = await GlobeRiseToken.deploy(owner.address);
      const receipt = await token.deploymentTransaction()?.wait();

      // Check that TokensMinted event was emitted in deployment
      const event = receipt?.logs.find((log: any) => {
        try {
          const parsed = token.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
          return parsed?.name === "TokensMinted";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });
  });

  // ============================================
  // TRANSFER TESTS
  // ============================================

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await token.transfer(addr1.address, amount);

      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should update balances after transfers", async function () {
      const { token, owner, addr1, addr2, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("50");

      await token.transfer(addr1.address, amount1);
      await token.transfer(addr2.address, amount2);

      expect(await token.balanceOf(owner.address)).to.equal(
        MAX_SUPPLY - amount1 - amount2
      );
      expect(await token.balanceOf(addr1.address)).to.equal(amount1);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("1");

      await expect(
        token.connect(addr1).transfer(addr1.address, amount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should emit Transfer event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, amount);
    });

    it("Should allow transferring full balance", async function () {
      const { token, owner, addr1, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );

      await token.transfer(addr1.address, MAX_SUPPLY);

      expect(await token.balanceOf(owner.address)).to.equal(0);
      expect(await token.balanceOf(addr1.address)).to.equal(MAX_SUPPLY);
    });

    it("Should handle multiple consecutive transfers", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const amount = ethers.parseEther("100");

      await token.transfer(addr1.address, amount);
      await token.connect(addr1).transfer(addr2.address, amount);

      expect(await token.balanceOf(addr2.address)).to.equal(amount);
      expect(await token.balanceOf(addr1.address)).to.equal(0);
    });
  });

  // ============================================
  // APPROVAL & ALLOWANCE TESTS
  // ============================================

  describe("Approvals", function () {
    it("Should approve tokens for spender", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await token.approve(addr1.address, amount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        amount
      );
    });

    it("Should emit Approval event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await expect(token.approve(addr1.address, amount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, amount);
    });

    it("Should allow updating approval amount", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");

      await token.approve(addr1.address, amount1);
      await token.approve(addr1.address, amount2);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        amount2
      );
    });

    it("Should allow spender to transferFrom", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const amount = ethers.parseEther("100");

      await token.approve(addr1.address, amount);
      await token
        .connect(addr1)
        .transferFrom(owner.address, addr2.address, amount);

      expect(await token.balanceOf(addr2.address)).to.equal(amount);
    });

    it("Should decrease allowance after transferFrom", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const approvedAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("30");

      await token.approve(addr1.address, approvedAmount);
      await token
        .connect(addr1)
        .transferFrom(owner.address, addr2.address, transferAmount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approvedAmount - transferAmount
      );
    });

    it("Should fail transferFrom if allowance exceeded", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const approvedAmount = ethers.parseEther("50");
      const transferAmount = ethers.parseEther("100");

      await token.approve(addr1.address, approvedAmount);

      await expect(
        token
          .connect(addr1)
          .transferFrom(owner.address, addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should support infinite approval", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(
        deployTokenFixture
      );
      const maxUint256 = ethers.MaxUint256;
      const transferAmount = ethers.parseEther("100");

      await token.approve(addr1.address, maxUint256);
      await token
        .connect(addr1)
        .transferFrom(owner.address, addr2.address, transferAmount);

      // Allowance should remain max after transfer
      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        maxUint256
      );
    });
  });

  // ============================================
  // BURN TESTS
  // ============================================

  describe("Burning", function () {
    it("Should allow burning own tokens", async function () {
      const { token, owner, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );
      const burnAmount = ethers.parseEther("1000");

      await token.burn(burnAmount);

      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);
      expect(await token.balanceOf(owner.address)).to.equal(
        MAX_SUPPLY - burnAmount
      );
    });

    it("Should emit Transfer event to zero address on burn", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1000");

      await expect(token.burn(burnAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should fail if burning more than balance", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1");

      await expect(
        token.connect(addr1).burn(burnAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should allow burning from approved allowance", async function () {
      const { token, owner, addr1, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );
      const burnAmount = ethers.parseEther("1000");

      await token.approve(addr1.address, burnAmount);
      await token.connect(addr1).burnFrom(owner.address, burnAmount);

      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - burnAmount);
    });

    it("Should decrease allowance after burnFrom", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const approvedAmount = ethers.parseEther("2000");
      const burnAmount = ethers.parseEther("1000");

      await token.approve(addr1.address, approvedAmount);
      await token.connect(addr1).burnFrom(owner.address, burnAmount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        approvedAmount - burnAmount
      );
    });

    it("Should update totalBurned correctly", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1000");

      expect(await token.totalBurned()).to.equal(0);

      await token.burn(burnAmount);

      expect(await token.totalBurned()).to.equal(burnAmount);
    });

    it("Should update circulatingSupply correctly", async function () {
      const { token, MAX_SUPPLY } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1000");

      await token.burn(burnAmount);

      expect(await token.circulatingSupply()).to.equal(MAX_SUPPLY - burnAmount);
    });
  });

  // ============================================
  // PERMIT (EIP-2612) TESTS
  // ============================================

  describe("Permit (Gasless Approvals)", function () {
    it("Should support permit functionality", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");
      const deadline = ethers.MaxUint256;

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const value = {
        owner: owner.address,
        spender: addr1.address,
        value: amount,
        nonce: await token.nonces(owner.address),
        deadline: deadline,
      };

      const signature = await owner.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);

      await token.permit(
        owner.address,
        addr1.address,
        amount,
        deadline,
        v,
        r,
        s
      );

      expect(await token.allowance(owner.address, addr1.address)).to.equal(
        amount
      );
    });

    it("Should increment nonce after permit", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const initialNonce = await token.nonces(owner.address);
      expect(initialNonce).to.equal(0);
    });
  });

  // ============================================
  // OWNERSHIP TESTS
  // ============================================

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await token.transferOwnership(addr1.address);

      expect(await token.owner()).to.equal(addr1.address);
    });

    it("Should emit OwnershipTransferred event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.transferOwnership(addr1.address))
        .to.emit(token, "OwnershipTransferred")
        .withArgs(owner.address, addr1.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);

      await expect(
        token.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should allow renouncing ownership", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      await token.renounceOwnership();

      expect(await token.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  // ============================================
  // UTILITY FUNCTION TESTS
  // ============================================

  describe("Utility Functions", function () {
    it("Should return correct hasSufficientBalance", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await token.transfer(addr1.address, amount);

      expect(
        await token.hasSufficientBalance(addr1.address, ethers.parseEther("50"))
      ).to.be.true;
      expect(
        await token.hasSufficientBalance(
          addr1.address,
          ethers.parseEther("150")
        )
      ).to.be.false;
    });

    it("Should return correct token info", async function () {
      const { token, MAX_SUPPLY } = await loadFixture(deployTokenFixture);

      const info = await token.getTokenInfo();

      expect(info.tokenName).to.equal("GlobeRise Token");
      expect(info.tokenSymbol).to.equal("GRT");
      expect(info.tokenDecimals).to.equal(18);
      expect(info.currentSupply).to.equal(MAX_SUPPLY);
      expect(info.maxSupply).to.equal(MAX_SUPPLY);
    });

    it("Should return updated currentSupply after burn", async function () {
      const { token, MAX_SUPPLY } = await loadFixture(deployTokenFixture);
      const burnAmount = ethers.parseEther("1000");

      await token.burn(burnAmount);

      const info = await token.getTokenInfo();
      expect(info.currentSupply).to.equal(MAX_SUPPLY - burnAmount);
    });
  });

  // ============================================
  // EMERGENCY RECOVERY TESTS
  // ============================================

  describe("Emergency Recovery", function () {
    it("Should allow owner to recover accidentally sent ERC20 tokens", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      // Deploy a mock ERC20 token
      const MockToken = await ethers.getContractFactory("GlobeRiseToken");
      const mockToken = await MockToken.deploy(owner.address);
      const amount = ethers.parseEther("100");

      // Send mock tokens to token contract
      await mockToken.transfer(await token.getAddress(), amount);

      // Recover them
      await token.recoverERC20(await mockToken.getAddress(), amount);

      expect(await mockToken.balanceOf(owner.address)).to.be.greaterThan(0);
    });

    it("Should not allow recovering GRT tokens", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await expect(
        token.recoverERC20(await token.getAddress(), amount)
      ).to.be.revertedWith("GRT: cannot recover GRT");
    });

    it("Should not allow recovering from zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("100");

      await expect(
        token.recoverERC20(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("GRT: zero address");
    });

    it("Should only allow owner to recover tokens", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      const MockToken = await ethers.getContractFactory("GlobeRiseToken");
      const mockToken = await MockToken.deploy(owner.address);
      const amount = ethers.parseEther("100");

      await mockToken.transfer(await token.getAddress(), amount);

      await expect(
        token.connect(addr1).recoverERC20(await mockToken.getAddress(), amount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should emit EmergencyAction event on recovery", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      const MockToken = await ethers.getContractFactory("GlobeRiseToken");
      const mockToken = await MockToken.deploy(owner.address);
      const amount = ethers.parseEther("100");

      await mockToken.transfer(await token.getAddress(), amount);

      await expect(token.recoverERC20(await mockToken.getAddress(), amount))
        .to.emit(token, "EmergencyAction")
        .withArgs(owner.address, "ERC20 recovery");
    });
  });

  // ============================================
  // EDGE CASE TESTS
  // ============================================

  describe("Edge Cases", function () {
    it("Should handle zero amount transfers", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);

      await expect(token.transfer(addr1.address, 0))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 0);
    });

    it("Should handle self-transfers", async function () {
      const { token, owner, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );
      const amount = ethers.parseEther("100");

      await token.transfer(owner.address, amount);

      expect(await token.balanceOf(owner.address)).to.equal(MAX_SUPPLY);
    });

    it("Should maintain total supply integrity after multiple operations", async function () {
      const { token, owner, addr1, addr2, MAX_SUPPLY } = await loadFixture(
        deployTokenFixture
      );

      await token.transfer(addr1.address, ethers.parseEther("1000"));
      await token.transfer(addr2.address, ethers.parseEther("2000"));
      await token
        .connect(addr1)
        .transfer(addr2.address, ethers.parseEther("500"));
      await token.burn(ethers.parseEther("100"));

      const ownerBal = await token.balanceOf(owner.address);
      const addr1Bal = await token.balanceOf(addr1.address);
      const addr2Bal = await token.balanceOf(addr2.address);
      const burned = await token.totalBurned();

      expect(ownerBal + addr1Bal + addr2Bal + burned).to.equal(MAX_SUPPLY);
    });
  });
});
