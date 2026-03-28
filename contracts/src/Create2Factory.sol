// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/// @title Create2Factory - Deterministic contract deployment factory
/// @notice Deploys contracts using CREATE2 for deterministic addresses across chains
/// @dev Uses OpenZeppelin's Create2 library with custom salt generation
/// @custom:security Only admin can deploy contracts
/// @custom:security Salt includes contract name and version for uniqueness
contract Create2Factory {
    /// @notice Emitted when a contract is deployed via CREATE2
    /// @param contractAddress The deployed contract address
    /// @param salt The salt used for deployment
    /// @param deployer The address that initiated the deployment
    event ContractDeployed(address indexed contractAddress, bytes32 indexed salt, address indexed deployer);

    /// @notice Admin address with deployment permissions
    address public immutable admin;

    /// @notice Tracks deployed contracts to prevent re-deployment with same salt
    mapping(bytes32 => address) public deployedContracts;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Create2Factory: caller is not admin");
        _;
    }

    /// @notice Generate deterministic salt for contract deployment
    /// @param contractName Name of the contract (e.g., "RoleRegistry")
    /// @param version Version string (e.g., "v1.0.0")
    /// @return Salt for CREATE2 deployment
    function generateSalt(string memory contractName, string memory version) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("MANDATE", contractName, version));
    }

    /// @notice Deploy a contract using CREATE2
    /// @param bytecode Contract creation bytecode (including constructor args)
    /// @param salt Deterministic salt for address generation
    /// @return deployedAddress The address of the deployed contract
    function deploy(bytes memory bytecode, bytes32 salt) public onlyAdmin returns (address deployedAddress) {
        require(deployedContracts[salt] == address(0), "Create2Factory: contract already deployed with this salt");

        deployedAddress = Create2.deploy(0, salt, bytecode);

        deployedContracts[salt] = deployedAddress;
        emit ContractDeployed(deployedAddress, salt, msg.sender);

        return deployedAddress;
    }

    /// @notice Compute the address where a contract will be deployed
    /// @param bytecode Contract creation bytecode (including constructor args)
    /// @param salt Deterministic salt for address generation
    /// @return Predicted contract address
    function computeAddress(bytes memory bytecode, bytes32 salt) public view returns (address) {
        return Create2.computeAddress(salt, keccak256(bytecode));
    }

    /// @notice Compute address using contract name and version
    /// @param bytecode Contract creation bytecode
    /// @param contractName Name of the contract
    /// @param version Version string
    /// @return Predicted contract address
    function computeAddressFromName(bytes memory bytecode, string memory contractName, string memory version)
        public
        view
        returns (address)
    {
        bytes32 salt = generateSalt(contractName, version);
        return computeAddress(bytecode, salt);
    }
}
