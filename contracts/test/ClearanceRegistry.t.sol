// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClearanceRegistry} from "../src/ClearanceRegistry.sol";

contract ClearanceRegistryTest is Test {
    ClearanceRegistry public registry;
    
    address public admin = address(0x1);
    address public operator = address(0x2);
    address public agent1 = address(0x3);
    address public agent2 = address(0x4);
    address public guardClauseMarketplace = address(0x5);
    address public complianceDriftOracle = address(0x6);

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    event ClearanceUpdated(address indexed agent, uint256 newLevel);
    event ClearanceBurned(address indexed agent, uint256 burnAmount);

    function setUp() public {
        vm.startPrank(admin);
        registry = new ClearanceRegistry();
        registry.grantRole(OPERATOR_ROLE, operator);
        registry.grantRole(OPERATOR_ROLE, guardClauseMarketplace);
        registry.grantRole(OPERATOR_ROLE, complianceDriftOracle);
        vm.stopPrank();
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       UPDATE CLEARANCE TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_updateClearance_operatorOnly() public {
        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit ClearanceUpdated(agent1, 5000);
        registry.updateClearance(agent1, 5000);

        assertEq(registry.getClearance(agent1), 5000);
    }

    function test_updateClearance_revertNonOperator() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.updateClearance(agent1, 5000);
    }

    function test_updateClearance_multipleAgents() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 3000);
        registry.updateClearance(agent2, 7500);
        vm.stopPrank();

        assertEq(registry.getClearance(agent1), 3000);
        assertEq(registry.getClearance(agent2), 7500);
    }

    function test_updateClearance_overwrite() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 5000);
        assertEq(registry.getClearance(agent1), 5000);

        registry.updateClearance(agent1, 8000);
        assertEq(registry.getClearance(agent1), 8000);
        vm.stopPrank();
    }

    function test_updateClearance_zeroLevel() public {
        vm.prank(operator);
        registry.updateClearance(agent1, 0);
        assertEq(registry.getClearance(agent1), 0);
    }

    function test_updateClearance_maxLevel() public {
        uint256 maxLevel = type(uint256).max;
        vm.prank(operator);
        registry.updateClearance(agent1, maxLevel);
        assertEq(registry.getClearance(agent1), maxLevel);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       BURN CLEARANCE TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_burnClearance_decreasesBurnRate() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000); // Initial 100% burn rate
        vm.stopPrank();

        // GuardClauseMarketplace burns 1% (100 bps)
        vm.prank(guardClauseMarketplace);
        registry.burnClearance(agent1, 100);

        assertEq(registry.getBurnRate(agent1), 9900);
    }

    function test_burnClearance_complianceDriftOracle() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000);
        vm.stopPrank();

        // ComplianceDriftOracle burns 2% (200 bps)
        vm.prank(complianceDriftOracle);
        registry.burnClearance(agent1, 200);

        assertEq(registry.getBurnRate(agent1), 9800);
    }

    function test_burnClearance_operatorCanCall() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000);
        registry.burnClearance(agent1, 500);
        vm.stopPrank();

        assertEq(registry.getBurnRate(agent1), 9500);
    }

    function test_burnClearance_revertNonOperator() public {
        vm.prank(agent2);
        vm.expectRevert();
        registry.burnClearance(agent1, 100);
    }

    function test_burnClearance_zeroBurn() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 5000);
        registry.burnClearance(agent1, 0);
        vm.stopPrank();

        assertEq(registry.getBurnRate(agent1), 5000);
    }

    function test_burnClearance_preventUnderflow() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 500); // Only 500 bps to burn
        
        // Try to burn more than available
        vm.expectRevert();
        registry.burnClearance(agent1, 1000);
        vm.stopPrank();
    }

    function test_burnClearance_burnToZero() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 500);
        registry.burnClearance(agent1, 500);
        vm.stopPrank();

        assertEq(registry.getBurnRate(agent1), 0);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       GET CLEARANCE TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_getClearance_unsetAgent() public {
        assertEq(registry.getClearance(agent1), 0);
    }

    function test_getClearance_publicView() public view {
        // This test verifies getClearance is public and returns correct value
        uint256 level = registry.getClearance(agent1);
        assertEq(level, 0);
    }

    function test_getClearance_afterUpdate() public {
        vm.prank(operator);
        registry.updateClearance(agent1, 7500);

        assertEq(registry.getClearance(agent1), 7500);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       INTEGRATION TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function test_integration_guardClauseMarketplaceWorkflow() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000);
        vm.stopPrank();

        // Guard clause marketplace activation burns 1% (100 bps)
        vm.prank(guardClauseMarketplace);
        registry.burnClearance(agent1, 100);

        assertEq(registry.getClearance(agent1), 10000);
        assertEq(registry.getBurnRate(agent1), 9900);
    }

    function test_integration_complianceDriftOracleWorkflow() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000);
        vm.stopPrank();

        // Compliance drift oracle recalibration burns 2% (200 bps)
        vm.prank(complianceDriftOracle);
        registry.burnClearance(agent1, 200);

        assertEq(registry.getClearance(agent1), 10000);
        assertEq(registry.getBurnRate(agent1), 9800);
    }

    function test_integration_consecutiveBurns() public {
        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, 10000);
        vm.stopPrank();

        // First burn: 1% by GuardClauseMarketplace
        vm.prank(guardClauseMarketplace);
        registry.burnClearance(agent1, 100);
        assertEq(registry.getBurnRate(agent1), 9900);

        // Second burn: 2% by ComplianceDriftOracle
        vm.prank(complianceDriftOracle);
        registry.burnClearance(agent1, 200);
        assertEq(registry.getBurnRate(agent1), 9700);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       FUZZ TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    function testFuzz_updateClearance(uint256 level) public {
        vm.prank(operator);
        registry.updateClearance(agent1, level);
        assertEq(registry.getClearance(agent1), level);
    }

    function testFuzz_burnClearance(uint256 initialBurnRate, uint256 burnAmount) public {
        initialBurnRate = bound(initialBurnRate, 0, 10000);
        burnAmount = bound(burnAmount, 0, initialBurnRate);

        vm.startPrank(operator);
        registry.updateClearance(agent1, 10000);
        registry.setBurnRate(agent1, initialBurnRate);
        registry.burnClearance(agent1, burnAmount);
        vm.stopPrank();

        assertEq(registry.getBurnRate(agent1), initialBurnRate - burnAmount);
    }
}
