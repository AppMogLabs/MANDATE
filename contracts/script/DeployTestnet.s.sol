// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DeployCreate2} from "./DeployCreate2.s.sol";
import {console2} from "forge-std/Script.sol";
import {RateToken} from "../src/RateToken.sol";

/// @title DeployTestnet - Testnet-specific deployment with test data
/// @notice Extends DeployCreate2 with testnet-specific initialization
/// @dev Adds test RATE distribution to known test agents
contract DeployTestnet is DeployCreate2 {
    // Test agent addresses for initial RATE distribution
    address constant TEST_AGENT_ALPHA = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant TEST_AGENT_BETA = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 constant INITIAL_RATE_PER_AGENT = 1000 * 1e18;

    function run() external override {
        // First, run the standard CREATE2 deployment
        _runDeployment();

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Testnet-specific: Distribute RATE to test agents
        console2.log("\n====================================");
        console2.log("Testnet Initialization");
        console2.log("====================================\n");

        RateToken rateTokenContract = RateToken(rateToken);

        console2.log("Distributing test RATE to agents...");
        rateTokenContract.transfer(TEST_AGENT_ALPHA, INITIAL_RATE_PER_AGENT);
        rateTokenContract.transfer(TEST_AGENT_BETA, INITIAL_RATE_PER_AGENT);

        console2.log("  Agent Alpha:", TEST_AGENT_ALPHA);
        console2.log("  Amount:     ", INITIAL_RATE_PER_AGENT / 1e18, "RATE");
        console2.log("  Agent Beta: ", TEST_AGENT_BETA);
        console2.log("  Amount:     ", INITIAL_RATE_PER_AGENT / 1e18, "RATE");
        console2.log("\nTestnet initialization complete!");
        console2.log("====================================");

        vm.stopBroadcast();
    }
}
