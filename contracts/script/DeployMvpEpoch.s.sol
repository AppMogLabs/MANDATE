// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MvpEpoch} from "../src/MvpEpoch.sol";

/// @title DeployMvpEpoch — Deploy MvpEpoch and start the first 7-day epoch
/// @notice Run:
///   forge script script/DeployMvpEpoch.s.sol:DeployMvpEpoch \
///     --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --slow \
///     --gas-estimate-multiplier 200
contract DeployMvpEpoch is Script {
    address constant ORDER_BOOK = 0x1BeA07Cb15cd540d463efd17Bbc0Dcd006344B58;
    address constant RATE_TOKEN = 0x4cB785c678E309bcB86A4CFaEE9FEB4367985e1C;
    address constant COMPUTE    = 0xDCfd00cAe10D6aC13BcDf785a9e7Ab6c6036b427;
    address constant CHIPS      = 0x82c76c6Ae247fA0597880ab5BCeC93bbcc732281;
    address constant DATA       = 0xa29Bb64FAe7b103b18FC13e3E8373954058F4115;

    uint64 constant EPOCH_DURATION = 7 days;

    function run() external {
        vm.startBroadcast();
        address owner = msg.sender;

        MvpEpoch epoch = new MvpEpoch(
            owner,
            ORDER_BOOK,
            RATE_TOKEN,
            COMPUTE,
            CHIPS,
            DATA
        );

        vm.stopBroadcast();

        console2.log("MvpEpoch deployed at:", address(epoch));
        console2.log("Owner:", owner);
        console2.log("Next: call startEpoch(604800) from the owner wallet");
    }
}
