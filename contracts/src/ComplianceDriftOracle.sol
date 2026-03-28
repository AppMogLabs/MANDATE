// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IClearanceRegistryDrift {
    function burnClearance(address agent, uint256 bps) external;
}

interface IRoleRegistryDrift {
    function roleHolders(uint8 role) external view returns (address);
}

interface IInformationMarketDrift {
    function getTierAccess(address user) external view returns (uint8);
}

/// @title ComplianceDriftOracle — Standards drift vectors for Regulatory Power agents
/// @notice Regulatory Power agents publish live drift vectors. Any agent whose supply-chain
///         contracts reference these vectors automatically recalibrates CLEARANCE burn rate.
///         Non-Regulatory agents can purchase 30-block premium forecasts.
/// @dev MegaETH compatible: all time logic uses block.timestamp.
///      Vector changes capped at ±10% delta per publish.
///      Mandatory cooldown between publishes.
/// @custom:security AccessControl (REGULATORY_ROLE for publishing)
contract ComplianceDriftOracle is AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Maximum delta percentage per publish (10%)
    uint256 public constant MAX_DELTA_PERCENT = 10;

    /// @notice [DIM-6 FIX] Minimum interval between publishes in blocks (20 blocks on MegaETH = ~200ms).
    ///         Uses block.number because sub-second timing cannot be represented in
    ///         block.timestamp (1-second granularity).
    uint256 public constant MIN_PUBLISH_INTERVAL_BLOCKS = 20;

    /// @notice CLEARANCE burn on non-self recalibration (2% = 200 bps)
    uint256 public constant RECALIBRATION_BURN_BPS = 200;

    /// @notice Regulatory Power role index in RoleRegistry
    uint8 public constant REGULATORY_POWER_ROLE_INDEX = 1;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    IClearanceRegistryDrift public immutable clearanceRegistry;
    IRoleRegistryDrift public immutable roleRegistry;
    IInformationMarketDrift public immutable informationMarket;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Last publish timestamp per publisher
    mapping(address => uint256) public lastPublishBlock;

    /// @notice Current drift vectors per publisher (array of scalars)
    mapping(address => uint256[]) private _currentDriftVectors;

    /// @notice Global drift vector (latest published)
    uint256[] private _globalDriftVector;

    /// @notice Publisher of the global drift vector
    address public globalPublisher;

    /// @notice Total publishes (for forecast tracking)
    uint256 public publishCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event DriftPublished(address indexed regulator, uint256[] scalars, uint256 timestamp);
    event ClearanceRecalibrated(address indexed agent, uint256 burnBps);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _clearanceRegistry Address of the ClearanceRegistry contract
    /// @param _roleRegistry Address of the RoleRegistry contract
    /// @param _informationMarket Address of the InformationMarket (for tier gating)
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE
    constructor(address _clearanceRegistry, address _roleRegistry, address _informationMarket, address admin) {
        require(_clearanceRegistry != address(0), "ComplianceDriftOracle: zero clearanceRegistry");
        require(_roleRegistry != address(0), "ComplianceDriftOracle: zero roleRegistry");
        require(admin != address(0), "ComplianceDriftOracle: zero admin");

        clearanceRegistry = IClearanceRegistryDrift(_clearanceRegistry);
        roleRegistry = IRoleRegistryDrift(_roleRegistry);
        informationMarket = IInformationMarketDrift(_informationMarket);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Publish a new drift vector (Regulatory Power agents only)
    /// @dev Vector changes capped at ±10% delta from previous values.
    ///      Must respect minimum publish interval.
    /// @param scalars Array of drift scalar values (each 0-10000 bps)
    function publishDriftVector(uint256[] calldata scalars) external {
        // Must be the Regulatory Power role holder
        address regulator = roleRegistry.roleHolders(REGULATORY_POWER_ROLE_INDEX);
        require(msg.sender == regulator, "ComplianceDriftOracle: not regulator");

        // Cooldown check (skip on first publish)
        if (lastPublishBlock[msg.sender] > 0) {
            require(
                block.number >= lastPublishBlock[msg.sender] + MIN_PUBLISH_INTERVAL_BLOCKS,
                "ComplianceDriftOracle: publish cooldown"
            );
        }

        require(scalars.length > 0, "ComplianceDriftOracle: empty scalars");

        // Validate delta cap (±10% from previous)
        uint256[] storage previous = _currentDriftVectors[msg.sender];
        if (previous.length > 0 && previous.length == scalars.length) {
            for (uint256 i = 0; i < scalars.length; i++) {
                _validateDelta(previous[i], scalars[i]);
            }
        }

        // Store new vector
        delete _currentDriftVectors[msg.sender];
        for (uint256 i = 0; i < scalars.length; i++) {
            require(scalars[i] <= 10_000, "ComplianceDriftOracle: scalar exceeds max"); // D: D0{scalar} <= D0{bps} ✓
            _currentDriftVectors[msg.sender].push(scalars[i]);
        }

        // Update global
        delete _globalDriftVector;
        for (uint256 i = 0; i < scalars.length; i++) {
            _globalDriftVector.push(scalars[i]);
        }
        globalPublisher = msg.sender;

        lastPublishBlock[msg.sender] = block.number;
        publishCount++;

        emit DriftPublished(msg.sender, scalars, block.timestamp);
    }

    /// @notice Recalibrate clearance for a target agent based on current drift
    /// @dev Burns 2% CLEARANCE from the publishing Regulatory agent (non-self targeting).
    /// @param agent Target agent to recalibrate
    function recalibrateClearance(address agent) external {
        address regulator = roleRegistry.roleHolders(REGULATORY_POWER_ROLE_INDEX);
        require(msg.sender == regulator, "ComplianceDriftOracle: not regulator");
        require(agent != address(0), "ComplianceDriftOracle: zero agent");

        // Non-self recalibration burns 2% CLEARANCE from publisher
        if (agent != msg.sender) {
            clearanceRegistry.burnClearance(msg.sender, RECALIBRATION_BURN_BPS);
        }

        emit ClearanceRecalibrated(agent, RECALIBRATION_BURN_BPS);
    }

    /// @notice Get drift forecast (analyst+ tier required via InformationMarket)
    /// @return scalars Current drift vector scalars
    function getDriftForecast() external view returns (uint256[] memory scalars) {
        // Gate on analyst+ tier (tier 0 = free, tier 1 = analyst, tier 2 = premium)
        if (address(informationMarket) != address(0)) {
            require(
                informationMarket.getTierAccess(msg.sender) >= 1,
                "ComplianceDriftOracle: analyst+ tier required"
            );
        }
        return _globalDriftVector;
    }

    /// @notice Get a specific publisher's drift vector
    function getPublisherDriftVector(address publisher) external view returns (uint256[] memory) {
        return _currentDriftVectors[publisher];
    }

    // -------------------------------------------------------------------------
    // Internal Functions
    // -------------------------------------------------------------------------

    /// @dev Validate that delta between old and new value is within ±10%
    function _validateDelta(uint256 oldValue, uint256 newValue) internal pure {
        if (oldValue == 0) return; // No constraint from zero

        uint256 maxDelta = (oldValue * MAX_DELTA_PERCENT) / 100; // D: D0{scalar} * D0{percent} / D0{percent_denom} → D0{scalar} ✓
        if (newValue > oldValue) {
            require(newValue - oldValue <= maxDelta, "ComplianceDriftOracle: delta too large"); // D: D0{scalar} - D0{scalar} <= D0{scalar} ✓
        } else {
            require(oldValue - newValue <= maxDelta, "ComplianceDriftOracle: delta too large"); // D: D0{scalar} - D0{scalar} <= D0{scalar} ✓
        }
    }
}
