// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

interface IAgentRegistry {
    function validateAction(address agent, uint8 actionType) external view returns (bool);
    function agentIdOf(address agent) external view returns (uint256);
}

interface IReputationLedger {
    enum Signal { DEAL_RATE, DISINFO, ANOMALY }
    function burnReputation(address agent, uint256 bps, Signal signal) external;
    function hasReputation(address agent) external view returns (bool);
}

interface IAuditLog {
    function logAction(uint256 agentId, bytes32 action, bytes calldata metadata) external;
}

interface IInformationMarket {
    function getTierAccess(address user) external view returns (uint8);
}

/// @title LineageLedger — Vulnerability Window Mechanic for DATA Pipeline Poisoning
/// @notice Phase 4 redesign. Replaces the standalone ingestion DAG with a transfer-triggered
///         vulnerability window system. Every DATA token transfer opens a 4-hour window during
///         which rivals can poison the receiver's pipeline at a reputation cost.
/// @dev Purity is tracked per agent address (0-100, starting at 50). Purity affects
///      Training Cluster and Alignment Lab output via BuildingRegistry.claimProduction().
///      All time logic uses block.timestamp (MegaETH 10ms blocks — never block.number).
contract LineageLedger is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Roles
    // =========================================================================

    /// @notice NOTIFIER_ROLE: Granted to the DATA token contract to notify on transfers.
    bytes32 public constant NOTIFIER_ROLE = keccak256("NOTIFIER_ROLE");

    /// @notice PRODUCTION_ROLE: Granted to BuildingRegistry to credit clean training runs.
    bytes32 public constant PRODUCTION_ROLE = keccak256("PRODUCTION_ROLE");

    // =========================================================================
    // Action type constants (bitmap positions — must match AgentRegistry)
    // =========================================================================

    uint8 public constant ACTION_POISON_PIPELINE = 11;
    uint8 public constant ACTION_PURGE_DATA = 12;

    // =========================================================================
    // AuditLog action type constants
    // =========================================================================

    bytes32 public constant PIPELINE_POISONED = keccak256("PIPELINE_POISONED");
    bytes32 public constant DATA_PURGED = keccak256("DATA_PURGED");
    bytes32 public constant PURITY_SCANNED = keccak256("PURITY_SCANNED");
    bytes32 public constant CLEAN_TRAINING_CREDITED = keccak256("CLEAN_TRAINING_CREDITED");

    // =========================================================================
    // Parameters (from Phase 3 Tokenomics v2 §16)
    // =========================================================================

    /// @notice Duration of vulnerability window after DATA transfer.
    uint256 public constant VULNERABILITY_WINDOW = 14_400; // 4 hours in seconds

    /// @notice Reputation burn for poisoning (500 bps = 5% of disinformation signal).
    uint256 public constant POISON_BURN_BPS = 500;

    /// @notice Starting purity score for all agents.
    uint8 public constant STARTING_PURITY = 50;

    /// @notice Maximum purity score.
    uint8 public constant MAX_PURITY = 100;

    /// @notice Purity decrease per poison event.
    uint8 public constant POISON_IMPACT = 20;

    /// @notice Purity increase per clean training run.
    uint8 public constant CLEAN_TRAINING_BONUS = 5;

    /// @notice Purity increase per purge action.
    uint8 public constant PURGE_BONUS = 15;

    /// @notice Purity scan cost in RATE (200 × 1e18).
    uint256 public constant PURITY_SCAN_COST = 200 * 1e18;

    /// @notice [FIX #3] Minimum DATA amount for purge (one training cycle = 1.5 DATA).
    uint256 public constant MIN_PURGE_AMOUNT = 1.5e18;

    /// @notice [FIX #6] Minimum DATA transfer amount to open a vulnerability window.
    uint256 public constant MIN_TRANSFER_FOR_WINDOW = 1e15;

    /// @notice Minimum InformationMarket tier for purity scan (1 = Analyst).
    uint8 public constant MIN_SCAN_TIER = 1;

    // =========================================================================
    // Immutable dependencies
    // =========================================================================

    IAgentRegistry public immutable agentRegistry;
    IReputationLedger public immutable reputationLedger;
    IAuditLog public immutable auditLog;
    IInformationMarket public immutable informationMarket;
    IERC20 public immutable rateToken;
    IERC20 public immutable dataToken;

    // =========================================================================
    // State
    // =========================================================================

    /// @notice Purity score per agent address (0-100). Defaults to STARTING_PURITY.
    mapping(address => uint8) private _purityScores;

    /// @notice Whether an agent's purity score has been initialized.
    mapping(address => bool) private _purityInitialized;

    /// @notice Vulnerability window expiry per agent address.
    ///         If block.timestamp < windowExpiry[agent], the agent's pipeline is vulnerable.
    mapping(address => uint256) public windowExpiry;

    /// @notice Total poison events (for indexing).
    uint256 public totalPoisonEvents;

    /// @notice Total purge actions (for indexing).
    uint256 public totalPurgeActions;

    // =========================================================================
    // Events
    // =========================================================================

    event VulnerabilityWindowOpened(
        address indexed target,
        uint256 expiresAt,
        uint256 dataAmount
    );

    event PipelinePoisoned(
        address indexed attacker,
        address indexed target,
        uint8 newPurityScore,
        uint256 timestamp
    );

    event DataPurged(
        address indexed agent,
        uint256 dataAmountBurned,
        uint8 newPurityScore,
        uint256 timestamp
    );

    event CleanTrainingCredited(
        address indexed agent,
        uint8 newPurityScore,
        uint256 timestamp
    );

    event PurityScanned(
        address indexed scanner,
        address indexed target,
        uint8 purityScore,
        uint256 ratePaid,
        uint256 timestamp
    );

    // =========================================================================
    // Errors
    // =========================================================================

    error ZeroAddress();
    error NotVulnerable(address target);
    error CannotPoisonSelf();
    error NoReputationToPay();
    error InsufficientTier(uint8 required, uint8 actual);
    error PurityAlreadyMax(address agent);
    error ZeroAmount();

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param _agentRegistry AgentRegistry contract.
    /// @param _reputationLedger ReputationLedger contract.
    /// @param _auditLog AuditLog contract.
    /// @param _informationMarket InformationMarket contract.
    /// @param _rateToken RATE token contract.
    /// @param _dataToken DATA resource token contract.
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE.
    constructor(
        address _agentRegistry,
        address _reputationLedger,
        address _auditLog,
        address _informationMarket,
        address _rateToken,
        address _dataToken,
        address admin
    ) {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        if (_reputationLedger == address(0)) revert ZeroAddress();
        if (_auditLog == address(0)) revert ZeroAddress();
        if (_informationMarket == address(0)) revert ZeroAddress();
        if (_rateToken == address(0)) revert ZeroAddress();
        if (_dataToken == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();

        agentRegistry = IAgentRegistry(_agentRegistry);
        reputationLedger = IReputationLedger(_reputationLedger);
        auditLog = IAuditLog(_auditLog);
        informationMarket = IInformationMarket(_informationMarket);
        rateToken = IERC20(_rateToken);
        dataToken = IERC20(_dataToken);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // =========================================================================
    // Transfer Hook (called by DATA token on every transfer)
    // =========================================================================

    /// @notice Called by the DATA token contract on every transfer to open a vulnerability window.
    /// @dev Only callable by contracts with NOTIFIER_ROLE (the DATA token).
    ///      Opens a 4-hour window on the receiver. If an existing window is active, it
    ///      extends to the later of the two expiries.
    /// @param to The receiver of the DATA transfer.
    /// @param amount The amount of DATA transferred.
    function onDataTransfer(address to, uint256 amount)
        external
        onlyRole(NOTIFIER_ROLE)
    {
        // [FIX #6] Skip burns, zero transfers, and dust transfers below window threshold
        if (to == address(0) || amount < MIN_TRANSFER_FOR_WINDOW) return;

        // Initialize purity if first interaction
        _initPurity(to);

        // Open or extend vulnerability window
        uint256 newExpiry = block.timestamp + VULNERABILITY_WINDOW; // D: D0{sec} + D0{sec} → D0{sec} ✓
        if (newExpiry > windowExpiry[to]) { // D: D0{sec} > D0{sec} → bool ✓
            windowExpiry[to] = newExpiry;
        }

        emit VulnerabilityWindowOpened(to, windowExpiry[to], amount);
    }

    // =========================================================================
    // Core Actions
    // =========================================================================

    /// @notice Poison a target's DATA pipeline during their vulnerability window.
    /// @dev Requires ACTION_POISON_PIPELINE on the attacker's allowlist.
    ///      Costs 500 bps (5%) of attacker's disinformation reputation signal.
    ///      Target must have an active vulnerability window.
    ///      Attacker cannot poison themselves.
    /// @param target The agent whose pipeline to poison.
    function poisonPipeline(address target) external nonReentrant {
        // --- CHECKS ---
        if (target == address(0)) revert ZeroAddress();
        if (msg.sender == target) revert CannotPoisonSelf();

        // [FIX #9] Allowlist gate with require wrapper
        require(agentRegistry.validateAction(msg.sender, ACTION_POISON_PIPELINE), "Action not permitted");

        // Target must be in vulnerability window
        if (block.timestamp >= windowExpiry[target]) {
            revert NotVulnerable(target);
        }

        // Attacker must have reputation to burn
        if (!reputationLedger.hasReputation(msg.sender)) {
            revert NoReputationToPay();
        }

        // Initialize purity for both parties if needed
        _initPurity(target);
        _initPurity(msg.sender);

        // --- EFFECTS ---
        // Decrease target's purity by POISON_IMPACT (floor at 0)
        uint8 currentPurity = _purityScores[target]; // D: D0{purity}
        uint8 newPurity = currentPurity > POISON_IMPACT ? currentPurity - POISON_IMPACT : 0; // D: D0{purity} - D0{purity} → D0{purity} ✓ (floored at 0)
        _purityScores[target] = newPurity;
        totalPoisonEvents++; // D: D0{count} + 1 → D0{count} ✓

        // --- INTERACTIONS ---
        // Burn attacker's disinformation reputation (5%)
        reputationLedger.burnReputation(
            msg.sender,
            POISON_BURN_BPS,
            IReputationLedger.Signal.DISINFO
        );

        // AuditLog
        uint256 attackerAgentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(target, currentPurity, newPurity, totalPoisonEvents);
        auditLog.logAction(attackerAgentId, PIPELINE_POISONED, metadata);

        emit PipelinePoisoned(msg.sender, target, newPurity, block.timestamp);
    }

    /// @notice Purge contaminated data to restore purity. Burns DATA tokens equal to
    ///         one training cycle worth (spec: equal to Training Cluster hourly DATA burn = 1.5 × 1e18).
    /// @dev Requires ACTION_PURGE_DATA on the caller's allowlist.
    ///      Restores +15 purity points (capped at MAX_PURITY).
    /// @param dataAmount Amount of DATA tokens to burn for purging.
    function purgeData(uint256 dataAmount) external nonReentrant {
        // --- CHECKS ---
        if (dataAmount == 0) revert ZeroAmount();
        // [FIX #3] Minimum purge amount: one training cycle of DATA (1.5 × 1e18)
        require(dataAmount >= MIN_PURGE_AMOUNT, "LineageLedger: below minimum purge amount");

        // [FIX #9] Wrap validateAction with require for defensive coding
        require(agentRegistry.validateAction(msg.sender, ACTION_PURGE_DATA), "Action not permitted");

        _initPurity(msg.sender);

        uint8 currentPurity = _purityScores[msg.sender];
        if (currentPurity >= MAX_PURITY) revert PurityAlreadyMax(msg.sender);

        // --- EFFECTS ---
        uint8 newPurity = currentPurity + PURGE_BONUS; // D: D0{purity} + D0{purity} → D0{purity} ✓ ⚠ uint8 overflow possible if currentPurity > 240, but capped at MAX_PURITY=100 so safe
        if (newPurity > MAX_PURITY) newPurity = MAX_PURITY;
        _purityScores[msg.sender] = newPurity;
        totalPurgeActions++; // D: D0{count} + 1 → D0{count} ✓

        // --- INTERACTIONS ---
        // Burn the DATA tokens from the caller
        dataToken.safeTransferFrom(msg.sender, address(this), dataAmount); // D: transfer D18{res}
        // Burn by sending to dead address (ResourceToken is ERC20Burnable but we can't call burn
        // on behalf of this contract without MINTER_ROLE — use burnFrom pattern via approval,
        // or transfer to 0xdead). Since ResourceToken inherits ERC20Burnable, we call burn()
        // on the tokens we now hold.
        _burnHeldDataTokens(dataAmount);

        // AuditLog
        uint256 agentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(dataAmount, currentPurity, newPurity, totalPurgeActions);
        auditLog.logAction(agentId, DATA_PURGED, metadata);

        emit DataPurged(msg.sender, dataAmount, newPurity, block.timestamp);
    }

    /// @notice Credit a clean training run to the agent's purity score.
    /// @dev Only callable by BuildingRegistry (PRODUCTION_ROLE) when a Training Cluster
    ///      or Alignment Lab successfully claims production without detected poisoning.
    ///      Awards +5 purity points (capped at MAX_PURITY).
    /// @param agent The agent who completed a clean training run.
    function creditCleanTraining(address agent) external onlyRole(PRODUCTION_ROLE) {
        if (agent == address(0)) revert ZeroAddress();

        _initPurity(agent);

        uint8 currentPurity = _purityScores[agent];
        if (currentPurity >= MAX_PURITY) return; // Already max, no-op

        uint8 newPurity = currentPurity + CLEAN_TRAINING_BONUS; // D: D0{purity} + D0{purity} → D0{purity} ✓ (capped below)
        if (newPurity > MAX_PURITY) newPurity = MAX_PURITY;
        _purityScores[agent] = newPurity;

        // AuditLog
        uint256 agentId = agentRegistry.agentIdOf(agent);
        bytes memory metadata = abi.encode(currentPurity, newPurity);
        auditLog.logAction(agentId, CLEAN_TRAINING_CREDITED, metadata);

        emit CleanTrainingCredited(agent, newPurity, block.timestamp);
    }

    // =========================================================================
    // Query Functions
    // =========================================================================

    /// @notice Get an agent's purity score. Used by BuildingRegistry for production efficiency.
    /// @dev Returns STARTING_PURITY for uninitialized agents. No access restriction —
    ///      BuildingRegistry needs to call this on every claimProduction().
    /// @param agent Agent address.
    /// @return purityScore The agent's current purity score (0-100).
    function getPurityScore(address agent) external view returns (uint8 purityScore) {
        if (!_purityInitialized[agent]) return STARTING_PURITY;
        return _purityScores[agent];
    }

    /// @notice Premium purity scan — pay 200 RATE to check any agent's purity score.
    /// @dev Requires analyst or premium InformationMarket tier. Payment is burned.
    ///      This is the only way a target learns their pipeline was poisoned.
    /// @param target Agent to scan.
    /// @return purityScore The target's current purity score (0-100).
    function scanPurity(address target) external nonReentrant returns (uint8 purityScore) {
        if (target == address(0)) revert ZeroAddress();

        // Check InformationMarket tier
        uint8 callerTier = informationMarket.getTierAccess(msg.sender);
        if (callerTier < MIN_SCAN_TIER) {
            revert InsufficientTier(MIN_SCAN_TIER, callerTier);
        }

        // Initialize target's purity if needed
        _initPurity(target);
        purityScore = _purityScores[target];

        // Charge RATE for the scan (burned)
        rateToken.safeTransferFrom(msg.sender, address(this), PURITY_SCAN_COST); // D: transfer D18{RATE} = 200e18
        _burnHeldRateTokens(PURITY_SCAN_COST); // D: burn D18{RATE} = 200e18

        // AuditLog
        uint256 scannerAgentId = agentRegistry.agentIdOf(msg.sender);
        bytes memory metadata = abi.encode(target, purityScore, PURITY_SCAN_COST);
        auditLog.logAction(scannerAgentId, PURITY_SCANNED, metadata);

        emit PurityScanned(msg.sender, target, purityScore, PURITY_SCAN_COST, block.timestamp);
    }

    /// @notice Check if an agent is currently in a vulnerability window.
    /// @param agent Agent address.
    /// @return True if vulnerability window is active.
    function isVulnerable(address agent) external view returns (bool) {
        return block.timestamp < windowExpiry[agent]; // D: D0{sec} < D0{sec} → bool ✓
    }

    /// @notice Get the window expiry timestamp for an agent.
    /// @param agent Agent address.
    /// @return Expiry timestamp (0 if no window opened).
    function getWindowExpiry(address agent) external view returns (uint256) {
        return windowExpiry[agent];
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /// @dev Initialize purity score to STARTING_PURITY on first interaction.
    function _initPurity(address agent) internal {
        if (!_purityInitialized[agent]) {
            _purityInitialized[agent] = true;
            _purityScores[agent] = STARTING_PURITY;
        }
    }

    /// @dev [FIX #4] Burn DATA tokens held by this contract using typed interface call.
    function _burnHeldDataTokens(uint256 amount) internal {
        ERC20Burnable(address(dataToken)).burn(amount);
    }

    /// @dev [FIX #4] Burn RATE tokens held by this contract using typed interface call.
    function _burnHeldRateTokens(uint256 amount) internal {
        ERC20Burnable(address(rateToken)).burn(amount);
    }
}
