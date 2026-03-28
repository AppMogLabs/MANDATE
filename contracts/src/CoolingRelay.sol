// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReflexWindowManager {
    function isReflexActive(uint256 eventId) external view returns (bool);
}

interface IRoleRegistry {
    function roleHolders(uint8 role) external view returns (address);
}

interface IInsurancePool {
    function topUp(uint256 amount) external;
}

/// @title CoolingRelay — Silent COOLING relay graphs for MANDATE
/// @notice Agents form on-chain relay graphs for COOLING capacity. Catastrophic failure
///         propagates probabilistically (20% per edge) along the graph.
/// @dev P0 Mitigation: propagateFailure() checks ReflexWindowManager. If a reflex window
///      is active, propagation is queued with 150ms delay.
///      MegaETH compatible: all time logic uses block.timestamp.
/// @custom:security ReentrancyGuard on propagateFailure()
/// @custom:security Talent Hub agents exempt from lock-in period via RoleRegistry check
contract CoolingRelay is AccessControl, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice [DIM-6 FIX] Lock-in period in blocks (50 blocks on MegaETH = ~500ms).
    ///         Uses block.number because sub-second timing cannot be represented in
    ///         block.timestamp (1-second granularity). This is the one exception to the
    ///         general "use block.timestamp" convention on MegaETH.
    uint256 public constant JOIN_LOCKUP_BLOCKS = 50;

    /// @notice [DIM-6 FIX] Exit delay in blocks (200 blocks on MegaETH = ~2 seconds).
    uint256 public constant EXIT_DELAY_BLOCKS = 200;

    /// @notice Propagation probability per edge (20% = 2000 bps)
    uint256 public constant PROPAGATION_CHANCE_BPS = 2_000;

    /// @notice [DIM-6 FIX] Queued propagation delay in blocks (15 blocks on MegaETH = ~150ms).
    uint256 public constant REFLEX_QUEUE_DELAY_BLOCKS = 15;

    /// @notice Maximum cascade depth (bounds damage propagation)
    uint256 public constant MAX_CASCADE_DEPTH = 3;

    /// @notice Talent Hub role index in RoleRegistry
    uint8 public constant TALENT_HUB_ROLE_INDEX = 0;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    IReflexWindowManager public immutable reflexWindowManager;
    IRoleRegistry public immutable roleRegistry;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Adjacency list for each agent in the relay graph
    mapping(address => address[]) public adjacency;

    /// @notice [DIM-6 FIX] Block number when agent joined the graph
    mapping(address => uint256) public joinBlock;

    /// @notice [DIM-6 FIX] Block number when agent requested exit (0 = not requested)
    mapping(address => uint256) public exitRequestBlock;

    /// @notice Whether an agent is currently in the graph
    mapping(address => bool) public isInGraph;

    /// @notice Queued propagation timestamps (agent => eventId => propagation time)
    mapping(address => mapping(uint256 => uint256)) public queuedPropagation;

    /// @notice Tracks processed failures to prevent double-propagation
    mapping(address => mapping(uint256 => bool)) public failureProcessed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event GraphJoined(address indexed agent, address[] neighbours);
    event ExitRequested(address indexed agent, uint256 eligibleAtTimestamp);
    event ExitCompleted(address indexed agent);
    event FailurePropagated(address indexed source, address indexed target, uint8 riskPercent);
    event PropagationQueued(address indexed source, uint256 indexed eventId, uint256 propagationTimestamp);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _reflexWindowManager Address of the ReflexWindowManager singleton
    /// @param _roleRegistry Address of the RoleRegistry contract
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE
    constructor(address _reflexWindowManager, address _roleRegistry, address admin) {
        require(_reflexWindowManager != address(0), "CoolingRelay: zero reflexWindowManager");
        require(_roleRegistry != address(0), "CoolingRelay: zero roleRegistry");
        require(admin != address(0), "CoolingRelay: zero admin");

        reflexWindowManager = IReflexWindowManager(_reflexWindowManager);
        roleRegistry = IRoleRegistry(_roleRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Join the relay graph with specified neighbours
    /// @dev Talent Hub agents skip the lock-in period.
    /// @param neighbours Array of neighbour addresses to connect to
    function joinGraph(address[] calldata neighbours) external {
        require(!isInGraph[msg.sender], "CoolingRelay: already in graph");
        require(neighbours.length > 0, "CoolingRelay: empty neighbours");

        isInGraph[msg.sender] = true;
        joinBlock[msg.sender] = block.number;

        // Store adjacency (both directions for bidirectional graph)
        for (uint256 i = 0; i < neighbours.length; i++) {
            require(neighbours[i] != msg.sender, "CoolingRelay: self-neighbour");
            require(neighbours[i] != address(0), "CoolingRelay: zero neighbour");
            adjacency[msg.sender].push(neighbours[i]);
        }

        emit GraphJoined(msg.sender, neighbours);
    }

    /// @notice Request to exit the relay graph (starts exit delay)
    function exitGraph() external {
        require(isInGraph[msg.sender], "CoolingRelay: not in graph");
        require(exitRequestBlock[msg.sender] == 0, "CoolingRelay: exit already requested");

        exitRequestBlock[msg.sender] = block.number;
        emit ExitRequested(msg.sender, block.number + EXIT_DELAY_BLOCKS);
    }

    /// @notice Complete exit after delay period has elapsed
    function completeExit() external {
        require(exitRequestBlock[msg.sender] > 0, "CoolingRelay: no exit requested");
        require(
            block.number >= exitRequestBlock[msg.sender] + EXIT_DELAY_BLOCKS,
            "CoolingRelay: exit delay not elapsed"
        );

        isInGraph[msg.sender] = false;
        delete adjacency[msg.sender];
        delete joinBlock[msg.sender];
        delete exitRequestBlock[msg.sender];

        emit ExitCompleted(msg.sender);
    }

    /// @notice Propagate a failure event through the relay graph
    /// @dev P0 Mitigation: if a reflex window is active for this eventId,
    ///      propagation is queued with 150ms delay instead of executing immediately.
    /// @param source The agent that experienced the failure
    /// @param eventId The world event ID associated with this failure
    function propagateFailure(address source, uint256 eventId) external nonReentrant onlyRole(OPERATOR_ROLE) {
        require(isInGraph[source], "CoolingRelay: source not in graph");
        require(!failureProcessed[source][eventId], "CoolingRelay: already processed");

        // P0 Mitigation: check reflex window
        if (reflexWindowManager.isReflexActive(eventId)) {
            // Queue propagation with 150ms delay
            queuedPropagation[source][eventId] = block.number + REFLEX_QUEUE_DELAY_BLOCKS;
            emit PropagationQueued(source, eventId, block.number + REFLEX_QUEUE_DELAY_BLOCKS);
            return;
        }

        _executePropagation(source, eventId, 0);
    }

    /// @notice Execute a queued propagation (after reflex delay)
    /// @param source The agent that experienced the failure
    /// @param eventId The world event ID
    function executeQueuedPropagation(address source, uint256 eventId) external nonReentrant onlyRole(OPERATOR_ROLE) {
        uint256 queuedTime = queuedPropagation[source][eventId];
        require(queuedTime > 0, "CoolingRelay: not queued");
        require(block.number >= queuedTime, "CoolingRelay: queue delay not elapsed");

        delete queuedPropagation[source][eventId];
        _executePropagation(source, eventId, 0);
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Get the adjacency list for an agent
    function getNeighbours(address agent) external view returns (address[] memory) {
        return adjacency[agent];
    }

    /// @notice Check if an agent is eligible for propagation (past lock-in)
    function isPropagationEligible(address agent) external view returns (bool) {
        if (!isInGraph[agent]) return false;

        // Talent Hub exemption
        address talentHub = roleRegistry.roleHolders(TALENT_HUB_ROLE_INDEX);
        if (agent == talentHub) return true;

        return block.number >= joinBlock[agent] + JOIN_LOCKUP_BLOCKS;
    }

    // -------------------------------------------------------------------------
    // Internal Functions
    // -------------------------------------------------------------------------

    /// @dev Execute failure propagation along edges with bounded cascade depth
    /// @param source The failing agent
    /// @param eventId The world event ID
    /// @param depth Current cascade depth (stops at MAX_CASCADE_DEPTH)
    function _executePropagation(address source, uint256 eventId, uint256 depth) internal {
        if (depth >= MAX_CASCADE_DEPTH) return;

        failureProcessed[source][eventId] = true;

        address[] memory neighbours = adjacency[source];
        for (uint256 i = 0; i < neighbours.length; i++) {
            address target = neighbours[i];
            if (!isInGraph[target]) continue;
            if (failureProcessed[target][eventId]) continue;

            // Check lock-in (Talent Hub exemption)
            address talentHub = roleRegistry.roleHolders(TALENT_HUB_ROLE_INDEX);
            bool isTalentHub = (target == talentHub);

            if (!isTalentHub) {
                if (block.number < joinBlock[target] + JOIN_LOCKUP_BLOCKS) continue;
            }

            // Probabilistic propagation: 20% chance per edge
            // Use pseudo-random based on block data (acceptable for game mechanics)
            uint256 roll = uint256(keccak256(abi.encodePacked(
                block.timestamp, source, target, eventId, i
            ))) % 10_000; // D: D0{scalar} % D0{bps} → D0{bps} ✓

            if (roll < PROPAGATION_CHANCE_BPS) { // D: D0{bps} < D0{bps} → bool ✓ (2000 = 20%)
                emit FailurePropagated(source, target, 20);
                // Recursively propagate to next depth level
                _executePropagation(target, eventId, depth + 1);
            }
        }
    }
}
