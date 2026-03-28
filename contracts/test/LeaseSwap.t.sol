// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {OrderBook} from "../src/OrderBook.sol";
import {RateToken} from "../src/RateToken.sol";
import {ResourceToken} from "../src/ResourceToken.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationLedger} from "../src/ReputationLedger.sol";
import {AuditLog} from "../src/AuditLog.sol";
import {EpochManager} from "../src/EpochManager.sol";

contract LeaseSwapTest is Test {
    OrderBook public orderBook;
    RateToken public rateToken;
    ResourceToken public computeToken;
    ResourceToken public energyToken;
    AgentRegistry public agentRegistry;
    ReputationLedger public reputationLedger;
    AuditLog public auditLog;
    EpochManager public epochManager;

    address public admin = address(0x1);
    address public initiator = address(0x10);
    address public counterparty = address(0x20);

    uint256 public initiatorAgentId;
    uint256 public counterpartyAgentId;

    event LeaseOrderPosted(uint256 indexed orderId, address indexed initiator, uint256 epochs);
    event LeaseMatched(uint256 indexed orderId, address indexed counterparty);
    event LeaseCancelled(uint256 indexed orderId);

    function setUp() public {
        vm.startPrank(admin);
        rateToken = new RateToken(admin);
        computeToken = new ResourceToken("Compute", "COMPUTE", admin);
        energyToken = new ResourceToken("Energy", "ENERGY", admin);
        agentRegistry = new AgentRegistry(admin);
        reputationLedger = new ReputationLedger(admin);
        auditLog = new AuditLog(admin);
        epochManager = new EpochManager(admin);

        orderBook = new OrderBook(
            address(rateToken), address(agentRegistry), address(reputationLedger), address(auditLog), address(epochManager), admin
        );

        // Grant roles
        reputationLedger.grantRole(reputationLedger.RECORDER_ROLE(), address(orderBook));
        auditLog.grantRole(auditLog.LOGGER_ROLE(), address(orderBook));
        computeToken.grantRole(computeToken.MINTER_ROLE(), admin);
        energyToken.grantRole(energyToken.MINTER_ROLE(), admin);

        // Register agents
        initiatorAgentId = agentRegistry.registerAgent(initiator, "ipfs://initiator");
        counterpartyAgentId = agentRegistry.registerAgent(counterparty, "ipfs://counterparty");

        // Grant lease permissions (ACTION_LEASE_POST = 7, ACTION_LEASE_MATCH = 8)
        agentRegistry.grantAction(initiatorAgentId, 7); // ACTION_LEASE_POST
        agentRegistry.grantAction(counterpartyAgentId, 8); // ACTION_LEASE_MATCH

        // Mint tokens
        computeToken.mint(initiator, 10_000 * 1e18);
        energyToken.mint(counterparty, 10_000 * 1e18);

        vm.stopPrank();

        // Approve OrderBook
        vm.prank(initiator);
        computeToken.approve(address(orderBook), type(uint256).max);
        vm.prank(counterparty);
        energyToken.approve(address(orderBook), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // postLeaseOrder Tests
    // -------------------------------------------------------------------------

    function test_PostLeaseOrder_Succeeds() public {
        vm.prank(initiator);
        uint256 leaseId = orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        assertEq(leaseId, 1);

        OrderBook.LeaseOrder memory lease = orderBook.getLeaseOrder(1);
        assertEq(lease.initiator, initiator);
        assertEq(lease.resource1, address(computeToken));
        assertEq(lease.amount1, 100 * 1e18);
        assertEq(lease.resource2, address(energyToken));
        assertEq(lease.amount2, 50 * 1e18);
        assertEq(lease.epochs, 5);
        assertEq(lease.repPenalty, 2000);
        assertEq(uint8(lease.status), uint8(OrderBook.LeaseStatus.ACTIVE));
    }

    function test_PostLeaseOrder_EscrowsTokens() public {
        uint256 balBefore = computeToken.balanceOf(initiator);

        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        assertEq(computeToken.balanceOf(initiator), balBefore - 100 * 1e18);
        assertEq(computeToken.balanceOf(address(orderBook)), 100 * 1e18);
    }

    function test_PostLeaseOrder_RevertsMinEpochs() public {
        vm.prank(initiator);
        vm.expectRevert("OrderBook: below min epoch duration");
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            1, 2000 // Below MIN_LEASE_EPOCHS (2)
        );
    }

    function test_PostLeaseOrder_RevertsMinRepPenalty() public {
        vm.prank(initiator);
        vm.expectRevert("OrderBook: min 0.2x reputation penalty");
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 1000
        );
    }

    function test_PostLeaseOrder_RevertsZeroAmount() public {
        vm.prank(initiator);
        vm.expectRevert("OrderBook: zero amount");
        orderBook.postLeaseOrder(
            address(computeToken), 0,
            address(energyToken), 50 * 1e18,
            5, 2000
        );
    }

    function test_PostLeaseOrder_RevertsSameResource() public {
        vm.prank(initiator);
        vm.expectRevert("OrderBook: same resource");
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(computeToken), 50 * 1e18,
            5, 2000
        );
    }

    // -------------------------------------------------------------------------
    // executeMatchedLease Tests
    // -------------------------------------------------------------------------

    function test_ExecuteMatchedLease_Succeeds() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        uint256 initiatorEnergyBefore = energyToken.balanceOf(initiator);
        uint256 counterpartyComputeBefore = computeToken.balanceOf(counterparty);

        vm.prank(counterparty);
        orderBook.executeMatchedLease(1);

        // Initiator gets energy
        assertEq(energyToken.balanceOf(initiator), initiatorEnergyBefore + 50 * 1e18);
        // Counterparty gets compute
        assertEq(computeToken.balanceOf(counterparty), counterpartyComputeBefore + 100 * 1e18);

        OrderBook.LeaseOrder memory lease = orderBook.getLeaseOrder(1);
        assertEq(uint8(lease.status), uint8(OrderBook.LeaseStatus.MATCHED));
        assertEq(lease.counterparty, counterparty);
        assertGt(lease.expiryTimestamp, block.timestamp);
    }

    function test_ExecuteMatchedLease_RevertsSelfMatch() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        // Grant LEASE_MATCH to initiator too
        vm.prank(admin);
        agentRegistry.grantAction(initiatorAgentId, 8);

        vm.prank(initiator);
        vm.expectRevert("OrderBook: self-match lease");
        orderBook.executeMatchedLease(1);
    }

    function test_ExecuteMatchedLease_RevertsNotActive() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        // Cancel first
        vm.prank(initiator);
        orderBook.cancelLeaseOrder(1);

        vm.prank(counterparty);
        vm.expectRevert("OrderBook: lease not active");
        orderBook.executeMatchedLease(1);
    }

    // -------------------------------------------------------------------------
    // cancelLeaseOrder Tests
    // -------------------------------------------------------------------------

    function test_CancelLeaseOrder_Succeeds() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        uint256 balBefore = computeToken.balanceOf(initiator);

        vm.prank(initiator);
        orderBook.cancelLeaseOrder(1);

        assertEq(computeToken.balanceOf(initiator), balBefore + 100 * 1e18);

        OrderBook.LeaseOrder memory lease = orderBook.getLeaseOrder(1);
        assertEq(uint8(lease.status), uint8(OrderBook.LeaseStatus.CANCELLED));
    }

    function test_CancelLeaseOrder_RevertsNotInitiator() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        vm.prank(counterparty);
        vm.expectRevert("OrderBook: not initiator");
        orderBook.cancelLeaseOrder(1);
    }

    function test_CancelLeaseOrder_RevertsAlreadyMatched() public {
        vm.prank(initiator);
        orderBook.postLeaseOrder(
            address(computeToken), 100 * 1e18,
            address(energyToken), 50 * 1e18,
            5, 2000
        );

        vm.prank(counterparty);
        orderBook.executeMatchedLease(1);

        vm.prank(initiator);
        vm.expectRevert("OrderBook: lease not active");
        orderBook.cancelLeaseOrder(1);
    }
}
