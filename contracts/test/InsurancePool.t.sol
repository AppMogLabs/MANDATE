// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {InsurancePool} from "../src/InsurancePool.sol";
import {RateToken} from "../src/RateToken.sol";

/// @title InsurancePoolTest — TDD test suite for InsurancePool
/// @notice Tests stake/unstake, premium bonding curve, policy purchase, and claim settlement.
contract InsurancePoolTest is Test {
    InsurancePool public pool;
    RateToken public rate;

    address public admin = address(1);
    address public operator = address(2);
    address public underwriter1 = address(3);
    address public underwriter2 = address(4);
    address public policyholder1 = address(5);
    address public policyholder2 = address(6);

    uint256 constant INITIAL_BALANCE = 100_000 * 1e18;

    function setUp() public {
        // Deploy contracts
        vm.startPrank(admin);
        rate = new RateToken(admin);
        pool = new InsurancePool(address(rate));
        pool.grantRole(pool.OPERATOR_ROLE(), operator);
        
        // Mint RATE to test users (zero initial supply)
        rate.mint(underwriter1, INITIAL_BALANCE);
        rate.mint(underwriter2, INITIAL_BALANCE);
        rate.mint(policyholder1, INITIAL_BALANCE);
        rate.mint(policyholder2, INITIAL_BALANCE);
        vm.stopPrank();

        // Approve pool for all users
        vm.prank(underwriter1);
        rate.approve(address(pool), type(uint256).max);
        
        vm.prank(underwriter2);
        rate.approve(address(pool), type(uint256).max);
        
        vm.prank(policyholder1);
        rate.approve(address(pool), type(uint256).max);
        
        vm.prank(policyholder2);
        rate.approve(address(pool), type(uint256).max);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       STAKING TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Test staking RATE mints shares proportionally
    function test_StakeMintsShares() public {
        uint256 stakeAmount = 10_000 * 1e18;

        vm.prank(underwriter1);
        pool.stake(stakeAmount);

        assertEq(pool.totalStaked(), stakeAmount, "Total staked mismatch");
        assertEq(pool.sharesOf(underwriter1), stakeAmount, "First staker should get 1:1 shares");
        assertEq(rate.balanceOf(address(pool)), stakeAmount, "Pool RATE balance mismatch");
    }

    /// @notice RED: Test second stake receives proportional shares
    function test_SecondStakeProportional() public {
        // First stake
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        // Second stake
        vm.prank(underwriter2);
        pool.stake(5_000 * 1e18);

        assertEq(pool.totalStaked(), 15_000 * 1e18, "Total staked mismatch");
        assertEq(pool.sharesOf(underwriter1), 10_000 * 1e18, "Underwriter1 shares incorrect");
        assertEq(pool.sharesOf(underwriter2), 5_000 * 1e18, "Underwriter2 shares incorrect");
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       UNSTAKE TESTS (TWO-STEP COOLDOWN)
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Initiate unstake sets cooldown timestamp
    function test_InitiateUnstakeSetsTimestamp() public {
        uint256 stakeAmount = 10_000 * 1e18;
        
        vm.prank(underwriter1);
        pool.stake(stakeAmount);

        vm.prank(underwriter1);
        pool.initiateUnstake(5_000 * 1e18);

        (uint256 amount, uint64 finalTimestamp) = pool.unstakeRequests(underwriter1);
        
        assertEq(amount, 5_000 * 1e18, "Unstake amount incorrect");
        assertEq(finalTimestamp, block.timestamp + 86_400, "Cooldown timestamp incorrect");
    }

    /// @notice RED: Cannot finalise unstake before cooldown expires
    function test_CannotFinaliseUnstakeBeforeCooldown() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        vm.prank(underwriter1);
        pool.initiateUnstake(5_000 * 1e18);

        // Try to finalise immediately
        vm.prank(underwriter1);
        vm.expectRevert("Cooldown not expired");
        pool.finaliseUnstake();
    }

    /// @notice RED: Can finalise unstake after cooldown
    function test_FinaliseUnstakeAfterCooldown() public {
        uint256 stakeAmount = 10_000 * 1e18;
        uint256 unstakeAmount = 5_000 * 1e18;

        vm.prank(underwriter1);
        pool.stake(stakeAmount);

        vm.prank(underwriter1);
        pool.initiateUnstake(unstakeAmount);

        // Fast forward past cooldown
        vm.warp(block.timestamp + 86_401);

        uint256 balanceBefore = rate.balanceOf(underwriter1);

        vm.prank(underwriter1);
        pool.finaliseUnstake();

        assertEq(rate.balanceOf(underwriter1), balanceBefore + unstakeAmount, "RATE not returned");
        assertEq(pool.sharesOf(underwriter1), stakeAmount - unstakeAmount, "Shares not burned");
        assertEq(pool.totalStaked(), stakeAmount - unstakeAmount, "Total staked not updated");
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       PREMIUM BONDING CURVE
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Premium rate increases with utilisation
    function test_PremiumBondingCurve() public {
        // Stake 10,000 RATE
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        // Initial premium rate with 0 coverage
        uint256 basePremiumRate = pool.getPremiumRate();
        assertEq(basePremiumRate, 500, "Base premium should be 5% (500 bps)");

        // Purchase policy for 5,000 RATE coverage
        vm.prank(policyholder1);
        pool.purchasePolicy(5_000 * 1e18, 30 days);

        // Premium rate should increase (utilisation = 50%)
        uint256 newPremiumRate = pool.getPremiumRate();
        assertGt(newPremiumRate, basePremiumRate, "Premium rate should increase with coverage");
        
        // Expected: 5% × (1 + 0.5) = 7.5% = 750 bps
        assertEq(newPremiumRate, 750, "Premium rate calculation incorrect");
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       POLICY PURCHASE
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Purchase policy transfers premium and stores policy
    function test_PurchasePolicyTransfersPremium() public {
        uint256 stakeAmount = 10_000 * 1e18;
        uint256 coverageAmount = 5_000 * 1e18;
        uint64 duration = 30 days;

        vm.prank(underwriter1);
        pool.stake(stakeAmount);

        uint256 premiumRate = pool.getPremiumRate();
        uint256 expectedPremium = (coverageAmount * premiumRate * duration) / (365 days * 10_000);

        uint256 balanceBefore = rate.balanceOf(policyholder1);

        vm.prank(policyholder1);
        uint256 policyId = pool.purchasePolicy(coverageAmount, duration);

        // Check premium transferred
        assertEq(
            rate.balanceOf(policyholder1),
            balanceBefore - expectedPremium,
            "Premium not transferred"
        );

        // Check policy stored
        (
            address holder,
            uint256 coverage,
            uint64 expiry,
            bool claimed
        ) = pool.getPolicy(policyId);

        assertEq(holder, policyholder1, "Policy holder incorrect");
        assertEq(coverage, coverageAmount, "Coverage amount incorrect");
        assertEq(expiry, block.timestamp + duration, "Expiry timestamp incorrect");
        assertFalse(claimed, "Policy should not be claimed");
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       CLAIM SETTLEMENT
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Trigger claim distributes RATE to affected policyholders only
    function test_TriggerClaimDistributesPayout() public {
        // Stake 20,000 RATE
        vm.prank(underwriter1);
        pool.stake(20_000 * 1e18);

        // Buy 2 policies
        vm.prank(policyholder1);
        pool.purchasePolicy(5_000 * 1e18, 30 days);

        vm.prank(policyholder2);
        pool.purchasePolicy(3_000 * 1e18, 30 days);

        uint256 balance1Before = rate.balanceOf(policyholder1);
        uint256 balance2Before = rate.balanceOf(policyholder2);

        // Trigger claim with both policyholders as affected agents
        address[] memory affected = new address[](2);
        affected[0] = policyholder1;
        affected[1] = policyholder2;
        vm.prank(operator);
        pool.triggerClaim(affected);

        // Check payouts
        assertEq(
            rate.balanceOf(policyholder1),
            balance1Before + 5_000 * 1e18,
            "Policyholder1 payout incorrect"
        );
        assertEq(
            rate.balanceOf(policyholder2),
            balance2Before + 3_000 * 1e18,
            "Policyholder2 payout incorrect"
        );

        // Check pool balance reduced
        assertEq(pool.totalStaked(), 12_000 * 1e18, "Pool not reduced by payout");
    }

    /// @notice RED: Solvency check prevents undercollateralised payout
    function test_SolvencyCheckBlocksUndercollateralised() public {
        // Stake 10,000 RATE
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        // Buy policy for 9,000 RATE (90% utilisation → solvency = 111% < 120%)
        vm.prank(policyholder1);
        pool.purchasePolicy(9_000 * 1e18, 30 days);

        // Trigger claim should revert
        address[] memory affected = new address[](1);
        affected[0] = policyholder1;
        vm.prank(operator);
        vm.expectRevert("Undercollateralised");
        pool.triggerClaim(affected);
    }

    /// @notice RED: Only operator can trigger claims
    function test_OnlyOperatorCanTriggerClaim() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        vm.prank(policyholder1);
        pool.purchasePolicy(5_000 * 1e18, 30 days);

        // Non-operator tries to trigger claim
        address[] memory affected = new address[](1);
        affected[0] = policyholder1;
        vm.prank(underwriter1);
        vm.expectRevert();
        pool.triggerClaim(affected);
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       ADVERSARIAL TESTS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Front-running claim by unstaking is blocked by cooldown
    function test_FrontRunClaimBlocked() public {
        // Stake 20,000 RATE
        vm.prank(underwriter1);
        pool.stake(20_000 * 1e18);

        // Buy policy
        vm.prank(policyholder1);
        pool.purchasePolicy(5_000 * 1e18, 30 days);

        // Underwriter sees claim event in mempool and tries to unstake
        vm.prank(underwriter1);
        pool.initiateUnstake(10_000 * 1e18);

        // Operator triggers claim with affected agent
        address[] memory affected = new address[](1);
        affected[0] = policyholder1;
        vm.prank(operator);
        pool.triggerClaim(affected);

        // Underwriter's stake is still locked (can't finalise until cooldown expires)
        vm.prank(underwriter1);
        vm.expectRevert("Cooldown not expired");
        pool.finaliseUnstake();

        // After cooldown, unstake succeeds
        vm.warp(block.timestamp + 86_401);
        vm.prank(underwriter1);
        pool.finaliseUnstake();
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       EDGE CASES & ERROR HANDLING
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Cannot stake zero amount
    function test_CannotStakeZero() public {
        vm.prank(underwriter1);
        vm.expectRevert("Zero amount");
        pool.stake(0);
    }

    /// @notice RED: Cannot purchase policy with zero coverage
    function test_CannotPurchasePolicyZeroCoverage() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        vm.prank(policyholder1);
        vm.expectRevert("Zero coverage");
        pool.purchasePolicy(0, 30 days);
    }

    /// @notice RED: Cannot purchase policy with zero duration
    function test_CannotPurchasePolicyZeroDuration() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        vm.prank(policyholder1);
        vm.expectRevert("Zero duration");
        pool.purchasePolicy(5_000 * 1e18, 0);
    }

    /// @notice RED: Pause blocks staking
    function test_PauseBlocksStaking() public {
        vm.prank(admin);
        pool.pause();

        vm.prank(underwriter1);
        vm.expectRevert();
        pool.stake(10_000 * 1e18);
    }

    /// @notice RED: Pause blocks policy purchase
    function test_PauseBlocksPolicyPurchase() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        vm.prank(admin);
        pool.pause();

        vm.prank(policyholder1);
        vm.expectRevert();
        pool.purchasePolicy(5_000 * 1e18, 30 days);
    }

    /// @notice RED: Unpause restores operations
    function test_UnpauseRestoresOperations() public {
        vm.prank(admin);
        pool.pause();

        vm.prank(admin);
        pool.unpause();

        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        assertEq(pool.totalStaked(), 10_000 * 1e18, "Staking should work after unpause");
    }

    /* ══════════════════════════════════════════════════════════════════════════════
       VIEW FUNCTIONS
       ══════════════════════════════════════════════════════════════════════════════ */

    /// @notice RED: Solvency ratio calculated correctly
    function test_SolvencyRatioCalculation() public {
        vm.prank(underwriter1);
        pool.stake(10_000 * 1e18);

        // 0 coverage → infinite solvency (return max)
        assertEq(pool.getSolvencyRatio(), type(uint256).max, "Empty pool solvency incorrect");

        // 5,000 coverage → >200% solvency (premiums increase capital)
        vm.prank(policyholder1);
        pool.purchasePolicy(5_000 * 1e18, 30 days);

        uint256 solvencyAfterFirst = pool.getSolvencyRatio();
        assertGe(solvencyAfterFirst, 20_000, "Solvency ratio should be >= 200%");
        assertLt(solvencyAfterFirst, 21_000, "Solvency ratio should be < 210%");

        // 8,000 total coverage → >125% solvency
        vm.prank(policyholder2);
        pool.purchasePolicy(3_000 * 1e18, 30 days);

        uint256 solvencyAfterSecond = pool.getSolvencyRatio();
        assertGe(solvencyAfterSecond, 12_500, "Solvency ratio should be >= 125%");
        assertLt(solvencyAfterSecond, 13_500, "Solvency ratio should be < 135%");
    }
}
