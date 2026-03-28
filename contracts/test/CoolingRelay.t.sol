// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CoolingRelay} from "../src/CoolingRelay.sol";
import {ReflexWindowManager} from "../src/ReflexWindowManager.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";

contract CoolingRelayTest is Test {
    CoolingRelay public relay;
    ReflexWindowManager public reflexManager;
    RoleRegistry public roleRegistry;

    address public admin = address(0x1);
    address public agent1 = address(0x10);
    address public agent2 = address(0x20);
    address public agent3 = address(0x30);
    address public talentHub = address(0x40);

    event GraphJoined(address indexed agent, address[] neighbours);
    event ExitRequested(address indexed agent, uint256 eligibleAtTimestamp);
    event ExitCompleted(address indexed agent);
    event PropagationQueued(address indexed source, uint256 indexed eventId, uint256 propagationTimestamp);
    event FailurePropagated(address indexed source, address indexed target, uint8 riskPercent);

    function setUp() public {
        vm.startPrank(admin);
        reflexManager = new ReflexWindowManager();
        roleRegistry = new RoleRegistry(admin);
        roleRegistry.grantRole(roleRegistry.OPERATOR_ROLE(), admin);

        relay = new CoolingRelay(address(reflexManager), address(roleRegistry), admin);

        // Grant ORACLE_ROLE to admin on ReflexWindowManager for testing
        reflexManager.grantRole(reflexManager.ORACLE_ROLE(), admin);
        reflexManager.grantRole(reflexManager.OPERATOR_ROLE(), admin);

        // Assign Talent Hub role
        roleRegistry.assignRole(RoleRegistry.Role.TALENT_HUB, talentHub);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Constructor Tests
    // -------------------------------------------------------------------------

    function test_Constructor_Reverts() public {
        vm.expectRevert("CoolingRelay: zero reflexWindowManager");
        new CoolingRelay(address(0), address(roleRegistry), admin);

        vm.expectRevert("CoolingRelay: zero roleRegistry");
        new CoolingRelay(address(reflexManager), address(0), admin);

        vm.expectRevert("CoolingRelay: zero admin");
        new CoolingRelay(address(reflexManager), address(roleRegistry), address(0));
    }

    // -------------------------------------------------------------------------
    // joinGraph Tests
    // -------------------------------------------------------------------------

    function test_JoinGraph_Succeeds() public {
        address[] memory neighbours = new address[](1);
        neighbours[0] = agent2;

        vm.prank(agent1);
        relay.joinGraph(neighbours);

        assertTrue(relay.isInGraph(agent1));
        assertEq(relay.joinBlock(agent1), block.number);

        address[] memory n = relay.getNeighbours(agent1);
        assertEq(n.length, 1);
        assertEq(n[0], agent2);
    }

    function test_JoinGraph_MultipleNeighbours() public {
        address[] memory neighbours = new address[](2);
        neighbours[0] = agent2;
        neighbours[1] = agent3;

        vm.prank(agent1);
        relay.joinGraph(neighbours);

        address[] memory n = relay.getNeighbours(agent1);
        assertEq(n.length, 2);
    }

    function test_JoinGraph_RevertsAlreadyInGraph() public {
        address[] memory neighbours = new address[](1);
        neighbours[0] = agent2;

        vm.prank(agent1);
        relay.joinGraph(neighbours);

        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: already in graph");
        relay.joinGraph(neighbours);
    }

    function test_JoinGraph_RevertsEmptyNeighbours() public {
        address[] memory neighbours = new address[](0);

        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: empty neighbours");
        relay.joinGraph(neighbours);
    }

    function test_JoinGraph_RevertsSelfNeighbour() public {
        address[] memory neighbours = new address[](1);
        neighbours[0] = agent1;

        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: self-neighbour");
        relay.joinGraph(neighbours);
    }

    // -------------------------------------------------------------------------
    // exitGraph Tests
    // -------------------------------------------------------------------------

    function test_ExitGraph_RequestSucceeds() public {
        _joinAgent(agent1, agent2);

        vm.prank(agent1);
        relay.exitGraph();

        assertEq(relay.exitRequestBlock(agent1), block.number);
    }

    function test_ExitGraph_RevertsNotInGraph() public {
        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: not in graph");
        relay.exitGraph();
    }

    function test_ExitGraph_RevertsDoubleRequest() public {
        _joinAgent(agent1, agent2);

        vm.prank(agent1);
        relay.exitGraph();

        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: exit already requested");
        relay.exitGraph();
    }

    function test_CompleteExit_Succeeds() public {
        _joinAgent(agent1, agent2);

        vm.prank(agent1);
        relay.exitGraph();

        // Advance time past exit delay
        vm.roll(block.number + 201);

        vm.prank(agent1);
        relay.completeExit();

        assertFalse(relay.isInGraph(agent1));
        assertEq(relay.getNeighbours(agent1).length, 0);
    }

    function test_CompleteExit_RevertsBeforeDelay() public {
        _joinAgent(agent1, agent2);

        vm.prank(agent1);
        relay.exitGraph();

        // Don't advance time enough
        vm.roll(block.number + 100);

        vm.prank(agent1);
        vm.expectRevert("CoolingRelay: exit delay not elapsed");
        relay.completeExit();
    }

    // -------------------------------------------------------------------------
    // propagateFailure Tests
    // -------------------------------------------------------------------------

    function test_PropagateFailure_Succeeds() public {
        _joinAgent(agent1, agent2);
        _joinAgent(agent2, agent1);

        // Advance past lock-in
        vm.roll(block.number + 51);

        vm.prank(admin);
        relay.propagateFailure(agent1, 1);

        assertTrue(relay.failureProcessed(agent1, 1));
    }

    function test_PropagateFailure_RevertsNotInGraph() public {
        vm.prank(admin);
        vm.expectRevert("CoolingRelay: source not in graph");
        relay.propagateFailure(agent1, 1);
    }

    function test_PropagateFailure_RevertsAlreadyProcessed() public {
        _joinAgent(agent1, agent2);

        vm.roll(block.number + 51);

        vm.prank(admin);
        relay.propagateFailure(agent1, 1);

        vm.prank(admin);
        vm.expectRevert("CoolingRelay: already processed");
        relay.propagateFailure(agent1, 1);
    }

    function test_PropagateFailure_QueuesOnReflexActive() public {
        _joinAgent(agent1, agent2);

        // Open a reflex window
        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        vm.prank(admin);
        relay.propagateFailure(agent1, 1);

        // Should be queued, not processed
        assertFalse(relay.failureProcessed(agent1, 1));
        assertGt(relay.queuedPropagation(agent1, 1), 0);
    }

    function test_ExecuteQueuedPropagation_Succeeds() public {
        _joinAgent(agent1, agent2);
        _joinAgent(agent2, agent1);

        // Open reflex window and queue
        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        vm.prank(admin);
        relay.propagateFailure(agent1, 1);

        // Close reflex window and advance past queue delay
        vm.prank(admin);
        reflexManager.closeReflexWindow(1);
        vm.roll(block.number + 51);

        vm.prank(admin);
        relay.executeQueuedPropagation(agent1, 1);

        assertTrue(relay.failureProcessed(agent1, 1));
    }

    function test_ExecuteQueuedPropagation_RevertsNotQueued() public {
        vm.prank(admin);
        vm.expectRevert("CoolingRelay: not queued");
        relay.executeQueuedPropagation(agent1, 1);
    }

    // -------------------------------------------------------------------------
    // Talent Hub Exemption Tests
    // -------------------------------------------------------------------------

    function test_TalentHub_SkipsLockIn() public {
        // Join as talent hub agent
        address[] memory neighbours = new address[](1);
        neighbours[0] = agent1;

        vm.prank(talentHub);
        relay.joinGraph(neighbours);

        // Immediately eligible (no lock-in)
        assertTrue(relay.isPropagationEligible(talentHub));
    }

    function test_NonTalentHub_RequiresLockIn() public {
        _joinAgent(agent1, agent2);

        // Not eligible immediately
        assertFalse(relay.isPropagationEligible(agent1));

        // Eligible after lock-in
        vm.roll(block.number + 51);
        assertTrue(relay.isPropagationEligible(agent1));
    }

    // -------------------------------------------------------------------------
    // Propagation Eligibility Tests
    // -------------------------------------------------------------------------

    function test_PropagationEligible_NotInGraph() public view {
        assertFalse(relay.isPropagationEligible(agent1));
    }

    // -------------------------------------------------------------------------
    // Access Control Tests
    // -------------------------------------------------------------------------

    function test_PropagateFailure_RequiresOperatorRole() public {
        _joinAgent(agent1, agent2);

        vm.prank(agent2);
        vm.expectRevert();
        relay.propagateFailure(agent1, 1);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _joinAgent(address agent, address neighbour) internal {
        address[] memory neighbours = new address[](1);
        neighbours[0] = neighbour;
        vm.prank(agent);
        relay.joinGraph(neighbours);
    }
}
