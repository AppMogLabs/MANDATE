// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ReflexWindowManager.sol";

contract ReflexWindowManagerTest is Test {
    ReflexWindowManager public reflexManager;
    
    address public owner;
    address public oracleRole;
    address public operatorRole;
    address public agent1;
    address public agent2;
    address public unauthorizedUser;
    
    // Role keys for signing
    uint256 public oracleKey = 0xA11CE;
    uint256 public operatorKey = 0xB0B;
    
    event ReflexWindowOpened(uint256 indexed eventId, uint64 startTimestamp, uint64 endTimestamp);
    event ReflexWindowClosed(uint256 indexed eventId);
    event NonceUsed(address indexed agent, uint256 indexed eventId);
    
    function setUp() public {
        owner = address(this);
        oracleRole = vm.addr(oracleKey);
        operatorRole = vm.addr(operatorKey);
        agent1 = address(0x1111);
        agent2 = address(0x2222);
        unauthorizedUser = address(0x9999);
        
        reflexManager = new ReflexWindowManager();
        
        // Grant roles
        reflexManager.grantRole(reflexManager.ORACLE_ROLE(), oracleRole);
        reflexManager.grantRole(reflexManager.OPERATOR_ROLE(), operatorRole);
    }
    
    // ============ Window Opening Tests ============
    
    function test_OpenReflexWindow_SetsCorrectTimestamps() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        vm.expectEmit(true, true, true, true);
        emit ReflexWindowOpened(eventId, uint64(block.timestamp), uint64(block.timestamp) + 100);
        reflexManager.openReflexWindow(eventId);
        
        ReflexWindowManager.ReflexWindow memory window = reflexManager.getReflexWindow(eventId);
        assertEq(window.startTimestamp, uint64(block.timestamp));
        assertEq(window.endTimestamp, uint64(block.timestamp) + 100);
        assertTrue(window.active);
    }
    
    function test_OpenReflexWindow_OnlyOracleRole() public {
        uint256 eventId = 1;
        
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        reflexManager.openReflexWindow(eventId);
    }
    
    function test_OpenReflexWindow_CanOpenMultipleWindows() public {
        vm.startPrank(oracleRole);
        
        reflexManager.openReflexWindow(1);
        reflexManager.openReflexWindow(2);
        reflexManager.openReflexWindow(3);
        
        vm.stopPrank();
        
        ReflexWindowManager.ReflexWindow memory w1 = reflexManager.getReflexWindow(1);
        ReflexWindowManager.ReflexWindow memory w2 = reflexManager.getReflexWindow(2);
        ReflexWindowManager.ReflexWindow memory w3 = reflexManager.getReflexWindow(3);
        
        assertTrue(w1.active && w2.active && w3.active);
        assertEq(w1.startTimestamp, w2.startTimestamp); // Opened in same tx, same timestamp
    }
    
    // ============ Window Closing Tests ============
    
    function test_CloseReflexWindow_SetsActiveFalse() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(operatorRole);
        vm.expectEmit(true, true, true, true);
        emit ReflexWindowClosed(eventId);
        reflexManager.closeReflexWindow(eventId);
        
        ReflexWindowManager.ReflexWindow memory window = reflexManager.getReflexWindow(eventId);
        assertFalse(window.active);
    }
    
    function test_CloseReflexWindow_OnlyOperatorRole() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        reflexManager.closeReflexWindow(eventId);
    }
    
    // ============ Reflex Active Timing Tests ============
    
    function test_IsReflexActive_TrueWithinWindow() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        assertTrue(reflexManager.isReflexActive(eventId));
        
        // Still active at 50ms into window
        vm.warp(block.timestamp + 50);
        assertTrue(reflexManager.isReflexActive(eventId));
    }
    
    function test_IsReflexActive_FalseAfterWindow() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        // Advance past 100 second window
        vm.warp(block.timestamp + 101);
        assertFalse(reflexManager.isReflexActive(eventId));
    }
    
    function test_IsReflexActive_FalseWhenInactive() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(operatorRole);
        reflexManager.closeReflexWindow(eventId);
        
        assertTrue(!reflexManager.isReflexActive(eventId));
    }
    
    function test_IsReflexActive_FalseForNonexistentWindow() public view {
        assertFalse(reflexManager.isReflexActive(999));
    }
    
    // ============ Nonce Management Tests ============
    
    function test_MarkNonceUsed_RecordsUsage() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(address(this)); // Simulate OrderBook calling
        reflexManager.markNonceUsed(agent1, eventId);
        
        assertTrue(reflexManager.hasUsedNonce(agent1, eventId));
    }
    
    function test_MarkNonceUsed_EmitsEvent() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.expectEmit(true, true, true, true);
        emit NonceUsed(agent1, eventId);
        vm.prank(address(this));
        reflexManager.markNonceUsed(agent1, eventId);
    }
    
    function test_HasUsedNonce_FalseInitially() public view {
        assertFalse(reflexManager.hasUsedNonce(agent1, 1));
    }
    
    function test_HasUsedNonce_TrueAfterMarking() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(address(this));
        reflexManager.markNonceUsed(agent1, eventId);
        
        assertTrue(reflexManager.hasUsedNonce(agent1, eventId));
    }
    
    function test_Nonce_DifferentAgentsIndependent() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        vm.prank(address(this));
        reflexManager.markNonceUsed(agent1, eventId);
        
        assertFalse(reflexManager.hasUsedNonce(agent2, eventId));
        assertTrue(reflexManager.hasUsedNonce(agent1, eventId));
    }
    
    function test_Nonce_DifferentEventsIndependent() public {
        vm.startPrank(oracleRole);
        reflexManager.openReflexWindow(1);
        reflexManager.openReflexWindow(2);
        vm.stopPrank();
        
        vm.prank(address(this));
        reflexManager.markNonceUsed(agent1, 1);
        
        assertFalse(reflexManager.hasUsedNonce(agent1, 2));
        assertTrue(reflexManager.hasUsedNonce(agent1, 1));
    }
    
    // ============ Edge Case Tests ============
    
    function test_MultipleWindowsTimingIndependent() public {
        vm.startPrank(oracleRole);
        reflexManager.openReflexWindow(1);
        reflexManager.openReflexWindow(2);
        vm.stopPrank();
        
        vm.warp(block.timestamp + 50);
        
        assertTrue(reflexManager.isReflexActive(1));
        assertTrue(reflexManager.isReflexActive(2));
        
        // Close window 1 only
        vm.prank(operatorRole);
        reflexManager.closeReflexWindow(1);
        
        assertFalse(reflexManager.isReflexActive(1));
        assertTrue(reflexManager.isReflexActive(2));
    }
    
    function test_WindowAtExactEndTimestamp() public {
        uint256 eventId = 1;
        
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(eventId);
        
        uint64 endTime = uint64(block.timestamp) + 100;
        vm.warp(endTime);
        
        // Should still be active at exact endTimestamp
        assertTrue(reflexManager.isReflexActive(eventId));
        
        // Should be inactive after endTimestamp
        vm.warp(endTime + 1);
        assertFalse(reflexManager.isReflexActive(eventId));
    }
    
    function test_AccessControl_NonOracleCannotOpen() public {
        vm.startPrank(operatorRole);
        vm.expectRevert();
        reflexManager.openReflexWindow(1);
        vm.stopPrank();
    }
    
    function test_AccessControl_NonOperatorCannotClose() public {
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(1);
        
        vm.startPrank(operatorRole);
        reflexManager.closeReflexWindow(1);
        vm.stopPrank();
        
        // Now try with oracle role to close a new window
        vm.prank(oracleRole);
        reflexManager.openReflexWindow(2);
        
        vm.prank(oracleRole); // Oracle tries to close
        vm.expectRevert();
        reflexManager.closeReflexWindow(2);
    }
}
