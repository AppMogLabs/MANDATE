// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PlayerOnboarding} from "../src/PlayerOnboarding.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";
import {RateToken} from "../src/RateToken.sol";
import {ResourceTokenFactory} from "../src/ResourceTokenFactory.sol";

/// @title DeployPlayerOnboarding — Deploy and configure the onboarding contract
/// @notice Split into two scripts to avoid MegaETH gas estimation cascade failures.
///
///   Step 1:  forge script script/DeployPlayerOnboarding.s.sol:DeployPlayerOnboarding \
///              --rpc-url $RPC --private-key $PK --broadcast --slow \
///              --gas-estimate-multiplier 200
///
///   Step 2:  Set ONBOARDING_ADDRESS env var to the deployed address, then:
///            forge script script/DeployPlayerOnboarding.s.sol:GrantOnboardingRoles \
///              --rpc-url $RPC --private-key $PK --broadcast --slow \
///              --gas-estimate-multiplier 200
///
/// @dev The --slow flag sends transactions sequentially (waits for receipt before next tx).
///      The --gas-estimate-multiplier 200 doubles the gas estimate to handle MegaETH's
///      10ms block time gas estimation quirks.
contract DeployPlayerOnboarding is Script {
    // Deployed contract addresses (MegaETH testnet)
    address constant AGENT_REGISTRY = 0x60461A80d753b25fA2fd2d8E77527141110085D1;
    address constant ROLE_REGISTRY  = 0x2653F9621e8894cADE271bbAb631292c9eb6373C;
    address constant RATE_TOKEN     = 0x4cB785c678E309bcB86A4CFaEE9FEB4367985e1C;
    address constant FACTORY        = 0x59fbB6aadb231f3F14A6BBAf72F258cC59b40DEe;

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
        address deployer = vm.addr(pk);

        console2.log("=== Step 1: Deploy PlayerOnboarding ===");
        console2.log("Deployer:", deployer);

        vm.startBroadcast(pk);

        PlayerOnboarding onboarding = new PlayerOnboarding(
            deployer,
            AGENT_REGISTRY,
            ROLE_REGISTRY,
            RATE_TOKEN,
            RESOURCE_TOKENS
        );

        vm.stopBroadcast();

        console2.log("PlayerOnboarding deployed at:", address(onboarding));
        console2.log("");
        console2.log("=== NEXT STEP ===");
        console2.log("Run GrantOnboardingRoles with:");
        console2.log("  ONBOARDING_ADDRESS=%s", address(onboarding));
    }
}

/// @title GrantOnboardingRoles — Grant roles to an already-deployed PlayerOnboarding
/// @notice Run AFTER DeployPlayerOnboarding succeeds. Set ONBOARDING_ADDRESS env var first.
contract GrantOnboardingRoles is Script {
    AgentRegistry constant AGENT_REGISTRY = AgentRegistry(0x60461A80d753b25fA2fd2d8E77527141110085D1);
    RoleRegistry  constant ROLE_REGISTRY  = RoleRegistry(0x2653F9621e8894cADE271bbAb631292c9eb6373C);
    RateToken     constant RATE_TOKEN     = RateToken(0x4cB785c678E309bcB86A4CFaEE9FEB4367985e1C);
    ResourceTokenFactory constant FACTORY = ResourceTokenFactory(0x59fbB6aadb231f3F14A6BBAf72F258cC59b40DEe);

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
        address deployer = vm.addr(pk);
        address onboarding = vm.envAddress("ONBOARDING_ADDRESS");

        console2.log("=== Step 2: Grant Roles to PlayerOnboarding ===");
        console2.log("Deployer:", deployer);
        console2.log("Onboarding:", onboarding);

        // Verify the contract exists
        uint256 codeSize;
        assembly { codeSize := extcodesize(onboarding) }
        require(codeSize > 0, "PlayerOnboarding has no code at this address - deploy first");

        vm.startBroadcast(pk);

        // 1. Grant REGISTRAR_ROLE on AgentRegistry (mint agents)
        AGENT_REGISTRY.grantRole(AGENT_REGISTRY.REGISTRAR_ROLE(), onboarding);
        console2.log("1/10 REGISTRAR_ROLE granted on AgentRegistry");

        // 2. Grant OPERATOR_ROLE on AgentRegistry (set allowlists)
        AGENT_REGISTRY.grantRole(AGENT_REGISTRY.OPERATOR_ROLE(), onboarding);
        console2.log("2/10 OPERATOR_ROLE granted on AgentRegistry");

        // 3. Grant OPERATOR_ROLE on RoleRegistry (assign roles)
        ROLE_REGISTRY.grantRole(ROLE_REGISTRY.OPERATOR_ROLE(), onboarding);
        console2.log("3/10 OPERATOR_ROLE granted on RoleRegistry");

        // 4. Grant MINTER_ROLE on RateToken (typed call, not raw .call())
        RATE_TOKEN.grantRole(RATE_TOKEN.MINTER_ROLE(), onboarding);
        console2.log("4/10 MINTER_ROLE granted on RateToken");

        // 5-11. Grant MINTER_ROLE on all 7 ResourceTokens via factory
        for (uint256 i; i < 7; ++i) {
            FACTORY.setMintAuthority(RESOURCE_TOKENS[i], onboarding, true);
            console2.log("  MINTER_ROLE granted on resource token", i + 1);
        }
        console2.log("5-10/10 MINTER_ROLE granted on all ResourceTokens");

        vm.stopBroadcast();

        console2.log("=== PlayerOnboarding fully configured ===");
        console2.log("Address:", onboarding);
    }
}
