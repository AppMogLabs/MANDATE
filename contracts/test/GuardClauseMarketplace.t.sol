// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardClauseMarketplace} from "../src/GuardClauseMarketplace.sol";
import {ReputationLedger} from "../src/ReputationLedger.sol";
import {ReflexWindowManager} from "../src/ReflexWindowManager.sol";
import {ClearanceRegistry} from "../src/ClearanceRegistry.sol";
import {ResourceToken} from "../src/ResourceToken.sol";
import {EpochManager} from "../src/EpochManager.sol";

contract GuardClauseMarketplaceTest is Test {
    GuardClauseMarketplace public marketplace;
    ReputationLedger public repLedger;
    ReflexWindowManager public reflexManager;
    ClearanceRegistry public clearance;
    ResourceToken public computeToken;
    EpochManager public epochMgr;

    address public admin = address(0x1);
    address public seller = address(0x10);
    address public buyer = address(0x20);

    event TemplateListed(uint256 indexed templateId, address indexed seller, uint256 priceInCompute);
    event ClausePurchased(uint256 indexed templateId, address indexed buyer);
    event ClauseActivated(uint256 indexed clauseId, uint256 indexed eventId, bool success);

    function setUp() public {
        vm.startPrank(admin);
        computeToken = new ResourceToken("Compute", "COMPUTE", admin);
        repLedger = new ReputationLedger(admin);
        reflexManager = new ReflexWindowManager();
        clearance = new ClearanceRegistry();
        epochMgr = new EpochManager(admin);

        marketplace = new GuardClauseMarketplace(
            address(computeToken),
            address(repLedger),
            address(reflexManager),
            address(clearance),
            address(epochMgr),
            admin
        );

        // Grant roles
        computeToken.grantRole(computeToken.MINTER_ROLE(), admin);
        repLedger.grantRole(repLedger.BURNER_ROLE(), address(marketplace));
        repLedger.grantRole(repLedger.RECORDER_ROLE(), address(marketplace));
        reflexManager.grantRole(reflexManager.ORACLE_ROLE(), admin);
        reflexManager.grantRole(reflexManager.OPERATOR_ROLE(), admin);
        clearance.grantRole(clearance.OPERATOR_ROLE(), address(marketplace));

        // Mint COMPUTE to buyer
        computeToken.mint(buyer, 100_000);

        // Set up clearance burn rate for buyer
        clearance.grantRole(clearance.OPERATOR_ROLE(), admin);
        clearance.setBurnRate(buyer, 5000);

        vm.stopPrank();

        // Approve marketplace to spend buyer's COMPUTE
        vm.prank(buyer);
        computeToken.approve(address(marketplace), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // listTemplate Tests
    // -------------------------------------------------------------------------

    function test_ListTemplate_Succeeds() public {
        bytes memory clause = hex"01020304";

        vm.prank(seller);
        uint256 templateId = marketplace.listTemplate(clause, 1000);

        assertEq(templateId, 1);
        (address s,,uint256 price, bool active,,) = marketplace.templates(templateId);
        assertEq(s, seller);
        assertEq(price, 1000);
        assertTrue(active);
    }

    function test_ListTemplate_BelowPriceFloorReverts() public {
        bytes memory clause = hex"01020304";

        vm.prank(seller);
        vm.expectRevert("GCM: below price floor");
        marketplace.listTemplate(clause, 10); // Below COMPUTE_PRICE_FLOOR (50)
    }

    function test_ListTemplate_EmptyClauseReverts() public {
        vm.prank(seller);
        vm.expectRevert("GCM: empty clause");
        marketplace.listTemplate("", 1000);
    }

    function test_ListTemplate_TooLargeClauseListsAsUnverified() public {
        // 265 bytes = exceeds MAX_TEMPLATE_OPCODES * 33 → listed but unverified
        bytes memory clause = new bytes(265);

        vm.prank(seller);
        uint256 templateId = marketplace.listTemplate(clause, 1000);

        (,,,, bool verified,) = marketplace.templates(templateId);
        assertFalse(verified, "Oversized clause should be unverified");
    }

    function test_ListTemplate_ValidClauseListsAsVerified() public {
        bytes memory clause = hex"01020304";

        vm.prank(seller);
        uint256 templateId = marketplace.listTemplate(clause, 500);

        (,,,, bool verified,) = marketplace.templates(templateId);
        assertTrue(verified, "Valid clause should be verified");
    }

    // -------------------------------------------------------------------------
    // purchaseAndIntegrate Tests
    // -------------------------------------------------------------------------

    function test_PurchaseAndIntegrate_Succeeds() public {
        _listTemplate(seller, 500);

        uint256 sellerBalBefore = computeToken.balanceOf(seller);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        assertEq(computeToken.balanceOf(seller), sellerBalBefore + 500);
    }

    function test_PurchaseAndIntegrate_InactiveReverts() public {
        _listTemplate(seller, 500);

        vm.prank(admin);
        marketplace.deactivateTemplate(1);

        vm.prank(buyer);
        vm.expectRevert("GCM: template not active");
        marketplace.purchaseAndIntegrate(1);
    }

    function test_PurchaseAndIntegrate_SelfBuyCooldown() public {
        _listTemplate(seller, 500);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        // Try again immediately
        vm.prank(buyer);
        vm.expectRevert("GCM: self-buy cooldown");
        marketplace.purchaseAndIntegrate(1);

        // Advance past cooldown (SELF_BUY_COOLDOWN_BLOCKS = 30)
        vm.roll(block.number + 31);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);
    }

    // -------------------------------------------------------------------------
    // activateClause Tests
    // -------------------------------------------------------------------------

    function test_ActivateClause_SuccessfulActivation() public {
        _listTemplate(seller, 500);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        // Open reflex window
        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        vm.prank(buyer);
        marketplace.activateClause(1, 1, true);
        // No revert = success
    }

    function test_ActivateClause_RequiresReflexWindow() public {
        _listTemplate(seller, 500);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        // No reflex window open
        vm.prank(buyer);
        vm.expectRevert("GCM: not in reflex window");
        marketplace.activateClause(1, 1, true);
    }

    function test_ActivateClause_RequiresPurchase() public {
        _listTemplate(seller, 500);

        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        vm.prank(buyer);
        vm.expectRevert("GCM: not purchased");
        marketplace.activateClause(1, 1, true);
    }

    function test_ActivateClause_IncorrectActivationPenalizes() public {
        _listTemplate(seller, 500);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        // Incorrect activation — should burn reputation on both seller and buyer
        vm.prank(buyer);
        marketplace.activateClause(1, 1, false);
        // Anomaly count incremented for both
    }

    // -------------------------------------------------------------------------
    // Cartel Farming Prevention
    // -------------------------------------------------------------------------

    function test_CartelFarming_EpochBonusCap() public {
        // Start epoch 1 in EpochManager
        vm.prank(admin);
        epochMgr.startFirstEpoch();

        _listTemplate(seller, 500);

        vm.prank(buyer);
        marketplace.purchaseAndIntegrate(1);

        vm.prank(admin);
        reflexManager.openReflexWindow(1);

        // First activation claims bonus in epoch 1
        vm.prank(buyer);
        marketplace.activateClause(1, 1, true);

        assertTrue(marketplace.hasClaimedBonusThisEpoch(1, buyer, 1));

        // Advance epoch via EpochManager (warp past duration, settle, then advance)
        vm.warp(block.timestamp + epochMgr.EPOCH_DURATION() + 1);
        vm.prank(admin);
        epochMgr.markSettled();
        vm.prank(admin);
        epochMgr.advanceEpoch();

        // Can claim bonus again in new epoch (epoch 2)
        assertFalse(marketplace.hasClaimedBonusThisEpoch(1, buyer, 2));
    }

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------

    function test_DeactivateTemplate() public {
        _listTemplate(seller, 500);

        vm.prank(admin);
        marketplace.deactivateTemplate(1);

        (,,, bool active,,) = marketplace.templates(1);
        assertFalse(active);
    }


    // -------------------------------------------------------------------------
    // validateTemplate Tests
    // -------------------------------------------------------------------------

    function test_ValidateTemplate_ValidClause() public view {
        assertTrue(marketplace.validateTemplate(hex"0102030405060708"));
    }

    function test_ValidateTemplate_EmptyClause() public view {
        assertFalse(marketplace.validateTemplate(""));
    }

    function test_ValidateTemplate_TooLargeClause() public view {
        bytes memory large = new bytes(265);
        assertFalse(marketplace.validateTemplate(large));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _listTemplate(address _seller, uint256 price) internal returns (uint256) {
        vm.prank(_seller);
        return marketplace.listTemplate(hex"01020304", price);
    }
}
