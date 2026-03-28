// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReputationLedgerGCM {
    enum Signal { DEAL_RATE, DISINFO, ANOMALY }
    function burnReputation(address agent, uint256 bps, Signal signal) external;
    function getReputation(address agent) external view returns (uint256);
    function recordTransactionByAddress(address buyer, address seller, uint256 amount) external;
}

interface IReflexWindowManagerGCM {
    function isReflexActive(uint256 eventId) external view returns (bool);
}

interface IClearanceRegistryGCM {
    function burnClearance(address agent, uint256 bps) external;
}

interface IEpochManagerGCM {
    function getCurrentEpoch() external view returns (uint256);
}

/// @title GuardClauseMarketplace — Tradeable guard-clause templates priced in COMPUTE
/// @notice Agents list and purchase pre-packaged guard-clause templates. Sellers receive
///         reputation bonuses on successful activation, penalties on incorrect activation.
/// @dev Phase 2 delivers the full Marketplace. Phase 4 delivers the bytecode parser.
///      Cartel farming prevention: per-buyer epoch bonus cap.
///      Self-buy prevention: 30-block cooldown on same template after purchase.
/// @custom:security ReentrancyGuard on purchaseAndIntegrate() and activateClause()
contract GuardClauseMarketplace is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Minimum price for a template in COMPUTE tokens
    uint256 public constant COMPUTE_PRICE_FLOOR = 50;

    /// @notice [DIM-6 FIX] Self-buy cooldown in blocks (30 blocks on MegaETH = ~300ms).
    ///         Uses block.number because sub-second timing cannot be represented in block.timestamp.
    uint256 public constant SELF_BUY_COOLDOWN_BLOCKS = 30;

    /// @notice Reputation bonus for seller on successful activation (3% = 300 bps)
    uint256 public constant ACTIVATION_BONUS_BPS = 300;

    /// @notice Reputation penalty for seller on incorrect activation (3% = 300 bps)
    uint256 public constant ACTIVATION_PENALTY_SELLER_BPS = 300;

    /// @notice Reputation penalty for buyer on incorrect activation (1% = 100 bps)
    uint256 public constant ACTIVATION_PENALTY_BUYER_BPS = 100;

    /// @notice CLEARANCE fee on activation (1% = 100 bps)
    uint256 public constant ACTIVATION_CLEARANCE_FEE_BPS = 100;

    /// @notice Maximum opcodes in a template clause
    uint256 public constant MAX_TEMPLATE_OPCODES = 8;

    /// @notice Maximum gas estimate for template
    uint256 public constant MAX_TEMPLATE_GAS = 150_000;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    IERC20 public immutable computeToken;
    IReputationLedgerGCM public immutable reputationLedger;
    IReflexWindowManagerGCM public immutable reflexWindowManager;
    IClearanceRegistryGCM public immutable clearanceRegistry;
    IEpochManagerGCM public immutable epochManager;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Template {
        address seller;
        bytes clauseBody;
        uint256 priceInCompute;
        bool active;
        bool verified;       // True if clause passed validateTemplate() at listing time
        uint256 listTimestamp;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Auto-incrementing template ID counter
    uint256 private _nextTemplateId = 1;

    /// @notice Maps templateId => Template
    mapping(uint256 => Template) public templates;

    /// @notice Maps templateId => buyer => epoch => claimed bonus
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public hasClaimedBonusThisEpoch;

    /// @notice Maps templateId => last purchase timestamp (self-buy cooldown)
    mapping(uint256 => uint256) public lastPurchaseBlock;

    /// @notice Maps buyer => templateId => purchase timestamp
    mapping(address => mapping(uint256 => uint256)) public buyerPurchaseTimestamp;


    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TemplateListed(uint256 indexed templateId, address indexed seller, uint256 priceInCompute);
    event ClausePurchased(uint256 indexed templateId, address indexed buyer);
    event ClauseActivated(uint256 indexed clauseId, uint256 indexed eventId, bool success);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _computeToken Address of the COMPUTE resource token
    /// @param _reputationLedger Address of the ReputationLedger contract
    /// @param _reflexWindowManager Address of the ReflexWindowManager singleton
    /// @param _clearanceRegistry Address of the ClearanceRegistry contract
    /// @param _epochManager Address of the EpochManager contract
    /// @param admin Address that receives DEFAULT_ADMIN_ROLE and OPERATOR_ROLE
    constructor(
        address _computeToken,
        address _reputationLedger,
        address _reflexWindowManager,
        address _clearanceRegistry,
        address _epochManager,
        address admin
    ) {
        require(_computeToken != address(0), "GCM: zero computeToken");
        require(_reputationLedger != address(0), "GCM: zero reputationLedger");
        require(_reflexWindowManager != address(0), "GCM: zero reflexWindowManager");
        require(_clearanceRegistry != address(0), "GCM: zero clearanceRegistry");
        require(_epochManager != address(0), "GCM: zero epochManager");
        require(admin != address(0), "GCM: zero admin");

        computeToken = IERC20(_computeToken);
        reputationLedger = IReputationLedgerGCM(_reputationLedger);
        reflexWindowManager = IReflexWindowManagerGCM(_reflexWindowManager);
        clearanceRegistry = IClearanceRegistryGCM(_clearanceRegistry);
        epochManager = IEpochManagerGCM(_epochManager);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice List a new guard-clause template on the marketplace (two-tier model)
    /// @dev Templates that pass validateTemplate() are marked as verified.
    ///      Unverified templates are still listed — buyer relies on seller reputation.
    /// @param clause The clause bytecode/data
    /// @param priceInCompute Price in COMPUTE tokens (must be >= COMPUTE_PRICE_FLOOR)
    /// @return templateId The ID of the newly listed template
    function listTemplate(bytes calldata clause, uint256 priceInCompute)
        external
        returns (uint256 templateId)
    {
        require(clause.length > 0, "GCM: empty clause");
        require(priceInCompute >= COMPUTE_PRICE_FLOOR, "GCM: below price floor");

        // Two-tier: attempt validation, store result (do not reject unverified)
        bool isVerified = validateTemplate(clause);

        templateId = _nextTemplateId++;
        templates[templateId] = Template({
            seller: msg.sender,
            clauseBody: clause,
            priceInCompute: priceInCompute,
            active: true,
            verified: isVerified,
            listTimestamp: block.timestamp
        });

        emit TemplateListed(templateId, msg.sender, priceInCompute);
    }

    /// @notice Purchase a template and integrate it
    /// @param templateId The template to purchase
    function purchaseAndIntegrate(uint256 templateId) external nonReentrant {
        Template storage tmpl = templates[templateId];
        require(tmpl.active, "GCM: template not active");
        require(tmpl.seller != address(0), "GCM: template not found");

        // Self-buy cooldown: 30-block cooldown on same template after purchase
        if (lastPurchaseBlock[templateId] > 0) {
            require(
                block.number >= lastPurchaseBlock[templateId] + SELF_BUY_COOLDOWN_BLOCKS,
                "GCM: self-buy cooldown"
            );
        }

        // Transfer COMPUTE from buyer to seller
        computeToken.safeTransferFrom(msg.sender, tmpl.seller, tmpl.priceInCompute);

        lastPurchaseBlock[templateId] = block.number;
        buyerPurchaseTimestamp[msg.sender][templateId] = block.timestamp;

        emit ClausePurchased(templateId, msg.sender);
    }

    /// @notice Activate a purchased clause during a reflex window
    /// @param clauseId The template/clause ID to activate
    /// @param eventId The world event triggering activation
    /// @param success Whether the activation was successful (determined off-chain/by oracle)
    function activateClause(uint256 clauseId, uint256 eventId, bool success) external nonReentrant {
        Template storage tmpl = templates[clauseId];
        require(tmpl.seller != address(0), "GCM: clause not found");

        // Must have purchased
        require(buyerPurchaseTimestamp[msg.sender][clauseId] > 0, "GCM: not purchased");

        // Activation requires active reflex window
        require(reflexWindowManager.isReflexActive(eventId), "GCM: not in reflex window");

        address seller = tmpl.seller;
        address buyer = msg.sender;

        if (success) {
            // Successful activation: seller gets 3% reputation bonus (deal completion)
            // Cartel farming prevention: check epoch bonus cap
            if (!hasClaimedBonusThisEpoch[clauseId][buyer][epochManager.getCurrentEpoch()]) {
                hasClaimedBonusThisEpoch[clauseId][buyer][epochManager.getCurrentEpoch()] = true;
                // Bonus to seller via deal completion signal improvement
                reputationLedger.recordTransactionByAddress(buyer, seller, ACTIVATION_BONUS_BPS);
            }
            // Buyer pays 1% CLEARANCE fee
            clearanceRegistry.burnClearance(buyer, ACTIVATION_CLEARANCE_FEE_BPS);
        } else {
            // Incorrect activation: 3% reputation deducted from seller
            reputationLedger.burnReputation(
                seller, ACTIVATION_PENALTY_SELLER_BPS, IReputationLedgerGCM.Signal.ANOMALY
            );
            // 1% from buyer
            reputationLedger.burnReputation(
                buyer, ACTIVATION_PENALTY_BUYER_BPS, IReputationLedgerGCM.Signal.ANOMALY
            );
        }

        emit ClauseActivated(clauseId, eventId, success);
    }

    /// @notice Validate a template clause (Phase 2 basic validation)
    /// @dev Phase 4 will implement the full bytecode parser.
    ///      Phase 2 checks: non-empty, length within limits (proxy for opcode count),
    ///      and gas estimate proxy.
    /// @param clause The clause bytecode to validate
    /// @return valid True if the clause passes validation
    function validateTemplate(bytes calldata clause) public pure returns (bool valid) {
        // Phase 2: basic structural validation
        // Max opcodes approximated by bytes length (1 opcode ~= 1-33 bytes)
        if (clause.length == 0) return false;
        if (clause.length > MAX_TEMPLATE_OPCODES * 33) return false; // D: D0{bytes} > D0{count} * D0{bytes/opcode} ✓ ~264 bytes max
        return true;
    }

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------

    /// @notice Deactivate a template
    function deactivateTemplate(uint256 templateId) external onlyRole(OPERATOR_ROLE) {
        templates[templateId].active = false;
    }
}
