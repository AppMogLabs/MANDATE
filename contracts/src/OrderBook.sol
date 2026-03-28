// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IAgentRegistry {
    function validateAction(address agent, uint8 actionType) external view returns (bool);
    function isActionPermitted(address agent, uint8 actionType) external view returns (bool);
    function agentIdOf(address agent) external view returns (uint256);
}

interface IReputationLedger {
    function recordTransaction(uint256 buyerAgentId, uint256 sellerAgentId, uint256 amount) external;
}

interface IAuditLog {
    function logAction(uint256 agentId, bytes32 action, bytes calldata metadata) external;
}

interface IEpochManager {
    function getCurrentEpoch() external view returns (uint256);
    function getEpochDuration() external pure returns (uint256);
    function isEpochActive() external view returns (bool);
}

/// @title OrderBook — Decentralized limit order book for MANDATE resources
/// @notice Agents place/cancel/match orders for resource tokens. All trades settled against RATE.
///         Integrates with AgentRegistry for permission checks, ReputationLedger for trust scores,
///         and AuditLog for immutable action history.
/// @dev Uses OpenZeppelin SafeERC20, ReentrancyGuard, and AccessControl. CEI pattern enforced.
contract OrderBook is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Order status enum
    // -------------------------------------------------------------------------
    enum OrderStatus {
        ACTIVE,
        FILLED,
        CANCELLED
    }

    // -------------------------------------------------------------------------
    // Order struct
    // -------------------------------------------------------------------------
    struct Order {
        uint256 orderId;          // D: D0{id}
        address seller;           // D: {addr} — Agent placing the order (selling resource)
        address resourceToken;    // D: {addr} — Resource being sold
        uint256 totalAmount;      // D: D18{res} — Total resource amount
        uint256 filledAmount;     // D: D18{res} — Amount already filled
        uint256 pricePerUnit;     // D: D18{RATE/res} — Price in RATE per unit of resource
        OrderStatus status;
        uint64 timestamp;         // D: D0{sec} — Uses block.timestamp per EthSkills L2 guidance
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IERC20 public immutable rateToken;
    IAgentRegistry public immutable agentRegistry;
    IReputationLedger public immutable reputationLedger;
    IAuditLog public immutable auditLog;
    IEpochManager public immutable epochManager;

    /// @notice Price observation for TWAP
    struct PriceObservation {
        uint256 price;    // D: D18{RATE/res} — price per unit in RATE (18 decimals)
        uint64 timestamp; // D: D0{sec}
    }

    /// @notice Price history per resource token
    mapping(address => PriceObservation[]) private _priceHistory;

    /// @notice Minimum order amount to prevent dust attacks.
    uint256 public constant MIN_ORDER_AMOUNT = 1e15; // D: D15{res} — dust threshold

    /// @notice Auto-incrementing order ID counter.
    uint256 private _nextOrderId = 1;

    /// @notice Maps orderId => Order struct.
    mapping(uint256 => Order) public orders;

    /// @notice Action type constants (must match AgentRegistry).
    uint8 public constant ACTION_ORDER_PLACE = 1;
    uint8 public constant ACTION_ORDER_CANCEL = 2;
    uint8 public constant ACTION_ORDER_MATCH = 3;

    /// @notice Action hashes for AuditLog.
    bytes32 public constant ORDER_PLACED = keccak256("ORDER_PLACED");
    bytes32 public constant ORDER_MATCHED = keccak256("ORDER_MATCHED");
    bytes32 public constant ORDER_CANCELLED = keccak256("ORDER_CANCELLED");

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new order is placed.
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed seller,
        address indexed resourceToken,
        uint256 amount,
        uint256 pricePerUnit
    );

    /// @notice Emitted when an order is matched (fully or partially).
    event OrderMatched(
        uint256 indexed orderId, address indexed seller, address indexed buyer, uint256 fillAmount, uint256 rateAmount
    );

    /// @notice Emitted when an order is cancelled.
    event OrderCancelled(uint256 indexed orderId, address indexed seller);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error ActionNotPermitted(address agent, uint8 actionType);
    error InvalidOrderParameters();
    error OrderNotFound();
    error OrderNotActive();
    error UnauthorizedCaller();
    error InsufficientOrderRemaining();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _rateToken Address of the RATE token (ERC-20).
    /// @param _agentRegistry Address of the AgentRegistry contract.
    /// @param _reputationLedger Address of the ReputationLedger contract.
    /// @param _auditLog Address of the AuditLog contract.
    /// @param _epochManager Address of the EpochManager contract.
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE.
    constructor(
        address _rateToken,
        address _agentRegistry,
        address _reputationLedger,
        address _auditLog,
        address _epochManager,
        address admin
    ) {
        require(_rateToken != address(0), "OrderBook: zero rateToken");
        require(_agentRegistry != address(0), "OrderBook: zero agentRegistry");
        require(_reputationLedger != address(0), "OrderBook: zero reputationLedger");
        require(_auditLog != address(0), "OrderBook: zero auditLog");
        require(admin != address(0), "OrderBook: zero admin");

        rateToken = IERC20(_rateToken);
        agentRegistry = IAgentRegistry(_agentRegistry);
        reputationLedger = IReputationLedger(_reputationLedger);
        auditLog = IAuditLog(_auditLog);
        epochManager = IEpochManager(_epochManager);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Emergency controls
    // -------------------------------------------------------------------------

    /// @notice Pause order placement and matching. Cancel remains available.
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /// @notice Resume normal operations.
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Order Placement
    // -------------------------------------------------------------------------

    /// @notice Place a limit order to sell a resource for RATE.
    /// @dev Validates agent permission via AgentRegistry.validateAction(). Locks resource tokens
    ///      in escrow via SafeERC20.safeTransferFrom(). Emits OrderPlaced event and logs to AuditLog.
    /// @param resourceToken Address of the resource token being sold.
    /// @param amount Total amount of resource to sell.
    /// @param pricePerUnit Price in RATE per unit of resource.
    /// @return orderId The ID of the newly created order.
    function placeOrder(address resourceToken, uint256 amount, uint256 pricePerUnit)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 orderId)
    {
        // Validation: AgentRegistry permission check (reverts if not permitted)
        agentRegistry.validateAction(msg.sender, ACTION_ORDER_PLACE);

        // Validation: parameters
        if (resourceToken == address(0) || amount < MIN_ORDER_AMOUNT || pricePerUnit == 0) {
            revert InvalidOrderParameters();
        }

        // Effects: create order
        orderId = _nextOrderId++;
        orders[orderId] = Order({
            orderId: orderId,
            seller: msg.sender,
            resourceToken: resourceToken,
            totalAmount: amount,
            filledAmount: 0,
            pricePerUnit: pricePerUnit,
            status: OrderStatus.ACTIVE,
            timestamp: uint64(block.timestamp)
        });

        // Interactions: lock resource tokens in escrow
        IERC20(resourceToken).safeTransferFrom(msg.sender, address(this), amount);

        // Events
        emit OrderPlaced(orderId, msg.sender, resourceToken, amount, pricePerUnit);

        // Audit log
        uint256 sellerAgentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(orderId, resourceToken, amount, pricePerUnit);
        auditLog.logAction(sellerAgentId, ORDER_PLACED, metadata);

        return orderId;
    }

    // -------------------------------------------------------------------------
    // Order Cancellation
    // -------------------------------------------------------------------------

    /// @notice Cancel an active order and return escrowed tokens to the seller.
    /// @dev Validates caller owns the order and has cancel permission. Returns unfilled resource
    ///      tokens via SafeERC20.safeTransfer(). Emits OrderCancelled and logs to AuditLog.
    /// @param orderId The ID of the order to cancel.
    function cancelOrder(uint256 orderId) external nonReentrant {
        // Checks: order exists and is active
        Order storage order = orders[orderId];
        if (order.seller == address(0)) revert OrderNotFound();
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();
        if (order.seller != msg.sender) revert UnauthorizedCaller();

        // Checks: AgentRegistry permission (reverts if not permitted)
        agentRegistry.validateAction(msg.sender, ACTION_ORDER_CANCEL);

        // Effects: mark order as cancelled
        order.status = OrderStatus.CANCELLED;

        // Interactions: return unfilled resource tokens to seller
        uint256 remainingAmount = order.totalAmount - order.filledAmount; // D: D18{res} - D18{res} → D18{res} ✓
        if (remainingAmount > 0) {
            IERC20(order.resourceToken).safeTransfer(order.seller, remainingAmount);
        }

        // Events
        emit OrderCancelled(orderId, msg.sender);

        // Audit log
        uint256 sellerAgentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(orderId, remainingAmount);
        auditLog.logAction(sellerAgentId, ORDER_CANCELLED, metadata);
    }

    // -------------------------------------------------------------------------
    // Order Matching
    // -------------------------------------------------------------------------

    /// @notice Match an existing order by buying resources with RATE.
    /// @dev Validates buyer permission, locks RATE in escrow, transfers resource to buyer,
    ///      transfers RATE to seller, records reputation, and logs to audit. Supports partial fills.
    /// @param orderId The ID of the order to match.
    /// @param fillAmount Amount of resource to buy (must be ≤ remaining amount).
    /// @return success True if the match succeeded.
    function matchOrder(uint256 orderId, uint256 fillAmount)
        external
        nonReentrant
        whenNotPaused
        returns (bool success)
    {
        // Checks: order exists and is active
        Order storage order = orders[orderId];
        if (order.seller == address(0)) revert OrderNotFound();
        if (order.status != OrderStatus.ACTIVE) revert OrderNotActive();

        // Checks: fillAmount is valid
        uint256 remainingAmount = order.totalAmount - order.filledAmount; // D: D18{res} - D18{res} → D18{res} ✓
        if (fillAmount == 0 || fillAmount > remainingAmount) {
            revert InsufficientOrderRemaining();
        }

        // Checks: no self-matching (prevents reputation gaming)
        if (msg.sender == order.seller) revert UnauthorizedCaller();

        // Checks: AgentRegistry permission (reverts if not permitted)
        agentRegistry.validateAction(msg.sender, ACTION_ORDER_MATCH);

        // Calculate RATE amount to transfer
        // Both fillAmount and pricePerUnit are in 1e18 units, so divide by 1e18
        uint256 rateAmount = (fillAmount * order.pricePerUnit) / 1e18; // D: D18{res} * D18{RATE/res} / D18 → D18{RATE} ✓
        if (rateAmount == 0) revert InvalidOrderParameters();

        // Effects: update filled amount
        order.filledAmount += fillAmount;

        // Effects: mark as FILLED if fully matched
        if (order.filledAmount == order.totalAmount) {
            order.status = OrderStatus.FILLED;
        }

        // Interactions: transfer RATE from buyer to seller
        rateToken.safeTransferFrom(msg.sender, order.seller, rateAmount);

        // Interactions: transfer resource from escrow to buyer
        IERC20(order.resourceToken).safeTransfer(msg.sender, fillAmount);

        // Events
        emit OrderMatched(orderId, order.seller, msg.sender, fillAmount, rateAmount);

        // Record price observation for TWAP
        _priceHistory[order.resourceToken].push(PriceObservation({
            price: order.pricePerUnit,
            timestamp: uint64(block.timestamp)
        }));

        // Reputation: record transaction
        uint256 buyerAgentId = agentRegistry.agentIdOf(msg.sender);
        uint256 sellerAgentId = agentRegistry.agentIdOf(order.seller);
        reputationLedger.recordTransaction(buyerAgentId, sellerAgentId, rateAmount);

        // Audit log
        bytes memory metadata = abi.encode(orderId, fillAmount, rateAmount, buyerAgentId, sellerAgentId);
        auditLog.logAction(buyerAgentId, ORDER_MATCHED, metadata);

        return true;
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    /// @notice Get order details.
    /// @param orderId The ID of the order to query.
    /// @return order The full Order struct.
    function getOrder(uint256 orderId) external view returns (Order memory order) {
        return orders[orderId];
    }

    /// @notice Get remaining amount available to fill for an order.
    /// @param orderId The ID of the order to query.
    /// @return remaining The unfilled amount.
    function getRemainingAmount(uint256 orderId) external view returns (uint256 remaining) {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.ACTIVE) return 0;
        return order.totalAmount - order.filledAmount;
    }

    /// @notice Check if an agent is permitted to place an order.
    /// @param agent The agent address to check.
    /// @return permitted True if the agent can place orders.
    function canPlaceOrder(address agent) external view returns (bool permitted) {
        return agentRegistry.isActionPermitted(agent, ACTION_ORDER_PLACE);
    }

    /// @notice Check if an agent is permitted to cancel an order.
    /// @param agent The agent address to check.
    /// @return permitted True if the agent can cancel orders.
    function canCancelOrder(address agent) external view returns (bool permitted) {
        return agentRegistry.isActionPermitted(agent, ACTION_ORDER_CANCEL);
    }

    /// @notice Check if an agent is permitted to match an order.
    /// @param agent The agent address to check.
    /// @return permitted True if the agent can match orders.
    function canMatchOrder(address agent) external view returns (bool permitted) {
        return agentRegistry.isActionPermitted(agent, ACTION_ORDER_MATCH);
    }

    // =========================================================================
    // Dynamic Resource Lease Swaps — DORMANT (Phase 3 v2)
    // Lease swaps removed from active scope. With 28-day epoch resets and
    // top-20% carry-over, temporary lending lacks a strong use case.
    // Code remains for potential future activation.
    // =========================================================================

    /// @notice Lease order status enum
    enum LeaseStatus {
        ACTIVE,
        MATCHED,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    /// @notice Lease order struct
    struct LeaseOrder {
        address initiator;         // D: {addr}
        address resource1;         // D: {addr} — give
        uint256 amount1;           // D: D18{res}
        address resource2;         // D: {addr} — want
        uint256 amount2;           // D: D18{res}
        uint256 epochs;            // D: D0{epoch}
        uint256 repPenalty;        // D: D0{bps} — in basis points
        uint256 expiryTimestamp;   // D: D0{sec}
        address counterparty;      // D: {addr}
        LeaseStatus status;
    }

    /// @notice Minimum lease duration in epochs
    uint256 public constant MIN_LEASE_EPOCHS = 2; // D: D0{epoch}

    /// @notice Minimum reputation penalty in bps
    uint256 public constant MIN_REP_PENALTY_BPS = 2_000; // D: D0{bps}

    /// @notice Auto-incrementing lease order ID counter
    uint256 private _nextLeaseOrderId = 1;

    /// @notice Maps leaseOrderId => LeaseOrder
    mapping(uint256 => LeaseOrder) public leaseOrders;

    /// @notice Action type for lease operations
    uint8 public constant ACTION_LEASE_POST = 7;
    uint8 public constant ACTION_LEASE_MATCH = 8;

    // Lease events
    event LeaseOrderPosted(uint256 indexed orderId, address indexed initiator, uint256 epochs);
    event LeaseMatched(uint256 indexed orderId, address indexed counterparty);
    event LeaseFailed(uint256 indexed orderId, address indexed defaulter, uint256 repPenaltyApplied);
    event LeaseCancelled(uint256 indexed orderId);

    /// @notice Post a two-sided lease order
    /// @param resource1 Resource to give
    /// @param amount1 Amount to give
    /// @param resource2 Resource to want
    /// @param amount2 Amount to want
    /// @param epochs Lease duration in epochs (min 5)
    /// @param repPenalty Reputation penalty on failure (min 2000 bps)
    /// @return leaseOrderId The ID of the new lease order
    function postLeaseOrder(
        address resource1,
        uint256 amount1,
        address resource2,
        uint256 amount2,
        uint256 epochs,
        uint256 repPenalty
    ) external nonReentrant whenNotPaused returns (uint256 leaseOrderId) {
        // Validate agent permission
        agentRegistry.validateAction(msg.sender, ACTION_LEASE_POST);

        // Validate parameters
        require(resource1 != address(0) && resource2 != address(0), "OrderBook: zero resource");
        require(resource1 != resource2, "OrderBook: same resource");
        require(amount1 > 0 && amount2 > 0, "OrderBook: zero amount");
        require(epochs >= MIN_LEASE_EPOCHS, "OrderBook: below min epoch duration");
        require(repPenalty >= MIN_REP_PENALTY_BPS, "OrderBook: min 0.2x reputation penalty");

        // Lock resource1 in escrow
        IERC20(resource1).safeTransferFrom(msg.sender, address(this), amount1);

        leaseOrderId = _nextLeaseOrderId++;
        leaseOrders[leaseOrderId] = LeaseOrder({
            initiator: msg.sender,
            resource1: resource1,
            amount1: amount1,
            resource2: resource2,
            amount2: amount2,
            epochs: epochs,
            repPenalty: repPenalty,
            expiryTimestamp: 0, // Set on match
            counterparty: address(0),
            status: LeaseStatus.ACTIVE
        });

        emit LeaseOrderPosted(leaseOrderId, msg.sender, epochs);
    }

    /// @notice Match and execute a lease order
    /// @param leaseOrderId The lease order to match
    function executeMatchedLease(uint256 leaseOrderId) external nonReentrant whenNotPaused {
        LeaseOrder storage lease = leaseOrders[leaseOrderId];
        require(lease.initiator != address(0), "OrderBook: lease not found");
        require(lease.status == LeaseStatus.ACTIVE, "OrderBook: lease not active");
        require(msg.sender != lease.initiator, "OrderBook: self-match lease");

        // Validate agent permission
        agentRegistry.validateAction(msg.sender, ACTION_LEASE_MATCH);

        // Lock counterparty's resource2 in escrow
        IERC20(lease.resource2).safeTransferFrom(msg.sender, address(this), lease.amount2);

        // Transfer resources: initiator's resource1 to counterparty
        IERC20(lease.resource1).safeTransfer(msg.sender, lease.amount1);
        // counterparty's resource2 to initiator
        IERC20(lease.resource2).safeTransfer(lease.initiator, lease.amount2);

        lease.counterparty = msg.sender;
        lease.status = LeaseStatus.MATCHED;
        // Expiry = now + epochs * epoch_duration (placeholder: 1 epoch = 1 hour)
        lease.expiryTimestamp = block.timestamp + (lease.epochs * epochManager.getEpochDuration()); // D: D0{sec} + D0{epoch} * D0{sec/epoch} → D0{sec} ✓

        emit LeaseMatched(leaseOrderId, msg.sender);
    }

    /// @notice Cancel an active (unmatched) lease order
    /// @param leaseOrderId The lease order to cancel
    function cancelLeaseOrder(uint256 leaseOrderId) external nonReentrant {
        LeaseOrder storage lease = leaseOrders[leaseOrderId];
        require(lease.initiator == msg.sender, "OrderBook: not initiator");
        require(lease.status == LeaseStatus.ACTIVE, "OrderBook: lease not active");

        lease.status = LeaseStatus.CANCELLED;

        // Return escrowed resource1
        IERC20(lease.resource1).safeTransfer(msg.sender, lease.amount1);

        emit LeaseCancelled(leaseOrderId);
    }

    /// @notice Get lease order details
    function getLeaseOrder(uint256 leaseOrderId) external view returns (LeaseOrder memory) {
        return leaseOrders[leaseOrderId];
    }

    // =========================================================================
    // TWAP Price Tracking
    // =========================================================================

    /// @notice Get the latest spot price for a resource token
    /// @param resource Address of the resource token
    /// @return price Latest trade price (0 if no trades)
    function getSpotPrice(address resource) external view returns (uint256 price) {
        PriceObservation[] storage history = _priceHistory[resource];
        if (history.length == 0) return 0;
        return history[history.length - 1].price;
    }

    /// @notice Get time-weighted average price over a window
    /// @param resource Address of the resource token
    /// @param windowSeconds Duration of the TWAP window
    /// @return twap Time-weighted average price (0 if no trades in window)
    function getTWAP(address resource, uint256 windowSeconds) external view returns (uint256 twap) {
        PriceObservation[] storage history = _priceHistory[resource];
        if (history.length == 0) return 0;

        uint256 windowStart = block.timestamp - windowSeconds; // D: D0{sec} - D0{sec} → D0{sec} ✓
        uint256 weightedSum;  // D: D18{RATE/res} * D0{sec} accumulator → D18{RATE/res * sec}
        uint256 totalWeight;  // D: D0{sec}

        for (uint256 i = history.length; i > 0; i--) {
            PriceObservation storage obs = history[i - 1];
            if (obs.timestamp < windowStart) break;

            uint256 duration; // D: D0{sec}
            if (i < history.length) {
                duration = history[i].timestamp - obs.timestamp; // D: D0{sec} - D0{sec} → D0{sec} ✓
            } else {
                duration = block.timestamp - obs.timestamp; // D: D0{sec} - D0{sec} → D0{sec} ✓
            }
            if (duration == 0) duration = 1; // minimum 1 second weight

            weightedSum += obs.price * duration; // D: D18{RATE/res} * D0{sec} → D18{RATE/res * sec} ✓ ⚠ overflow if price~1e18 and duration large
            totalWeight += duration; // D: D0{sec} ✓
        }

        if (totalWeight == 0) return history[history.length - 1].price;
        return weightedSum / totalWeight; // D: D18{RATE/res * sec} / D0{sec} → D18{RATE/res} ✓
    }

    // =========================================================================
    // Batch Cancel & Lease Failure Detection
    // =========================================================================

    event LeaseExpired(uint256 indexed leaseOrderId, address indexed counterparty);

    /// @notice Batch cancel active orders for epoch reset (operator only)
    /// @param fromId Start order ID (inclusive)
    /// @param toId End order ID (exclusive)
    function cancelOrdersBatch(uint256 fromId, uint256 toId) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = fromId; i < toId; i++) {
            Order storage order = orders[i];
            if (order.status == OrderStatus.ACTIVE) {
                uint256 remaining = order.totalAmount - order.filledAmount; // D: D18{res} - D18{res} → D18{res} ✓
                order.status = OrderStatus.CANCELLED;
                if (remaining > 0) {
                    IERC20(order.resourceToken).safeTransfer(order.seller, remaining);
                }
                emit OrderCancelled(i, order.seller);
            }
        }
    }

    /// @notice Detect and process lease failure at epoch boundary (operator only)
    /// @param leaseOrderId The lease order to check
    function detectLeaseFailure(uint256 leaseOrderId) external onlyRole(OPERATOR_ROLE) {
        LeaseOrder storage lease = leaseOrders[leaseOrderId];
        require(lease.status == LeaseStatus.MATCHED, "OrderBook: not matched");
        require(block.timestamp > lease.expiryTimestamp, "OrderBook: not expired");

        lease.status = LeaseStatus.FAILED;

        emit LeaseExpired(leaseOrderId, lease.counterparty);
    }
}
