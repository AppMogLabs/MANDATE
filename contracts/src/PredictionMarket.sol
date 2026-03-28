// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PredictionMarket — Factory + Template for Binary Outcome Markets
/// @notice Each market is deployed as a minimal proxy clone. Markets resolve via EventOracle.
/// @dev Deploys markets at ~45K gas using EIP-1167. Uses constant-product AMM for settlement.
contract PredictionMarket is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // CONSTANTS & ROLES
    // =========================================================================

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant INITIAL_LIQUIDITY = 10_000 * 1e18; // D: D18{RATE}
    uint256 public constant PLATFORM_FEE_BPS = 100; // D: D0{bps} — 1%

    // Outcome constants
    uint8 constant OUTCOME_NO = 0;
    uint8 constant OUTCOME_YES = 1;
    uint8 constant OUTCOME_UNRESOLVED = 2;

    // =========================================================================
    // TYPES
    // =========================================================================

    /// @notice Market state structure.
    struct Market {
        uint256 eventId;              // D: D0{id} — EventOracle event ID (Phase 3 integration)
        string question;              // Human-readable market question
        uint64 expiryTimestamp;       // D: D0{sec} — block.timestamp when market expires
        uint256 poolYes;              // D: D18{outcome_tok} — YES outcome tokens in pool (virtual liquidity)
        uint256 poolNo;               // D: D18{outcome_tok} — NO outcome tokens in pool (virtual liquidity)
        uint256 totalRateDeposited;   // D: D18{RATE} — Total RATE deposited by all buyers (for payout pool)
        uint256 totalYesTokensIssued; // D: D18{outcome_tok} — [DIM-8 FIX] Total YES tokens issued to users
        uint256 totalNoTokensIssued;  // D: D18{outcome_tok} — [DIM-8 FIX] Total NO tokens issued to users
        uint8 winningOutcome;         // 0=NO, 1=YES, 2=UNRESOLVED
        bool resolved;                // D: {bool} — Has market been resolved?
    }

    /// @notice User's position in a market (outcome tokens held).
    struct Position {
        uint256 yesTokens; // D: D18{outcome_tok} — YES tokens held by user
        uint256 noTokens;  // D: D18{outcome_tok} — NO tokens held by user
    }

    // =========================================================================
    // STORAGE
    // =========================================================================

    /// @notice RATE token (settlement currency).
    IERC20 public rateToken;

    /// @notice All markets: marketId => Market
    mapping(uint256 => Market) public markets;

    /// @notice Market count (also next market ID).
    uint256 public marketCount;

    /// @notice All market addresses (for reference).
    address[] public marketAddresses;

    /// @notice User positions: marketId => user => Position
    mapping(uint256 => mapping(address => Position)) public positions;

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a new market is created.
    event MarketCreated(
        uint256 indexed marketId,
        uint256 eventId,
        string question,
        uint64 expiryTimestamp,
        address cloneAddress
    );

    /// @notice Emitted when outcome tokens are purchased.
    event OutcomePurchased(
        uint256 indexed marketId,
        address indexed buyer,
        uint8 outcome,
        uint256 amountIn,
        uint256 tokensOut
    );

    /// @notice Emitted when market is resolved.
    event MarketResolved(uint256 indexed marketId, uint8 winningOutcome);

    /// @notice Emitted when winnings are claimed.
    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 payout
    );

    // =========================================================================
    // ERRORS
    // =========================================================================

    error InvalidOutcome();
    error MarketNotExpired();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InsufficientBalance();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /// @notice Deploy PredictionMarket factory.
    /// @param _rateToken Address of RATE token (settlement currency).
    /// @param _admin Address to receive DEFAULT_ADMIN_ROLE and OPERATOR_ROLE.
    constructor(address _rateToken, address _admin) {
        if (_rateToken == address(0)) revert("PredictionMarket: zero rate token");
        if (_admin == address(0)) revert("PredictionMarket: zero admin");

        rateToken = IERC20(_rateToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // =========================================================================
    // FACTORY: CREATE MARKET
    // =========================================================================

    /// @notice Create a new binary prediction market.
    /// @dev Creator must approve INITIAL_LIQUIDITY RATE before calling.
    /// @param eventId EventOracle event ID.
    /// @param question Human-readable market question.
    /// @param expiryTimestamp block.timestamp when market expires.
    /// @return marketId ID of the new market.
    function createMarket(
        uint256 eventId,
        string calldata question,
        uint64 expiryTimestamp
    ) external nonReentrant returns (uint256) {
        // Transfer creator-funded liquidity
        rateToken.safeTransferFrom(msg.sender, address(this), INITIAL_LIQUIDITY);

        // Store market data
        uint256 marketId = marketCount;
        markets[marketId] = Market({
            eventId: eventId,
            question: question,
            expiryTimestamp: expiryTimestamp,
            poolYes: INITIAL_LIQUIDITY,
            poolNo: INITIAL_LIQUIDITY,
            totalRateDeposited: INITIAL_LIQUIDITY,
            totalYesTokensIssued: 0,
            totalNoTokensIssued: 0,
            winningOutcome: OUTCOME_UNRESOLVED,
            resolved: false
        });

        marketCount++;

        emit MarketCreated(marketId, eventId, question, expiryTimestamp, address(this));

        return marketId;
    }

    /// @notice Create market and return the clone address (convenience method).
    /// @dev Creator must approve INITIAL_LIQUIDITY RATE before calling.
    function createMarketGetAddress(
        uint256 eventId,
        string calldata question,
        uint64 expiryTimestamp
    ) external nonReentrant returns (address) {
        // Transfer creator-funded liquidity
        rateToken.safeTransferFrom(msg.sender, address(this), INITIAL_LIQUIDITY);

        // Store market data
        uint256 marketId = marketCount;
        markets[marketId] = Market({
            eventId: eventId,
            question: question,
            expiryTimestamp: expiryTimestamp,
            poolYes: INITIAL_LIQUIDITY,
            poolNo: INITIAL_LIQUIDITY,
            totalRateDeposited: INITIAL_LIQUIDITY,
            totalYesTokensIssued: 0,
            totalNoTokensIssued: 0,
            winningOutcome: OUTCOME_UNRESOLVED,
            resolved: false
        });

        marketCount++;

        emit MarketCreated(marketId, eventId, question, expiryTimestamp, address(this));

        return address(this);
    }

    // =========================================================================
    // MARKET QUERIES
    // =========================================================================

    /// @notice Get market count.
    function getMarketCount() external view returns (uint256) {
        return marketCount;
    }

    /// @notice Get market address (returns self for now; placeholder for EIP-1167).
    function getMarketAddress(uint256 _marketId) external view returns (address) {
        return address(this);
    }

    /// @notice Get full market state.
    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    // =========================================================================
    // AMM: BUY OUTCOME
    // =========================================================================

    /// @notice Buy outcome tokens using constant-product AMM.
    /// @param marketId Market to trade in.
    /// @param outcome 0=NO, 1=YES.
    /// @param amountIn RATE tokens to spend.
    /// @return tokensOut Outcome tokens received.
    function buyOutcome(
        uint256 marketId,
        uint8 outcome,
        uint256 amountIn
    ) external nonReentrant returns (uint256) {
        if (outcome > OUTCOME_YES) revert InvalidOutcome();

        Market storage market = markets[marketId];

        // Checks: market not expired
        require(block.timestamp < market.expiryTimestamp, "PredictionMarket: market expired");

        // Transfer RATE from user to contract (CEI pattern)
        rateToken.safeTransferFrom(msg.sender, address(this), amountIn);

        // Track total RATE deposited for payout pool
        market.totalRateDeposited += amountIn;

        // Calculate constant-product AMM output
        // k = poolYes × poolNo
        // tokensOut = poolOut - (k / (poolIn + amountIn))
        uint256 k = market.poolYes * market.poolNo; // D: D18{outcome_tok} * D18{outcome_tok} → D36{outcome_tok^2} ✓ ⚠ overflow if pools > ~1e39
        uint256 tokensOut; // D: D18{outcome_tok}

        if (outcome == OUTCOME_YES) {
            // Buying YES: add to poolYes, subtract from poolNo
            uint256 poolInAfter = market.poolYes + amountIn; // D: D18{outcome_tok} + D18{RATE} → D18{outcome_tok} ✓ (RATE seeds pool as outcome_tok)
            uint256 poolOutAfter = k / poolInAfter; // D: D36{outcome_tok^2} / D18{outcome_tok} → D18{outcome_tok} ✓
            tokensOut = market.poolNo - poolOutAfter; // D: D18{outcome_tok} - D18{outcome_tok} → D18{outcome_tok} ✓

            // Update pools
            market.poolYes = poolInAfter;
            market.poolNo = poolOutAfter;
        } else {
            // Buying NO: add to poolNo, subtract from poolYes
            uint256 poolInAfter = market.poolNo + amountIn; // D: D18{outcome_tok} + D18{RATE} → D18{outcome_tok} ✓
            uint256 poolOutAfter = k / poolInAfter; // D: D36{outcome_tok^2} / D18{outcome_tok} → D18{outcome_tok} ✓
            tokensOut = market.poolYes - poolOutAfter; // D: D18{outcome_tok} - D18{outcome_tok} → D18{outcome_tok} ✓

            // Update pools
            market.poolNo = poolInAfter;
            market.poolYes = poolOutAfter;
        }

        // Update user position and track total issued tokens [DIM-8 FIX]
        if (outcome == OUTCOME_YES) {
            positions[marketId][msg.sender].yesTokens += tokensOut;
            market.totalYesTokensIssued += tokensOut;
        } else {
            positions[marketId][msg.sender].noTokens += tokensOut;
            market.totalNoTokensIssued += tokensOut;
        }

        emit OutcomePurchased(marketId, msg.sender, outcome, amountIn, tokensOut);

        return tokensOut;
    }

    // =========================================================================
    // MARKET RESOLUTION
    // =========================================================================

    /// @notice Resolve a market after expiry.
    /// @param marketId Market to resolve.
    /// @param outcome Winning outcome (0=NO, 1=YES).
    function resolveMarket(uint256 marketId, uint8 outcome)
        external
        onlyRole(OPERATOR_ROLE)
    {
        Market storage market = markets[marketId];

        // Checks
        require(block.timestamp > market.expiryTimestamp, "PredictionMarket: market not expired");
        require(!market.resolved, "PredictionMarket: market already resolved");
        require(outcome <= OUTCOME_YES, "PredictionMarket: invalid outcome");

        // Effects
        market.winningOutcome = outcome;
        market.resolved = true;

        emit MarketResolved(marketId, outcome);
    }

    // =========================================================================
    // CLAIM WINNINGS
    // =========================================================================

    /// @notice Claim winnings for a resolved market.
    /// @param marketId Market to claim from.
    /// @return payout RATE tokens paid to winner (0 if loser).
    function claimWinnings(uint256 marketId)
        external
        nonReentrant
        returns (uint256)
    {
        Market storage market = markets[marketId];

        // Checks
        require(market.resolved, "PredictionMarket: market not resolved");

        Position storage userPosition = positions[marketId][msg.sender];
        uint256 payout = 0;

        // Calculate payout based on winning outcome
        // Payout pool = total RATE actually deposited
        uint256 payoutPool = market.totalRateDeposited; // D: D18{RATE}

        if (market.winningOutcome == OUTCOME_YES) {
            // YES won: payout if user holds YES tokens
            // [DIM-8 FIX] Use totalYesTokensIssued as denominator, not residual poolYes.
            // This ensures sum of all payouts = payoutPool exactly.
            if (userPosition.yesTokens > 0 && market.totalYesTokensIssued > 0) {
                payout = (userPosition.yesTokens * payoutPool) / market.totalYesTokensIssued;
            }
            userPosition.yesTokens = 0;
        } else if (market.winningOutcome == OUTCOME_NO) {
            // NO won: payout if user holds NO tokens
            // [DIM-8 FIX] Use totalNoTokensIssued as denominator.
            if (userPosition.noTokens > 0 && market.totalNoTokensIssued > 0) {
                payout = (userPosition.noTokens * payoutPool) / market.totalNoTokensIssued;
            }
            userPosition.noTokens = 0;
        }

        // Transfer payout (CEI: effects before interactions)
        if (payout > 0) {
            rateToken.safeTransfer(msg.sender, payout);
        }

        emit WinningsClaimed(marketId, msg.sender, payout);

        return payout;
    }

    // =========================================================================
    // VIEWS: ODDS & PRICING
    // =========================================================================

    /// @notice Get current odds (percentage in basis points).
    /// @param marketId Market to query.
    /// @return yesOdds Probability YES wins (0-10000 basis points).
    /// @return noOdds Probability NO wins (0-10000 basis points).
    function getOdds(uint256 marketId)
        external
        view
        returns (uint256 yesOdds, uint256 noOdds)
    {
        Market storage market = markets[marketId];
        uint256 total = market.poolYes + market.poolNo; // D: D18{outcome_tok} + D18{outcome_tok} → D18{outcome_tok} ✓

        if (total == 0) {
            yesOdds = 5000; // D: D0{bps}
            noOdds = 5000;  // D: D0{bps}
        } else {
            yesOdds = (market.poolYes * 10000) / total; // D: D18{outcome_tok} * D0{bps} / D18{outcome_tok} → D0{bps} ✓
            noOdds = (market.poolNo * 10000) / total; // D: D18{outcome_tok} * D0{bps} / D18{outcome_tok} → D0{bps} ✓
        }
    }

    /// @notice Get user's position in a market.
    function getPosition(uint256 marketId, address user)
        external
        view
        returns (uint256 yesTokens, uint256 noTokens)
    {
        Position storage pos = positions[marketId][user];
        return (pos.yesTokens, pos.noTokens);
    }
}
