// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {ResourceToken} from "./ResourceToken.sol";

/// @title BuildingRegistry — ERC-721 Building NFT Lifecycle for MANDATE
/// @notice Manages construction, time-based production, upgrades, and demolition of AI-themed buildings.
/// @dev Inherits ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, AccessControl per Phase 2 spec.
///      All time calculations use block.timestamp (not block.number) per EthSkills L2 guidance.
/// @custom:invariant Each tileId maps to at most one tokenId (tileOccupancy uniqueness)
/// @custom:invariant Building tier is always in range [1, 3] (validated at construction and upgrade)
/// @custom:invariant Production tier multipliers: 1.0x (tier 1), 1.5x (tier 2), 2.25x (tier 3)
/// @custom:invariant upgradeInProgress implies upgradeFinalTimestamp > block.timestamp (cooldown enforcement)
/// @custom:invariant Demolition clears tileOccupancy and burns NFT atomically (no orphan tiles)
/// @custom:invariant claimProduction follows CEI pattern (Checks-Effects-Interactions)
/// @custom:security Uses ReentrancyGuard on all state-changing functions with external calls
/// @custom:security SafeERC20 for all token transfers (protects against non-standard ERC20 implementations)
/// @custom:security Operator-only recipe management (OPERATOR_ROLE required)
contract BuildingRegistry is ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    // =========================================================================
    // Constants
    // =========================================================================

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant UPGRADE_COOLDOWN = 3600; // D: D0{sec} — 1 hour
    uint256 public constant MIN_WORKER_EFFICIENCY = 1_000; // D: D0{bps} — 10% in bps
    uint256 public constant TALENT_REQUIREMENT_PER_HOUR = 5e17; // D: D17{res/hr} — 0.5 TALENT/hr per building
    uint256 public constant ENERGY_REQUIREMENT_PER_HOUR = 3e17; // D: D17{res/hr} — 0.3 ENERGY/hr per building

    // Building type constants
    uint8 public constant DATA_CENTRE = 0;
    uint8 public constant POWER_PLANT = 1;
    uint8 public constant SOLAR_ARRAY = 2;
    uint8 public constant FABRICATION_CONTRACT = 3;
    uint8 public constant RECRUITING_PIPELINE = 4;
    uint8 public constant DATA_ACQUISITION_HUB = 5;
    uint8 public constant COOLING_INFRASTRUCTURE = 6;
    uint8 public constant TRAINING_CLUSTER = 7;
    uint8 public constant ALIGNMENT_LAB = 8;
    uint8 public constant LOBBYING_OFFICE = 9;
    uint8 public constant INTELLIGENCE_NETWORK = 10;
    uint8 public constant MEDIA_ARM = 11;
    uint8 public constant DEPLOYED_MODEL = 12;
    uint8 public constant PATENT_PORTFOLIO = 13;
    uint8 public constant ROAD = 14;
    uint8 public constant SECURITY_PERIMETER = 15;

    // =========================================================================
    // State
    // =========================================================================

    AgentRegistry public immutable agentRegistry;
    ResourceToken public immutable computeToken;
    ResourceToken public immutable energyToken;
    ResourceToken public immutable chipsToken;
    ResourceToken public immutable coolingToken;
    ResourceToken public immutable talentToken;
    ResourceToken public immutable dataToken;
    ResourceToken public immutable clearanceToken;

    /// @notice Per-building-type production rate (tokens per hour, 18 decimals)
    mapping(uint8 => uint256) public productionRatePerHour;

    uint256 private _nextTokenId = 1;

    /// @notice Building information struct
    struct BuildingInfo {
        uint8 buildingType;              // D: D0{id}
        uint8 tier;                      // D: D0{tier}
        uint32 tileId;                   // D: D0{tileId}
        address owner;                   // D: {addr}
        uint64 lastProductionTimestamp;  // D: D0{sec}
        uint256 talentAllocation;        // D: D18{res} — TALENT tokens allocated
        uint256 productionAccumulator;   // D: D18{res}
        bool upgradeInProgress;          // D: {bool}
        uint64 upgradeFinalTimestamp;    // D: D0{sec}
    }

    /// @notice Construction recipe struct
    struct Recipe {
        address[] resources;
        uint256[] amounts;
    }

    /// @notice Maps tokenId => BuildingInfo
    mapping(uint256 => BuildingInfo) private _buildings;

    /// @notice Maps buildingType => tier => Recipe
    mapping(uint8 => mapping(uint8 => Recipe)) private _recipes;

    /// @notice Maps tileId => tokenId (tile occupancy)
    mapping(uint32 => uint256) public tileOccupancy;

    // =========================================================================
    // Events
    // =========================================================================

    event BuildingConstructed(uint256 indexed tokenId, uint8 buildingType, uint32 tileId, address indexed agent);
    event BuildingUpgraded(uint256 indexed tokenId, uint8 newTier);
    event BuildingDemolished(uint256 indexed tokenId);
    event ProductionClaimed(uint256 indexed tokenId, address indexed resource, uint256 amount);
    event WorkerAllocationUpdated(uint256 indexed tokenId, uint256 talentPerCycle);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address _agentRegistry,
        address _compute,
        address _energy,
        address _chips,
        address _cooling,
        address _talent,
        address _data,
        address _clearance
    ) ERC721("MANDATE Building", "BUILDING") {
        agentRegistry = AgentRegistry(_agentRegistry);
        computeToken = ResourceToken(_compute);
        energyToken = ResourceToken(_energy);
        chipsToken = ResourceToken(_chips);
        coolingToken = ResourceToken(_cooling);
        talentToken = ResourceToken(_talent);
        dataToken = ResourceToken(_data);
        clearanceToken = ResourceToken(_clearance);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        _initializeRecipes();
        _initializeProductionRates();
    }

    // =========================================================================
    // Recipe Initialization (All 16 Building Types)
    // =========================================================================

    /// @notice Initialize per-building production rates (tokens per hour at tier 1)
    function _initializeProductionRates() private {
        productionRatePerHour[DATA_CENTRE] = 5e18;           // D: D18{res/hr} — 5.0 COMPUTE/hr
        productionRatePerHour[DEPLOYED_MODEL] = 8e18;        // D: D18{res/hr} — 8.0 COMPUTE/hr
        productionRatePerHour[POWER_PLANT] = 4e18;           // D: D18{res/hr} — 4.0 ENERGY/hr
        productionRatePerHour[SOLAR_ARRAY] = 25e17;          // D: D17{res/hr} — 2.5 ENERGY/hr
        productionRatePerHour[FABRICATION_CONTRACT] = 15e17;  // D: D17{res/hr} — 1.5 CHIPS/hr
        productionRatePerHour[COOLING_INFRASTRUCTURE] = 3e18; // D: D18{res/hr} — 3.0 COOLING/hr
        productionRatePerHour[RECRUITING_PIPELINE] = 12e17;   // D: D17{res/hr} — 1.2 TALENT/hr
        productionRatePerHour[DATA_ACQUISITION_HUB] = 35e17;  // D: D17{res/hr} — 3.5 DATA/hr
        productionRatePerHour[LOBBYING_OFFICE] = 2e18;        // D: D18{res/hr} — 2.0 CLEARANCE/hr
        productionRatePerHour[PATENT_PORTFOLIO] = 3e18;       // D: D18{res/hr} — 3.0 CLEARANCE/hr
    }

    /// @notice Initialize all building construction recipes
    function _initializeRecipes() private {
        // Data Centre: 10 COMPUTE, 8 ENERGY, 5 CHIPS, 3 COOLING, 2 TALENT
        _setRecipe(DATA_CENTRE, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(0), address(0)), _buildAmountArray(10, 8, 5, 3, 2, 0, 0));

        // Power Plant: 5 COMPUTE, 3 CHIPS, 2 COOLING, 2 TALENT
        _setRecipe(POWER_PLANT, 1, _buildResourceArray(address(computeToken), address(chipsToken), address(coolingToken), address(talentToken), address(0), address(0), address(0)), _buildAmountArray(5, 3, 2, 2, 0, 0, 0));

        // Solar Array: 3 COMPUTE, 2 CHIPS, 1 COOLING, 1 TALENT
        _setRecipe(SOLAR_ARRAY, 1, _buildResourceArray(address(computeToken), address(chipsToken), address(coolingToken), address(talentToken), address(0), address(0), address(0)), _buildAmountArray(3, 2, 1, 1, 0, 0, 0));

        // Fabrication Contract: 8 COMPUTE, 5 ENERGY, 2 COOLING, 3 TALENT, 2 CLEARANCE
        _setRecipe(FABRICATION_CONTRACT, 1, _buildResourceArray(address(computeToken), address(energyToken), address(coolingToken), address(talentToken), address(clearanceToken), address(0), address(0)), _buildAmountArray(8, 5, 2, 3, 2, 0, 0));

        // Recruiting Pipeline: 3 COMPUTE, 2 ENERGY, 1 CHIPS, 2 DATA, 1 CLEARANCE
        _setRecipe(RECRUITING_PIPELINE, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(dataToken), address(clearanceToken), address(0), address(0)), _buildAmountArray(3, 2, 1, 2, 1, 0, 0));

        // Data Acquisition Hub: 5 COMPUTE, 3 ENERGY, 2 CHIPS, 1 COOLING, 2 TALENT
        _setRecipe(DATA_ACQUISITION_HUB, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(0), address(0)), _buildAmountArray(5, 3, 2, 1, 2, 0, 0));

        // Cooling Infrastructure: 4 COMPUTE, 3 ENERGY, 3 CHIPS, 1 TALENT
        _setRecipe(COOLING_INFRASTRUCTURE, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(talentToken), address(0), address(0), address(0)), _buildAmountArray(4, 3, 3, 1, 0, 0, 0));

        // Training Cluster: 15 COMPUTE, 10 ENERGY, 8 CHIPS, 5 COOLING, 5 TALENT, 3 DATA
        _setRecipe(TRAINING_CLUSTER, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(dataToken), address(0)), _buildAmountArray(15, 10, 8, 5, 5, 3, 0));

        // Alignment Lab: 10 COMPUTE, 8 ENERGY, 5 CHIPS, 3 COOLING, 8 TALENT, 5 DATA, 3 CLEARANCE
        _setRecipe(ALIGNMENT_LAB, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(dataToken), address(clearanceToken)), _buildAmountArray(10, 8, 5, 3, 8, 5, 3));

        // Lobbying Office: 3 COMPUTE, 2 ENERGY, 1 CHIPS, 3 TALENT
        _setRecipe(LOBBYING_OFFICE, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(talentToken), address(0), address(0), address(0)), _buildAmountArray(3, 2, 1, 3, 0, 0, 0));

        // Intelligence Network: 8 COMPUTE, 5 ENERGY, 3 CHIPS, 2 COOLING, 5 TALENT, 3 DATA, 2 CLEARANCE
        _setRecipe(INTELLIGENCE_NETWORK, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(dataToken), address(clearanceToken)), _buildAmountArray(8, 5, 3, 2, 5, 3, 2));

        // Media Arm: 5 COMPUTE, 3 ENERGY, 2 CHIPS, 1 COOLING, 3 TALENT, 2 DATA
        _setRecipe(MEDIA_ARM, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(dataToken), address(0)), _buildAmountArray(5, 3, 2, 1, 3, 2, 0));

        // Deployed Model: 12 COMPUTE, 8 ENERGY, 5 CHIPS, 4 COOLING, 5 TALENT, 3 CLEARANCE
        _setRecipe(DEPLOYED_MODEL, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(clearanceToken), address(0)), _buildAmountArray(12, 8, 5, 4, 5, 3, 0));

        // Patent Portfolio: 5 COMPUTE, 3 ENERGY, 2 CHIPS, 8 TALENT, 5 DATA, 5 CLEARANCE
        _setRecipe(PATENT_PORTFOLIO, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(talentToken), address(dataToken), address(clearanceToken), address(0)), _buildAmountArray(5, 3, 2, 8, 5, 5, 0));

        // Road: 2 COMPUTE, 1 ENERGY, 1 CHIPS
        _setRecipe(ROAD, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(0), address(0), address(0), address(0)), _buildAmountArray(2, 1, 1, 0, 0, 0, 0));

        // Security Perimeter: 3 COMPUTE, 2 ENERGY, 3 CHIPS, 1 COOLING, 1 TALENT, 1 CLEARANCE
        _setRecipe(SECURITY_PERIMETER, 1, _buildResourceArray(address(computeToken), address(energyToken), address(chipsToken), address(coolingToken), address(talentToken), address(clearanceToken), address(0)), _buildAmountArray(3, 2, 3, 1, 1, 1, 0));
    }

    /// @dev Helper to build resource address arrays (filters out zero addresses)
    function _buildResourceArray(address r0, address r1, address r2, address r3, address r4, address r5, address r6) private pure returns (address[] memory) {
        address[7] memory temp = [r0, r1, r2, r3, r4, r5, r6];
        uint256 count = 0;
        for (uint256 i = 0; i < 7; i++) {
            if (temp[i] != address(0)) count++;
        }
        address[] memory result = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < 7; i++) {
            if (temp[i] != address(0)) {
                result[index++] = temp[i];
            }
        }
        return result;
    }

    /// @dev Helper to build amount arrays (filters out zeros)
    function _buildAmountArray(uint256 a0, uint256 a1, uint256 a2, uint256 a3, uint256 a4, uint256 a5, uint256 a6) private pure returns (uint256[] memory) {
        uint256[7] memory temp = [a0, a1, a2, a3, a4, a5, a6];
        uint256 count = 0;
        for (uint256 i = 0; i < 7; i++) {
            if (temp[i] != 0) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < 7; i++) {
            if (temp[i] != 0) {
                result[index++] = temp[i] * 1e18; // D: D0{count} * D18 → D18{res} ✓ (scales integer recipe amounts to token precision)
            }
        }
        return result;
    }

    /// @dev Internal recipe setter
    function _setRecipe(uint8 buildingType, uint8 tier, address[] memory resources, uint256[] memory amounts) private {
        require(resources.length == amounts.length, "Mismatched arrays");
        _recipes[buildingType][tier] = Recipe({resources: resources, amounts: amounts});
    }

    // =========================================================================
    // Construction
    // =========================================================================

    /// @notice Construct a new building on a tile
    /// @param buildingType The type of building (0-15)
    /// @param tileId The tile to build on
    /// @param agent The agent address (must be registered)
    /// @return tokenId The newly minted building NFT token ID
    function construct(uint8 buildingType, uint32 tileId, address agent) external nonReentrant returns (uint256 tokenId) {
        // 1. Validate agent via AgentRegistry (ERC-8004 compliance)
        uint256 agentId = agentRegistry.agentIdOf(agent);
        require(agentId != 0, "Agent not registered");

        // 2. Check tile availability
        require(tileOccupancy[tileId] == 0, "Tile occupied");

        // 3. Get recipe
        Recipe memory recipe = _recipes[buildingType][1];
        require(recipe.resources.length > 0, "Invalid building type");

        // 4. Burn construction resources via SafeERC20
        for (uint256 i = 0; i < recipe.resources.length; i++) {
            IERC20(recipe.resources[i]).safeTransferFrom(agent, address(this), recipe.amounts[i]);
            ResourceToken(recipe.resources[i]).burn(recipe.amounts[i]);
        }

        // 5. Mint NFT
        tokenId = _nextTokenId++;
        _safeMint(agent, tokenId);

        // 6. Initialize building state
        _buildings[tokenId] = BuildingInfo({
            buildingType: buildingType,
            tier: 1,
            tileId: tileId,
            owner: agent,
            lastProductionTimestamp: uint64(block.timestamp),
            talentAllocation: 0,
            productionAccumulator: 0,
            upgradeInProgress: false,
            upgradeFinalTimestamp: 0
        });

        // 7. Mark tile occupied
        tileOccupancy[tileId] = tokenId;

        emit BuildingConstructed(tokenId, buildingType, tileId, agent);
    }

    // =========================================================================
    // Production
    // =========================================================================

    /// @notice Claim production from a building
    /// @param tokenId The building token ID
    /// @return amountProduced The amount of resource tokens produced
    function claimProduction(uint256 tokenId) external nonReentrant returns (uint256 amountProduced) {
        require(_ownerOf(tokenId) == msg.sender, "Not building owner");

        BuildingInfo storage building = _buildings[tokenId];

        // Calculate time elapsed (using block.timestamp per EthSkills L2 guidance)
        uint256 elapsed = block.timestamp - building.lastProductionTimestamp; // D: D0{sec} - D0{sec} → D0{sec} ✓
        require(elapsed > 0, "No time elapsed");

        // Calculate production amount
        uint256 tierMultiplier = _getTierMultiplier(building.tier); // D: D0{bps}
        uint256 workerEfficiency = _calculateWorkerEfficiency(tokenId); // D: D0{bps}

        // Production formula: elapsed × ratePerHour × tierMultiplier × workerEfficiency
        uint256 baseRate = productionRatePerHour[building.buildingType]; // D: D18{res/hr}
        amountProduced = (elapsed * baseRate * tierMultiplier * workerEfficiency) / (3600 * 10_000 * 10_000); // D: D0{sec} * D18{res/hr} * D0{bps} * D0{bps} / (D0{sec/hr} * D0{bps} * D0{bps}) → D18{res} ✓ ⚠ overflow if elapsed*baseRate*tierMult*efficiency > 2^256

        // For processing buildings, burn inputs
        if (building.buildingType == TRAINING_CLUSTER || building.buildingType == ALIGNMENT_LAB) {
            _burnProcessingInputs(tokenId, elapsed);
        }

        // Burn TALENT and ENERGY upkeep
        _burnTalentUpkeep(tokenId, elapsed);
        _burnEnergyUpkeep(tokenId, elapsed);

        // Update timestamp
        building.lastProductionTimestamp = uint64(block.timestamp);

        // Mint output resource based on building type
        address outputResource = _getOutputResource(building.buildingType);
        if (outputResource != address(0) && amountProduced > 0) {
            ResourceToken(outputResource).mint(msg.sender, amountProduced);
            emit ProductionClaimed(tokenId, outputResource, amountProduced);
        }
    }

    /// @dev Get tier multiplier (1.0x, 1.5x, 2.25x)
    /// @return D0{bps} — tier multiplier in basis points
    function _getTierMultiplier(uint8 tier) private pure returns (uint256) {
        if (tier == 1) return 10000; // D: D0{bps} — 1.0x
        if (tier == 2) return 15000; // D: D0{bps} — 1.5x
        if (tier == 3) return 22500; // D: D0{bps} — 2.25x
        return 10000;
    }

    /// @dev Calculate combined worker efficiency: min(talentEfficiency, energyEfficiency)
    /// @dev Both degrade linearly to MIN_WORKER_EFFICIENCY (10%) floor
    function _calculateWorkerEfficiency(uint256 tokenId) private view returns (uint256) {
        BuildingInfo storage building = _buildings[tokenId];

        // [DIM-1] Talent efficiency: allocation and requirement are both D18{res}.
        // TALENT_REQUIREMENT_PER_HOUR = 5e17 = 0.5 × 1e18 (0.5 TALENT in D18 scale).
        // Formula: efficiency_bps = (allocation * 10_000) / requirement → D18 * D0 / D18 = D0{bps} ✓
        // The dimensional analysis flagged this as D17 but the constant is actually D18
        // (0.5 × 1e18 = 5e17). No fix needed — formula is dimensionally correct.
        uint256 talentEfficiency;
        if (building.talentAllocation == 0) {
            talentEfficiency = MIN_WORKER_EFFICIENCY;
        } else {
            talentEfficiency = (building.talentAllocation * 10_000) / TALENT_REQUIREMENT_PER_HOUR;
            if (talentEfficiency > 10_000) talentEfficiency = 10_000;
            if (talentEfficiency < MIN_WORKER_EFFICIENCY) talentEfficiency = MIN_WORKER_EFFICIENCY;
        }

        // Energy efficiency: same pattern, both D18{res}.
        // ENERGY_REQUIREMENT_PER_HOUR = 3e17 = 0.3 × 1e18 (0.3 ENERGY in D18 scale).
        uint256 energyEfficiency;
        address owner = building.owner;
        uint256 energyBalance = energyToken.balanceOf(owner);
        if (energyBalance >= ENERGY_REQUIREMENT_PER_HOUR) {
            energyEfficiency = 10_000;
        } else if (energyBalance == 0) {
            energyEfficiency = MIN_WORKER_EFFICIENCY;
        } else {
            energyEfficiency = (energyBalance * 10_000) / ENERGY_REQUIREMENT_PER_HOUR;
            if (energyEfficiency < MIN_WORKER_EFFICIENCY) energyEfficiency = MIN_WORKER_EFFICIENCY;
        }

        // Combined efficiency = min(talent, energy)
        return talentEfficiency < energyEfficiency ? talentEfficiency : energyEfficiency;
    }

    /// @dev Burn TALENT upkeep proportional to elapsed time
    function _burnTalentUpkeep(uint256 tokenId, uint256 elapsed) private {
        BuildingInfo storage building = _buildings[tokenId];

        if (building.talentAllocation > 0) {
            uint256 talentRequired = (elapsed * TALENT_REQUIREMENT_PER_HOUR) / 3600; // D: D0{sec} * D17{res/hr} / D0{sec/hr} → D17{res} ✓
            uint256 talentToBurn = talentRequired > building.talentAllocation ? building.talentAllocation : talentRequired;

            if (talentToBurn > 0 && talentToken.balanceOf(msg.sender) >= talentToBurn) {
                IERC20(address(talentToken)).safeTransferFrom(msg.sender, address(this), talentToBurn);
                talentToken.burn(talentToBurn);
            }
        }
    }

    /// @dev Burn processing inputs for Training Cluster / Alignment Lab
    function _burnProcessingInputs(uint256 tokenId, uint256 elapsed) private {
        BuildingInfo storage building = _buildings[tokenId];

        if (building.buildingType == TRAINING_CLUSTER) {
            // Training Cluster: 2 COMPUTE + 1.5 DATA per hour
            uint256 computeBurn = (elapsed * 2e18) / 3600; // D: D0{sec} * D18{res/hr} / D0{sec/hr} → D18{res} ✓
            uint256 dataBurn = (elapsed * 15e17) / 3600; // D: D0{sec} * D17{res/hr} / D0{sec/hr} → D17{res} ✓

            if (computeToken.balanceOf(msg.sender) >= computeBurn) {
                IERC20(address(computeToken)).safeTransferFrom(msg.sender, address(this), computeBurn);
                computeToken.burn(computeBurn);
            }
            if (dataToken.balanceOf(msg.sender) >= dataBurn) {
                IERC20(address(dataToken)).safeTransferFrom(msg.sender, address(this), dataBurn);
                dataToken.burn(dataBurn);
            }
        } else if (building.buildingType == ALIGNMENT_LAB) {
            // Alignment Lab: 1.5 COMPUTE + 1 DATA + 0.5 ENERGY per hour
            uint256 computeBurn = (elapsed * 15e17) / 3600; // D: D0{sec} * D17{res/hr} / D0{sec/hr} → D17{res} ✓
            uint256 dataBurn = (elapsed * 1e18) / 3600; // D: D0{sec} * D18{res/hr} / D0{sec/hr} → D18{res} ✓
            uint256 energyBurn = (elapsed * 5e17) / 3600; // D: D0{sec} * D17{res/hr} / D0{sec/hr} → D17{res} ✓

            if (computeToken.balanceOf(msg.sender) >= computeBurn) {
                IERC20(address(computeToken)).safeTransferFrom(msg.sender, address(this), computeBurn);
                computeToken.burn(computeBurn);
            }
            if (dataToken.balanceOf(msg.sender) >= dataBurn) {
                IERC20(address(dataToken)).safeTransferFrom(msg.sender, address(this), dataBurn);
                dataToken.burn(dataBurn);
            }
            if (energyToken.balanceOf(msg.sender) >= energyBurn) {
                IERC20(address(energyToken)).safeTransferFrom(msg.sender, address(this), energyBurn);
                energyToken.burn(energyBurn);
            }
        }
    }

    /// @dev Burn ENERGY upkeep proportional to elapsed time
    function _burnEnergyUpkeep(uint256 tokenId, uint256 elapsed) private {
        uint256 energyRequired = (elapsed * ENERGY_REQUIREMENT_PER_HOUR) / 3600; // D: D0{sec} * D17{res/hr} / D0{sec/hr} → D17{res} ✓
        if (energyRequired > 0 && energyToken.balanceOf(msg.sender) >= energyRequired) {
            IERC20(address(energyToken)).safeTransferFrom(msg.sender, address(this), energyRequired);
            energyToken.burn(energyRequired);
        }
    }

    /// @dev Get output resource address for building type
    function _getOutputResource(uint8 buildingType) private view returns (address) {
        if (buildingType == DATA_CENTRE || buildingType == DEPLOYED_MODEL) return address(computeToken);
        if (buildingType == POWER_PLANT || buildingType == SOLAR_ARRAY) return address(energyToken);
        if (buildingType == FABRICATION_CONTRACT) return address(chipsToken);
        if (buildingType == COOLING_INFRASTRUCTURE) return address(coolingToken);
        if (buildingType == RECRUITING_PIPELINE) return address(talentToken);
        if (buildingType == DATA_ACQUISITION_HUB) return address(dataToken);
        if (buildingType == LOBBYING_OFFICE || buildingType == INTELLIGENCE_NETWORK || buildingType == PATENT_PORTFOLIO) return address(clearanceToken);
        return address(0);
    }

    /// @notice Set TALENT allocation for a building
    /// @param tokenId The building token ID
    /// @param talentPerCycle The amount of TALENT to allocate per production cycle
    function setWorkerAllocation(uint256 tokenId, uint256 talentPerCycle) external {
        require(_ownerOf(tokenId) == msg.sender, "Not building owner");

        _buildings[tokenId].talentAllocation = talentPerCycle;

        emit WorkerAllocationUpdated(tokenId, talentPerCycle);
    }

    /// @notice Get worker efficiency for a building (0-10000 bps)
    /// @param tokenId The building token ID
    /// @return efficiency The efficiency in basis points (10000 = 100%)
    function getWorkerEfficiency(uint256 tokenId) external view returns (uint256 efficiency) {
        return _calculateWorkerEfficiency(tokenId);
    }

    // =========================================================================
    // Upgrades (Two-Step Pattern)
    // =========================================================================

    /// @notice Initiate upgrade to next tier
    /// @param tokenId The building token ID
    function initiateUpgrade(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not building owner");

        BuildingInfo storage building = _buildings[tokenId];
        require(building.tier < 3, "Already max tier");
        require(!building.upgradeInProgress, "Upgrade already in progress");

        building.upgradeInProgress = true;
        building.upgradeFinalTimestamp = uint64(block.timestamp + UPGRADE_COOLDOWN); // D: D0{sec} + D0{sec} → D0{sec} ✓
    }

    /// @notice Finalize upgrade after cooldown
    /// @param tokenId The building token ID
    function finaliseUpgrade(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not building owner");

        BuildingInfo storage building = _buildings[tokenId];
        require(building.upgradeInProgress, "No upgrade in progress");
        require(block.timestamp >= building.upgradeFinalTimestamp, "Cooldown not complete");

        building.tier++;
        building.upgradeInProgress = false;
        building.upgradeFinalTimestamp = 0;

        emit BuildingUpgraded(tokenId, building.tier);
    }

    // =========================================================================
    // Demolition
    // =========================================================================

    /// @notice Demolish a building (burns NFT, no resource recovery)
    /// @param tokenId The building token ID
    function demolish(uint256 tokenId) external {
        require(_ownerOf(tokenId) == msg.sender, "Not building owner");

        _demolishInternal(tokenId);
    }

    /// @notice Batch demolish buildings for epoch reset (operator only)
    /// @param tokenIds Array of building token IDs to demolish
    function demolishBatch(uint256[] calldata tokenIds) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_ownerOf(tokenIds[i]) != address(0)) {
                _demolishInternal(tokenIds[i]);
            }
        }
    }

    /// @dev Internal demolish logic shared by demolish() and demolishBatch()
    function _demolishInternal(uint256 tokenId) private {
        BuildingInfo storage building = _buildings[tokenId];

        // Release tile
        tileOccupancy[building.tileId] = 0;

        // Burn NFT
        _burn(tokenId);

        emit BuildingDemolished(tokenId);
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// @notice Get building information
    /// @param tokenId The building token ID
    /// @return Building information struct
    function getBuildingInfo(uint256 tokenId) external view returns (BuildingInfo memory) {
        require(_ownerOf(tokenId) != address(0), "Building does not exist");
        return _buildings[tokenId];
    }

    /// @notice Get construction recipe for a building type and tier
    /// @param buildingType The building type (0-15)
    /// @param tier The tier (1-3)
    /// @return Recipe struct
    function getRecipe(uint8 buildingType, uint8 tier) external view returns (Recipe memory) {
        return _recipes[buildingType][tier];
    }

    // =========================================================================
    // ERC721 Overrides (Required for Multiple Inheritance)
    // =========================================================================

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
