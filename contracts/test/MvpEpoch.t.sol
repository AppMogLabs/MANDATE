// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MvpEpoch} from "../src/MvpEpoch.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }
}

contract MockOrderBook {
    mapping(address => uint256) public spot;

    function setSpot(address resource, uint256 price) external {
        spot[resource] = price;
    }

    function getSpotPrice(address resource) external view returns (uint256) {
        return spot[resource];
    }

    function getTWAP(address, uint256) external pure returns (uint256) {
        return 0;
    }
}

contract MvpEpochTest is Test {
    MvpEpoch internal epoch;
    MockERC20 internal rate;
    MockERC20 internal compute;
    MockERC20 internal chips;
    MockERC20 internal data;
    MockOrderBook internal book;

    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        rate = new MockERC20();
        compute = new MockERC20();
        chips = new MockERC20();
        data = new MockERC20();
        book = new MockOrderBook();
        book.setSpot(address(compute), 1.2e18);
        book.setSpot(address(chips), 2.1e18);
        book.setSpot(address(data), 1.8e18);

        epoch = new MvpEpoch(
            owner,
            address(book),
            address(rate),
            address(compute),
            address(chips),
            address(data)
        );
    }

    function _startEpoch(uint64 duration) internal {
        vm.prank(owner);
        epoch.startEpoch(duration);
    }

    function test_startEpoch_setsTimestamps() public {
        _startEpoch(7 days);
        assertEq(epoch.epochStart(), uint64(block.timestamp));
        assertEq(epoch.epochEnd(), uint64(block.timestamp) + 7 days);
        assertTrue(epoch.isActive());
        assertFalse(epoch.finalized());
    }

    function test_register_addsPlayerAndCommitsMandate() public {
        _startEpoch(7 days);
        bytes32 h = keccak256("buy chips aggressively");

        vm.prank(alice);
        epoch.register(h);

        assertEq(epoch.playerCount(), 1);
        assertTrue(epoch.registered(alice));
        assertEq(epoch.mandateHashOf(alice), h);
    }

    function test_register_twice_updatesMandateButNotPlayerList() public {
        _startEpoch(7 days);
        vm.startPrank(alice);
        epoch.register(keccak256("v1"));
        epoch.register(keccak256("v2"));
        vm.stopPrank();
        assertEq(epoch.playerCount(), 1);
        assertEq(epoch.mandateHashOf(alice), keccak256("v2"));
    }

    function test_updateMandate_requiresRegistration() public {
        _startEpoch(7 days);
        vm.prank(alice);
        vm.expectRevert(MvpEpoch.NotRegistered.selector);
        epoch.updateMandate(keccak256("x"));
    }

    function test_register_revertsBeforeEpochStart() public {
        vm.prank(alice);
        vm.expectRevert(MvpEpoch.EpochNotActive.selector);
        epoch.register(bytes32(0));
    }

    function test_finalize_revertsBeforeEnd() public {
        _startEpoch(7 days);
        vm.expectRevert(MvpEpoch.EpochNotOver.selector);
        epoch.finalize();
    }

    function test_finalize_scoresAllRegisteredPlayers() public {
        _startEpoch(1 days);

        rate.mint(alice, 1000e18);
        compute.mint(alice, 500e18); // × 1.2 = 600
        chips.mint(alice, 200e18);   // × 2.1 = 420
        data.mint(alice, 100e18);    // × 1.8 = 180
        // alice total = 1000 + 600 + 420 + 180 = 2200

        rate.mint(bob, 500e18);
        chips.mint(bob, 1000e18); // × 2.1 = 2100
        // bob total = 500 + 2100 = 2600

        vm.prank(alice);
        epoch.register(bytes32("alice-mandate"));
        vm.prank(bob);
        epoch.register(bytes32("bob-mandate"));

        vm.warp(block.timestamp + 1 days + 1);
        epoch.finalize();

        assertTrue(epoch.finalized());
        assertEq(epoch.finalScore(alice), 2200e18);
        assertEq(epoch.finalScore(bob), 2600e18);
    }

    function test_finalize_cannotBeCalledTwice() public {
        _startEpoch(1 days);
        vm.warp(block.timestamp + 1 days + 1);
        epoch.finalize();
        vm.expectRevert(MvpEpoch.EpochAlreadyFinalized.selector);
        epoch.finalize();
    }

    function test_currentValue_tracksPortfolioLive() public {
        _startEpoch(1 days);
        compute.mint(alice, 1000e18);
        assertEq(epoch.currentValue(alice), 1200e18); // 1000 × 1.2
        book.setSpot(address(compute), 1.5e18);
        assertEq(epoch.currentValue(alice), 1500e18);
    }

    function test_startEpoch_revertsIfPreviousNotFinalized() public {
        _startEpoch(1 days);
        vm.prank(owner);
        vm.expectRevert(MvpEpoch.EpochAlreadyStarted.selector);
        epoch.startEpoch(1 days);
    }

    function test_startEpoch_allowsRestartAfterFinalize() public {
        _startEpoch(1 days);
        vm.warp(block.timestamp + 1 days + 1);
        epoch.finalize();
        _startEpoch(2 days);
        assertTrue(epoch.isActive());
        assertEq(epoch.playerCount(), 0); // players list reset
    }
}
