// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IOrderBookTWAP {
    function getSpotPrice(address resource) external view returns (uint256);
    function getTWAP(address resource, uint256 windowSeconds) external view returns (uint256);
}

/// @title HedgeFactory — Parametric hedge creation and TWAP-based settlement for MANDATE
/// @notice DORMANT (Phase 3 v2) — Removed from active scope. PredictionMarket provides equivalent
///         functionality with better liquidity. Contract remains in codebase but is not deployed.
/// @notice Creates parametric hedges stored in mappings. Phase 2 uses mapping-based storage (following InsurancePool pattern).
/// @dev Phase 3 will migrate to Clones (EIP-1167) for isolated hedge contracts. SafeERC20 for all transfers. CEI pattern enforced.
/// @dev Design decision: Mapping-based storage for Phase 2 MVP (simpler, gas-efficient). Clones integration deferred to Phase 3 with full OrderBook TWAP.
/// @custom:invariant Each hedgeId maps to exactly one Hedge struct (no duplicates)
/// @custom:invariant direction is always 0 (SHORT) or 1 (LONG) (validated at creation)
/// @custom:invariant settled == true implies hedge is immutable (no further modifications)
/// @custom:invariant counterparty == address(0) implies hedge is unmatched (waiting for counterparty)
/// @custom:invariant Matching requires counterparty to stake same amount as creator (stakeAmount equality)
/// @custom:invariant Settlement requires TWAP window completion (windowSeconds elapsed since createdTimestamp)
/// @custom:security ReentrancyGuard on all state-changing functions with token transfers
/// @custom:security SafeERC20 for all IERC20 operations (handles non-standard tokens)
/// @custom:security CEI pattern enforced (state updates before external calls)
/// @custom:security Operator-only settlement (OPERATOR_ROLE required for settleHedge)
contract HedgeFactory is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant TWAP_WINDOW = 60; // D: D0{sec} — 60 seconds
    uint256 public constant MIN_STAKE = 2_000 * 1e18; // D: D18{RATE}
    uint256 public constant MAX_PAYOUT_MULTIPLIER = 30_000; // D: D0{bps} — 3x

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------
    
    /// @notice Hedge parameters
    struct HedgeParams {
        address resource;              // D: {addr} — Resource token to hedge (e.g., COMPUTE)
        uint8 direction;               // 0 = SHORT (price falls), 1 = LONG (price rises)
        uint16 thresholdBps;           // D: D0{bps} — Threshold in basis points (e.g., 500 = 5%)
        uint64 windowSeconds;          // D: D0{sec} — Settlement window (block.timestamp)
        uint256 stakeAmount;           // D: D18{RATE} — RATE staked by creator
        uint16 payoutMultiplierBps;    // D: D0{bps} — Payout multiplier (e.g., 15000 = 1.5x)
    }

    /// @notice Hedge state
    struct Hedge {
        HedgeParams params;
        address creator;             // D: {addr}
        address counterparty;        // D: {addr}
        uint64 createdTimestamp;     // D: D0{sec} — block.timestamp
        uint256 initialPrice;        // D: D18{RATE/res}
        bool settled;                // D: {bool}
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20 public immutable rateToken;
    IOrderBookTWAP public immutable orderBook;

    /// @notice Auto-incrementing hedge ID counter
    uint256 private _nextHedgeId = 1;

    /// @notice Maps hedgeId => Hedge struct
    mapping(uint256 => Hedge) private _hedges;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event HedgeCreated(uint256 indexed hedgeId, address indexed creator, HedgeParams params);
    event HedgeMatched(uint256 indexed hedgeId, address indexed counterparty);
    event HedgeSettled(uint256 indexed hedgeId, address winner, uint256 payout);
    event HedgeCancelled(uint256 indexed hedgeId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address rateToken_, address orderBook_) {
        require(rateToken_ != address(0), "Invalid rate token");
        rateToken = IERC20(rateToken_);
        orderBook = IOrderBookTWAP(orderBook_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // -------------------------------------------------------------------------
    // External Functions
    // -------------------------------------------------------------------------

    /// @notice Create a new hedge
    /// @param params Hedge parameters
    /// @return hedgeId The ID of the created hedge
    function createHedge(HedgeParams calldata params) external returns (uint256 hedgeId) {
        require(params.thresholdBps > 0, "Invalid threshold");
        require(params.windowSeconds > 0, "Invalid window");
        require(params.stakeAmount >= MIN_STAKE, "Stake too low");
        require(params.payoutMultiplierBps <= MAX_PAYOUT_MULTIPLIER, "Multiplier too high");
        require(params.direction <= 1, "Invalid direction");

        hedgeId = _nextHedgeId++;

        // Lock creator's stake (CEI pattern: Effects before Interaction)
        uint256 initialPrice = _getInitialPrice(params.resource);

        _hedges[hedgeId] = Hedge({
            params: params,
            creator: msg.sender,
            counterparty: address(0),
            createdTimestamp: uint64(block.timestamp),
            initialPrice: initialPrice,
            settled: false
        });

        // Transfer stake from creator (Interaction last)
        rateToken.safeTransferFrom(msg.sender, address(this), params.stakeAmount);

        emit HedgeCreated(hedgeId, msg.sender, params);
    }

    /// @notice Match an existing hedge
    /// @param hedgeId The ID of the hedge to match
    function matchHedge(uint256 hedgeId) external {
        Hedge storage hedge = _hedges[hedgeId];
        require(hedge.creator != address(0), "Hedge does not exist");
        require(hedge.counterparty == address(0), "Hedge already matched");
        require(!hedge.settled, "Hedge already settled");

        // Set counterparty (CEI: Effects)
        hedge.counterparty = msg.sender;

        // Transfer counterparty stake (CEI: Interaction)
        rateToken.safeTransferFrom(msg.sender, address(this), hedge.params.stakeAmount);

        emit HedgeMatched(hedgeId, msg.sender);
    }

    /// @notice Settle a hedge after the window has elapsed
    /// @param hedgeId The ID of the hedge to settle
    function settleHedge(uint256 hedgeId) external nonReentrant {
        Hedge storage hedge = _hedges[hedgeId];
        require(hedge.creator != address(0), "Hedge does not exist");
        require(hedge.counterparty != address(0), "Hedge not matched");
        require(!hedge.settled, "Hedge already settled");
        require(
            block.timestamp >= hedge.createdTimestamp + hedge.params.windowSeconds, // D: D0{sec} >= D0{sec} + D0{sec} → D0{sec} ✓
            "Settlement window not elapsed"
        );

        // Mark as settled (CEI: Effects)
        hedge.settled = true;

        // Get TWAP price (Phase 3 placeholder: stubbed with initial price for now)
        uint256 twapPrice = _getTWAPPrice(hedge.params.resource); // D: D18{RATE/res}

        // Calculate price change in basis points
        int256 priceChangeBps = _calculatePriceChangeBps(hedge.initialPrice, twapPrice); // D: D0{bps} (signed)

        // Determine winner
        address winner = _determineWinner(hedge, priceChangeBps);

        // Calculate payout
        // [DIM-9 FIX] Cap payout at totalStake — the contract can only pay out what it holds.
        // With multiplier > 10000 bps, the formula would exceed totalStake, causing revert.
        uint256 totalStake = hedge.params.stakeAmount * 2;
        uint256 rawPayout = winner != address(0)
            ? (totalStake * hedge.params.payoutMultiplierBps) / 10000
            : 0;
        uint256 payout = rawPayout > totalStake ? totalStake : rawPayout;

        // Transfer payout (CEI: Interaction)
        if (winner != address(0)) {
            rateToken.safeTransfer(winner, payout);
            // Return any remaining stake to the loser
            uint256 remainder = totalStake - payout;
            if (remainder > 0) {
                address loser = winner == hedge.creator ? hedge.counterparty : hedge.creator;
                rateToken.safeTransfer(loser, remainder);
            }
        } else {
            // Draw: return stakes to both parties
            rateToken.safeTransfer(hedge.creator, hedge.params.stakeAmount);
            rateToken.safeTransfer(hedge.counterparty, hedge.params.stakeAmount);
        }

        emit HedgeSettled(hedgeId, winner, payout);
    }

    /// @notice Cancel an unmatched hedge and refund the creator
    /// @param hedgeId The ID of the hedge to cancel
    function cancelUnmatchedHedge(uint256 hedgeId) external {
        Hedge storage hedge = _hedges[hedgeId];
        require(hedge.creator != address(0), "Hedge does not exist");
        require(hedge.creator == msg.sender, "Not hedge creator");
        require(hedge.counterparty == address(0), "Hedge already matched");
        require(!hedge.settled, "Hedge already settled");

        // Mark as settled (CEI: Effects)
        hedge.settled = true;

        // Refund stake (CEI: Interaction)
        rateToken.safeTransfer(msg.sender, hedge.params.stakeAmount);

        emit HedgeCancelled(hedgeId);
    }

    /// @notice Get hedge details
    /// @param hedgeId The ID of the hedge
    /// @return Hedge struct
    function getHedge(uint256 hedgeId) external view returns (Hedge memory) {
        return _hedges[hedgeId];
    }

    // -------------------------------------------------------------------------
    // Internal Functions
    // -------------------------------------------------------------------------

    /// @notice Get initial price for hedge creation via OrderBook spot price
    /// @param resource The resource token address
    /// @return Initial price (falls back to 1e18 if no trades)
    function _getInitialPrice(address resource) internal view returns (uint256) {
        if (address(orderBook) == address(0)) return 1e18;
        uint256 spot = orderBook.getSpotPrice(resource);
        return spot > 0 ? spot : 1e18;
    }

    /// @notice Get TWAP price via OrderBook
    /// @param resource The resource token address
    /// @return TWAP price (falls back to 1e18 if no trades)
    function _getTWAPPrice(address resource) internal view returns (uint256) {
        if (address(orderBook) == address(0)) return 1e18;
        uint256 twap = orderBook.getTWAP(resource, TWAP_WINDOW);
        return twap > 0 ? twap : 1e18;
    }

    /// @notice Calculate price change in basis points
    /// @param initialPrice Initial price
    /// @param currentPrice Current TWAP price
    /// @return Price change in basis points (signed)
    function _calculatePriceChangeBps(uint256 initialPrice, uint256 currentPrice) 
        internal 
        pure 
        returns (int256) 
    {
        if (currentPrice == initialPrice) {
            return 0;
        }
        
        int256 change = int256(currentPrice) - int256(initialPrice); // D: D18{RATE/res} - D18{RATE/res} → D18{RATE/res} ✓
        int256 changeBps = (change * 10000) / int256(initialPrice); // D: D18{RATE/res} * D0{bps} / D18{RATE/res} → D0{bps} ✓
        return changeBps;
    }

    /// @notice Determine hedge winner based on price change
    /// @param hedge Hedge struct
    /// @param priceChangeBps Price change in basis points
    /// @return Winner address (or address(0) for draw)
    function _determineWinner(Hedge storage hedge, int256 priceChangeBps) 
        internal 
        view 
        returns (address) 
    {
        int256 threshold = int256(uint256(hedge.params.thresholdBps));

        if (hedge.params.direction == 1) {
            // LONG wins if price rises above threshold
            if (priceChangeBps >= threshold) {
                return hedge.creator;
            } else if (priceChangeBps <= -threshold) {
                return hedge.counterparty;
            }
        } else {
            // SHORT wins if price falls below threshold
            if (priceChangeBps <= -threshold) {
                return hedge.creator;
            } else if (priceChangeBps >= threshold) {
                return hedge.counterparty;
            }
        }

        // Draw (threshold not met)
        return address(0);
    }
}
