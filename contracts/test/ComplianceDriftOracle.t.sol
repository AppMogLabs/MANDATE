// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ComplianceDriftOracle} from "../src/ComplianceDriftOracle.sol";
import {ClearanceRegistry} from "../src/ClearanceRegistry.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";

contract ComplianceDriftOracleTest is Test {
    ComplianceDriftOracle public oracle;
    ClearanceRegistry public clearance;
    RoleRegistry public roleRegistry;

    address public admin = address(0x1);
    address public regulator = address(0x10);
    address public agent1 = address(0x20);

    event DriftPublished(address indexed regulator, uint256[] scalars, uint256 timestamp);
    event ClearanceRecalibrated(address indexed agent, uint256 burnBps);

    function setUp() public {
        vm.startPrank(admin);
        clearance = new ClearanceRegistry();
        roleRegistry = new RoleRegistry(admin);
        roleRegistry.grantRole(roleRegistry.OPERATOR_ROLE(), admin);

        oracle = new ComplianceDriftOracle(address(clearance), address(roleRegistry), address(0), admin);

        // Assign Regulatory Power role
        roleRegistry.assignRole(RoleRegistry.Role.REGULATORY_POWER, regulator);

        // Grant OPERATOR_ROLE to oracle on ClearanceRegistry for burn operations
        clearance.grantRole(clearance.OPERATOR_ROLE(), address(oracle));

        // Set up regulator's burn rate so it can be burned
        clearance.grantRole(clearance.OPERATOR_ROLE(), admin);
        clearance.setBurnRate(regulator, 5000); // 50% burn rate
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Constructor Tests
    // -------------------------------------------------------------------------

    function test_Constructor_Reverts() public {
        vm.expectRevert("ComplianceDriftOracle: zero clearanceRegistry");
        new ComplianceDriftOracle(address(0), address(roleRegistry), address(0), admin);

        vm.expectRevert("ComplianceDriftOracle: zero roleRegistry");
        new ComplianceDriftOracle(address(clearance), address(0), address(0), admin);
    }

    // -------------------------------------------------------------------------
    // publishDriftVector Tests
    // -------------------------------------------------------------------------

    function test_PublishDriftVector_Succeeds() public {
        uint256[] memory scalars = new uint256[](3);
        scalars[0] = 5000;
        scalars[1] = 3000;
        scalars[2] = 7000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars);

        uint256[] memory result = oracle.getDriftForecast();
        assertEq(result.length, 3);
        assertEq(result[0], 5000);
        assertEq(result[1], 3000);
        assertEq(result[2], 7000);
        assertEq(oracle.publishCount(), 1);
    }

    function test_PublishDriftVector_NonRegulatorReverts() public {
        uint256[] memory scalars = new uint256[](1);
        scalars[0] = 5000;

        vm.prank(agent1);
        vm.expectRevert("ComplianceDriftOracle: not regulator");
        oracle.publishDriftVector(scalars);
    }

    function test_PublishDriftVector_CooldownReverts() public {
        uint256[] memory scalars = new uint256[](1);
        scalars[0] = 5000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars);

        // Try again immediately
        vm.prank(regulator);
        vm.expectRevert("ComplianceDriftOracle: publish cooldown");
        oracle.publishDriftVector(scalars);
    }

    function test_PublishDriftVector_CooldownSucceedsAfterDelay() public {
        uint256[] memory scalars = new uint256[](1);
        scalars[0] = 5000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars);

        vm.roll(block.number + 21);

        vm.prank(regulator);
        oracle.publishDriftVector(scalars);

        assertEq(oracle.publishCount(), 2);
    }

    function test_PublishDriftVector_EmptyScalarsReverts() public {
        uint256[] memory scalars = new uint256[](0);

        vm.prank(regulator);
        vm.expectRevert("ComplianceDriftOracle: empty scalars");
        oracle.publishDriftVector(scalars);
    }

    function test_PublishDriftVector_DeltaCapEnforced() public {
        uint256[] memory scalars1 = new uint256[](1);
        scalars1[0] = 5000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars1);

        vm.roll(block.number + 21);

        // Try to change by more than 10% (500 from 5000)
        uint256[] memory scalars2 = new uint256[](1);
        scalars2[0] = 6000; // +20% delta = 1000, cap = 500

        vm.prank(regulator);
        vm.expectRevert("ComplianceDriftOracle: delta too large");
        oracle.publishDriftVector(scalars2);
    }

    function test_PublishDriftVector_DeltaWithinCapSucceeds() public {
        uint256[] memory scalars1 = new uint256[](1);
        scalars1[0] = 5000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars1);

        vm.roll(block.number + 21);

        // 10% of 5000 = 500, so 5500 is OK
        uint256[] memory scalars2 = new uint256[](1);
        scalars2[0] = 5500;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars2);

        uint256[] memory result = oracle.getDriftForecast();
        assertEq(result[0], 5500);
    }

    function test_PublishDriftVector_ScalarExceedsMaxReverts() public {
        uint256[] memory scalars = new uint256[](1);
        scalars[0] = 10_001;

        vm.prank(regulator);
        vm.expectRevert("ComplianceDriftOracle: scalar exceeds max");
        oracle.publishDriftVector(scalars);
    }

    // -------------------------------------------------------------------------
    // recalibrateClearance Tests
    // -------------------------------------------------------------------------

    function test_RecalibrateClearance_NonSelfBurnsClearance() public {
        uint256 burnRateBefore = clearance.getBurnRate(regulator);

        vm.prank(regulator);
        oracle.recalibrateClearance(agent1);

        uint256 burnRateAfter = clearance.getBurnRate(regulator);
        assertEq(burnRateAfter, burnRateBefore - 200, "2% CLEARANCE burned from regulator");
    }

    function test_RecalibrateClearance_SelfDoesNotBurn() public {
        uint256 burnRateBefore = clearance.getBurnRate(regulator);

        vm.prank(regulator);
        oracle.recalibrateClearance(regulator);

        uint256 burnRateAfter = clearance.getBurnRate(regulator);
        assertEq(burnRateAfter, burnRateBefore, "Self-targeting does not burn");
    }

    function test_RecalibrateClearance_NonRegulatorReverts() public {
        vm.prank(agent1);
        vm.expectRevert("ComplianceDriftOracle: not regulator");
        oracle.recalibrateClearance(agent1);
    }

    function test_RecalibrateClearance_ZeroAgentReverts() public {
        vm.prank(regulator);
        vm.expectRevert("ComplianceDriftOracle: zero agent");
        oracle.recalibrateClearance(address(0));
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function test_GetPublisherDriftVector() public {
        uint256[] memory scalars = new uint256[](2);
        scalars[0] = 4000;
        scalars[1] = 6000;

        vm.prank(regulator);
        oracle.publishDriftVector(scalars);

        uint256[] memory result = oracle.getPublisherDriftVector(regulator);
        assertEq(result.length, 2);
        assertEq(result[0], 4000);
        assertEq(result[1], 6000);
    }

    function test_GetDriftForecast_EmptyByDefault() public view {
        uint256[] memory result = oracle.getDriftForecast();
        assertEq(result.length, 0);
    }
}
