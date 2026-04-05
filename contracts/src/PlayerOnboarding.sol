// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {RoleRegistry} from "./RoleRegistry.sol";
import {RateToken} from "./RateToken.sol";
import {ResourceToken} from "./ResourceToken.sol";

/// @title PlayerOnboarding — Atomic registration for new MANDATE players
/// @notice Single transaction: mint agent NFT + set allowlist + mint starter tokens + assign role.
///         Called by MANDATE backend (OPERATOR_ROLE) on behalf of new players.
/// @dev The player's embedded wallet is the recipient, not the caller. This avoids the
///      chicken-and-egg problem of needing tokens to register.
contract PlayerOnboarding is AccessControl {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // External contracts
    // -------------------------------------------------------------------------
    AgentRegistry public immutable agentRegistry;
    RoleRegistry public immutable roleRegistry;
    RateToken public immutable rateToken;

    // -------------------------------------------------------------------------
    // Resource tokens (ordered: COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE)
    // -------------------------------------------------------------------------
    ResourceToken[7] public resourceTokens;

    // -------------------------------------------------------------------------
    // Starter amounts (18 decimals, adjustable by admin)
    // PHASE_3_PLACEHOLDER — calibrate after playtesting
    // -------------------------------------------------------------------------
    uint256 public starterRate = 5_000 ether;

    /// @notice Base amounts for all roles [COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE]
    uint256[7] public baseAmounts = [
        100 ether,  // COMPUTE
        200 ether,  // ENERGY
        50 ether,   // CHIPS
        50 ether,   // COOLING
        30 ether,   // TALENT
        80 ether,   // DATA
        40 ether    // CLEARANCE
    ];

    /// @notice Bonus amounts per role (index = RoleRegistry.Role enum value)
    /// @dev Each role gets a bonus in specific resources:
    ///      0 = TALENT_HUB:        +60 TALENT (index 4)
    ///      1 = REGULATORY_POWER:  +80 CLEARANCE (index 6)
    ///      2 = DATA_SOVEREIGN:    +160 DATA (index 5)
    ///      3 = COMPUTE_SUPERPOWER: +200 COMPUTE (index 0)
    ///      4 = CHIPS_MAGNATE:     +100 CHIPS (index 2)
    uint256[7][5] public roleBonuses;

    // -------------------------------------------------------------------------
    // Default allowlist bitmap: ORDER_PLACE | ORDER_CANCEL | ORDER_MATCH
    //   bits 1,2,3 = 0b1110 = 0x0E
    // -------------------------------------------------------------------------
    uint256 public defaultAllowlist = 0x0E;

    // -------------------------------------------------------------------------
    // Rate limiting: max 1 registration per address
    // -------------------------------------------------------------------------
    mapping(address => bool) public hasRegistered;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event PlayerOnboarded(
        address indexed player,
        uint256 indexed agentId,
        uint8 role,
        uint256 rateAmount,
        uint256 timestamp
    );
    event StarterRateUpdated(uint256 oldAmount, uint256 newAmount);
    event DefaultAllowlistUpdated(uint256 oldBitmap, uint256 newBitmap);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error AlreadyRegistered(address player);
    error InvalidRole(uint8 role);
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address admin,
        address _agentRegistry,
        address _roleRegistry,
        address _rateToken,
        address[7] memory _resourceTokens
    ) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        agentRegistry = AgentRegistry(_agentRegistry);
        roleRegistry = RoleRegistry(_roleRegistry);
        rateToken = RateToken(_rateToken);

        for (uint256 i; i < 7; ++i) {
            resourceTokens[i] = ResourceToken(_resourceTokens[i]);
        }

        // Initialize role bonuses
        // TALENT_HUB: +60 TALENT (index 4)
        roleBonuses[0][4] = 60 ether;
        // REGULATORY_POWER: +80 CLEARANCE (index 6)
        roleBonuses[1][6] = 80 ether;
        // DATA_SOVEREIGN: +160 DATA (index 5)
        roleBonuses[2][5] = 160 ether;
        // COMPUTE_SUPERPOWER: +200 COMPUTE (index 0)
        roleBonuses[3][0] = 200 ether;
        // CHIPS_MAGNATE: +100 CHIPS (index 2)
        roleBonuses[4][2] = 100 ether;
    }

    // -------------------------------------------------------------------------
    // Core: Atomic onboarding
    // -------------------------------------------------------------------------

    /// @notice Register a new player atomically: agent NFT + allowlist + tokens + role.
    /// @param player The player's embedded wallet address (recipient).
    /// @param role The chosen sovereign role (0-4, maps to RoleRegistry.Role).
    /// @param agentURI Off-chain agent URI for ERC-8004 registration.
    /// @return agentId The minted agent NFT token ID.
    function onboardPlayer(
        address player,
        uint8 role,
        string calldata agentURI
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 agentId) {
        if (player == address(0)) revert ZeroAddress();
        if (role > 4) revert InvalidRole(role);
        if (hasRegistered[player]) revert AlreadyRegistered(player);

        hasRegistered[player] = true;

        // 1. Register agent (mints soulbound ERC-721)
        agentId = agentRegistry.registerAgent(player, agentURI);

        // 2. Set default allowlist bitmap
        agentRegistry.updateAllowlist(agentId, defaultAllowlist);

        // 3. Mint starter RATE
        rateToken.mint(player, starterRate);

        // 4. Mint base resources + role bonus
        for (uint256 i; i < 7; ++i) {
            uint256 amount = baseAmounts[i] + roleBonuses[role][i];
            if (amount > 0) {
                resourceTokens[i].mint(player, amount);
            }
        }

        // 5. Assign sovereign role
        roleRegistry.assignRole(RoleRegistry.Role(role), player);

        emit PlayerOnboarded(player, agentId, role, starterRate, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Admin: Tune starter amounts
    // -------------------------------------------------------------------------

    /// @notice Update the starter RATE amount for new players.
    function setStarterRate(uint256 newAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = starterRate;
        starterRate = newAmount;
        emit StarterRateUpdated(old, newAmount);
    }

    /// @notice Update the default allowlist bitmap for new agents.
    function setDefaultAllowlist(uint256 newBitmap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = defaultAllowlist;
        defaultAllowlist = newBitmap;
        emit DefaultAllowlistUpdated(old, newBitmap);
    }

    /// @notice Update base resource amounts.
    function setBaseAmounts(uint256[7] calldata newAmounts) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseAmounts = newAmounts;
    }

    /// @notice Update role bonus amounts for a specific role.
    function setRoleBonus(uint8 role, uint256[7] calldata newBonuses) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (role > 4) revert InvalidRole(role);
        roleBonuses[role] = newBonuses;
    }
}
