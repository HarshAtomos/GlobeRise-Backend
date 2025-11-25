// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GlobeRisePlatform
 * @notice Main DeFi MLM platform contract for GlobeRise
 * @dev Implements:
 *      - UUPS upgradeable pattern for future improvements
 *      - Investment management with dynamic ROI tiers (8%, 10%, 12%)
 *      - Staking system with 5 duration tiers (3-24 months)
 *      - MLM structure (Binary tree + Unilevel with unlimited referrals)
 *      - 5 commission types: ROI, Direct Referral, Level Income, Royalty, Bonus
 *      - 16 ranks (BEGINNER to IMPERATOR) with 60:40 qualification
 *      - Withdrawal system with Monday-only window and 10% platform fee
 *      - Role-based access control (ADMIN, OPERATOR, UPGRADER)
 *      - Dormant user tracking (90 days inactivity)
 *
 * Business Rules (from PDF requirements):
 * - Minimum investment: $100 (in GRT tokens)
 * - ROI Tiers: 8% (2.5X cap), 10% (3X cap with 2 refs in 14 days), 12% (4X cap with 4 refs in 21 days)
 * - Direct Referral: 5% of investment (one-time)
 * - Level Income: 10%-1% across 16 levels (ROI-to-ROI based)
 * - Royalty: CTO-based distribution to qualified ranks (requires 10% monthly growth)
 * - Bonus: One-time rewards ($250-$50k) for rank achievements
 * - Unlimited direct referrals (income generated only through 16 levels)
 * - Platform fee: 10% on withdrawals (2.5% dev + 7.5% treasury)
 * - Withdrawals: Monday only (00:00-23:59 UTC)
 * - Staking: Non-MLM, does not count towards team business
 */
contract GlobeRisePlatform is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ============================================
    // TYPE DEFINITIONS
    // ============================================

    /// @notice Investment record for each user
    struct Investment {
        uint256 amount; // Investment amount in GRT
        uint256 startTime; // Investment start timestamp
        uint256 passiveROIClaimed; // Only passive ROI counts toward cap
        uint256 maxClaimable; // Maximum claimable (amount * multiplier)
        address referrer; // Address of sponsor
        bool active; // Is investment still active
    }

    /// @notice Staking package for fixed-term deposits (non-MLM)
    struct StakingPackage {
        uint256 amount; // Staked amount in GRT
        uint8 durationTier; // 1=3mo, 2=6mo, 3=12mo, 4=18mo, 5=24mo
        uint256 startTime; // Stake start timestamp
        uint256 maturityTime; // When stake can be claimed
        uint256 monthlyRate; // Monthly rate in basis points
        bool claimed; // Has stake been claimed
    }

    /// @notice User profile in MLM structure
    struct User {
        address sponsor; // Direct upline (sponsor)
        address leftLeg; // Binary tree left leg
        address rightLeg; // Binary tree right leg
        address[] directReferrals; // Unilevel structure (unlimited)
        uint256 leftVolume; // Binary tree left leg volume
        uint256 rightVolume; // Binary tree right leg volume
        uint8 rank; // Current rank (0-15)
        uint256 totalCommissions; // Lifetime commissions earned
        uint256 totalInvested; // Total amount invested
        bool registered; // Is user registered
        uint256 registrationTime; // When user registered
    }

    /// @notice Monthly activity tracking for royalty re-qualification
    struct MonthlyActivity {
        uint256 month; // Month identifier (timestamp / 30 days)
        uint256 newBusiness; // New business generated this month
        uint256 teamVolume; // Total team volume this month
        bool qualifiesForRoyalty; // Passed 10% growth check
    }

    /// @notice Withdrawal request
    struct WithdrawalRequest {
        uint256 amount; // Amount to withdraw (before fee)
        WithdrawalType withdrawalType; // GRT_ONLY or GRT_USDT_SPLIT
        uint256 requestTime; // When requested
        WithdrawalStatus status; // Current status
    }

    /// @notice Withdrawal type enum
    enum WithdrawalType {
        GRT_ONLY, // 100% in GRT
        GRT_USDT_SPLIT // 50% GRT + 50% USDT
    }

    /// @notice Withdrawal status enum
    enum WithdrawalStatus {
        PENDING,
        APPROVED,
        COMPLETED,
        REJECTED
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice GRT token contract
    IERC20 public grtToken;

    /// @notice USDT token contract (for 50/50 withdrawals)
    IERC20 public usdtToken;

    /// @notice Minimum investment amount in GRT (default: 100 GRT = $100)
    uint256 public minInvestment;

    /// @notice ROI percentages for each tier (basis points: 800 = 8%)
    uint256[3] public roiPercentages;

    /// @notice ROI cap multipliers (basis points: 250 = 2.5X)
    uint256[3] public roiCaps;

    /// @notice Direct referral commission rate (basis points: 500 = 5%)
    uint256 public directReferralRate;

    /// @notice Level income rates for 16 levels (basis points)
    uint256[16] public levelIncomeRates;

    /// @notice Rank names (16 ranks)
    string[16] public rankNames;

    /// @notice Rank qualification requirements (team volume in USD)
    uint256[16] public rankRequirements;

    /// @notice One-time bonus amounts for each rank (in USD)
    uint256[16] public rankBonuses;

    /// @notice Minimum withdrawal amount
    uint256 public minWithdrawal;

    /// @notice Platform treasury address
    address public treasury;

    /// @notice Dev wallet address for gas/dev fee portion
    address public devWallet;

    /// @notice Platform fee rate on withdrawals (basis points, default 1000 = 10%)
    uint256 public platformFeeRate;

    /// @notice Dev fee share of platform fee (basis points, 2500 = 25% of fee = 2.5% of total)
    uint256 public constant DEV_FEE_SHARE = 2500;

    /// @notice Treasury fee share of platform fee (basis points, 7500 = 75% of fee = 7.5% of total)
    uint256 public constant TREASURY_FEE_SHARE = 7500;

    /// @notice Staking monthly rates for each tier (basis points)
    uint256[5] public stakingRates;

    /// @notice Staking durations in months for each tier
    uint8[5] public stakingDurations;

    /// @notice Dormant period after which user is considered inactive (90 days)
    uint256 public constant DORMANT_PERIOD = 90 days;

    // ============================================
    // MAPPINGS
    // ============================================

    /// @notice User address => User struct
    mapping(address => User) public users;

    /// @notice User address => Investment array
    mapping(address => Investment[]) public investments;

    /// @notice User address => StakingPackage array
    mapping(address => StakingPackage[]) public stakingPackages;

    /// @notice User address => Month => MonthlyActivity
    mapping(address => mapping(uint256 => MonthlyActivity))
        public monthlyActivity;

    /// @notice User address => WithdrawalRequest array
    mapping(address => WithdrawalRequest[]) public withdrawalRequests;

    /// @notice User address => Last activity timestamp (for dormant check)
    mapping(address => uint256) public lastActivityTime;

    /// @notice User address => Available balance for withdrawal (Reward Wallet equivalent)
    mapping(address => uint256) public withdrawableBalance;

    /// @notice Total users registered
    uint256 public totalUsers;

    /// @notice Total investments made
    uint256 public totalInvestments;

    /// @notice Total commissions distributed
    uint256 public totalCommissionsDistributed;

    /// @notice Total platform fees collected
    uint256 public totalFeesCollected;

    // ============================================
    // ROLES
    // ============================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ============================================
    // EVENTS
    // ============================================

    event UserRegistered(address indexed user, address indexed sponsor);
    event InvestmentCreated(
        address indexed user,
        uint256 indexed investmentId,
        uint256 amount,
        address indexed referrer
    );
    event ROIClaimed(
        address indexed user,
        uint256 indexed investmentId,
        uint256 amount,
        uint8 roiTier
    );
    event CommissionPaid(
        address indexed user,
        address indexed from,
        uint256 amount,
        string commissionType
    );
    event RankUpdated(address indexed user, uint8 newRank, uint8 oldRank);
    event WithdrawalRequested(
        address indexed user,
        uint256 indexed requestId,
        uint256 amount,
        WithdrawalType withdrawalType
    );
    event WithdrawalApproved(address indexed user, uint256 indexed requestId);
    event WithdrawalCompleted(
        address indexed user,
        uint256 indexed requestId,
        uint256 netAmount,
        uint256 devFee,
        uint256 treasuryFee
    );
    event WithdrawalRejected(
        address indexed user,
        uint256 indexed requestId,
        string reason
    );
    event RoyaltyDistributed(
        uint256 indexed month,
        uint256 totalAmount,
        uint256 maxBudget,
        uint256 recipientCount
    );
    event StakeCreated(
        address indexed user,
        uint256 indexed stakeId,
        uint256 amount,
        uint8 tier
    );
    event StakeClaimed(
        address indexed user,
        uint256 indexed stakeId,
        uint256 principal,
        uint256 interest
    );
    event PlatformFeeCollected(
        address indexed user,
        uint256 devFee,
        uint256 treasuryFee
    );
    event DevWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );
    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);

    // ============================================
    // CUSTOM ERRORS
    // ============================================

    error NotRegistered();
    error AlreadyRegistered();
    error InvalidAmount();
    error InvalidTier();
    error InvalidReferrer();
    error InvestmentNotActive();
    error NothingToClaim();
    error InsufficientBalance();
    error NotWithdrawalDay();
    error InvalidWithdrawalRequest();
    error Unauthorized();
    error StakeNotMature();
    error StakeAlreadyClaimed();
    error SponsorDormant();
    error InvalidAddress();

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyRegistered() {
        if (!users[msg.sender].registered) revert NotRegistered();
        _;
    }

    modifier onlyOnMonday() {
        if (!_isMonday()) revert NotWithdrawalDay();
        _;
    }

    // ============================================
    // INITIALIZATION (UUPS)
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the platform contract
     * @param _grtToken Address of GRT token contract
     * @param _usdtToken Address of USDT token contract
     * @param _treasury Treasury address for platform fees
     * @param _devWallet Dev wallet address for gas/dev portion of fees
     */
    function initialize(
        address _grtToken,
        address _usdtToken,
        address _treasury,
        address _devWallet
    ) public initializer {
        require(_grtToken != address(0), "Invalid GRT token");
        require(_usdtToken != address(0), "Invalid USDT token");
        require(_treasury != address(0), "Invalid treasury");
        require(_devWallet != address(0), "Invalid dev wallet");

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        grtToken = IERC20(_grtToken);
        usdtToken = IERC20(_usdtToken);
        treasury = _treasury;
        devWallet = _devWallet;

        // Initialize platform parameters
        minInvestment = 100 * 10 ** 18; // 100 GRT
        directReferralRate = 500; // 5%
        minWithdrawal = 10 * 10 ** 18; // 10 GRT
        platformFeeRate = 1000; // 10%

        // ROI configurations (basis points)
        roiPercentages = [800, 1000, 1200]; // 8%, 10%, 12%
        roiCaps = [250, 300, 400]; // 2.5X, 3X, 4X

        // Level income rates (16 levels, basis points)
        levelIncomeRates = [
            1000,
            500,
            400,
            400, // L1-L4: 10%, 5%, 4%, 4%
            300,
            300,
            300, // L5-L7: 3%, 3%, 3%
            200,
            200,
            200,
            200, // L8-L11: 2%, 2%, 2%, 2%
            100,
            100,
            100,
            100,
            100 // L12-L16: 1%, 1%, 1%, 1%, 1%
        ];

        // Staking configurations (basis points for monthly rate)
        stakingRates = [125, 175, 225, 400, 475]; // 1.25%, 1.75%, 2.25%, 4%, 4.75%
        stakingDurations = [3, 6, 12, 18, 24]; // months

        // Initialize rank names
        _initializeRanks();
    }

    /**
     * @dev Initialize rank names, requirements, and bonuses
     */
    function _initializeRanks() private {
        // Rank names per PDF requirements
        rankNames = [
            "BEGINNER",
            "EXPLORER",
            "PATHFINDER",
            "CHALLENGER",
            "NAVIGATOR",
            "CHAMPION",
            "COMMANDER",
            "STRATEGIST",
            "TRAILBLAZER",
            "GRANDMASTER",
            "LEGEND",
            "CROWN PRINCE",
            "KING",
            "EMPEROR",
            "SUPREME LEADER",
            "IMPERATOR"
        ];

        // Team volume requirements in USD (per PDF requirements)
        rankRequirements = [
            0,
            5000,
            15000,
            40000, // BEGINNER, EXPLORER, PATHFINDER, CHALLENGER
            100000,
            200000,
            350000,
            500000, // NAVIGATOR, CHAMPION, COMMANDER, STRATEGIST
            1000000,
            1500000,
            2500000,
            4000000, // TRAILBLAZER, GRANDMASTER, LEGEND, CROWN PRINCE
            5500000,
            7000000,
            8500000,
            10000000 // KING, EMPEROR, SUPREME LEADER, IMPERATOR
        ];

        // One-time bonuses in USD (per PDF requirements)
        rankBonuses = [
            0,
            250,
            750,
            1500, // BEGINNER (0), EXPLORER ($250), PATHFINDER ($750), CHALLENGER ($1500)
            3000,
            5000,
            7500,
            9000, // NAVIGATOR ($3000), CHAMPION ($5000), COMMANDER ($7500), STRATEGIST ($9000)
            15000,
            20000,
            25000,
            30000, // TRAILBLAZER ($15000), GRANDMASTER ($20000), LEGEND ($25000), CROWN PRINCE ($30000)
            35000,
            40000,
            45000,
            50000 // KING ($35000), EMPEROR ($40000), SUPREME LEADER ($45000), IMPERATOR ($50000)
        ];
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * @dev Check if today is Monday (UTC)
     * @return True if current day is Monday
     */
    function _isMonday() private view returns (bool) {
        // Unix timestamp starts on Thursday (1970-01-01)
        // (timestamp / 1 day + 4) % 7 gives: 0=Sun, 1=Mon, 2=Tue, etc.
        return ((block.timestamp / 1 days + 4) % 7) == 1;
    }

    /**
     * @dev Check if a user is dormant (inactive for 90+ days)
     * @param user User address
     * @return True if user is dormant
     */
    function isDormant(address user) public view returns (bool) {
        if (!users[user].registered) return true;
        if (lastActivityTime[user] == 0) return false; // New user, not dormant yet
        return block.timestamp > lastActivityTime[user] + DORMANT_PERIOD;
    }

    /**
     * @dev Update last activity time for a user
     * @param user User address
     */
    function _updateActivity(address user) private {
        lastActivityTime[user] = block.timestamp;
    }

    /**
     * @dev Calculate dynamic ROI tier based on referrals within time window
     * @param user User address
     * @param packageStartTime When the investment package started
     * @param packageAmount Amount of the investment
     * @return tier ROI tier (1, 2, or 3)
     * @return roiRate ROI rate in basis points
     * @return capMultiplier Cap multiplier in basis points
     */
    function _calculateDynamicROITier(
        address user,
        uint256 packageStartTime,
        uint256 packageAmount
    )
        private
        view
        returns (uint8 tier, uint256 roiRate, uint256 capMultiplier)
    {
        address[] storage referrals = users[user].directReferrals;

        uint256 qualifyingFor12Percent = 0; // Count refs within 21 days with same/more investment
        uint256 qualifyingFor10Percent = 0; // Count refs within 14 days with same/more investment

        for (uint256 i = 0; i < referrals.length; i++) {
            address referral = referrals[i];
            uint256 refJoinTime = users[referral].registrationTime;

            // Check if referral joined after package start
            if (refJoinTime < packageStartTime) continue;

            // Check if referral has invested same or more
            if (users[referral].totalInvested < packageAmount) continue;

            uint256 timeSincePackage = refJoinTime - packageStartTime;

            // Check 21-day window for 12% tier
            if (timeSincePackage <= 21 days) {
                qualifyingFor12Percent++;
            }

            // Check 14-day window for 10% tier
            if (timeSincePackage <= 14 days) {
                qualifyingFor10Percent++;
            }
        }

        // Determine tier based on qualifying referrals
        if (qualifyingFor12Percent >= 4) {
            return (3, roiPercentages[2], roiCaps[2]); // 12%, 4X
        } else if (qualifyingFor10Percent >= 2) {
            return (2, roiPercentages[1], roiCaps[1]); // 10%, 3X
        } else {
            return (1, roiPercentages[0], roiCaps[0]); // 8%, 2.5X
        }
    }

    // ============================================
    // USER REGISTRATION
    // ============================================

    /**
     * @notice Register a new user with optional sponsor
     * @param sponsor Address of sponsor (can be zero for first user)
     */
    function registerUser(address sponsor) external whenNotPaused {
        if (users[msg.sender].registered) revert AlreadyRegistered();

        // Validate sponsor
        if (sponsor != address(0)) {
            if (!users[sponsor].registered) revert InvalidReferrer();
            // Check if sponsor is dormant (referral code inactive)
            if (isDormant(sponsor)) revert SponsorDormant();
        }

        // Create user
        users[msg.sender].sponsor = sponsor;
        users[msg.sender].registered = true;
        users[msg.sender].registrationTime = block.timestamp;

        // Add to sponsor's direct referrals (no limit)
        if (sponsor != address(0)) {
            users[sponsor].directReferrals.push(msg.sender);

            // Place in binary tree (simple left-fill algorithm)
            _placeBinaryTree(sponsor, msg.sender);
        }

        totalUsers++;
        _updateActivity(msg.sender);

        emit UserRegistered(msg.sender, sponsor);
    }

    /**
     * @dev Place new user in binary tree (iterative left-fill algorithm)
     * @param sponsor Sponsor address
     * @param newUser New user address
     */
    function _placeBinaryTree(address sponsor, address newUser) private {
        address current = sponsor;
        uint256 maxDepth = 100;
        uint256 depth = 0;

        while (depth < maxDepth) {
            if (users[current].leftLeg == address(0)) {
                users[current].leftLeg = newUser;
                return;
            } else if (users[current].rightLeg == address(0)) {
                users[current].rightLeg = newUser;
                return;
            } else {
                current = users[current].leftLeg;
                depth++;
            }
        }

        revert("Binary tree too deep");
    }

    // ============================================
    // INVESTMENT FUNCTIONS
    // ============================================

    /**
     * @notice Create a new investment
     * @param amount Amount of GRT tokens to invest
     * @dev User must approve this contract to spend GRT tokens first
     * @dev ROI tier is calculated dynamically on each claim based on referral activity
     */
    function createInvestment(
        uint256 amount
    ) external nonReentrant whenNotPaused onlyRegistered {
        if (amount < minInvestment) revert InvalidAmount();

        // Transfer GRT tokens from user
        grtToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate initial max claimable (will be recalculated dynamically)
        // Start with base tier (2.5X) - actual cap determined at claim time
        uint256 maxClaimable = (amount * roiCaps[0]) / 100;

        // Create investment record
        Investment memory newInvestment = Investment({
            amount: amount,
            startTime: block.timestamp,
            passiveROIClaimed: 0,
            maxClaimable: maxClaimable,
            referrer: users[msg.sender].sponsor,
            active: true
        });

        investments[msg.sender].push(newInvestment);
        uint256 investmentId = investments[msg.sender].length - 1;

        // Update user stats
        users[msg.sender].totalInvested += amount;
        totalInvestments++;

        // Update binary tree volumes upward
        _updateBinaryVolumes(msg.sender, amount);

        // Distribute direct referral commission
        _distributeDirectReferral(msg.sender, amount);
        _updateMonthlyActivity(msg.sender, amount);
        _updateActivity(msg.sender);

        emit InvestmentCreated(
            msg.sender,
            investmentId,
            amount,
            users[msg.sender].sponsor
        );
    }

    /**
     * @notice Claim ROI from an investment
     * @param investmentId Index of investment in user's investment array
     */
    function claimROI(
        uint256 investmentId
    ) external nonReentrant whenNotPaused onlyRegistered {
        if (investmentId >= investments[msg.sender].length)
            revert InvalidAmount();

        Investment storage investment = investments[msg.sender][investmentId];

        if (!investment.active) revert InvestmentNotActive();

        // Calculate dynamic ROI tier based on current referral status
        (
            uint8 tier,
            uint256 roiRate,
            uint256 capMultiplier
        ) = _calculateDynamicROITier(
                msg.sender,
                investment.startTime,
                investment.amount
            );

        // Update max claimable based on current tier
        uint256 currentMaxClaimable = (investment.amount * capMultiplier) / 100;
        if (currentMaxClaimable > investment.maxClaimable) {
            investment.maxClaimable = currentMaxClaimable;
        }

        // Calculate claimable ROI
        uint256 claimable = _calculateClaimableROI(
            msg.sender,
            investmentId,
            roiRate
        );

        if (claimable == 0) revert NothingToClaim();

        // Update investment (only passive ROI counts toward cap)
        investment.passiveROIClaimed += claimable;

        // Check if investment reached max cap
        if (investment.passiveROIClaimed >= investment.maxClaimable) {
            investment.active = false;
        }

        // Add to withdrawable balance
        withdrawableBalance[msg.sender] += claimable;

        // Update user commissions
        users[msg.sender].totalCommissions += claimable;

        // Distribute level income to upline
        _distributeLevelIncome(msg.sender, claimable);
        _updateActivity(msg.sender);

        emit ROIClaimed(msg.sender, investmentId, claimable, tier);
    }

    /**
     * @dev Calculate claimable ROI for an investment
     * @param user User address
     * @param investmentId Investment index
     * @param roiRate ROI rate in basis points
     * @return Claimable amount
     */
    function _calculateClaimableROI(
        address user,
        uint256 investmentId,
        uint256 roiRate
    ) private view returns (uint256) {
        Investment storage investment = investments[user][investmentId];

        if (!investment.active) return 0;

        // Calculate months elapsed since start
        uint256 monthsElapsed = (block.timestamp - investment.startTime) /
            30 days;

        if (monthsElapsed == 0) return 0;

        // Calculate total ROI earned
        uint256 totalEarned = (investment.amount * roiRate * monthsElapsed) /
            10000;

        // Subtract already claimed (passive ROI only)
        uint256 claimable = totalEarned > investment.passiveROIClaimed
            ? totalEarned - investment.passiveROIClaimed
            : 0;

        // Cap at maxClaimable
        uint256 remaining = investment.maxClaimable -
            investment.passiveROIClaimed;
        if (claimable > remaining) {
            claimable = remaining;
        }

        return claimable;
    }

    /**
     * @dev Update binary tree volumes upward
     */
    function _updateBinaryVolumes(address user, uint256 amount) private {
        address current = users[user].sponsor;

        while (current != address(0)) {
            if (users[current].leftLeg == user || _isInLeftLeg(current, user)) {
                users[current].leftVolume += amount;
            } else {
                users[current].rightVolume += amount;
            }

            user = current;
            current = users[current].sponsor;
        }
    }

    /**
     * @dev Check if user is in left leg of upline
     */
    function _isInLeftLeg(
        address upline,
        address user
    ) private view returns (bool) {
        address left = users[upline].leftLeg;
        if (left == address(0)) return false;
        if (left == user) return true;

        address[50] memory queue;
        uint256 front = 0;
        uint256 back = 0;

        queue[back++] = left;
        uint256 maxIterations = 50;
        uint256 iterations = 0;

        while (front < back && iterations < maxIterations) {
            address current = queue[front++];

            if (current == user) return true;

            if (users[current].leftLeg != address(0) && back < 50) {
                queue[back++] = users[current].leftLeg;
            }
            if (users[current].rightLeg != address(0) && back < 50) {
                queue[back++] = users[current].rightLeg;
            }

            iterations++;
        }

        return false;
    }

    /**
     * @dev Distribute direct referral commission (5%)
     */
    function _distributeDirectReferral(address user, uint256 amount) private {
        address sponsor = users[user].sponsor;
        if (sponsor == address(0)) return;

        uint256 commission = (amount * directReferralRate) / 10000;
        withdrawableBalance[sponsor] += commission;
        users[sponsor].totalCommissions += commission;
        totalCommissionsDistributed += commission;

        emit CommissionPaid(sponsor, user, commission, "Direct Referral");
    }

    /**
     * @dev Distribute level income to upline (ROI-to-ROI based)
     * @dev Only pays through 16 levels, even though unlimited referrals allowed
     */
    function _distributeLevelIncome(
        address user,
        uint256 claimedAmount
    ) private {
        address current = users[user].sponsor;
        uint8 level = 0;

        while (current != address(0) && level < 16) {
            // Only pay if upline has active investments
            if (_hasActiveInvestments(current)) {
                uint256 commission = (claimedAmount * levelIncomeRates[level]) /
                    10000;
                withdrawableBalance[current] += commission;
                users[current].totalCommissions += commission;
                totalCommissionsDistributed += commission;

                emit CommissionPaid(current, user, commission, "Level Income");
            }

            current = users[current].sponsor;
            level++;
        }
    }

    /**
     * @dev Check if user has active investments
     */
    function _hasActiveInvestments(address user) private view returns (bool) {
        Investment[] storage userInvestments = investments[user];
        for (uint256 i = 0; i < userInvestments.length; i++) {
            if (userInvestments[i].active) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Update monthly activity for royalty qualification
     * @dev Now checks 10% GROWTH from previous month
     */
    function _updateMonthlyActivity(address user, uint256 amount) private {
        uint256 currentMonth = getCurrentMonth();
        MonthlyActivity storage activity = monthlyActivity[user][currentMonth];

        activity.month = currentMonth;
        activity.newBusiness += amount;
        activity.teamVolume = users[user].leftVolume + users[user].rightVolume;

        // Check if qualifies for royalty (10% growth from previous month)
        uint256 previousMonth = currentMonth > 0 ? currentMonth - 1 : 0;
        uint256 previousTeamVolume = monthlyActivity[user][previousMonth]
            .teamVolume;

        if (previousTeamVolume == 0) {
            // First month or no previous activity - qualifies if has any business
            activity.qualifiesForRoyalty = activity.teamVolume > 0;
        } else {
            // Require 10% growth: current >= previous * 1.1
            uint256 requiredVolume = (previousTeamVolume * 110) / 100;
            activity.qualifiesForRoyalty =
                activity.teamVolume >= requiredVolume;
        }
    }

    // ============================================
    // STAKING FUNCTIONS (Non-MLM)
    // ============================================

    /**
     * @notice Create a new staking package
     * @param amount Amount of GRT tokens to stake
     * @param tier Duration tier (1=3mo, 2=6mo, 3=12mo, 4=18mo, 5=24mo)
     * @dev Staking does NOT count towards team business or MLM commissions
     */
    function createStake(
        uint256 amount,
        uint8 tier
    ) external nonReentrant whenNotPaused onlyRegistered {
        if (amount == 0) revert InvalidAmount();
        if (tier < 1 || tier > 5) revert InvalidTier();

        // Transfer GRT tokens from user
        grtToken.safeTransferFrom(msg.sender, address(this), amount);

        uint8 tierIndex = tier - 1;
        uint256 durationMonths = stakingDurations[tierIndex];
        uint256 maturityTime = block.timestamp + (durationMonths * 30 days);

        // Create staking record
        StakingPackage memory newStake = StakingPackage({
            amount: amount,
            durationTier: tier,
            startTime: block.timestamp,
            maturityTime: maturityTime,
            monthlyRate: stakingRates[tierIndex],
            claimed: false
        });

        stakingPackages[msg.sender].push(newStake);
        uint256 stakeId = stakingPackages[msg.sender].length - 1;

        _updateActivity(msg.sender);

        emit StakeCreated(msg.sender, stakeId, amount, tier);
    }

    /**
     * @notice Claim a matured staking package
     * @param stakeId Index of stake in user's staking array
     * @dev Returns principal + interest in native GRT tokens only
     */
    function claimStake(
        uint256 stakeId
    ) external nonReentrant whenNotPaused onlyRegistered {
        if (stakeId >= stakingPackages[msg.sender].length)
            revert InvalidAmount();

        StakingPackage storage stake = stakingPackages[msg.sender][stakeId];

        if (stake.claimed) revert StakeAlreadyClaimed();
        if (block.timestamp < stake.maturityTime) revert StakeNotMature();

        // Calculate interest
        uint8 tierIndex = stake.durationTier - 1;
        uint256 months = stakingDurations[tierIndex];
        uint256 totalInterest = (stake.amount * stake.monthlyRate * months) /
            10000;
        uint256 totalPayout = stake.amount + totalInterest;

        // Mark as claimed
        stake.claimed = true;

        // Transfer tokens (principal + interest)
        require(
            grtToken.balanceOf(address(this)) >= totalPayout,
            "Insufficient contract balance"
        );
        grtToken.safeTransfer(msg.sender, totalPayout);

        _updateActivity(msg.sender);

        emit StakeClaimed(msg.sender, stakeId, stake.amount, totalInterest);
    }

    /**
     * @notice Get user's staking packages
     * @param user User address
     * @return Array of StakingPackage
     */
    function getStakingPackages(
        address user
    ) external view returns (StakingPackage[] memory) {
        return stakingPackages[user];
    }

    // ============================================
    // WITHDRAWAL FUNCTIONS
    // ============================================

    /**
     * @notice Request a withdrawal (Monday only)
     * @param amount Amount to withdraw
     * @param withdrawalType Type of withdrawal (GRT_ONLY or GRT_USDT_SPLIT)
     */
    function requestWithdrawal(
        uint256 amount,
        WithdrawalType withdrawalType
    ) external nonReentrant whenNotPaused onlyRegistered onlyOnMonday {
        if (amount < minWithdrawal) revert InvalidAmount();
        if (amount > withdrawableBalance[msg.sender])
            revert InsufficientBalance();

        // Create withdrawal request
        WithdrawalRequest memory request = WithdrawalRequest({
            amount: amount,
            withdrawalType: withdrawalType,
            requestTime: block.timestamp,
            status: WithdrawalStatus.PENDING
        });

        withdrawalRequests[msg.sender].push(request);
        uint256 requestId = withdrawalRequests[msg.sender].length - 1;

        // Lock the funds
        withdrawableBalance[msg.sender] -= amount;

        _updateActivity(msg.sender);

        emit WithdrawalRequested(msg.sender, requestId, amount, withdrawalType);
    }

    /**
     * @notice Approve a withdrawal request (admin only)
     * @param user User address
     * @param requestId Withdrawal request ID
     */
    function approveWithdrawal(
        address user,
        uint256 requestId
    ) external onlyRole(ADMIN_ROLE) {
        if (requestId >= withdrawalRequests[user].length)
            revert InvalidWithdrawalRequest();

        WithdrawalRequest storage request = withdrawalRequests[user][requestId];

        if (request.status != WithdrawalStatus.PENDING)
            revert InvalidWithdrawalRequest();

        request.status = WithdrawalStatus.APPROVED;

        emit WithdrawalApproved(user, requestId);
    }

    /**
     * @notice Complete a withdrawal with platform fee deduction
     * @param user User address
     * @param requestId Withdrawal request ID
     * @dev Deducts 10% platform fee: 2.5% to devWallet, 7.5% to treasury
     */
    function completeWithdrawal(
        address user,
        uint256 requestId
    ) external nonReentrant onlyRole(OPERATOR_ROLE) {
        if (requestId >= withdrawalRequests[user].length)
            revert InvalidWithdrawalRequest();

        WithdrawalRequest storage request = withdrawalRequests[user][requestId];

        if (request.status != WithdrawalStatus.APPROVED)
            revert InvalidWithdrawalRequest();

        // Calculate platform fee
        uint256 totalFee = (request.amount * platformFeeRate) / 10000;
        uint256 devFee = (totalFee * DEV_FEE_SHARE) / 10000;
        uint256 treasuryFee = totalFee - devFee;
        uint256 netAmount = request.amount - totalFee;

        // Track fees
        totalFeesCollected += totalFee;

        // Process withdrawal based on type
        if (request.withdrawalType == WithdrawalType.GRT_ONLY) {
            // 100% in GRT (after fee deduction)
            require(
                grtToken.balanceOf(address(this)) >= request.amount,
                "Insufficient GRT balance"
            );

            // Transfer fees
            grtToken.safeTransfer(devWallet, devFee);
            grtToken.safeTransfer(treasury, treasuryFee);

            // Transfer net amount to user
            grtToken.safeTransfer(user, netAmount);
        } else {
            // 50% GRT + 50% USDT (after fee deduction)
            uint256 grtAmount = netAmount / 2;
            uint256 usdtAmount = netAmount / 2; // 1:1 simplified - integrate DEX for production

            require(
                grtToken.balanceOf(address(this)) >= grtAmount + totalFee,
                "Insufficient GRT balance"
            );
            require(
                usdtToken.balanceOf(address(this)) >= usdtAmount,
                "Insufficient USDT balance"
            );

            // Transfer fees (in GRT)
            grtToken.safeTransfer(devWallet, devFee);
            grtToken.safeTransfer(treasury, treasuryFee);

            // Transfer net amounts to user
            grtToken.safeTransfer(user, grtAmount);
            usdtToken.safeTransfer(user, usdtAmount);
        }

        request.status = WithdrawalStatus.COMPLETED;

        emit PlatformFeeCollected(user, devFee, treasuryFee);
        emit WithdrawalCompleted(
            user,
            requestId,
            netAmount,
            devFee,
            treasuryFee
        );
    }

    /**
     * @notice Reject a withdrawal request (admin only)
     * @param user User address
     * @param requestId Withdrawal request ID
     * @param reason Rejection reason
     */
    function rejectWithdrawal(
        address user,
        uint256 requestId,
        string calldata reason
    ) external onlyRole(ADMIN_ROLE) {
        if (requestId >= withdrawalRequests[user].length)
            revert InvalidWithdrawalRequest();

        WithdrawalRequest storage request = withdrawalRequests[user][requestId];

        if (request.status != WithdrawalStatus.PENDING)
            revert InvalidWithdrawalRequest();

        request.status = WithdrawalStatus.REJECTED;

        // Unlock the funds
        withdrawableBalance[user] += request.amount;

        emit WithdrawalRejected(user, requestId, reason);
    }

    /**
     * @notice Get withdrawable balance for a user
     * @param user User address
     * @return Available balance
     */
    function getWithdrawableBalance(
        address user
    ) external view returns (uint256) {
        return withdrawableBalance[user];
    }

    // ============================================
    // RANK SYSTEM FUNCTIONS
    // ============================================

    /**
     * @notice Update user's rank based on qualifications
     * @param user User address
     * @dev Checks team volume and 60:40 ratio
     */
    function updateRank(address user) public {
        if (!users[user].registered) revert NotRegistered();

        uint8 currentRank = users[user].rank;
        uint8 newRank = _calculateRank(user);

        if (newRank != currentRank) {
            users[user].rank = newRank;

            // Pay one-time bonus if rank increased (bonuses don't count toward ROI cap)
            if (newRank > currentRank && rankBonuses[newRank] > 0) {
                uint256 bonus = rankBonuses[newRank] * 10 ** 18;
                withdrawableBalance[user] += bonus;
                users[user].totalCommissions += bonus;

                emit CommissionPaid(user, address(0), bonus, "Rank Bonus");
            }

            emit RankUpdated(user, newRank, currentRank);
        }
    }

    /**
     * @dev Calculate user's rank based on qualifications
     * @dev Checks: 1) Team volume, 2) 60:40 ratio
     * @dev No direct referral count requirement (unlimited referrals allowed)
     */
    function _calculateRank(address user) private view returns (uint8) {
        uint256 leftVol = users[user].leftVolume;
        uint256 rightVol = users[user].rightVolume;
        uint256 totalVolume = leftVol + rightVol;

        // Check 60:40 ratio - weaker leg must be at least 40% of total volume
        uint256 weakerLeg = leftVol < rightVol ? leftVol : rightVol;
        bool ratioValid = totalVolume == 0 ||
            (weakerLeg * 100) >= (totalVolume * 40);

        if (!ratioValid) return 0;

        // Find highest qualified rank based on volume only
        for (uint8 i = 15; i > 0; i--) {
            if (totalVolume >= rankRequirements[i] * 10 ** 18) {
                return i;
            }
        }

        return 0;
    }

    /**
     * @notice Get rank name for a user
     */
    function getUserRankName(
        address user
    ) external view returns (string memory) {
        return rankNames[users[user].rank];
    }

    /**
     * @notice Check if user qualifies for rank upgrade
     */
    function checkRankUpgrade(
        address user
    ) external view returns (bool canUpgrade, uint8 nextRank) {
        uint8 currentRank = users[user].rank;
        uint8 calculatedRank = _calculateRank(user);

        canUpgrade = calculatedRank > currentRank;
        nextRank = calculatedRank;
    }

    /**
     * @notice Distribute monthly royalty to qualified users
     * @param eligibleUsers Array of user addresses
     * @param amounts Array of royalty amounts
     * @param maxBudget Maximum total amount that can be distributed
     */
    function distributeRoyalty(
        address[] calldata eligibleUsers,
        uint256[] calldata amounts,
        uint256 maxBudget
    ) external onlyRole(ADMIN_ROLE) {
        require(eligibleUsers.length == amounts.length, "Length mismatch");

        uint256 currentMonth = getCurrentMonth();
        uint256 totalDistribution = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            totalDistribution += amounts[i];
        }

        require(totalDistribution <= maxBudget, "Exceeds royalty budget");
        require(
            grtToken.balanceOf(address(this)) >= totalDistribution,
            "Insufficient contract balance"
        );

        uint256 actualRecipients = 0;
        for (uint256 i = 0; i < eligibleUsers.length; i++) {
            address user = eligibleUsers[i];

            // Verify user qualifies (has 10% growth this month)
            if (!monthlyActivity[user][currentMonth].qualifiesForRoyalty)
                continue;

            withdrawableBalance[user] += amounts[i];
            users[user].totalCommissions += amounts[i];
            totalCommissionsDistributed += amounts[i];
            actualRecipients++;

            emit CommissionPaid(user, address(0), amounts[i], "Royalty");
        }

        emit RoyaltyDistributed(
            currentMonth,
            totalDistribution,
            maxBudget,
            actualRecipients
        );
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get user information
     */
    function getUser(address user) external view returns (User memory) {
        return users[user];
    }

    /**
     * @notice Get user's investments
     */
    function getUserInvestments(
        address user
    ) external view returns (Investment[] memory) {
        return investments[user];
    }

    /**
     * @notice Get user's direct referrals
     */
    function getDirectReferrals(
        address user
    ) external view returns (address[] memory) {
        return users[user].directReferrals;
    }

    /**
     * @notice Get user's withdrawal requests
     */
    function getWithdrawalRequests(
        address user
    ) external view returns (WithdrawalRequest[] memory) {
        return withdrawalRequests[user];
    }

    /**
     * @notice Get current month identifier
     */
    function getCurrentMonth() public view returns (uint256) {
        return block.timestamp / 30 days;
    }

    /**
     * @notice Check if today is a valid withdrawal day (Monday)
     */
    function isWithdrawalDay() external view returns (bool) {
        return _isMonday();
    }

    /**
     * @notice Get current ROI tier for an investment
     * @param user User address
     * @param investmentId Investment index
     */
    function getInvestmentROITier(
        address user,
        uint256 investmentId
    )
        external
        view
        returns (uint8 tier, uint256 roiRate, uint256 capMultiplier)
    {
        if (investmentId >= investments[user].length) revert InvalidAmount();
        Investment storage investment = investments[user][investmentId];
        return
            _calculateDynamicROITier(
                user,
                investment.startTime,
                investment.amount
            );
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Update treasury address
     */
    function updateTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();
        treasury = newTreasury;
    }

    /**
     * @notice Update dev wallet address
     */
    function updateDevWallet(
        address newDevWallet
    ) external onlyRole(ADMIN_ROLE) {
        if (newDevWallet == address(0)) revert InvalidAddress();
        address oldWallet = devWallet;
        devWallet = newDevWallet;
        emit DevWalletUpdated(oldWallet, newDevWallet);
    }

    /**
     * @notice Update platform fee rate
     * @param newRate New fee rate in basis points (e.g., 1000 = 10%)
     */
    function updatePlatformFeeRate(
        uint256 newRate
    ) external onlyRole(ADMIN_ROLE) {
        require(newRate <= 2000, "Fee too high"); // Max 20%
        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;
        emit PlatformFeeRateUpdated(oldRate, newRate);
    }

    /**
     * @notice Update minimum investment
     */
    function updateMinInvestment(
        uint256 newMinInvestment
    ) external onlyRole(ADMIN_ROLE) {
        minInvestment = newMinInvestment;
    }

    /**
     * @notice Emergency withdraw tokens (admin only)
     * @param token Token address
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyRole(ADMIN_ROLE) {
        if (to == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ============================================
    // UPGRADE AUTHORIZATION
    // ============================================

    /**
     * @dev Function that should revert when msg.sender is not authorized to upgrade
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    // ============================================
    // STORAGE GAP (for future upgrades)
    // ============================================

    uint256[45] private __gap;
}
