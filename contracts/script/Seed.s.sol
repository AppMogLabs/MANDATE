// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RateToken} from "../src/RateToken.sol";
import {ResourceToken} from "../src/ResourceToken.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {OrderBook} from "../src/OrderBook.sol";
import {EpochManager} from "../src/EpochManager.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";
import {ResourceTokenFactory} from "../src/ResourceTokenFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Seed — Populate MegaETH testnet with initial MANDATE game state
contract Seed is Script {
    ResourceTokenFactory constant FACTORY = ResourceTokenFactory(0x59fbB6aadb231f3F14A6BBAf72F258cC59b40DEe);
    // ── Deployed addresses (checksummed) ───────────────────────────────
    RateToken constant RATE = RateToken(0x4cB785c678E309bcB86A4CFaEE9FEB4367985e1C);

    ResourceToken constant COMPUTE   = ResourceToken(0xDCfd00cAe10D6aC13BcDf785a9e7Ab6c6036b427);
    ResourceToken constant ENERGY    = ResourceToken(0x5cea8086e7B62c694dcb9c707c46942f535Ab1A7);
    ResourceToken constant CHIPS     = ResourceToken(0x82c76c6Ae247fA0597880ab5BCeC93bbcc732281);
    ResourceToken constant COOLING   = ResourceToken(0x135D1E1Ce9295c94c9cEC63c8131bA28D20A7261);
    ResourceToken constant TALENT    = ResourceToken(0x2E87aBc41F0dAcEa141D212424e598cE4d2881EF);
    ResourceToken constant DATA_TKN  = ResourceToken(0xa29Bb64FAe7b103b18FC13e3E8373954058F4115);
    ResourceToken constant CLEARANCE_TKN = ResourceToken(0x9f37D312cb0B205e793080f33EE72731e1d4ED43);

    AgentRegistry constant REGISTRY     = AgentRegistry(0x60461A80d753b25fA2fd2d8E77527141110085D1);
    OrderBook     constant ORDER_BOOK   = OrderBook(0x1BeA07Cb15cd540d463efd17Bbc0Dcd006344B58);
    EpochManager  constant EPOCH_MGR    = EpochManager(0x44bEA0CFB25a42F0d80505725535e7B4bC8076eA);
    RoleRegistry  constant ROLES        = RoleRegistry(0x2653F9621e8894cADE271bbAb631292c9eb6373C);

    // Allowlist bitmap: bits 0-6 set = all basic actions permitted
    uint256 constant FULL_ALLOWLIST = 0x7F;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("=== MANDATE Seed ===");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(pk);

        // ── 1. Register agent (skip if already registered) ────────────
        uint256 agentId = REGISTRY.agentIdOf(deployer);
        if (agentId == 0) {
            REGISTRY.registerAgent(
                deployer,
                '{"name":"Alpha-7","role":"ComputeSuperpower","negotiationEndpoint":"http://localhost:8545"}'
            );
            agentId = REGISTRY.agentIdOf(deployer);
            REGISTRY.updateAllowlist(agentId, FULL_ALLOWLIST);
            console2.log("Agent registered, ID:", agentId);
        } else {
            console2.log("Agent already registered, ID:", agentId);
        }

        // ── 2. Grant OPERATOR_ROLE then assign role ──────────────────
        if (!ROLES.hasRole(ROLES.OPERATOR_ROLE(), deployer)) {
            ROLES.grantRole(ROLES.OPERATOR_ROLE(), deployer);
        }
        ROLES.assignRole(RoleRegistry.Role(0), deployer); // ComputeSuperpower
        console2.log("Role: ComputeSuperpower");

        // ── 3. Grant MINTER_ROLE on resource tokens via factory ───────
        FACTORY.setMintAuthority(address(COMPUTE), deployer, true);
        FACTORY.setMintAuthority(address(ENERGY), deployer, true);
        FACTORY.setMintAuthority(address(CHIPS), deployer, true);
        FACTORY.setMintAuthority(address(COOLING), deployer, true);
        FACTORY.setMintAuthority(address(TALENT), deployer, true);
        FACTORY.setMintAuthority(address(DATA_TKN), deployer, true);
        FACTORY.setMintAuthority(address(CLEARANCE_TKN), deployer, true);
        console2.log("MINTER_ROLE granted on all resource tokens");

        // ── 4. Mint tokens ────────────────────────────────────────────
        RATE.mint(deployer, 15_000 ether);
        COMPUTE.mint(deployer, 5_000 ether);
        ENERGY.mint(deployer, 2_000 ether);
        CHIPS.mint(deployer, 2_000 ether);
        COOLING.mint(deployer, 500 ether);
        TALENT.mint(deployer, 500 ether);
        DATA_TKN.mint(deployer, 2_000 ether);
        CLEARANCE_TKN.mint(deployer, 500 ether);
        console2.log("Tokens minted");

        // ── 5. Start epoch (skip if already active) ──────────────────
        if (EPOCH_MGR.getCurrentEpoch() == 0) {
            EPOCH_MGR.startFirstEpoch();
            console2.log("Epoch 1 started");
        } else {
            console2.log("Epoch already active:", EPOCH_MGR.getCurrentEpoch());
        }

        // ── 5. Approve OrderBook ──────────────────────────────────────
        IERC20(address(COMPUTE)).approve(address(ORDER_BOOK), type(uint256).max);
        IERC20(address(ENERGY)).approve(address(ORDER_BOOK), type(uint256).max);
        IERC20(address(CHIPS)).approve(address(ORDER_BOOK), type(uint256).max);
        IERC20(address(DATA_TKN)).approve(address(ORDER_BOOK), type(uint256).max);

        // ── 6. Place orders ───────────────────────────────────────────
        ORDER_BOOK.placeOrder(address(COMPUTE), 500 ether, 1.20 ether);
        ORDER_BOOK.placeOrder(address(COMPUTE), 300 ether, 1.35 ether);
        ORDER_BOOK.placeOrder(address(ENERGY), 1000 ether, 0.50 ether);
        ORDER_BOOK.placeOrder(address(ENERGY), 800 ether, 0.55 ether);
        ORDER_BOOK.placeOrder(address(CHIPS), 200 ether, 2.10 ether);
        ORDER_BOOK.placeOrder(address(DATA_TKN), 400 ether, 1.80 ether);
        console2.log("6 orders placed");

        vm.stopBroadcast();
        console2.log("=== Seed Complete ===");
    }
}
