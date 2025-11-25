// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GlobeRiseToken
 * @notice GRT - The native token for the GlobeRise DeFi MLM platform
 * @dev Standard ERC20 token with:
 *      - Fixed supply (1 billion tokens)
 *      - Burnable functionality for deflationary mechanics
 *      - EIP-2612 Permit for gasless approvals
 *      - Ownership controls for platform integration
 *
 * Token Economics:
 * - Total Supply: 1,000,000,000 GRT (1 billion)
 * - Decimals: 18 (standard)
 * - Use Cases: Investments, ROI payouts, commissions, withdrawals
 *
 * Security:
 * - No minting after deployment (fixed supply)
 * - Only burnable (deflationary)
 * - Owner can transfer ownership for platform upgrades
 */
contract GlobeRiseToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum total supply: 1 billion tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Contract version for tracking upgrades
    string public constant VERSION = "1.0.0";

    // ============================================
    // EVENTS
    // ============================================

    /// @notice Emitted when tokens are minted to an address
    event TokensMinted(address indexed to, uint256 amount);

    /// @notice Emitted when emergency pause is triggered (future use)
    event EmergencyAction(address indexed caller, string action);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @notice Initialize the GlobeRise Token
     * @param initialOwner Address that will receive all tokens and own the contract
     * @dev Mints entire supply to initialOwner
     *      In production, this should be a multi-sig wallet or the platform contract
     */
    constructor(
        address initialOwner
    )
        ERC20("GlobeRise Token", "GRT")
        ERC20Permit("GlobeRise Token")
        Ownable(initialOwner)
    {
        require(initialOwner != address(0), "GRT: zero address");

        // Mint entire supply to initial owner
        _mint(initialOwner, MAX_SUPPLY);

        emit TokensMinted(initialOwner, MAX_SUPPLY);
    }

    // ============================================
    // PUBLIC VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get the current circulating supply (total supply minus burned)
     * @return Current circulating supply in wei
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Get the total amount of tokens burned
     * @return Total burned tokens in wei
     */
    function totalBurned() public view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Check if an address has sufficient balance
     * @param account Address to check
     * @param amount Minimum amount required
     * @return True if account has at least amount tokens
     */
    function hasSufficientBalance(address account, uint256 amount)
        public
        view
        returns (bool)
    {
        return balanceOf(account) >= amount;
    }

    // ============================================
    // OWNER FUNCTIONS
    // ============================================

    /**
     * @notice Emergency function to recover accidentally sent ERC20 tokens
     * @param token Address of the ERC20 token to recover
     * @param amount Amount to recover
     * @dev Can only be called by owner
     *      Cannot recover GRT tokens (use normal transfers instead)
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "GRT: cannot recover GRT");
        require(token != address(0), "GRT: zero address");

        IERC20(token).transfer(owner(), amount);

        emit EmergencyAction(msg.sender, "ERC20 recovery");
    }

    /**
     * @notice Get contract metadata for frontend integration
     * @return tokenName Token name
     * @return tokenSymbol Token symbol
     * @return tokenDecimals Token decimals
     * @return currentSupply Current total supply
     * @return maxSupply Maximum possible supply
     */
    function getTokenInfo()
        external
        view
        returns (
            string memory tokenName,
            string memory tokenSymbol,
            uint8 tokenDecimals,
            uint256 currentSupply,
            uint256 maxSupply
        )
    {
        return (
            "GlobeRise Token",
            "GRT",
            18,
            totalSupply(),
            MAX_SUPPLY
        );
    }

    // ============================================
    // INTERNAL OVERRIDES
    // ============================================

    /**
     * @dev Override _update to add custom transfer logic if needed
     *      Currently just calls parent implementation
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        super._update(from, to, value);
    }
}
