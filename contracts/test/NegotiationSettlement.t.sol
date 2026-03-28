// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/NegotiationSettlement.sol";
import "../src/RateToken.sol";
import "../src/ResourceToken.sol";
import "../src/AgentRegistry.sol";
import "../src/ReputationLedger.sol";
import "../src/AuditLog.sol";

contract NegotiationSettlementTest is Test {
    NegotiationSettlement public settlement;
    RateToken public rateToken;
    ResourceToken public computeToken;
    ResourceToken public chipsToken;
    AgentRegistry public agentRegistry;
    ReputationLedger public reputationLedger;
    AuditLog public auditLog;

    address public admin = address(1);

    // Use vm.addr(privateKey) for signable accounts
    uint256 public agentAKey = 0xA11CE;
    uint256 public agentBKey = 0xB0B;
    uint256 public agentCKey = 0xC0C;
    address public agentA;
    address public agentB;
    address public agentC;
    address public unauthorized = address(99);

    uint256 public agentAId;
    uint256 public agentBId;
    uint256 public agentCId;

    uint256 constant INITIAL_RATE = 500_000 * 1e18;
    uint256 constant INITIAL_COMPUTE = 10_000 * 1e18;
    uint256 constant INITIAL_CHIPS = 5_000 * 1e18;

    // Action type constants (must match NegotiationSettlement)
    uint8 constant ACTION_DEAL_SETTLE = 10;

    event DealSettled(
        uint256 indexed dealId,
        address indexed agentA,
        address indexed agentB,
        uint256 nonce,
        uint256 timestamp
    );

    function setUp() public {
        agentA = vm.addr(agentAKey);
        agentB = vm.addr(agentBKey);
        agentC = vm.addr(agentCKey);

        // Deploy core contracts
        rateToken = new RateToken(admin);
        computeToken = new ResourceToken("Compute", "COMPUTE", admin);
        chipsToken = new ResourceToken("Chips", "CHIPS", admin);
        agentRegistry = new AgentRegistry(admin);
        reputationLedger = new ReputationLedger(admin);
        auditLog = new AuditLog(admin);

        // Deploy NegotiationSettlement
        settlement = new NegotiationSettlement(
            address(agentRegistry),
            address(reputationLedger),
            address(auditLog),
            admin
        );

        vm.startPrank(admin);

        // Grant roles
        reputationLedger.grantRole(reputationLedger.RECORDER_ROLE(), address(settlement));
        auditLog.grantRole(auditLog.LOGGER_ROLE(), address(settlement));
        computeToken.grantRole(computeToken.MINTER_ROLE(), admin);
        chipsToken.grantRole(chipsToken.MINTER_ROLE(), admin);

        // Register agents
        agentAId = agentRegistry.registerAgent(agentA, "ipfs://agentA");
        agentBId = agentRegistry.registerAgent(agentB, "ipfs://agentB");
        agentCId = agentRegistry.registerAgent(agentC, "ipfs://agentC");

        // Grant DEAL_SETTLE permission
        agentRegistry.grantAction(agentAId, ACTION_DEAL_SETTLE);
        agentRegistry.grantAction(agentBId, ACTION_DEAL_SETTLE);
        agentRegistry.grantAction(agentCId, ACTION_DEAL_SETTLE);

        // Mint tokens
        rateToken.mint(agentA, INITIAL_RATE);
        rateToken.mint(agentB, INITIAL_RATE);
        rateToken.mint(agentC, INITIAL_RATE);
        computeToken.mint(agentA, INITIAL_COMPUTE);
        computeToken.mint(agentB, INITIAL_COMPUTE);
        chipsToken.mint(agentA, INITIAL_CHIPS);
        chipsToken.mint(agentB, INITIAL_CHIPS);

        vm.stopPrank();

        // Approve settlement contract for all token transfers
        _approveAll(agentA);
        _approveAll(agentB);
        _approveAll(agentC);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _approveAll(address agent) internal {
        vm.startPrank(agent);
        rateToken.approve(address(settlement), type(uint256).max);
        computeToken.approve(address(settlement), type(uint256).max);
        chipsToken.approve(address(settlement), type(uint256).max);
        vm.stopPrank();
    }

    function _simpleDeal(uint256 nonce, uint256 expiresAt)
        internal
        view
        returns (NegotiationSettlement.Deal memory)
    {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 100 * 1e18);

        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 500 * 1e18);

        return NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: nonce,
            expiresAt: expiresAt
        });
    }

    function _multiLegDeal(uint256 nonce, uint256 expiresAt)
        internal
        view
        returns (NegotiationSettlement.Deal memory)
    {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](2);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 50 * 1e18);
        aGives[1] = NegotiationSettlement.DealLeg(address(chipsToken), 25 * 1e18);

        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 1000 * 1e18);

        return NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: nonce,
            expiresAt: expiresAt
        });
    }

    function _computeDigest(NegotiationSettlement.Deal memory deal) internal view returns (bytes32) {
        // Compute EIP-712 struct hash manually for signing
        bytes32 DEAL_LEG_TYPEHASH = settlement.DEAL_LEG_TYPEHASH();
        bytes32 DEAL_TYPEHASH = settlement.DEAL_TYPEHASH();

        bytes32 aGivesHash = _hashLegsArray(deal.agentAGives, DEAL_LEG_TYPEHASH);
        bytes32 bGivesHash = _hashLegsArray(deal.agentBGives, DEAL_LEG_TYPEHASH);

        bytes32 structHash = keccak256(
            abi.encode(
                DEAL_TYPEHASH,
                deal.agentA,
                deal.agentB,
                aGivesHash,
                bGivesHash,
                deal.nonce,
                deal.expiresAt
            )
        );

        bytes32 domainSep = settlement.domainSeparator();
        return keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
    }

    function _hashLegsArray(NegotiationSettlement.DealLeg[] memory legs, bytes32 legTypeHash)
        internal
        pure
        returns (bytes32)
    {
        bytes32[] memory legHashes = new bytes32[](legs.length);
        for (uint256 i = 0; i < legs.length; i++) {
            legHashes[i] = keccak256(abi.encode(legTypeHash, legs[i].resource, legs[i].amount));
        }
        return keccak256(abi.encodePacked(legHashes));
    }

    function _signDealManual(NegotiationSettlement.Deal memory deal, uint256 privateKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = _computeDigest(deal);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _settleSimpleDeal() internal returns (NegotiationSettlement.Deal memory deal) {
        deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);
        settlement.settleDeal(deal, sigA, sigB);
    }

    // =========================================================================
    // Deployment Tests
    // =========================================================================

    function test_deployment() public view {
        assertEq(address(settlement.agentRegistry()), address(agentRegistry));
        assertEq(address(settlement.reputationLedger()), address(reputationLedger));
        assertEq(address(settlement.auditLog()), address(auditLog));
        assertEq(settlement.totalDealsSettled(), 0);
        assertEq(settlement.ACTION_NEGOTIATE(), 9);
        assertEq(settlement.ACTION_DEAL_SETTLE(), 10);
        assertEq(settlement.MAX_LEGS_PER_SIDE(), 8);
    }

    function test_deployment_reverts_zero_addresses() public {
        vm.expectRevert(NegotiationSettlement.ZeroAddress.selector);
        new NegotiationSettlement(address(0), address(reputationLedger), address(auditLog), admin);

        vm.expectRevert(NegotiationSettlement.ZeroAddress.selector);
        new NegotiationSettlement(address(agentRegistry), address(0), address(auditLog), admin);

        vm.expectRevert(NegotiationSettlement.ZeroAddress.selector);
        new NegotiationSettlement(address(agentRegistry), address(reputationLedger), address(0), admin);

        vm.expectRevert(NegotiationSettlement.ZeroAddress.selector);
        new NegotiationSettlement(address(agentRegistry), address(reputationLedger), address(auditLog), address(0));
    }

    // =========================================================================
    // Simple Settlement Tests
    // =========================================================================

    function test_settle_simple_deal() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        uint256 agentAComputeBefore = computeToken.balanceOf(agentA);
        uint256 agentBComputeBefore = computeToken.balanceOf(agentB);
        uint256 agentARateBefore = rateToken.balanceOf(agentA);
        uint256 agentBRateBefore = rateToken.balanceOf(agentB);

        vm.expectEmit(true, true, true, true);
        emit DealSettled(1, agentA, agentB, 0, block.timestamp);

        settlement.settleDeal(deal, sigA, sigB);

        // Verify transfers
        assertEq(computeToken.balanceOf(agentA), agentAComputeBefore - 100 * 1e18);
        assertEq(computeToken.balanceOf(agentB), agentBComputeBefore + 100 * 1e18);
        assertEq(rateToken.balanceOf(agentA), agentARateBefore + 500 * 1e18);
        assertEq(rateToken.balanceOf(agentB), agentBRateBefore - 500 * 1e18);

        // Verify state updates
        assertEq(settlement.totalDealsSettled(), 1);
        assertEq(settlement.getPairNonce(agentA, agentB), 1);
    }

    function test_settle_multi_leg_deal() public {
        NegotiationSettlement.Deal memory deal = _multiLegDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        uint256 agentAComputeBefore = computeToken.balanceOf(agentA);
        uint256 agentAChipsBefore = chipsToken.balanceOf(agentA);
        uint256 agentARateBefore = rateToken.balanceOf(agentA);

        settlement.settleDeal(deal, sigA, sigB);

        assertEq(computeToken.balanceOf(agentA), agentAComputeBefore - 50 * 1e18);
        assertEq(chipsToken.balanceOf(agentA), agentAChipsBefore - 25 * 1e18);
        assertEq(rateToken.balanceOf(agentA), agentARateBefore + 1000 * 1e18);
    }

    function test_settle_one_sided_deal() public {
        // agentA gives, agentB gives nothing (gift/transfer)
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 10 * 1e18);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](0);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        settlement.settleDeal(deal, sigA, sigB);
        assertEq(settlement.totalDealsSettled(), 1);
    }

    function test_either_party_can_submit() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        // Third party (unauthorized) submits — should work since both parties signed
        vm.prank(unauthorized);
        settlement.settleDeal(deal, sigA, sigB);

        assertEq(settlement.totalDealsSettled(), 1);
    }

    // =========================================================================
    // Sequential Deals & Nonce Tests
    // =========================================================================

    function test_sequential_deals_increment_nonce() public {
        // First deal
        _settleSimpleDeal();
        assertEq(settlement.getPairNonce(agentA, agentB), 1);

        // Second deal with nonce 1
        NegotiationSettlement.Deal memory deal2 = _simpleDeal(1, block.timestamp + 1 hours);
        bytes memory sigA2 = _signDealManual(deal2, agentAKey);
        bytes memory sigB2 = _signDealManual(deal2, agentBKey);
        settlement.settleDeal(deal2, sigA2, sigB2);

        assertEq(settlement.getPairNonce(agentA, agentB), 2);
        assertEq(settlement.totalDealsSettled(), 2);
    }

    function test_pair_nonce_symmetric() public {
        // Nonce is the same regardless of agent order
        assertEq(settlement.getPairNonce(agentA, agentB), settlement.getPairNonce(agentB, agentA));

        _settleSimpleDeal();
        assertEq(settlement.getPairNonce(agentA, agentB), settlement.getPairNonce(agentB, agentA));
    }

    function test_different_pairs_independent_nonces() public {
        _settleSimpleDeal(); // A-B pair nonce = 1

        // A-C pair should have nonce 0
        assertEq(settlement.getPairNonce(agentA, agentC), 0);

        // Settle A-C deal
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);
        NegotiationSettlement.DealLeg[] memory cGives = new NegotiationSettlement.DealLeg[](1);
        cGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentC,
            agentAGives: aGives,
            agentBGives: cGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigC = _signDealManual(deal, agentCKey);
        settlement.settleDeal(deal, sigA, sigC);

        assertEq(settlement.getPairNonce(agentA, agentC), 1);
        assertEq(settlement.getPairNonce(agentA, agentB), 1); // Unchanged
    }

    // =========================================================================
    // Revert Tests
    // =========================================================================

    function test_revert_expired_deal() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp - 1);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(
            abi.encodeWithSelector(
                NegotiationSettlement.DealExpired.selector,
                block.timestamp - 1,
                block.timestamp
            )
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_wrong_nonce() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(1, block.timestamp + 1 hours); // Expected 0
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(
            abi.encodeWithSelector(NegotiationSettlement.InvalidNonce.selector, 0, 1)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_replay_same_deal() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        settlement.settleDeal(deal, sigA, sigB);

        // Replay with same nonce
        vm.expectRevert(
            abi.encodeWithSelector(NegotiationSettlement.InvalidNonce.selector, 1, 0)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_invalid_signature_agentA() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentBKey); // Wrong key
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(
            abi.encodeWithSelector(NegotiationSettlement.InvalidSignature.selector, agentA, agentB)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_invalid_signature_agentB() public {
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentAKey); // Wrong key

        vm.expectRevert(
            abi.encodeWithSelector(NegotiationSettlement.InvalidSignature.selector, agentB, agentA)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_empty_deal() public {
        NegotiationSettlement.DealLeg[] memory empty = new NegotiationSettlement.DealLeg[](0);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: empty,
            agentBGives: empty,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(NegotiationSettlement.EmptyDeal.selector);
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_same_agent() public {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 1e18);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](0);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentA, // Same agent
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);

        vm.expectRevert(NegotiationSettlement.SameAgent.selector);
        settlement.settleDeal(deal, sigA, sigA);
    }

    function test_revert_zero_amount_leg() public {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 0); // Zero amount
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(NegotiationSettlement.ZeroAmount.selector);
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_zero_resource_address() public {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(0), 100 * 1e18); // Zero address
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(NegotiationSettlement.ZeroAddress.selector);
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_too_many_legs() public {
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](9);
        for (uint256 i = 0; i < 9; i++) {
            aGives[i] = NegotiationSettlement.DealLeg(address(computeToken), 1e18);
        }
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(
            abi.encodeWithSelector(NegotiationSettlement.TooManyLegs.selector, 9, 8)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_agent_not_registered() public {
        address unregistered = vm.addr(0xDEAD);

        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), 1e18);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: unregistered,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, 0xDEAD);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        // AgentRegistry reverts with AgentNotRegistered
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.AgentNotRegistered.selector, unregistered)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_action_not_permitted() public {
        // Revoke DEAL_SETTLE from agentA
        vm.prank(admin);
        agentRegistry.revokeAction(agentAId, ACTION_DEAL_SETTLE);

        NegotiationSettlement.Deal memory deal = _simpleDeal(0, block.timestamp + 1 hours);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.ActionNotPermitted.selector, agentA, ACTION_DEAL_SETTLE)
        );
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_insufficient_balance() public {
        // Create a deal with more COMPUTE than agentA has
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), INITIAL_COMPUTE + 1);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        // SafeERC20 will revert on insufficient balance
        vm.expectRevert();
        settlement.settleDeal(deal, sigA, sigB);
    }

    function test_revert_no_approval() public {
        // Deploy fresh token without approval to settlement
        vm.startPrank(admin);
        ResourceToken freshToken = new ResourceToken("Fresh", "FRESH", admin);
        freshToken.grantRole(freshToken.MINTER_ROLE(), admin);
        freshToken.mint(agentA, 1000 * 1e18);
        vm.stopPrank();

        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(freshToken), 100 * 1e18);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        // SafeERC20 reverts on insufficient allowance
        vm.expectRevert();
        settlement.settleDeal(deal, sigA, sigB);
    }

    // =========================================================================
    // Edge Case Tests
    // =========================================================================

    function test_max_legs_per_side() public {
        // Exactly MAX_LEGS_PER_SIDE (8) legs should succeed
        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](8);
        for (uint256 i = 0; i < 8; i++) {
            aGives[i] = NegotiationSettlement.DealLeg(address(computeToken), 1 * 1e18);
        }
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), 100 * 1e18);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        settlement.settleDeal(deal, sigA, sigB);
        assertEq(settlement.totalDealsSettled(), 1);
    }

    function test_deal_at_exact_expiry() public {
        uint256 expiry = block.timestamp;
        NegotiationSettlement.Deal memory deal = _simpleDeal(0, expiry);
        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        // block.timestamp == expiresAt should succeed (> check, not >=)
        settlement.settleDeal(deal, sigA, sigB);
        assertEq(settlement.totalDealsSettled(), 1);
    }

    function test_domain_separator_consistent() public view {
        bytes32 sep1 = settlement.domainSeparator();
        bytes32 sep2 = settlement.domainSeparator();
        assertEq(sep1, sep2);
    }

    // =========================================================================
    // Fuzz Tests
    // =========================================================================

    function testFuzz_settle_various_amounts(uint256 computeAmount, uint256 rateAmount) public {
        computeAmount = bound(computeAmount, 1, INITIAL_COMPUTE);
        rateAmount = bound(rateAmount, 1, INITIAL_RATE);

        NegotiationSettlement.DealLeg[] memory aGives = new NegotiationSettlement.DealLeg[](1);
        aGives[0] = NegotiationSettlement.DealLeg(address(computeToken), computeAmount);
        NegotiationSettlement.DealLeg[] memory bGives = new NegotiationSettlement.DealLeg[](1);
        bGives[0] = NegotiationSettlement.DealLeg(address(rateToken), rateAmount);

        NegotiationSettlement.Deal memory deal = NegotiationSettlement.Deal({
            agentA: agentA,
            agentB: agentB,
            agentAGives: aGives,
            agentBGives: bGives,
            nonce: 0,
            expiresAt: block.timestamp + 1 hours
        });

        bytes memory sigA = _signDealManual(deal, agentAKey);
        bytes memory sigB = _signDealManual(deal, agentBKey);

        settlement.settleDeal(deal, sigA, sigB);

        assertEq(settlement.totalDealsSettled(), 1);
        assertEq(settlement.getPairNonce(agentA, agentB), 1);
    }
}
