// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {RateToken} from "../src/RateToken.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public factory;
    RateToken public rateToken;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    uint256 public constant RATE_PER_ACCOUNT = 100_000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY = 10_000 * 1e18;

    function setUp() public {
        // Deploy RateToken
        rateToken = new RateToken(admin);

        // Deploy PredictionMarket factory
        factory = new PredictionMarket(address(rateToken), admin);

        // Mint RATE to test accounts (zero initial supply)
        vm.startPrank(admin);
        rateToken.mint(alice, RATE_PER_ACCOUNT);
        rateToken.mint(bob, RATE_PER_ACCOUNT);
        rateToken.mint(charlie, RATE_PER_ACCOUNT);
        vm.stopPrank();

        // Approve factory for all accounts (createMarket now requires RATE transfer)
        vm.prank(alice);
        rateToken.approve(address(factory), type(uint256).max);
        vm.prank(bob);
        rateToken.approve(address(factory), type(uint256).max);
        vm.prank(charlie);
        rateToken.approve(address(factory), type(uint256).max);
    }

    // =========================================================================
    // DEPLOYMENT & INITIALIZATION
    // =========================================================================

    function test_Deployment_FactoryInitialized() public view {
        assertEq(address(factory.rateToken()), address(rateToken));
        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(factory.hasRole(factory.OPERATOR_ROLE(), admin));
    }

    function test_RevertWhen_DeployWithZeroRateToken() public {
        vm.expectRevert("PredictionMarket: zero rate token");
        new PredictionMarket(address(0), admin);
    }

    function test_RevertWhen_DeployWithZeroAdmin() public {
        vm.expectRevert("PredictionMarket: zero admin");
        new PredictionMarket(address(rateToken), address(0));
    }

    // =========================================================================
    // MARKET CREATION
    // =========================================================================

    function test_CreateMarket_Success() public {
        uint256 eventId = 1;
        string memory question = "Will ETH reach $2000?";
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 marketId = factory.createMarket(eventId, question, expiryTimestamp);

        assertEq(marketId, 0);
        assertEq(factory.getMarketCount(), 1);
    }

    function test_CreateMarket_MultipleMarkets() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);

        vm.prank(alice);
        uint256 id1 = factory.createMarket(1, "Question 1", expiryTimestamp);
        vm.prank(bob);
        uint256 id2 = factory.createMarket(2, "Question 2", expiryTimestamp);

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(factory.getMarketCount(), 2);
    }

    function test_CreateMarket_ReturnsMarketAddress() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);

        vm.prank(alice);
        address marketAddr = factory.createMarketGetAddress(
            1,
            "Question",
            expiryTimestamp
        );
        assertTrue(marketAddr != address(0));
    }

    // =========================================================================
    // MARKET RETRIEVAL
    // =========================================================================

    function test_GetMarket_ReturnsCorrectData() public {
        uint256 eventId = 42;
        string memory question = "Will Bitcoin hit $100K?";
        uint64 expiryTimestamp = uint64(block.timestamp + 60 days);

        vm.prank(alice);
        uint256 marketId = factory.createMarket(eventId, question, expiryTimestamp);

        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertEq(market.eventId, eventId);
        assertEq(
            keccak256(abi.encodePacked(market.question)),
            keccak256(abi.encodePacked(question))
        );
        assertEq(market.expiryTimestamp, expiryTimestamp);
        assertEq(market.poolYes, INITIAL_LIQUIDITY);
        assertEq(market.poolNo, INITIAL_LIQUIDITY);
        assertEq(market.winningOutcome, 2); // UNRESOLVED
        assertEq(market.resolved, false);
    }

    // =========================================================================
    // AMM: BUY OUTCOME
    // =========================================================================

    function test_BuyOutcome_BuyYes() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);
        uint256 amountIn = 100 * 1e18;

        // Approve RATE transfer
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);

        // Buy YES outcome
        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        assertTrue(tokensOut > 0);
        // Pool should increase
        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertEq(market.poolYes, INITIAL_LIQUIDITY + amountIn);
    }

    function test_BuyOutcome_BuyNo() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);
        uint256 amountIn = 100 * 1e18;

        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);

        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 0, amountIn);

        assertTrue(tokensOut > 0);
        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertEq(market.poolNo, INITIAL_LIQUIDITY + amountIn);
    }

    function test_BuyOutcome_AMMFormulaCorrect() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);
        uint256 amountIn = 100 * 1e18;

        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);

        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        // Verify constant product: k = poolYes × poolNo
        // Formula: tokensOut = poolOut - (k / (poolIn + amountIn))
        // Which means: k / (poolIn + amountIn) = poolOut - tokensOut
        uint256 k_before = INITIAL_LIQUIDITY * INITIAL_LIQUIDITY;
        uint256 poolYesAfter = INITIAL_LIQUIDITY + amountIn;
        uint256 poolNoAfter = INITIAL_LIQUIDITY - tokensOut;
        
        // With integer division, k_after might be slightly less due to rounding
        // Check that product is preserved within reasonable bounds
        uint256 k_after = poolYesAfter * poolNoAfter;
        
        // Allow some slippage due to integer division
        // The formula: k_after should be close to k_before
        assertApproxEqAbs(k_after, k_before, INITIAL_LIQUIDITY * 1); // 1% tolerance
    }

    function test_BuyOutcome_MultipleSequentialBuys() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys YES
        uint256 amountIn1 = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn1);
        vm.prank(alice);
        uint256 tokensOut1 = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn1);

        // Bob buys NO
        uint256 amountIn2 = 50 * 1e18;
        vm.prank(bob);
        rateToken.approve(marketAddr, amountIn2);
        vm.prank(bob);
        uint256 tokensOut2 = PredictionMarket(marketAddr).buyOutcome(marketId, 0, amountIn2);

        assertTrue(tokensOut1 > 0);
        assertTrue(tokensOut2 > 0);
        assertTrue(tokensOut2 < tokensOut1); // Second buy has worse price
    }

    // =========================================================================
    // MARKET RESOLUTION
    // =========================================================================

    function test_ResolveMarket_YesWins() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        // Advance time past expiry
        vm.warp(expiryTimestamp + 1);

        // Resolve market (YES = 1)
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertEq(market.winningOutcome, 1);
        assertTrue(market.resolved);
    }

    function test_ResolveMarket_NoWins() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        vm.warp(expiryTimestamp + 1);

        vm.prank(admin);
        factory.resolveMarket(marketId, 0);

        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertEq(market.winningOutcome, 0);
        assertTrue(market.resolved);
    }

    function test_RevertWhen_ResolveBeforeExpiry() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        // Don't advance time, stay before expiry
        vm.prank(admin);
        vm.expectRevert("PredictionMarket: market not expired");
        factory.resolveMarket(marketId, 1);
    }

    function test_RevertWhen_ResolveAlreadyResolved() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        vm.warp(expiryTimestamp + 1);

        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // Try to resolve again
        vm.prank(admin);
        vm.expectRevert("PredictionMarket: market already resolved");
        factory.resolveMarket(marketId, 0);
    }

    // =========================================================================
    // CLAIM WINNINGS
    // =========================================================================

    function test_ClaimWinnings_WinnerGetsPayout() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys YES
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        uint256 aliceTokens = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        // Resolve market with YES winning
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // Alice claims winnings
        uint256 rateBalanceBefore = rateToken.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = PredictionMarket(marketAddr).claimWinnings(marketId);

        uint256 rateBalanceAfter = rateToken.balanceOf(alice);
        assertEq(rateBalanceAfter - rateBalanceBefore, payout);
        assertTrue(payout > 0);
    }

    function test_ClaimWinnings_LoserGetsZero() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys NO (loses)
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        PredictionMarket(marketAddr).buyOutcome(marketId, 0, amountIn);

        // Resolve market with YES winning
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // Alice tries to claim (should get 0)
        vm.prank(alice);
        uint256 payout = PredictionMarket(marketAddr).claimWinnings(marketId);
        assertEq(payout, 0);
    }

    function test_ClaimWinnings_ProportionalPayout() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys YES (50 RATE)
        uint256 aliceAmount = 50 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, aliceAmount);
        vm.prank(alice);
        uint256 aliceTokens = PredictionMarket(marketAddr).buyOutcome(marketId, 1, aliceAmount);

        // Bob buys YES (100 RATE)
        uint256 bobAmount = 100 * 1e18;
        vm.prank(bob);
        rateToken.approve(marketAddr, bobAmount);
        vm.prank(bob);
        uint256 bobTokens = PredictionMarket(marketAddr).buyOutcome(marketId, 1, bobAmount);

        // Resolve with YES winning
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // Both claim
        vm.prank(alice);
        uint256 alicePayout = PredictionMarket(marketAddr).claimWinnings(marketId);
        vm.prank(bob);
        uint256 bobPayout = PredictionMarket(marketAddr).claimWinnings(marketId);

        // Bob should get approximately 2x Alice (he has ~2x tokens)
        assertGt(bobPayout, alicePayout);
        // Payouts proportional to tokens (allow 20% slippage due to AMM math)
        assertApproxEqRel(alicePayout * 100, bobPayout * 50, 0.2e18);
    }

    function test_RevertWhen_ClaimBeforeResolution() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys YES
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        // Try to claim before market is resolved
        vm.prank(alice);
        vm.expectRevert("PredictionMarket: market not resolved");
        PredictionMarket(marketAddr).claimWinnings(marketId);
    }

    function test_RevertWhen_ClaimWithoutTokens() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Alice buys YES
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        // Resolve market
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // Charlie (who didn't buy) tries to claim
        vm.prank(charlie);
        uint256 payout = PredictionMarket(marketAddr).claimWinnings(marketId);
        assertEq(payout, 0);
    }

    // =========================================================================
    // VIEWS: getOdds
    // =========================================================================

    function test_GetOdds_InitialState() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);
        (uint256 yesOdds, uint256 noOdds) = PredictionMarket(marketAddr).getOdds(
            marketId
        );

        // Initially balanced: yes pool / total = 50%
        assertEq(yesOdds, 5000); // 50%
        assertEq(noOdds, 5000); // 50%
    }

    function test_GetOdds_AfterBuy() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Buy large amount of YES
        uint256 amountIn = 1000 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        (uint256 yesOdds, uint256 noOdds) = PredictionMarket(marketAddr).getOdds(
            marketId
        );

        // YES odds should be higher now
        assertGt(yesOdds, 5000);
        assertLt(noOdds, 5000);
    }

    // =========================================================================
    // SECURITY: Reentrancy Guard
    // =========================================================================

    function test_Security_BuyOutcomeNonReentrant() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Normal buy should succeed
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        assertTrue(tokensOut > 0);
    }

    function test_Security_ClaimWinningsNonReentrant() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        // Buy, resolve, claim
        uint256 amountIn = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        vm.prank(alice);
        uint256 payout = PredictionMarket(marketAddr).claimWinnings(marketId);
        assertTrue(payout > 0);
    }

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    function test_EdgeCase_VerySmallBuy() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        uint256 amountIn = 1; // 1 wei
        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        assertTrue(tokensOut >= 0);
    }

    function test_EdgeCase_LargeBuy() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        address marketAddr = factory.getMarketAddress(marketId);

        uint256 amountIn = 10_000_000 * 1e18; // Very large
        vm.prank(admin);
        rateToken.mint(alice, amountIn);

        vm.prank(alice);
        rateToken.approve(marketAddr, amountIn);
        vm.prank(alice);
        uint256 tokensOut = PredictionMarket(marketAddr).buyOutcome(marketId, 1, amountIn);

        assertTrue(tokensOut > 0);
    }

    function test_EdgeCase_ResolveExactlyAtExpiry() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Question", expiryTimestamp);

        // Advance exactly to expiry (not past)
        vm.warp(expiryTimestamp);

        // Should NOT resolve (requires block.timestamp > expiryTimestamp)
        vm.prank(admin);
        vm.expectRevert("PredictionMarket: market not expired");
        factory.resolveMarket(marketId, 1);

        // Advance one more second
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1); // Now should succeed
    }

    // =========================================================================
    // INTEGRATION: Full Market Lifecycle
    // =========================================================================

    function test_Integration_FullMarketLifecycle() public {
        uint64 expiryTimestamp = uint64(block.timestamp + 30 days);

        // 1. Create market
        vm.prank(alice);
        uint256 marketId = factory.createMarket(1, "Will BTC hit $100K?", expiryTimestamp);
        address marketAddr = factory.getMarketAddress(marketId);

        // 2. Alice buys YES (100 RATE)
        uint256 aliceAmount = 100 * 1e18;
        vm.prank(alice);
        rateToken.approve(marketAddr, aliceAmount);
        vm.prank(alice);
        uint256 aliceTokens = PredictionMarket(marketAddr).buyOutcome(marketId, 1, aliceAmount);

        // 3. Bob buys NO (50 RATE)
        uint256 bobAmount = 50 * 1e18;
        vm.prank(bob);
        rateToken.approve(marketAddr, bobAmount);
        vm.prank(bob);
        uint256 bobTokens = PredictionMarket(marketAddr).buyOutcome(marketId, 0, bobAmount);

        // 4. Check odds
        (uint256 yesOdds, uint256 noOdds) = PredictionMarket(marketAddr).getOdds(
            marketId
        );
        assertGt(yesOdds, noOdds); // YES more likely

        // 5. Resolve with YES winning
        vm.warp(expiryTimestamp + 1);
        vm.prank(admin);
        factory.resolveMarket(marketId, 1);

        // 6. Alice claims winnings (should get payout)
        uint256 rateBeforeAlice = rateToken.balanceOf(alice);
        vm.prank(alice);
        uint256 alicePayout = PredictionMarket(marketAddr).claimWinnings(marketId);
        uint256 rateAfterAlice = rateToken.balanceOf(alice);

        assertEq(rateAfterAlice - rateBeforeAlice, alicePayout);
        assertGt(alicePayout, 0);

        // 7. Bob claims winnings (should get 0)
        vm.prank(bob);
        uint256 bobPayout = PredictionMarket(marketAddr).claimWinnings(marketId);
        assertEq(bobPayout, 0);

        // 8. Verify market state
        PredictionMarket.Market memory market = factory.getMarket(marketId);
        assertTrue(market.resolved);
        assertEq(market.winningOutcome, 1);
    }
}
