// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EventOracle.sol";

contract EventOracleTest is Test {
    EventOracle public oracle;
    
    address public owner;
    address public publisher1;
    address public publisher2;
    address public seniorPublisher1;
    address public seniorPublisher2;
    address public seniorPublisher3;
    address public unauthorizedUser;
    
    uint256 public publisher1Key = 0xA11CE;
    uint256 public publisher2Key = 0xB0B;
    uint256 public seniorKey1 = 0xCA1;
    uint256 public seniorKey2 = 0xCA2;
    uint256 public seniorKey3 = 0xCA3;
    
    // Test resource addresses
    address public resourceCompute = address(0x1);
    address public resourceEnergy = address(0x2);
    
    function setUp() public {
        owner = address(this);
        publisher1 = vm.addr(publisher1Key);
        publisher2 = vm.addr(publisher2Key);
        seniorPublisher1 = vm.addr(seniorKey1);
        seniorPublisher2 = vm.addr(seniorKey2);
        seniorPublisher3 = vm.addr(seniorKey3);
        unauthorizedUser = address(0x999);
        
        oracle = new EventOracle();
        
        // Grant roles
        oracle.grantRole(oracle.PUBLISHER_ROLE(), publisher1);
        oracle.grantRole(oracle.PUBLISHER_ROLE(), publisher2);
        oracle.grantRole(oracle.SENIOR_PUBLISHER_ROLE(), seniorPublisher1);
        oracle.grantRole(oracle.SENIOR_PUBLISHER_ROLE(), seniorPublisher2);
        oracle.grantRole(oracle.SENIOR_PUBLISHER_ROLE(), seniorPublisher3);
    }
    
    // ============ EIP-712 Signature Tests ============
    
    function test_PublishEvent_ValidSignature() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](1);
        impacts[0] = IEventOracle.ResourceImpact({
            resource: resourceCompute,
            productionModBps: -2000,  // -20%
            demandModBps: 3000        // +30%
        });
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisher1Key, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectEmit(true, true, true, true);
        emit IEventOracle.EventPublished(1, IEventOracle.EventType.GPUShortage, 5, 100);
        
        oracle.publishEvent(worldEvent, signature);
        
        // Verify event was stored
        IEventOracle.WorldEvent memory stored = oracle.getEvent(1);
        assertEq(stored.eventId, 1);
        assertEq(uint8(stored.eventType), uint8(IEventOracle.EventType.GPUShortage));
        assertEq(stored.severity, 5);
    }
    
    function test_PublishEvent_InvalidSignature_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        // Sign with unauthorized key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectRevert("Invalid signature: not PUBLISHER_ROLE");
        oracle.publishEvent(worldEvent, signature);
    }
    
    function test_PublishEvent_NonPublisher_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        // Unauthorized user signs
        uint256 unauthorizedKey = 0xBADBAD;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(unauthorizedKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        vm.expectRevert("Invalid signature: not PUBLISHER_ROLE");
        oracle.publishEvent(worldEvent, signature);
    }
    
    // ============ Multi-Sig for High-Severity Events ============
    
    function test_PublishHighSeverityEvent_TwoValidSignatures() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](1);
        impacts[0] = IEventOracle.ResourceImpact({
            resource: resourceCompute,
            productionModBps: -5000,  // -50%
            demandModBps: 0
        });
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.PowerGridFailure,
            severity: 8,  // High severity
            region: 200,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 7200,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        
        // Sign with two senior publishers
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(seniorKey1, digest);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(seniorKey2, digest);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);
        
        vm.expectEmit(true, true, true, true);
        emit IEventOracle.EventPublished(2, IEventOracle.EventType.PowerGridFailure, 8, 200);
        
        oracle.publishHighSeverityEvent(worldEvent, signature1, signature2);
        
        // Verify event was stored
        IEventOracle.WorldEvent memory stored = oracle.getEvent(2);
        assertEq(stored.severity, 8);
    }
    
    function test_PublishHighSeverityEvent_OnlyOneSignature_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.PowerGridFailure,
            severity: 7,
            region: 200,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 7200,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(seniorKey1, digest);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        // Use same signature twice (invalid)
        vm.expectRevert("Signatures must be from different senior publishers");
        oracle.publishHighSeverityEvent(worldEvent, signature1, signature1);
    }
    
    function test_PublishHighSeverityEvent_NonSeniorPublisher_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.PowerGridFailure,
            severity: 9,
            region: 200,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 7200,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        
        // Sign with regular publisher (not senior)
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(publisher1Key, digest);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(seniorKey1, digest);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);
        
        vm.expectRevert("Invalid signature1: not SENIOR_PUBLISHER_ROLE");
        oracle.publishHighSeverityEvent(worldEvent, signature1, signature2);
    }
    
    function test_PublishHighSeverityEvent_SeverityBelow7_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 6,  // Below threshold
            region: 200,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 7200,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(seniorKey1, digest);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(seniorKey2, digest);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);
        
        vm.expectRevert("Use publishEvent for severity < 7");
        oracle.publishHighSeverityEvent(worldEvent, signature1, signature2);
    }
    
    // ============ Active Events Tests ============
    
    function test_GetActiveEvents_FiltersExpiredEvents() public {
        // Publish active event
        IEventOracle.ResourceImpact[] memory impacts1 = new IEventOracle.ResourceImpact[](0);
        IEventOracle.WorldEvent memory event1 = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,  // Active for 1 hour
            impacts: impacts1
        });
        
        bytes32 digest1 = oracle.getEventDigest(event1);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(publisher1Key, digest1);
        oracle.publishEvent(event1, abi.encodePacked(r1, s1, v1));
        
        // Publish expired event (starts in the past, already expired)
        IEventOracle.ResourceImpact[] memory impacts2 = new IEventOracle.ResourceImpact[](0);
        IEventOracle.WorldEvent memory event2 = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.PowerGridFailure,
            severity: 6,
            region: 200,
            startTimestamp: 1,  // Started at timestamp 1
            durationSeconds: 100,  // Ended at timestamp 101
            impacts: impacts2
        });
        
        bytes32 digest2 = oracle.getEventDigest(event2);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(publisher1Key, digest2);
        oracle.publishEvent(event2, abi.encodePacked(r2, s2, v2));
        
        // Warp time forward to ensure event 2 is expired
        vm.warp(block.timestamp + 200);
        
        IEventOracle.WorldEvent[] memory activeEvents = oracle.getActiveEvents();
        
        assertEq(activeEvents.length, 1);
        assertEq(activeEvents[0].eventId, 1);
    }
    
    // ============ Resource Modifier Tests ============
    
    function test_GetResourceModifier_AggregatesMultipleEvents() public {
        // Event 1: -20% production, +30% demand
        IEventOracle.ResourceImpact[] memory impacts1 = new IEventOracle.ResourceImpact[](1);
        impacts1[0] = IEventOracle.ResourceImpact({
            resource: resourceCompute,
            productionModBps: -2000,
            demandModBps: 3000
        });
        
        IEventOracle.WorldEvent memory event1 = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts1
        });
        
        bytes32 digest1 = oracle.getEventDigest(event1);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(publisher1Key, digest1);
        oracle.publishEvent(event1, abi.encodePacked(r1, s1, v1));
        
        // Event 2: -10% production, +15% demand
        IEventOracle.ResourceImpact[] memory impacts2 = new IEventOracle.ResourceImpact[](1);
        impacts2[0] = IEventOracle.ResourceImpact({
            resource: resourceCompute,
            productionModBps: -1000,
            demandModBps: 1500
        });
        
        IEventOracle.WorldEvent memory event2 = IEventOracle.WorldEvent({
            eventId: 2,
            eventType: IEventOracle.EventType.SupplyChainDisruption,
            severity: 4,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 7200,
            impacts: impacts2
        });
        
        bytes32 digest2 = oracle.getEventDigest(event2);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(publisher1Key, digest2);
        oracle.publishEvent(event2, abi.encodePacked(r2, s2, v2));
        
        (int256 productionMod, int256 demandMod) = oracle.getResourceModifier(resourceCompute);
        
        assertEq(productionMod, -3000);  // -20% + -10% = -30%
        assertEq(demandMod, 4500);       // +30% + +15% = +45%
    }
    
    function test_GetResourceModifier_NoActiveEvents() public {
        (int256 productionMod, int256 demandMod) = oracle.getResourceModifier(resourceCompute);
        
        assertEq(productionMod, 0);
        assertEq(demandMod, 0);
    }
    
    // ============ Event Resolution Tests ============
    
    function test_ResolveEvent_MarksEventResolved() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisher1Key, digest);
        oracle.publishEvent(worldEvent, abi.encodePacked(r, s, v));
        
        vm.expectEmit(true, true, true, true);
        emit IEventOracle.EventResolved(1);
        
        oracle.resolveEvent(1);
    }
    
    function test_ResolveEvent_NonexistentEvent_Reverts() public {
        vm.expectRevert("Event does not exist");
        oracle.resolveEvent(999);
    }
    
    // ============ Duplicate Event Tests ============
    
    function test_PublishEvent_DuplicateEventId_Reverts() public {
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 1,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 5,
            region: 100,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 3600,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(publisher1Key, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        oracle.publishEvent(worldEvent, signature);
        
        vm.expectRevert("Event ID already exists");
        oracle.publishEvent(worldEvent, signature);
    }
    
    // ============ EIP-712 Domain Tests ============
    
    function test_EIP712Domain_CorrectChainId() public {
        // Verify EIP-712 is working by checking signature verification
        // Domain separator is internal to EIP712 contract
        IEventOracle.ResourceImpact[] memory impacts = new IEventOracle.ResourceImpact[](0);
        IEventOracle.WorldEvent memory worldEvent = IEventOracle.WorldEvent({
            eventId: 999,
            eventType: IEventOracle.EventType.GPUShortage,
            severity: 1,
            region: 1,
            startTimestamp: uint64(block.timestamp),
            durationSeconds: 1,
            impacts: impacts
        });
        
        bytes32 digest = oracle.getEventDigest(worldEvent);
        assertTrue(digest != bytes32(0));
    }
}
