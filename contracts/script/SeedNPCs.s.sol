// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPlayerOnboarding {
    function onboardPlayer(address player, uint8 role, string calldata agentURI) external returns (uint256);
    function hasRegistered(address) external view returns (bool);
}

interface IAgentRegistry {
    function updateAllowlist(uint256 agentId, uint256 actionBitmap) external;
    function agentIdOf(address) external view returns (uint256);
}

/// @title SeedNPCs — Register 5 NPC agents and approve their tokens for trading
/// @notice Run in two phases:
///   Phase 1 (operator key): Register NPCs via PlayerOnboarding
///   Phase 2 (each NPC key): Approve OrderBook for all tokens
///
///   source .env && forge script script/SeedNPCs.s.sol:RegisterNPCs \
///     --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --slow --skip-simulation
///
///   Then for each NPC:
///   forge script script/SeedNPCs.s.sol:ApproveNPCTokens \
///     --rpc-url $RPC_URL --private-key $NPC_PK_N --broadcast --slow --skip-simulation
contract RegisterNPCs is Script {
    IPlayerOnboarding constant ONBOARDING = IPlayerOnboarding(0x77EC9115f982c6e48eB5701d3b7ad114c973B539);
    IAgentRegistry constant AGENT_REGISTRY = IAgentRegistry(0x60461A80d753b25fA2fd2d8E77527141110085D1);

    // Full allowlist: bits 0-4 = TRANSFER | ORDER_PLACE | ORDER_CANCEL | ORDER_MATCH | FEEDBACK_POST
    uint256 constant FULL_ALLOWLIST = 0x1F;

    struct NPCConfig {
        address addr;
        uint8 role;
        string name;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // NPC addresses (must match the generated keys)
        NPCConfig[5] memory npcs = [
            NPCConfig(0x40778B13840aBeB4079ab0BFd75112382175A42C, 0, "Meridian"),     // TalentHub
            NPCConfig(0x386406ACda5978E6d8EA8e0B24c4Ce30A3E719e5, 1, "Sentinel"),     // RegulatoryPower
            NPCConfig(0xdC424E6b56a3BA1B4b91c7f44f977700fA82DF56, 2, "Echo-Prime"),   // DataSovereign
            NPCConfig(0xADC81cfB07de436EE31eE5E035d84Aab6147F4B6, 3, "Vanguard"),     // ComputeSuperpower
            NPCConfig(0xf3D9b0D2b5A43e15a4Dd08F0EAc6b00cDEFab07C, 4, "Nexus-3")      // ChipsMagnate
        ];

        console2.log("=== Register NPCs ===");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(pk);

        for (uint256 i = 0; i < 5; i++) {
            if (ONBOARDING.hasRegistered(npcs[i].addr)) {
                console2.log("Already registered:", npcs[i].name);
                continue;
            }

            string memory uri = string(abi.encodePacked(
                '{"name":"', npcs[i].name, '","type":"NPC","role":', vm.toString(npcs[i].role), '}'
            ));

            uint256 agentId = ONBOARDING.onboardPlayer(npcs[i].addr, npcs[i].role, uri);
            console2.log("Registered:", npcs[i].name, "agentId:", agentId);

            // Update allowlist to full (include ACTION_TRANSFER for tile claims)
            AGENT_REGISTRY.updateAllowlist(agentId, FULL_ALLOWLIST);
            console2.log("  Allowlist set to", FULL_ALLOWLIST);
        }

        vm.stopBroadcast();
        console2.log("=== NPCs Registered ===");
    }
}

/// @title ApproveNPCTokens — Each NPC approves OrderBook for all tokens
/// @notice Run once per NPC with their private key:
///   forge script script/SeedNPCs.s.sol:ApproveNPCTokens \
///     --rpc-url $RPC_URL --private-key $NPC_PK --broadcast --slow --skip-simulation
contract ApproveNPCTokens is Script {
    address constant ORDER_BOOK = 0x1BeA07Cb15cd540d463efd17Bbc0Dcd006344B58;
    address constant RATE_TOKEN = 0x4cB785c678E309bcB86A4CFaEE9FEB4367985e1C;

    address[7] RESOURCE_TOKENS = [
        0xDCfd00cAe10D6aC13BcDf785a9e7Ab6c6036b427, // COMPUTE
        0x5cea8086e7B62c694dcb9c707c46942f535Ab1A7, // ENERGY
        0x82c76c6Ae247fA0597880ab5BCeC93bbcc732281, // CHIPS
        0x135D1E1Ce9295c94c9cEC63c8131bA28D20A7261, // COOLING
        0x2E87aBc41F0dAcEa141D212424e598cE4d2881EF, // TALENT
        0xa29Bb64FAe7b103b18FC13e3E8373954058F4115, // DATA
        0x9f37D312cb0B205e793080f33EE72731e1d4ED43  // CLEARANCE
    ];

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address npc = vm.addr(pk);
        console2.log("=== Approve tokens for NPC:", npc, "===");

        vm.startBroadcast(pk);

        // Approve RATE
        IERC20(RATE_TOKEN).approve(ORDER_BOOK, type(uint256).max);
        console2.log("  Approved RATE");

        // Approve all resource tokens
        for (uint256 i = 0; i < 7; i++) {
            IERC20(RESOURCE_TOKENS[i]).approve(ORDER_BOOK, type(uint256).max);
        }
        console2.log("  Approved 7 resource tokens");

        vm.stopBroadcast();
        console2.log("=== Approvals complete ===");
    }
}
