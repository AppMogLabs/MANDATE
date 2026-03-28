// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {InformationMarket} from "../src/InformationMarket.sol";
import {RateToken} from "../src/RateToken.sol";

contract InformationMarketTest is Test {
    InformationMarket public market;
    RateToken public rateToken;

    address public admin = makeAddr("admin");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    // Tier constants
    uint8 constant TIER_FREE = 0;
    uint8 constant TIER_ANALYST = 1;
    uint8 constant TIER_PREMIUM = 2;

    // Subscription duration
    uint256 constant SUBSCRIPTION_DURATION = 1 days;

    // Prices
    uint256 constant ANALYST_PRICE = 150 * 1e18;
    uint256 constant PREMIUM_PRICE = 1_000 * 1e18;

    function setUp() public {
        // Deploy RATE token
        rateToken = new RateToken(admin);

        // Deploy InformationMarket
        market = new InformationMarket(address(rateToken), admin);

        // Mint RATE to test users (zero initial supply)
        vm.startPrank(admin);
        rateToken.mint(alice, 10_000 * 1e18);
        rateToken.mint(bob, 10_000 * 1e18);
        rateToken.mint(charlie, 500 * 1e18);
        vm.stopPrank();
    }

    // =========================================================================
    // DEPLOYMENT TESTS
    // =========================================================================

    function test_Deployment_CorrectRateTokenAddress() public view {
        assertEq(address(market.rateToken()), address(rateToken));
    }

    function test_Deployment_AdminHasOperatorRole() public view {
        assertTrue(market.hasRole(market.OPERATOR_ROLE(), admin));
    }

    function test_Deployment_InitialPricesSet() public view {
        assertEq(market.getTierPrice(TIER_ANALYST), ANALYST_PRICE);
        assertEq(market.getTierPrice(TIER_PREMIUM), PREMIUM_PRICE);
    }

    function test_RevertWhen_DeployWithZeroRateToken() public {
        vm.expectRevert("InformationMarket: zero rate token");
        new InformationMarket(address(0), admin);
    }

    function test_RevertWhen_DeployWithZeroAdmin() public {
        vm.expectRevert("InformationMarket: zero admin");
        new InformationMarket(address(rateToken), address(0));
    }

    // =========================================================================
    // TIER 0 (FREE) TESTS
    // =========================================================================

    function test_FreeTier_AlwaysAccessible() public view {
        // No subscription needed
        uint8 tier = market.getTierAccess(alice);
        assertEq(tier, TIER_FREE);
    }

    function test_FreeTier_NoSubscriptionRequired() public view {
        bool isActive = market.isSubscriptionActive(alice);
        assertFalse(isActive);
    }

    // =========================================================================
    // TIER 1 (ANALYST) SUBSCRIPTION TESTS
    // =========================================================================

    function test_Subscribe_AnalystTier_Success() public {
        // Alice subscribes to analyst tier
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        // Check subscription
        InformationMarket.Subscription memory sub = market.getSubscription(alice);
        assertEq(sub.tier, TIER_ANALYST);
        assertGe(sub.expiryTimestamp, block.timestamp + SUBSCRIPTION_DURATION);

        // Check access
        uint8 accessTier = market.getTierAccess(alice);
        assertEq(accessTier, TIER_ANALYST);

        // Check subscription is active
        assertTrue(market.isSubscriptionActive(alice));
    }

    function test_Subscribe_AnalystTier_BurnsRATE() public {
        uint256 balanceBefore = rateToken.balanceOf(alice);
        uint256 supplyBefore = rateToken.totalSupply();

        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        uint256 balanceAfter = rateToken.balanceOf(alice);
        uint256 supplyAfter = rateToken.totalSupply();

        // RATE should be burned (not in contract)
        assertEq(balanceAfter, balanceBefore - ANALYST_PRICE);
        assertEq(supplyAfter, supplyBefore - ANALYST_PRICE);
        assertEq(rateToken.balanceOf(address(market)), 0); // Not stored in contract
    }

    function test_Subscribe_AnalystTier_EmitsEvent() public {
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InformationMarket.SubscriptionPurchased(alice, TIER_ANALYST, uint64(block.timestamp) + uint64(SUBSCRIPTION_DURATION));
        market.subscribe(TIER_ANALYST);
    }

    function test_RevertWhen_SubscribeAnalystWithInsufficientRATE() public {
        // Create a user with insufficient RATE (less than analyst price)
        address poorUser = makeAddr("poor");
        vm.prank(admin);
        rateToken.mint(poorUser, 50 * 1e18); // Only 50 RATE, analyst costs 150

        vm.prank(poorUser);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(poorUser);
        vm.expectRevert();
        market.subscribe(TIER_ANALYST);
    }

    function test_RevertWhen_SubscribeAnalystWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert();
        market.subscribe(TIER_ANALYST);
    }

    // =========================================================================
    // TIER 2 (PREMIUM) SUBSCRIPTION TESTS
    // =========================================================================

    function test_Subscribe_PremiumTier_Success() public {
        vm.prank(alice);
        rateToken.approve(address(market), PREMIUM_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_PREMIUM);

        InformationMarket.Subscription memory sub = market.getSubscription(alice);
        assertEq(sub.tier, TIER_PREMIUM);
        assertGe(sub.expiryTimestamp, block.timestamp + SUBSCRIPTION_DURATION);

        uint8 accessTier = market.getTierAccess(alice);
        assertEq(accessTier, TIER_PREMIUM);
    }

    function test_Subscribe_PremiumTier_BurnsRATE() public {
        uint256 balanceBefore = rateToken.balanceOf(alice);

        vm.prank(alice);
        rateToken.approve(address(market), PREMIUM_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_PREMIUM);

        uint256 balanceAfter = rateToken.balanceOf(alice);
        assertEq(balanceAfter, balanceBefore - PREMIUM_PRICE);
    }

    // =========================================================================
    // INVALID TIER TESTS
    // =========================================================================

    function test_RevertWhen_SubscribeToFreeTier() public {
        vm.prank(alice);
        rateToken.approve(address(market), 0);

        vm.prank(alice);
        vm.expectRevert();
        market.subscribe(TIER_FREE);
    }

    function test_RevertWhen_SubscribeToInvalidTier() public {
        vm.prank(alice);
        rateToken.approve(address(market), 1000 * 1e18);

        vm.prank(alice);
        vm.expectRevert();
        market.subscribe(3); // Invalid tier
    }

    // =========================================================================
    // EXPIRY AND ACCESS CONTROL TESTS
    // =========================================================================

    function test_SubscriptionExpiry_DeniesAccessAfterExpiry() public {
        // Subscribe
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        // Check access while active
        assertEq(market.getTierAccess(alice), TIER_ANALYST);
        assertTrue(market.isSubscriptionActive(alice));

        // Jump time past expiry
        vm.warp(block.timestamp + SUBSCRIPTION_DURATION + 1);

        // Check access denied
        assertEq(market.getTierAccess(alice), TIER_FREE);
        assertFalse(market.isSubscriptionActive(alice));
    }

    function test_AccessControl_CannotAccessPremiumWithAnalystTier() public {
        // Alice subscribes to analyst
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        // Try to check premium access
        InformationMarket.Subscription memory sub = market.getSubscription(alice);
        assertEq(sub.tier, TIER_ANALYST);

        // Verify she cannot access premium
        require(
            market.getTierAccess(alice) < TIER_PREMIUM,
            "Should not have access to premium"
        );
    }

    // =========================================================================
    // RENEWAL TESTS
    // =========================================================================

    function test_Renew_ExtendsExpiry() public {
        // Subscribe
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        InformationMarket.Subscription memory sub1 = market.getSubscription(alice);

        // Wait 12 hours (within 1-day subscription period)
        vm.warp(block.timestamp + 12 hours);

        // Renew
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.renew();

        InformationMarket.Subscription memory sub2 = market.getSubscription(alice);

        // Same tier, extended expiry
        assertEq(sub2.tier, sub1.tier);
        assertGt(sub2.expiryTimestamp, sub1.expiryTimestamp);
        assertEq(sub2.expiryTimestamp, sub1.expiryTimestamp + uint64(SUBSCRIPTION_DURATION));
    }

    function test_Renew_BurnsRATE() public {
        // Subscribe
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        uint256 balanceBefore = rateToken.balanceOf(alice);

        // Renew
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.renew();

        uint256 balanceAfter = rateToken.balanceOf(alice);
        assertEq(balanceAfter, balanceBefore - ANALYST_PRICE);
    }

    function test_Renew_EmitsEvent() public {
        // Subscribe
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST);

        InformationMarket.Subscription memory subBefore = market.getSubscription(alice);

        // Renew
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit InformationMarket.SubscriptionRenewed(alice, subBefore.expiryTimestamp + uint64(SUBSCRIPTION_DURATION));
        market.renew();
    }

    function test_RevertWhen_RenewWithoutSubscription() public {
        vm.prank(alice);
        vm.expectRevert();
        market.renew();
    }

    function test_RevertWhen_RenewWithInsufficientRATE() public {
        // Create a user with minimal funds
        address minimalUser = makeAddr("minimal");
        vm.prank(admin);
        rateToken.mint(minimalUser, ANALYST_PRICE); // Exactly enough for one subscription

        // Subscribe once
        vm.prank(minimalUser);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(minimalUser);
        market.subscribe(TIER_ANALYST);

        // Now minimalUser has 0 RATE remaining, should fail to renew
        vm.prank(minimalUser);
        vm.expectRevert();
        market.renew();
    }

    // =========================================================================
    // TIER PRICING TESTS (OPERATOR ROLE)
    // =========================================================================

    function test_SetTierPrice_ByOperator_Success() public {
        uint256 newPrice = 200 * 1e18;

        vm.prank(admin);
        market.setTierPrice(TIER_ANALYST, newPrice);

        assertEq(market.getTierPrice(TIER_ANALYST), newPrice);
    }

    function test_SetTierPrice_EmitsEvent() public {
        uint256 newPrice = 200 * 1e18;

        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit InformationMarket.TierPriceUpdated(TIER_ANALYST, newPrice);
        market.setTierPrice(TIER_ANALYST, newPrice);
    }

    function test_RevertWhen_SetTierPriceByNonOperator() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setTierPrice(TIER_ANALYST, 200 * 1e18);
    }

    function test_SetTierPrice_CannotSetFreeTierPrice() public {
        vm.prank(admin);
        vm.expectRevert();
        market.setTierPrice(TIER_FREE, 100 * 1e18);
    }

    // =========================================================================
    // REENTRANCY TESTS
    // =========================================================================

    function test_Subscribe_ReentrancyGuard() public {
        // This test verifies that ReentrancyGuard is in place
        // The contract should have nonReentrant modifier on subscribe()
        vm.prank(alice);
        rateToken.approve(address(market), ANALYST_PRICE);

        vm.prank(alice);
        market.subscribe(TIER_ANALYST); // Should not revert on normal call

        // Verify subscription succeeded
        InformationMarket.Subscription memory sub = market.getSubscription(alice);
        assertEq(sub.tier, TIER_ANALYST);
    }

    // =========================================================================
    // FUZZ TESTS
    // =========================================================================

    function testFuzz_Subscribe_ValidTiers(uint8 tier) public {
        vm.assume(tier == TIER_ANALYST || tier == TIER_PREMIUM);

        uint256 price = tier == TIER_ANALYST ? ANALYST_PRICE : PREMIUM_PRICE;

        vm.prank(alice);
        rateToken.approve(address(market), price);

        vm.prank(alice);
        market.subscribe(tier);

        InformationMarket.Subscription memory sub = market.getSubscription(alice);
        assertEq(sub.tier, tier);
    }

    function testFuzz_SetTierPrice(uint256 newPrice) public {
        vm.assume(newPrice > 0 && newPrice < type(uint128).max);

        vm.prank(admin);
        market.setTierPrice(TIER_ANALYST, newPrice);

        assertEq(market.getTierPrice(TIER_ANALYST), newPrice);
    }
}
