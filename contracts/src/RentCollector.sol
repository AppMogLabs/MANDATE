// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRateTokenBurn {
    function burnFrom(address account, uint256 amount) external;
}

interface IMapRegistryRent {
    function getTileOwner(uint32 tileId) external view returns (address);
}

interface IBuildingRegistryRent {
    function demolishBatch(uint256[] calldata tokenIds) external;
}

/// @title RentCollector — Escalating tile rent collection for MANDATE
/// @notice Phase 2: Collects escalating daily rent in RATE tokens based on the number of tiles
///         an agent holds. Burns RATE on payment. Auto-releases tiles and demolishes buildings
///         when an agent fails to pay rent within the grace period.
/// @dev Rent escalates in tiers: the more tiles held, the higher the per-tile daily rate.
///      Agents must be registered for rent by an operator before the clock starts.
///      The grace period is 3 days (259,200 seconds). After that, an operator may evict.
/// @custom:invariant lastRentPaymentTimestamp is only set by registerForRent, payRent, or accrueDebt
/// @custom:invariant rentDebt is only increased by accrueDebt and cleared by payRent or evict
/// @custom:invariant RATE tokens collected as rent are burned immediately — never held in contract
/// @custom:security payRent() uses ReentrancyGuard and SafeERC20 for safe token transfer
/// @custom:security evict() requires OPERATOR_ROLE and enforces the grace period check
/// @custom:security All economic parameters are PHASE_3_PLACEHOLDER — values will be tuned
contract RentCollector is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Base daily rent per tile (100 RATE) — PHASE_3_PLACEHOLDER
    uint256 public constant BASE_TILE_RENT_DAILY = 100 * 1e18;

    /// @notice Grace period before eviction is allowed (3 days in seconds) — PHASE_3_PLACEHOLDER
    uint256 public constant RENT_GRACE_PERIOD = 259_200;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice Role for operators that can register agents, accrue debt, and evict
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    /// @notice The RATE token used for rent payments (ERC20 + ERC20Burnable)
    IERC20 public immutable rateToken;

    /// @notice The MapRegistry for tile ownership queries
    IMapRegistryRent public immutable mapRegistry;

    /// @notice The BuildingRegistry for demolishing buildings on eviction
    IBuildingRegistryRent public immutable buildingRegistry;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Timestamp of each agent's last rent payment (0 = not registered)
    mapping(address => uint256) public lastRentPaymentTimestamp;

    /// @notice Accumulated unpaid rent debt per agent
    mapping(address => uint256) public rentDebt;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when an agent pays rent
    event RentPaid(address indexed agent, uint256 amount, uint256 tilesCount);

    /// @notice Emitted when an agent is evicted for non-payment
    event AgentEvicted(address indexed agent, uint256 tilesReleased, uint256 buildingsDemolished);

    /// @notice Emitted when debt is accrued for an agent by an operator
    event DebtAccrued(address indexed agent, uint256 debtAmount);

    /// @notice Emitted when an agent is registered for rent tracking
    event AgentRegisteredForRent(address indexed agent);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NoRentOwed();
    error AgentNotRegistered();
    error GracePeriodNotExceeded();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice Deploys the RentCollector with immutable references to core contracts
    /// @param _rateToken Address of the RATE ERC20Burnable token
    /// @param _mapRegistry Address of the MapRegistry contract
    /// @param _buildingRegistry Address of the BuildingRegistry contract
    /// @param admin Address to receive DEFAULT_ADMIN_ROLE and OPERATOR_ROLE
    constructor(
        address _rateToken,
        address _mapRegistry,
        address _buildingRegistry,
        address admin
    ) {
        if (_rateToken == address(0)) revert ZeroAddress();
        if (_mapRegistry == address(0)) revert ZeroAddress();
        if (_buildingRegistry == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();

        rateToken = IERC20(_rateToken);
        mapRegistry = IMapRegistryRent(_mapRegistry);
        buildingRegistry = IBuildingRegistryRent(_buildingRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Returns the daily rent per tile based on how many tiles an agent holds
    /// @dev Escalating tiers — PHASE_3_PLACEHOLDER values
    /// @param tilesHeld Number of tiles the agent currently holds
    /// @return rentPerTile Daily rent per tile in RATE (18 decimals)
    function getRentPerTile(uint256 tilesHeld) public pure returns (uint256) {
        if (tilesHeld <= 3) {
            return 100 * 1e18;
        } else if (tilesHeld <= 5) {
            return 150 * 1e18;
        } else if (tilesHeld <= 10) {
            return 250 * 1e18;
        } else if (tilesHeld <= 15) {
            return 500 * 1e18;
        } else {
            // 16-20 and 20+ are both capped at 1000 RATE
            return 1_000 * 1e18;
        }
    }

    /// @notice Calculates total rent owed by an agent including any accrued debt
    /// @dev Returns 0 if the agent has never been registered (lastRentPaymentTimestamp == 0)
    /// @param agent Address of the agent
    /// @param tilesHeld Number of tiles the agent currently holds
    /// @return owed Total RATE owed (elapsed rent + outstanding debt)
    function calculateOwedRent(address agent, uint256 tilesHeld) public view returns (uint256) {
        uint256 lastPayment = lastRentPaymentTimestamp[agent];
        if (lastPayment == 0) {
            return 0;
        }

        uint256 elapsedDays = (block.timestamp - lastPayment) / 1 days; // D: D0{sec} - D0{sec} → D0{sec} / D0{sec/day} → D0{day} ✓
        uint256 rentPerTile = getRentPerTile(tilesHeld); // D: → D18{RATE/day/tile}
        uint256 periodRent = elapsedDays * tilesHeld * rentPerTile; // D: D0{day} * D0{count} * D18{RATE/day/tile} → D18{RATE} ✓

        return periodRent + rentDebt[agent]; // D: D18{RATE} + D18{RATE} → D18{RATE} ✓
    }

    // -------------------------------------------------------------------------
    // External Functions
    // -------------------------------------------------------------------------

    /// @notice Pay all outstanding rent. Burns the RATE tokens immediately.
    /// @dev Caller must have approved this contract for at least the owed amount of RATE.
    ///      Uses safeTransferFrom to pull RATE, then burns via ERC20Burnable.burn().
    /// @param tilesHeld Number of tiles the caller currently holds
    function payRent(uint256 tilesHeld) external nonReentrant {
        uint256 owed = calculateOwedRent(msg.sender, tilesHeld);
        if (owed == 0) revert NoRentOwed();

        // Pull RATE from the agent to this contract
        rateToken.safeTransferFrom(msg.sender, address(this), owed);

        // Burn the RATE from this contract's balance
        ERC20Burnable(address(rateToken)).burn(owed);

        // Update payment state
        lastRentPaymentTimestamp[msg.sender] = block.timestamp;
        rentDebt[msg.sender] = 0;

        emit RentPaid(msg.sender, owed, tilesHeld);
    }

    /// @notice Register an agent for rent tracking (starts the rent clock)
    /// @dev Only callable by OPERATOR_ROLE. Sets the initial payment timestamp to now.
    /// @param agent Address of the agent to register
    function registerForRent(address agent) external onlyRole(OPERATOR_ROLE) {
        lastRentPaymentTimestamp[agent] = block.timestamp;

        emit AgentRegisteredForRent(agent);
    }

    /// @notice Evict an agent for non-payment after the grace period has elapsed
    /// @dev Demolishes the agent's buildings and resets their rent state.
    ///      The operator must separately release tiles in the MapRegistry.
    /// @param agent Address of the agent to evict
    /// @param tileIds Array of tile IDs being released (used for event reporting)
    /// @param buildingTokenIds Array of building token IDs to demolish
    function evict(
        address agent,
        uint32[] calldata tileIds,
        uint256[] calldata buildingTokenIds
    ) external onlyRole(OPERATOR_ROLE) {
        uint256 lastPayment = lastRentPaymentTimestamp[agent];
        if (lastPayment == 0) revert AgentNotRegistered();
        if (block.timestamp <= lastPayment + RENT_GRACE_PERIOD) revert GracePeriodNotExceeded(); // D: D0{sec} <= D0{sec} + D0{sec} → D0{sec} ✓

        // Demolish all buildings on the evicted tiles
        buildingRegistry.demolishBatch(buildingTokenIds);

        // Reset rent state
        lastRentPaymentTimestamp[agent] = 0;
        rentDebt[agent] = 0;

        emit AgentEvicted(agent, tileIds.length, buildingTokenIds.length);
    }

    /// @notice Accrue outstanding rent as debt for an agent and reset the payment clock
    /// @dev Called by operators during periodic rent sweeps. Adds elapsed rent to the
    ///      agent's debt without requiring payment.
    /// @param agent Address of the agent
    /// @param tilesHeld Number of tiles the agent currently holds
    function accrueDebt(address agent, uint256 tilesHeld) external onlyRole(OPERATOR_ROLE) {
        uint256 lastPayment = lastRentPaymentTimestamp[agent];
        if (lastPayment == 0) revert AgentNotRegistered();

        uint256 elapsedDays = (block.timestamp - lastPayment) / 1 days; // D: D0{sec} - D0{sec} → D0{sec} / D0{sec/day} → D0{day} ✓
        uint256 rentPerTile = getRentPerTile(tilesHeld); // D: → D18{RATE/day/tile}
        uint256 newDebt = elapsedDays * tilesHeld * rentPerTile; // D: D0{day} * D0{count} * D18{RATE/day/tile} → D18{RATE} ✓

        rentDebt[agent] += newDebt; // D: D18{RATE} += D18{RATE} ✓
        lastRentPaymentTimestamp[agent] = block.timestamp;

        emit DebtAccrued(agent, newDebt);
    }
}
