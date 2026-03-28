// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/RoleRegistry.sol";

contract RoleRegistryTest is Test {
    RoleRegistry public registry;

    address public admin = address(1);
    address public operator = address(2);
    address public unauthorized = address(3);
    address public talentHubAddr = address(4);
    address public regulatoryPowerAddr = address(5);
    address public dataSovereignAddr = address(6);
    address public computeSuperpowerAddr = address(7);
    address public chipsMagnateAddr = address(8);

    event RoleAssigned(uint8 indexed role, address indexed newHolder, uint256 indexed epoch);
    event EpochReset(uint256 newEpoch);

    function setUp() public {
        registry = new RoleRegistry(admin);

        // Grant OPERATOR_ROLE to operator
        vm.startPrank(admin);
        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        vm.stopPrank();
    }

    // =========================================================================
    // Constructor & Initialization Tests
    // =========================================================================

    function test_Constructor() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(registry.currentEpoch(), 0);
    }

    function test_ConstructorRevertsOnZeroAdmin() public {
        vm.expectRevert("RoleRegistry: zero admin");
        new RoleRegistry(address(0));
    }

    // =========================================================================
    // assignRole Tests
    // =========================================================================

    function test_AssignRole_TalentHub() public {
        vm.prank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);

        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);
    }

    function test_AssignRole_RegulatoryPower() public {
        vm.prank(operator);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulatoryPowerAddr);

        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), regulatoryPowerAddr);
    }

    function test_AssignRole_AllRoles() public {
        vm.startPrank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulatoryPowerAddr);
        registry.assignRole(RoleRegistry.Role.DATA_SOVEREIGN, dataSovereignAddr);
        registry.assignRole(RoleRegistry.Role.COMPUTE_SUPERPOWER, computeSuperpowerAddr);
        registry.assignRole(RoleRegistry.Role.CHIPS_MAGNATE, chipsMagnateAddr);
        vm.stopPrank();

        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);
        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), regulatoryPowerAddr);
        assertEq(registry.getRole(RoleRegistry.Role.DATA_SOVEREIGN), dataSovereignAddr);
        assertEq(registry.getRole(RoleRegistry.Role.COMPUTE_SUPERPOWER), computeSuperpowerAddr);
        assertEq(registry.getRole(RoleRegistry.Role.CHIPS_MAGNATE), chipsMagnateAddr);
    }

    function test_AssignRole_Reassignment() public {
        address newTalentHub = address(9);

        // First assignment
        vm.prank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);

        // Reassignment
        vm.prank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, newTalentHub);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), newTalentHub);
    }

    function test_AssignRole_RevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
    }

    function test_AssignRole_EmitsEvent() public {
        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit RoleAssigned(uint8(RoleRegistry.Role.TALENT_HUB), talentHubAddr, 0);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
    }

    // =========================================================================
    // getRole Tests
    // =========================================================================

    function test_GetRole_Unassigned() public view {
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), address(0));
    }

    function test_GetRole_AfterAssignment() public {
        vm.prank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);

        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);
    }

    function test_GetRole_MultipleRoles() public {
        vm.startPrank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulatoryPowerAddr);
        vm.stopPrank();

        // Check each role independently
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);
        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), regulatoryPowerAddr);
        assertEq(registry.getRole(RoleRegistry.Role.DATA_SOVEREIGN), address(0)); // Still unassigned
    }

    // =========================================================================
    // resetEpoch Tests
    // =========================================================================

    function test_ResetEpoch_ClearsRoles() public {
        // Assign all roles
        vm.startPrank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulatoryPowerAddr);
        registry.assignRole(RoleRegistry.Role.DATA_SOVEREIGN, dataSovereignAddr);
        registry.assignRole(RoleRegistry.Role.COMPUTE_SUPERPOWER, computeSuperpowerAddr);
        registry.assignRole(RoleRegistry.Role.CHIPS_MAGNATE, chipsMagnateAddr);

        // Reset epoch
        registry.resetEpoch();
        vm.stopPrank();

        // All roles should be cleared
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), address(0));
        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), address(0));
        assertEq(registry.getRole(RoleRegistry.Role.DATA_SOVEREIGN), address(0));
        assertEq(registry.getRole(RoleRegistry.Role.COMPUTE_SUPERPOWER), address(0));
        assertEq(registry.getRole(RoleRegistry.Role.CHIPS_MAGNATE), address(0));
    }

    function test_ResetEpoch_IncrementsEpoch() public {
        assertEq(registry.currentEpoch(), 0);

        vm.prank(operator);
        registry.resetEpoch();

        assertEq(registry.currentEpoch(), 1);
    }

    function test_ResetEpoch_MultipleResets() public {
        assertEq(registry.currentEpoch(), 0);

        vm.startPrank(operator);
        registry.resetEpoch();
        assertEq(registry.currentEpoch(), 1);

        registry.resetEpoch();
        assertEq(registry.currentEpoch(), 2);

        registry.resetEpoch();
        assertEq(registry.currentEpoch(), 3);
        vm.stopPrank();
    }

    function test_ResetEpoch_RevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.resetEpoch();
    }

    function test_ResetEpoch_ThenReassign() public {
        // Epoch 0: Assign first set
        vm.startPrank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);

        // Reset to Epoch 1
        registry.resetEpoch();
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), address(0));

        // Assign new holder in Epoch 1
        address newTalentHub = address(10);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, newTalentHub);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), newTalentHub);
        vm.stopPrank();
    }

    // =========================================================================
    // Integration Tests
    // =========================================================================

    function test_FullEpochCycle() public {
        // Epoch 0: Assign roles
        vm.startPrank(operator);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHubAddr);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulatoryPowerAddr);
        registry.assignRole(RoleRegistry.Role.DATA_SOVEREIGN, dataSovereignAddr);

        assertEq(registry.currentEpoch(), 0);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), talentHubAddr);

        // Move to Epoch 1
        registry.resetEpoch();
        assertEq(registry.currentEpoch(), 1);

        // Assign new roles in Epoch 1
        address newTalentHub = address(9);
        address newRegulatory = address(10);
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, newTalentHub);
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, newRegulatory);

        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), newTalentHub);
        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), newRegulatory);

        // DATA_SOVEREIGN should remain unassigned in Epoch 1
        assertEq(registry.getRole(RoleRegistry.Role.DATA_SOVEREIGN), address(0));

        vm.stopPrank();
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_AssignRole(uint8 roleIndex, address holder) public {
        // Constrain roleIndex to valid roles (0-4)
        roleIndex = uint8(bound(roleIndex, 0, 4));
        vm.assume(holder != address(0)); // Avoid zero address assignments

        RoleRegistry.Role role = RoleRegistry.Role(roleIndex);

        vm.prank(operator);
        registry.assignRole(role, holder);

        assertEq(registry.getRole(role), holder);
    }

    function testFuzz_MultipleAssignments(address holder1, address holder2) public {
        vm.assume(holder1 != address(0) && holder2 != address(0));
        vm.assume(holder1 != holder2);

        vm.startPrank(operator);

        // Assign to role 0
        registry.assignRole(RoleRegistry.Role.TALENT_HUB, holder1);
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), holder1);

        // Assign to role 1
        registry.assignRole(RoleRegistry.Role.REGULATORY_POWER, holder2);
        assertEq(registry.getRole(RoleRegistry.Role.REGULATORY_POWER), holder2);

        // First role should remain unchanged
        assertEq(registry.getRole(RoleRegistry.Role.TALENT_HUB), holder1);

        vm.stopPrank();
    }
}
