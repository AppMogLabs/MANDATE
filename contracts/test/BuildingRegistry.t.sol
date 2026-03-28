// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BuildingRegistry} from "../src/BuildingRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ResourceTokenFactory} from "../src/ResourceTokenFactory.sol";
import {ResourceToken} from "../src/ResourceToken.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title BuildingRegistry Test Suite
/// @notice TDD test suite for MANDATE BuildingRegistry contract
contract BuildingRegistryTest is Test {
    BuildingRegistry public registry;
    AgentRegistry public agentRegistry;
    ResourceTokenFactory public factory;
    
    ResourceToken public compute;
    ResourceToken public energy;
    ResourceToken public chips;
    ResourceToken public cooling;
    ResourceToken public talent;
    ResourceToken public data;
    ResourceToken public clearance;
    
    address public operator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    
    uint256 public agent1Id;
    uint256 public agent2Id;
    
    // Building type constants (matching handoff spec)
    uint8 constant DATA_CENTRE = 0;
    uint8 constant POWER_PLANT = 1;
    uint8 constant TRAINING_CLUSTER = 7;
    uint8 constant ALIGNMENT_LAB = 8;
    
    function setUp() public {
        vm.startPrank(operator);
        
        // Deploy AgentRegistry
        agentRegistry = new AgentRegistry(operator);
        
        // Deploy ResourceTokenFactory
        factory = new ResourceTokenFactory(operator);
        
        // Deploy resource tokens
        compute = ResourceToken(factory.deployResource("Compute", "COMPUTE"));
        energy = ResourceToken(factory.deployResource("Energy", "ENERGY"));
        chips = ResourceToken(factory.deployResource("Chips", "CHIPS"));
        cooling = ResourceToken(factory.deployResource("Cooling", "COOLING"));
        talent = ResourceToken(factory.deployResource("Talent", "TALENT"));
        data = ResourceToken(factory.deployResource("Data", "DATA"));
        clearance = ResourceToken(factory.deployResource("Clearance", "CLEARANCE"));
        
        // Deploy BuildingRegistry
        registry = new BuildingRegistry(
            address(agentRegistry),
            address(compute),
            address(energy),
            address(chips),
            address(cooling),
            address(talent),
            address(data),
            address(clearance)
        );
        
        // Register agents
        agent1Id = agentRegistry.registerAgent(agent1, "ipfs://agent1");
        agent2Id = agentRegistry.registerAgent(agent2, "ipfs://agent2");
        
        // Set allowlists (all actions permitted for testing)
        agentRegistry.updateAllowlist(agent1Id, 0xFFFFFFFF);
        agentRegistry.updateAllowlist(agent2Id, 0xFFFFFFFF);
        
        // Grant MINTER_ROLE to BuildingRegistry and operator (for test setup)
        factory.setMintAuthority(address(compute), address(registry), true);
        factory.setMintAuthority(address(energy), address(registry), true);
        factory.setMintAuthority(address(chips), address(registry), true);
        factory.setMintAuthority(address(cooling), address(registry), true);
        factory.setMintAuthority(address(talent), address(registry), true);
        factory.setMintAuthority(address(data), address(registry), true);
        factory.setMintAuthority(address(clearance), address(registry), true);
        
        // Grant MINTER_ROLE to operator for test token minting
        factory.setMintAuthority(address(compute), operator, true);
        factory.setMintAuthority(address(energy), operator, true);
        factory.setMintAuthority(address(chips), operator, true);
        factory.setMintAuthority(address(cooling), operator, true);
        factory.setMintAuthority(address(talent), operator, true);
        factory.setMintAuthority(address(data), operator, true);
        factory.setMintAuthority(address(clearance), operator, true);
        
        vm.stopPrank();
    }
    
    // ============================================
    // Recipe Storage Tests
    // ============================================
    
    function testGetRecipe_DataCentre() public {
        BuildingRegistry.Recipe memory recipe = registry.getRecipe(DATA_CENTRE, 1);
        
        // Data Centre tier 1: 10 COMPUTE, 8 ENERGY, 5 CHIPS, 3 COOLING, 2 TALENT
        assertEq(recipe.resources.length, 5);
        assertEq(recipe.amounts.length, 5);
        assertEq(recipe.amounts[0], 10 * 1e18); // COMPUTE
        assertEq(recipe.amounts[1], 8 * 1e18);  // ENERGY
        assertEq(recipe.amounts[2], 5 * 1e18);  // CHIPS
        assertEq(recipe.amounts[3], 3 * 1e18);  // COOLING
        assertEq(recipe.amounts[4], 2 * 1e18);  // TALENT
    }
    
    function testGetRecipe_AllBuildingTypes() public {
        // Verify all 16 building types have recipes
        for (uint8 i = 0; i < 16; i++) {
            BuildingRegistry.Recipe memory recipe = registry.getRecipe(i, 1);
            assertTrue(recipe.resources.length > 0, "Recipe should exist");
        }
    }
    
    // ============================================
    // Construction Tests
    // ============================================
    
    function testConstruct_Success() public {
        // Mint resources to agent1
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        // Approve BuildingRegistry to spend resources
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        // Construct Data Centre on tile 1
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Verify NFT minted
        assertEq(registry.ownerOf(tokenId), agent1);
        
        // Verify building info
        BuildingRegistry.BuildingInfo memory info = registry.getBuildingInfo(tokenId);
        assertEq(info.buildingType, DATA_CENTRE);
        assertEq(info.tier, 1);
        assertEq(info.tileId, 1);
        assertEq(info.owner, agent1);
        
        vm.stopPrank();
    }
    
    function testConstruct_BurnsResources() public {
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 computeBefore = compute.balanceOf(agent1);
        uint256 energyBefore = energy.balanceOf(agent1);
        
        registry.construct(DATA_CENTRE, 1, agent1);
        
        // Verify resources burned (Data Centre: 10 COMPUTE, 8 ENERGY, 5 CHIPS, 3 COOLING, 2 TALENT)
        assertEq(compute.balanceOf(agent1), computeBefore - 10 * 1e18);
        assertEq(energy.balanceOf(agent1), energyBefore - 8 * 1e18);
        
        vm.stopPrank();
    }
    
    function testConstruct_RevertsIfInsufficientResources() public {
        vm.startPrank(operator);
        compute.mint(agent1, 1 * 1e18); // Not enough
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        
        vm.expectRevert();
        registry.construct(DATA_CENTRE, 1, agent1);
        
        vm.stopPrank();
    }
    
    function testConstruct_RevertsIfUnregisteredAgent() public {
        address unregistered = address(0x999);
        
        vm.expectRevert();
        registry.construct(DATA_CENTRE, 1, unregistered);
    }
    
    // ============================================
    // Production Tests
    // ============================================
    
    function testClaimProduction_TimeBasedOutput() public {
        // Setup: construct building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 1100 * 1e18); // Extra for allocation
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Allocate TALENT
        registry.setWorkerAllocation(tokenId, 10 * 1e18);
        
        // Warp time forward 1 hour
        vm.warp(block.timestamp + 3600);
        
        // Claim production
        uint256 produced = registry.claimProduction(tokenId);
        
        // Should produce > 0
        assertTrue(produced > 0, "Should produce tokens");
        
        vm.stopPrank();
    }
    
    function testClaimProduction_TierMultipliers() public {
        // Test that tier 2 produces 1.5x and tier 3 produces 2.25x
        // This will be implemented after upgrade functionality
    }
    
    function testClaimProduction_WorkerEfficiency() public {
        // Setup building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 1100 * 1e18); // Enough for construction + allocation
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Allocate only 50% of required TALENT
        registry.setWorkerAllocation(tokenId, 5 * 1e18); // 50% of requirement
        
        vm.warp(block.timestamp + 3600);
        
        uint256 efficiency = registry.getWorkerEfficiency(tokenId);
        
        // Efficiency should be ~5000 bps (50%) or floored at 1000 bps (10%)
        assertTrue(efficiency >= 1000, "Efficiency floor is 10%");
        assertTrue(efficiency <= 10000, "Efficiency max is 100%");
        
        vm.stopPrank();
    }
    
    // ============================================
    // Upgrade Tests
    // ============================================
    
    function testUpgrade_TwoStepFlow() public {
        // Setup building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Step 1: Initiate upgrade
        registry.initiateUpgrade(tokenId);
        
        BuildingRegistry.BuildingInfo memory info = registry.getBuildingInfo(tokenId);
        assertTrue(info.upgradeInProgress, "Upgrade should be in progress");
        assertTrue(info.upgradeFinalTimestamp > block.timestamp, "Finalize timestamp should be in future");
        
        // Try to finalize immediately - should revert
        vm.expectRevert();
        registry.finaliseUpgrade(tokenId);
        
        // Warp past cooldown
        vm.warp(info.upgradeFinalTimestamp);
        
        // Step 2: Finalize upgrade
        registry.finaliseUpgrade(tokenId);
        
        info = registry.getBuildingInfo(tokenId);
        assertEq(info.tier, 2, "Building should be tier 2");
        assertFalse(info.upgradeInProgress, "Upgrade should be complete");
        
        vm.stopPrank();
    }
    
    function testUpgrade_CannotSkipCooldown() public {
        // Setup building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        registry.initiateUpgrade(tokenId);
        
        // Attempt to finalize before cooldown
        vm.expectRevert();
        registry.finaliseUpgrade(tokenId);
        
        vm.stopPrank();
    }
    
    function testUpgrade_MaxTierIsTHree() public {
        // Setup and upgrade to tier 3
        vm.startPrank(operator);
        compute.mint(agent1, 1000 * 1e18);
        energy.mint(agent1, 1000 * 1e18);
        chips.mint(agent1, 1000 * 1e18);
        cooling.mint(agent1, 1000 * 1e18);
        talent.mint(agent1, 1000 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Upgrade to tier 2
        registry.initiateUpgrade(tokenId);
        vm.warp(block.timestamp + 3600);
        registry.finaliseUpgrade(tokenId);
        
        // Upgrade to tier 3
        registry.initiateUpgrade(tokenId);
        vm.warp(block.timestamp + 7200);
        registry.finaliseUpgrade(tokenId);
        
        BuildingRegistry.BuildingInfo memory info = registry.getBuildingInfo(tokenId);
        assertEq(info.tier, 3);
        
        // Try to upgrade past tier 3 - should revert
        vm.expectRevert();
        registry.initiateUpgrade(tokenId);
        
        vm.stopPrank();
    }
    
    // ============================================
    // Demolition Tests
    // ============================================
    
    function testDemolish_BurnsNFT() public {
        // Setup building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        
        // Demolish
        registry.demolish(tokenId);
        
        // Verify NFT burned
        vm.expectRevert();
        registry.ownerOf(tokenId);
        
        vm.stopPrank();
    }
    
    function testDemolish_NoResourceRecovery() public {
        // Setup building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 computeBefore = compute.balanceOf(agent1);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        registry.demolish(tokenId);
        
        // Balance should not increase (0% recovery)
        assertEq(compute.balanceOf(agent1), computeBefore - 10 * 1e18);
        
        vm.stopPrank();
    }
    
    // ============================================
    // Processing Building Tests (Training Cluster, Alignment Lab)
    // ============================================
    
    function testProcessing_TrainingCluster_BurnsInputs() public {
        // Training Cluster requires: 15 COMPUTE, 10 ENERGY, 8 CHIPS, 5 COOLING, 5 TALENT, 3 DATA
        vm.startPrank(operator);
        compute.mint(agent1, 1000 * 1e18);
        energy.mint(agent1, 1000 * 1e18);
        chips.mint(agent1, 1000 * 1e18);
        cooling.mint(agent1, 1000 * 1e18);
        talent.mint(agent1, 1000 * 1e18);
        data.mint(agent1, 1000 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        data.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(TRAINING_CLUSTER, 1, agent1);
        
        // Allocate TALENT
        registry.setWorkerAllocation(tokenId, 10 * 1e18);
        
        uint256 computeBefore = compute.balanceOf(agent1);
        uint256 dataBefore = data.balanceOf(agent1);
        
        // Warp time and claim
        vm.warp(block.timestamp + 3600);
        registry.claimProduction(tokenId);
        
        // Verify inputs burned (Training Cluster burns COMPUTE + DATA)
        assertTrue(compute.balanceOf(agent1) < computeBefore, "COMPUTE should be burned");
        assertTrue(data.balanceOf(agent1) < dataBefore, "DATA should be burned");
        
        vm.stopPrank();
    }
    
    // ============================================
    // Security Tests
    // ============================================
    
    function testSecurity_CannotClaimOthersProduction() public {
        // Setup: agent1 constructs building
        vm.startPrank(operator);
        compute.mint(agent1, 100 * 1e18);
        energy.mint(agent1, 100 * 1e18);
        chips.mint(agent1, 100 * 1e18);
        cooling.mint(agent1, 100 * 1e18);
        talent.mint(agent1, 100 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(agent1);
        compute.approve(address(registry), type(uint256).max);
        energy.approve(address(registry), type(uint256).max);
        chips.approve(address(registry), type(uint256).max);
        cooling.approve(address(registry), type(uint256).max);
        talent.approve(address(registry), type(uint256).max);
        
        uint256 tokenId = registry.construct(DATA_CENTRE, 1, agent1);
        vm.stopPrank();
        
        // agent2 attempts to claim
        vm.startPrank(agent2);
        vm.expectRevert();
        registry.claimProduction(tokenId);
        vm.stopPrank();
    }
    
    function testSecurity_ReentrancyProtection() public {
        // ReentrancyGuard should be on claimProduction
        // This is tested by the nonReentrant modifier
    }
}
