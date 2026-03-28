// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title InformationMarket — Three-tier subscription system for MANDATE intelligence
/// @notice Gates premium data access behind paid RATE subscriptions.
/// @dev Subscriptions are time-limited, paid in RATE (burned immediately), and enforced via tier checks.
contract InformationMarket is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // CONSTANTS & STORAGE
    // =========================================================================

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant SUBSCRIPTION_DURATION = 1 days;
    uint256 public constant ANALYST_PRICE = 150 * 1e18;
    uint256 public constant PREMIUM_PRICE = 1_000 * 1e18;

    // Tier definitions
    uint8 constant TIER_FREE = 0;
    uint8 constant TIER_ANALYST = 1;
    uint8 constant TIER_PREMIUM = 2;

    /// @notice RATE token address (payment currency).
    IERC20 public rateToken;

    /// @notice Subscription state for each user.
    /// @dev Tier 0 (free) is always accessible without subscription. Tier 1+ requires active subscription.
    struct Subscription {
        uint8 tier; // 0 (free), 1 (analyst), 2 (premium)
        uint64 expiryTimestamp; // block.timestamp of subscription expiry
    }

    /// @notice User subscriptions.
    mapping(address => Subscription) public subscriptions;

    /// @notice Tier pricing in RATE tokens (18 decimals).
    mapping(uint8 => uint256) public tierPrices;

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a user purchases a subscription.
    event SubscriptionPurchased(
        address indexed user,
        uint8 tier,
        uint64 expiryTimestamp
    );

    /// @notice Emitted when a user renews a subscription.
    event SubscriptionRenewed(address indexed user, uint64 newExpiryTimestamp);

    /// @notice Emitted when operator updates tier pricing.
    event TierPriceUpdated(uint8 indexed tier, uint256 newPrice);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error InsufficientTier();
    error InvalidTier();

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    /// @notice Deploy InformationMarket with initial tier prices.
    /// @param _rateToken Address of RATE token contract (must not be zero).
    /// @param _admin Address to receive DEFAULT_ADMIN_ROLE and OPERATOR_ROLE.
    constructor(address _rateToken, address _admin) {
        if (_rateToken == address(0)) revert("InformationMarket: zero rate token");
        if (_admin == address(0)) revert("InformationMarket: zero admin");

        rateToken = IERC20(_rateToken);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);

        // Initialize tier prices
        tierPrices[TIER_ANALYST] = ANALYST_PRICE;
        tierPrices[TIER_PREMIUM] = PREMIUM_PRICE;
    }

    // =========================================================================
    // PUBLIC FUNCTIONS
    // =========================================================================

    /// @notice Subscribe to a paid tier.
    /// @param tier Subscription tier (1 = Analyst, 2 = Premium).
    /// @dev Requires approval for RATE token transfer. Tier 0 (free) is automatic; do not call for free tier.
    /// @dev Follows CEI pattern: Checks -> Effects -> Interactions (via SafeERC20).
    function subscribe(uint8 tier) external nonReentrant {
        // Checks
        if (tier == TIER_FREE || tier > TIER_PREMIUM) {
            revert InvalidTier();
        }

        uint256 cost = tierPrices[tier];
        require(cost > 0, "InformationMarket: tier not configured");

        // Effects
        uint64 expiryTimestamp = uint64(block.timestamp + SUBSCRIPTION_DURATION); // D: D0{sec} + D0{sec} → D0{sec} ✓ ⚠ uint64 truncation safe until year 2554
        subscriptions[msg.sender] = Subscription({tier: tier, expiryTimestamp: expiryTimestamp});

        // Interactions (SafeERC20)
        rateToken.safeTransferFrom(msg.sender, address(this), cost); // D: transfer D18{RATE}
        ERC20Burnable(address(rateToken)).burn(cost); // D: burn D18{RATE}

        emit SubscriptionPurchased(msg.sender, tier, expiryTimestamp);
    }

    /// @notice Renew an existing subscription.
    /// @dev User must have an active subscription. Renewal extends current expiry by SUBSCRIPTION_DURATION.
    /// @dev If subscription expired, new expiry is max(currentExpiry, block.timestamp) + SUBSCRIPTION_DURATION.
    function renew() external nonReentrant {
        // Checks
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.tier > TIER_FREE, "InformationMarket: no subscription");

        uint256 cost = tierPrices[sub.tier];
        require(cost > 0, "InformationMarket: tier not configured");

        // Effects
        uint64 newExpiry = uint64(
            max(sub.expiryTimestamp, block.timestamp) + SUBSCRIPTION_DURATION // D: max(D0{sec}, D0{sec}) + D0{sec} → D0{sec} ✓
        );
        sub.expiryTimestamp = newExpiry;

        // Interactions (SafeERC20)
        rateToken.safeTransferFrom(msg.sender, address(this), cost); // D: transfer D18{RATE}
        ERC20Burnable(address(rateToken)).burn(cost); // D: burn D18{RATE}

        emit SubscriptionRenewed(msg.sender, newExpiry);
    }

    /// @notice Get the maximum tier a user can access.
    /// @param user Address to check.
    /// @return Tier 0 (free), 1 (analyst), or 2 (premium). Returns 0 if subscription expired or not subscribed.
    function getTierAccess(address user) external view returns (uint8) {
        Subscription storage sub = subscriptions[user];

        // Always grant free tier
        if (sub.tier == TIER_FREE) return TIER_FREE;

        // Check if subscription is active
        if (sub.expiryTimestamp >= block.timestamp) { // D: D0{sec} >= D0{sec} → bool ✓
            return sub.tier;
        }

        // Subscription expired
        return TIER_FREE;
    }

    /// @notice Check if a user has an active (non-expired) subscription.
    /// @param user Address to check.
    /// @return True if subscription exists and has not expired.
    function isSubscriptionActive(address user) external view returns (bool) {
        Subscription storage sub = subscriptions[user];
        return sub.tier > TIER_FREE && sub.expiryTimestamp >= block.timestamp;
    }

    /// @notice Get a user's subscription details.
    /// @param user Address to query.
    /// @return Subscription struct with tier and expiryTimestamp.
    function getSubscription(address user) external view returns (Subscription memory) {
        return subscriptions[user];
    }

    /// @notice Get the price of a subscription tier.
    /// @param tier Tier to query (1 = Analyst, 2 = Premium).
    /// @return Price in RATE tokens (18 decimals).
    function getTierPrice(uint8 tier) external view returns (uint256) {
        return tierPrices[tier];
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /// @notice Update the price of a subscription tier.
    /// @param tier Tier to update (1 = Analyst, 2 = Premium).
    /// @param priceInRate New price in RATE tokens (18 decimals).
    /// @dev Only OPERATOR_ROLE can call. Cannot update free tier (tier 0).
    function setTierPrice(uint8 tier, uint256 priceInRate)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (tier == TIER_FREE || tier > TIER_PREMIUM) {
            revert InvalidTier();
        }

        tierPrices[tier] = priceInRate;
        emit TierPriceUpdated(tier, priceInRate);
    }

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /// @notice Return the maximum of two uint256 values.
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
}
