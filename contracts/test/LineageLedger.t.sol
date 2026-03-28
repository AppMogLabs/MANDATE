// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/LineageLedger.sol";
import "../src/RateToken.sol";
import "../src/ResourceToken.sol";
import "../src/AgentRegistry.sol";
import "../src/ReputationLedger.sol";
import "../src/AuditLog.sol";
import "../src/InformationMarket.sol";

contract LineageLedgerTest is Test {
    LineageLedger public ledger;
    RateToken public rateToken;
    ResourceToken public dataToken;
    AgentRegistry public agentRegistry;
    ReputationLedger public reputationLedger;
    AuditLog public auditLog;
    InformationMarket public infoMarket;

    address public admin = address(1);
    address public attacker = address(2);
    address public target = address(3);
    address public scanner = address(4);
    address public unauthorized = address(5);
    address public buildingRegistry = address(6); // Mock

    uint256 public attackerAgentId;
    uint256 public targetAgentId;
    uint256 public scannerAgentId;

    uint256 constant INITIAL_RATE = 500_000 * 1e18;
    uint256 constant INITIAL_DATA = 10_000 * 1e18;

    uint8 constant ACTION_POISON_PIPELINE = 11;
    uint8 constant ACTION_PURGE_DATA = 12;

    // Events
    event VulnerabilityWindowOpened(address indexed target, uint256 expiresAt, uint256 dataAmount);
    event PipelinePoisoned(address indexed attacker, address indexed target, uint8 newPurityScore, uint256 timestamp);
    event DataPurged(address indexed agent, uint256 dataAmountBurned, uint8 newPurityScore, uint256 timestamp);
    event CleanTrainingCredited(address indexed agent, uint8 newPurityScore, uint256 timestamp);
    event PurityScanned(address indexed scanner, address indexed target, uint8 purityScore, uint256 ratePaid, uint256 timestamp);

    function setUp() public {
        // Deploy core contracts
        rateToken = new RateToken(admin);
        dataToken = new ResourceToken("Data", "DATA", admin);
        agentRegistry = new AgentRegistry(admin);
        reputationLedger = new ReputationLedger(admin);
        auditLog = new AuditLog(admin);
        infoMarket = new InformationMarket(address(rateToken), admin);

        // Deploy LineageLedger
        ledger = new LineageLedger(
            address(agentRegistry),
            address(reputationLedger),
            address(auditLog),
            address(infoMarket),
            address(rateToken),
            address(dataToken),
            admin
        );

        vm.startPrank(admin);

        // Grant roles
        reputationLedger.grantRole(reputationLedger.BURNER_ROLE(), address(ledger));
        auditLog.grantRole(auditLog.LOGGER_ROLE(), address(ledger));
        dataToken.grantRole(dataToken.MINTER_ROLE(), admin);

        // Grant NOTIFIER_ROLE to admin (simulating DATA token hook)
        ledger.grantRole(ledger.NOTIFIER_ROLE(), admin);
        // Grant PRODUCTION_ROLE to buildingRegistry mock
        ledger.grantRole(ledger.PRODUCTION_ROLE(), buildingRegistry);

        // Register agents
        attackerAgentId = agentRegistry.registerAgent(attacker, "ipfs://attacker");
        targetAgentId = agentRegistry.registerAgent(target, "ipfs://target");
        scannerAgentId = agentRegistry.registerAgent(scanner, "ipfs://scanner");

        // Grant action permissions
        agentRegistry.grantAction(attackerAgentId, ACTION_POISON_PIPELINE);
        agentRegistry.grantAction(targetAgentId, ACTION_PURGE_DATA);
        agentRegistry.grantAction(scannerAgentId, ACTION_PURGE_DATA);

        // Mint tokens
        rateToken.mint(attacker, INITIAL_RATE);
        rateToken.mint(target, INITIAL_RATE);
        rateToken.mint(scanner, INITIAL_RATE);
        dataToken.mint(attacker, INITIAL_DATA);
        dataToken.mint(target, INITIAL_DATA);

        // Give attacker some reputation to burn (use by-address variant to update address-keyed storage)
        reputationLedger.grantRole(reputationLedger.RECORDER_ROLE(), admin);
        reputationLedger.recordTransactionByAddress(attacker, target, 1000 * 1e18);

        vm.stopPrank();

        // Approve ledger for DATA transfers (purge burns)
        vm.prank(target);
        dataToken.approve(address(ledger), type(uint256).max);
        vm.prank(attacker);
        dataToken.approve(address(ledger), type(uint256).max);

        // Approve ledger and infoMarket for RATE transfers (purity scan)
        vm.prank(scanner);
        rateToken.approve(address(ledger), type(uint256).max);
        vm.prank(scanner);
        rateToken.approve(address(infoMarket), type(uint256).max);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _openWindow(address receiver, uint256 amount) internal {
        vm.prank(admin); // admin has NOTIFIER_ROLE
        ledger.onDataTransfer(receiver, amount);
    }

    function _subscribeScanner() internal {
        vm.prank(scanner);
        infoMarket.subscribe(1); // Analyst tier
    }

    // =========================================================================
    // Deployment Tests
    // =========================================================================

    function test_deployment() public view {
        assertEq(address(ledger.agentRegistry()), address(agentRegistry));
        assertEq(address(ledger.reputationLedger()), address(reputationLedger));
        assertEq(address(ledger.auditLog()), address(auditLog));
        assertEq(address(ledger.informationMarket()), address(infoMarket));
        assertEq(address(ledger.rateToken()), address(rateToken));
        assertEq(address(ledger.dataToken()), address(dataToken));
        assertEq(ledger.VULNERABILITY_WINDOW(), 14_400);
        assertEq(ledger.STARTING_PURITY(), 50);
        assertEq(ledger.MAX_PURITY(), 100);
        assertEq(ledger.POISON_IMPACT(), 20);
        assertEq(ledger.CLEAN_TRAINING_BONUS(), 5);
        assertEq(ledger.PURGE_BONUS(), 15);
        assertEq(ledger.PURITY_SCAN_COST(), 200 * 1e18);
    }

    function test_deployment_reverts_zero_addresses() public {
        vm.expectRevert(LineageLedger.ZeroAddress.selector);
        new LineageLedger(address(0), address(reputationLedger), address(auditLog),
            address(infoMarket), address(rateToken), address(dataToken), admin);
    }

    // =========================================================================
    // Default Purity Tests
    // =========================================================================

    function test_default_purity_is_50() public view {
        assertEq(ledger.getPurityScore(target), 50);
        assertEq(ledger.getPurityScore(attacker), 50);
        assertEq(ledger.getPurityScore(unauthorized), 50);
    }

    // =========================================================================
    // Vulnerability Window Tests
    // =========================================================================

    function test_data_transfer_opens_window() public {
        assertFalse(ledger.isVulnerable(target));

        vm.expectEmit(true, false, false, true);
        emit VulnerabilityWindowOpened(target, block.timestamp + 14_400, 100 * 1e18);

        _openWindow(target, 100 * 1e18);

        assertTrue(ledger.isVulnerable(target));
        assertEq(ledger.getWindowExpiry(target), block.timestamp + 14_400);
    }

    function test_window_extends_on_second_transfer() public {
        _openWindow(target, 100 * 1e18);
        uint256 firstExpiry = ledger.getWindowExpiry(target);

        vm.warp(block.timestamp + 3600); // 1 hour later
        _openWindow(target, 50 * 1e18);
        uint256 secondExpiry = ledger.getWindowExpiry(target);

        assertGt(secondExpiry, firstExpiry);
        assertEq(secondExpiry, block.timestamp + 14_400);
    }

    function test_window_closes_after_duration() public {
        _openWindow(target, 100 * 1e18);
        assertTrue(ledger.isVulnerable(target));

        vm.warp(block.timestamp + 14_400); // Exactly at expiry
        assertFalse(ledger.isVulnerable(target));
    }

    function test_zero_transfer_does_not_open_window() public {
        vm.prank(admin);
        ledger.onDataTransfer(target, 0);
        assertFalse(ledger.isVulnerable(target));
    }

    // [FIX #6] Dust transfer tests
    function test_dust_transfer_does_not_open_window() public {
        vm.prank(admin);
        ledger.onDataTransfer(target, 1); // 1 wei — below MIN_TRANSFER_FOR_WINDOW
        assertFalse(ledger.isVulnerable(target));
    }

    function test_minimum_transfer_opens_window() public {
        vm.prank(admin);
        ledger.onDataTransfer(target, 1e15); // Exactly at MIN_TRANSFER_FOR_WINDOW
        assertTrue(ledger.isVulnerable(target));
    }

    function test_below_minimum_transfer_ignored() public {
        vm.prank(admin);
        ledger.onDataTransfer(target, 1e15 - 1); // Just below minimum
        assertFalse(ledger.isVulnerable(target));
    }

    function test_transfer_to_zero_address_skipped() public {
        vm.prank(admin);
        ledger.onDataTransfer(address(0), 100 * 1e18);
    }

    function test_only_notifier_can_open_window() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        ledger.onDataTransfer(target, 100 * 1e18);
    }

    // =========================================================================
    // Poison Pipeline Tests
    // =========================================================================

    function test_poison_pipeline_success() public {
        _openWindow(target, 100 * 1e18);

        vm.expectEmit(true, true, false, true);
        emit PipelinePoisoned(attacker, target, 30, block.timestamp);

        vm.prank(attacker);
        ledger.poisonPipeline(target);

        assertEq(ledger.getPurityScore(target), 30);
        assertEq(ledger.totalPoisonEvents(), 1);
    }

    function test_poison_pipeline_multiple_times() public {
        _openWindow(target, 100 * 1e18);

        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 30);

        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 10);

        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 0);

        assertEq(ledger.totalPoisonEvents(), 3);
    }

    function test_poison_floors_at_zero() public {
        _openWindow(target, 100 * 1e18);

        for (uint256 i = 0; i < 4; i++) {
            vm.prank(attacker);
            ledger.poisonPipeline(target);
        }
        assertEq(ledger.getPurityScore(target), 0);
    }

    function test_revert_poison_not_vulnerable() public {
        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(LineageLedger.NotVulnerable.selector, target)
        );
        ledger.poisonPipeline(target);
    }

    function test_revert_poison_window_expired() public {
        _openWindow(target, 100 * 1e18);
        vm.warp(block.timestamp + 14_400);

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(LineageLedger.NotVulnerable.selector, target)
        );
        ledger.poisonPipeline(target);
    }

    function test_revert_poison_self() public {
        _openWindow(attacker, 100 * 1e18);

        vm.prank(attacker);
        vm.expectRevert(LineageLedger.CannotPoisonSelf.selector);
        ledger.poisonPipeline(attacker);
    }

    function test_revert_poison_no_permission() public {
        _openWindow(target, 100 * 1e18);

        vm.prank(target);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ActionNotPermitted.selector, target, ACTION_POISON_PIPELINE)
        );
        ledger.poisonPipeline(attacker);
    }

    function test_revert_poison_no_reputation() public {
        vm.startPrank(admin);
        address noRep = address(0xDEAD);
        uint256 noRepId = agentRegistry.registerAgent(noRep, "ipfs://norep");
        agentRegistry.grantAction(noRepId, ACTION_POISON_PIPELINE);
        vm.stopPrank();

        _openWindow(target, 100 * 1e18);

        vm.prank(noRep);
        vm.expectRevert(LineageLedger.NoReputationToPay.selector);
        ledger.poisonPipeline(target);
    }

    // =========================================================================
    // Purge Data Tests
    // =========================================================================

    function test_purge_data_success() public {
        _openWindow(target, 100 * 1e18);

        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 30);

        uint256 purgeAmount = 2 * 1e18; // >= MIN_PURGE_AMOUNT (1.5e18)
        uint256 dataBefore = dataToken.balanceOf(target);

        vm.expectEmit(true, false, false, true);
        emit DataPurged(target, purgeAmount, 45, block.timestamp);

        vm.prank(target);
        ledger.purgeData(purgeAmount);

        assertEq(ledger.getPurityScore(target), 45);
        assertEq(dataToken.balanceOf(target), dataBefore - purgeAmount);
        assertEq(ledger.totalPurgeActions(), 1);
    }

    function test_purge_caps_at_max_purity() public {
        vm.prank(target);
        ledger.purgeData(1.5e18); // Use MIN_PURGE_AMOUNT
        assertEq(ledger.getPurityScore(target), 65);

        vm.prank(target);
        ledger.purgeData(1.5e18);
        assertEq(ledger.getPurityScore(target), 80);

        vm.prank(target);
        ledger.purgeData(1.5e18);
        assertEq(ledger.getPurityScore(target), 95);

        vm.prank(target);
        ledger.purgeData(1.5e18);
        assertEq(ledger.getPurityScore(target), 100);
    }

    // [FIX #3] Minimum purge amount tests
    function test_revert_purge_below_minimum() public {
        vm.prank(target);
        vm.expectRevert("LineageLedger: below minimum purge amount");
        ledger.purgeData(1); // 1 wei should revert
    }

    function test_revert_purge_just_below_minimum() public {
        vm.prank(target);
        vm.expectRevert("LineageLedger: below minimum purge amount");
        ledger.purgeData(1.5e18 - 1); // Just below minimum
    }

    function test_purge_at_exact_minimum() public {
        vm.prank(target);
        ledger.purgeData(1.5e18); // Exactly at minimum — should succeed
        assertEq(ledger.getPurityScore(target), 65);
    }

    function test_revert_purge_at_max_purity() public {
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(target);
            ledger.purgeData(1.5e18); // Use MIN_PURGE_AMOUNT
        }
        assertEq(ledger.getPurityScore(target), 100);

        vm.prank(target);
        vm.expectRevert(
            abi.encodeWithSelector(LineageLedger.PurityAlreadyMax.selector, target)
        );
        ledger.purgeData(1.5e18);
    }

    function test_revert_purge_zero_amount() public {
        vm.prank(target);
        vm.expectRevert(LineageLedger.ZeroAmount.selector);
        ledger.purgeData(0);
    }

    function test_revert_purge_no_permission() public {
        vm.prank(attacker); // attacker has POISON but not PURGE — use valid amount
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ActionNotPermitted.selector, attacker, ACTION_PURGE_DATA)
        );
        ledger.purgeData(1.5e18);
    }

    // =========================================================================
    // Clean Training Credit Tests
    // =========================================================================

    function test_credit_clean_training() public {
        vm.expectEmit(true, false, false, true);
        emit CleanTrainingCredited(target, 55, block.timestamp);

        vm.prank(buildingRegistry);
        ledger.creditCleanTraining(target);

        assertEq(ledger.getPurityScore(target), 55);
    }

    function test_credit_clean_training_multiple() public {
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(buildingRegistry);
            ledger.creditCleanTraining(target);
        }
        assertEq(ledger.getPurityScore(target), 100);
    }

    function test_credit_clean_training_caps_at_max() public {
        for (uint256 i = 0; i < 11; i++) {
            vm.prank(buildingRegistry);
            ledger.creditCleanTraining(target);
        }
        assertEq(ledger.getPurityScore(target), 100);
    }

    function test_revert_credit_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        ledger.creditCleanTraining(target);
    }

    function test_revert_credit_zero_address() public {
        vm.prank(buildingRegistry);
        vm.expectRevert(LineageLedger.ZeroAddress.selector);
        ledger.creditCleanTraining(address(0));
    }

    // =========================================================================
    // Purity Scan Tests
    // =========================================================================

    function test_scan_purity_success() public {
        _subscribeScanner();

        uint256 rateBefore = rateToken.balanceOf(scanner);

        vm.expectEmit(true, true, false, true);
        emit PurityScanned(scanner, target, 50, 200 * 1e18, block.timestamp);

        vm.prank(scanner);
        uint8 purity = ledger.scanPurity(target);

        assertEq(purity, 50);
        assertEq(rateToken.balanceOf(scanner), rateBefore - 200 * 1e18);
    }

    function test_scan_purity_after_poison() public {
        _subscribeScanner();
        _openWindow(target, 100 * 1e18);

        vm.prank(attacker);
        ledger.poisonPipeline(target);

        vm.prank(scanner);
        uint8 purity = ledger.scanPurity(target);

        assertEq(purity, 30);
    }

    function test_revert_scan_no_subscription() public {
        vm.prank(scanner);
        vm.expectRevert(
            abi.encodeWithSelector(LineageLedger.InsufficientTier.selector, 1, 0)
        );
        ledger.scanPurity(target);
    }

    function test_revert_scan_zero_target() public {
        _subscribeScanner();

        vm.prank(scanner);
        vm.expectRevert(LineageLedger.ZeroAddress.selector);
        ledger.scanPurity(address(0));
    }

    // =========================================================================
    // Integration: Poison → Purge → Clean Training Cycle
    // =========================================================================

    function test_full_lifecycle() public {
        // 1. DATA transfer opens window
        _openWindow(target, 500 * 1e18);
        assertTrue(ledger.isVulnerable(target));
        assertEq(ledger.getPurityScore(target), 50);

        // 2. Attacker poisons (50 → 30)
        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 30);

        // 3. Attacker poisons again (30 → 10)
        vm.prank(attacker);
        ledger.poisonPipeline(target);
        assertEq(ledger.getPurityScore(target), 10);

        // 4. Window expires
        vm.warp(block.timestamp + 14_400);
        assertFalse(ledger.isVulnerable(target));

        // 5. Target purges (10 → 25) — must use >= MIN_PURGE_AMOUNT (1.5e18)
        vm.prank(target);
        ledger.purgeData(2 * 1e18); // >= 1.5e18 ✓
        assertEq(ledger.getPurityScore(target), 25);

        // 6. Clean training credits (25 → 50)
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(buildingRegistry);
            ledger.creditCleanTraining(target);
        }
        assertEq(ledger.getPurityScore(target), 50);

        // 7. Scanner checks purity
        _subscribeScanner();
        vm.prank(scanner);
        uint8 scannedPurity = ledger.scanPurity(target);
        assertEq(scannedPurity, 50);
    }

    // =========================================================================
    // Efficiency Modifier Test
    // =========================================================================

    function test_purity_as_efficiency_modifier() public view {
        uint8 purity = ledger.getPurityScore(target);
        uint256 baseOutput = 1000;
        uint256 adjustedOutput = (baseOutput * purity) / 100;
        assertEq(adjustedOutput, 500);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_poison_bounded_purity(uint8 poisonCount) public {
        poisonCount = uint8(bound(poisonCount, 1, 10));

        _openWindow(target, 100 * 1e18);

        for (uint8 i = 0; i < poisonCount; i++) {
            vm.prank(attacker);
            ledger.poisonPipeline(target);
        }

        uint8 purity = ledger.getPurityScore(target);
        assertTrue(purity <= 100);
        uint256 expected = 50;
        uint256 reduction = uint256(poisonCount) * 20;
        if (reduction >= expected) {
            assertEq(purity, 0);
        } else {
            assertEq(purity, uint8(expected - reduction));
        }
    }

    function testFuzz_purge_bounded_purity(uint8 purgeCount) public {
        purgeCount = uint8(bound(purgeCount, 1, 5));

        for (uint8 i = 0; i < purgeCount; i++) {
            uint8 current = ledger.getPurityScore(target);
            if (current >= 100) break;
            vm.prank(target);
            ledger.purgeData(1.5e18); // Use MIN_PURGE_AMOUNT
        }

        uint8 purity = ledger.getPurityScore(target);
        assertTrue(purity <= 100);
        assertTrue(purity >= 50);
    }
}
