// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Create2Factory} from "../src/Create2Factory.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";
import {ClearanceRegistry} from "../src/ClearanceRegistry.sol";
import {MapRegistry} from "../src/MapRegistry.sol";
import {RateToken} from "../src/RateToken.sol";
import {ResourceTokenFactory} from "../src/ResourceTokenFactory.sol";
import {BuildingRegistry} from "../src/BuildingRegistry.sol";
import {ReputationLedger} from "../src/ReputationLedger.sol";
import {EventOracle} from "../src/EventOracle.sol";
import {ReflexWindowManager} from "../src/ReflexWindowManager.sol";
import {InsurancePool} from "../src/InsurancePool.sol";
import {HedgeFactory} from "../src/HedgeFactory.sol";
import {MandateEchoOracle} from "../src/MandateEchoOracle.sol";
import {LineageLedger} from "../src/LineageLedger.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {AuditLog} from "../src/AuditLog.sol";
import {CoolingRelay} from "../src/CoolingRelay.sol";
import {ComplianceDriftOracle} from "../src/ComplianceDriftOracle.sol";
import {GuardClauseMarketplace} from "../src/GuardClauseMarketplace.sol";

/// @title DeployCreate2 - CREATE2-based deterministic deployment for MANDATE
/// @notice Deploys all Phase 2 contracts using CREATE2 for deterministic addresses
/// @dev Deployment order follows dependency graph:
///      Phase 1: RoleRegistry, ClearanceRegistry, MapRegistry, AgentRegistry, AuditLog
///      Phase 2: RateToken, ResourceTokenFactory
///      Phase 3: BuildingRegistry, ReputationLedger, EventOracle, ReflexWindowManager
///      Phase 4: InsurancePool, HedgeFactory, MandateEchoOracle, LineageLedger
contract DeployCreate2 is Script {
    // Contract version for salt generation
    string constant VERSION = "v1.0.0";

    // CREATE2 Factory
    Create2Factory public factory;

    // Deployment addresses (public for testnet variant to access)
    address public roleRegistry;
    address public clearanceRegistry;
    address public mapRegistry;
    address public agentRegistry;
    address public auditLog;
    address public rateToken;
    address public resourceTokenFactory;
    address public computeToken;
    address public chipsToken;
    address public energyToken;
    address public coolingToken;
    address public talentToken;
    address public dataToken;
    address public clearanceToken;
    address public buildingRegistry;
    address public reputationLedger;
    address public eventOracle;
    address public reflexWindowManager;
    address public insurancePool;
    address public hedgeFactory;
    address public mandateEchoOracle;
    address public lineageLedger;

    function run() external virtual {
        _runDeployment();
    }

    function _runDeployment() internal {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("====================================");
        console2.log("MANDATE CREATE2 Deployment");
        console2.log("====================================");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("Version:", VERSION);
        console2.log("====================================\n");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy CREATE2 Factory first
        console2.log("0. Deploying Create2Factory...");
        factory = new Create2Factory();
        console2.log("   Factory:", address(factory));
        console2.log("");

        // Phase 1: Independent contracts (no dependencies)
        deployPhase1(deployer);

        // Phase 2: Token layer
        deployPhase2(deployer);

        // Phase 3: Core infrastructure (depends on Phase 1+2)
        deployPhase3(deployer);

        // Phase 4: Market + Intelligence (depends on Phase 3)
        deployPhase4(deployer);

        vm.stopBroadcast();

        // Print deployment summary
        printDeploymentSummary(deployer);
        printJSONManifest(deployer);
    }

    function deployPhase1(address deployer) internal {
        console2.log("====================================");
        console2.log("Phase 1: Independent Contracts");
        console2.log("====================================\n");

        // 1. RoleRegistry
        console2.log("1. Deploying RoleRegistry...");
        bytes32 salt1 = factory.generateSalt("RoleRegistry", VERSION);
        bytes memory bytecode1 = abi.encodePacked(type(RoleRegistry).creationCode, abi.encode(deployer));
        roleRegistry = factory.deploy(bytecode1, salt1);
        console2.log("   Address:", roleRegistry);
        console2.log("");

        // 2. ClearanceRegistry
        console2.log("2. Deploying ClearanceRegistry...");
        bytes32 salt2 = factory.generateSalt("ClearanceRegistry", VERSION);
        bytes memory bytecode2 = abi.encodePacked(type(ClearanceRegistry).creationCode, abi.encode(deployer));
        clearanceRegistry = factory.deploy(bytecode2, salt2);
        console2.log("   Address:", clearanceRegistry);
        console2.log("");

        // 3. MapRegistry
        console2.log("3. Deploying MapRegistry...");
        bytes32 salt3 = factory.generateSalt("MapRegistry", VERSION);
        bytes memory bytecode3 = abi.encodePacked(type(MapRegistry).creationCode, abi.encode(deployer));
        mapRegistry = factory.deploy(bytecode3, salt3);
        console2.log("   Address:", mapRegistry);
        console2.log("");

        // 4. AgentRegistry
        console2.log("4. Deploying AgentRegistry...");
        bytes32 salt4 = factory.generateSalt("AgentRegistry", VERSION);
        bytes memory bytecode4 = abi.encodePacked(type(AgentRegistry).creationCode, abi.encode(deployer));
        agentRegistry = factory.deploy(bytecode4, salt4);
        console2.log("   Address:", agentRegistry);
        console2.log("");

        // 5. AuditLog
        console2.log("5. Deploying AuditLog...");
        bytes32 salt5 = factory.generateSalt("AuditLog", VERSION);
        bytes memory bytecode5 = abi.encodePacked(type(AuditLog).creationCode, abi.encode(deployer));
        auditLog = factory.deploy(bytecode5, salt5);
        console2.log("   Address:", auditLog);
        console2.log("");
    }

    function deployPhase2(address deployer) internal {
        console2.log("====================================");
        console2.log("Phase 2: Token Layer");
        console2.log("====================================\n");

        // 1. RateToken
        console2.log("1. Deploying RateToken...");
        bytes32 salt = factory.generateSalt("RateToken", VERSION);
        bytes memory bytecode = abi.encodePacked(type(RateToken).creationCode, abi.encode(deployer));
        rateToken = factory.deploy(bytecode, salt);
        console2.log("   Address:", rateToken);
        console2.log("");

        // 2. ResourceTokenFactory
        console2.log("2. Deploying ResourceTokenFactory...");
        bytes32 salt2 = factory.generateSalt("ResourceTokenFactory", VERSION);
        bytes memory bytecode2 = abi.encodePacked(type(ResourceTokenFactory).creationCode, abi.encode(deployer));
        resourceTokenFactory = factory.deploy(bytecode2, salt2);
        console2.log("   Address:", resourceTokenFactory);
        console2.log("");

        // 3. Deploy all 7 resource tokens via factory
        ResourceTokenFactory factoryContract = ResourceTokenFactory(resourceTokenFactory);

        console2.log("3. Deploying COMPUTE resource token...");
        computeToken = factoryContract.deployResource("COMPUTE", "COMPUTE");
        console2.log("   Address:", computeToken);
        console2.log("");

        console2.log("4. Deploying CHIPS resource token...");
        chipsToken = factoryContract.deployResource("CHIPS", "CHIPS");
        console2.log("   Address:", chipsToken);
        console2.log("");

        console2.log("5. Deploying ENERGY resource token...");
        energyToken = factoryContract.deployResource("ENERGY", "ENERGY");
        console2.log("   Address:", energyToken);
        console2.log("");

        console2.log("6. Deploying COOLING resource token...");
        coolingToken = factoryContract.deployResource("COOLING", "COOLING");
        console2.log("   Address:", coolingToken);
        console2.log("");

        console2.log("7. Deploying TALENT resource token...");
        talentToken = factoryContract.deployResource("TALENT", "TALENT");
        console2.log("   Address:", talentToken);
        console2.log("");

        console2.log("8. Deploying DATA resource token...");
        dataToken = factoryContract.deployResource("DATA", "DATA");
        console2.log("   Address:", dataToken);
        console2.log("");

        console2.log("9. Deploying CLEARANCE resource token...");
        clearanceToken = factoryContract.deployResource("CLEARANCE", "CLEARANCE");
        console2.log("   Address:", clearanceToken);
        console2.log("");
    }

    function deployPhase3(address deployer) internal {
        console2.log("====================================");
        console2.log("Phase 3: Core Infrastructure");
        console2.log("====================================\n");

        // 1. BuildingRegistry (8 constructor args: agentRegistry + 7 resource tokens)
        console2.log("1. Deploying BuildingRegistry...");
        bytes32 salt = factory.generateSalt("BuildingRegistry", VERSION);
        bytes memory bytecode =
            abi.encodePacked(type(BuildingRegistry).creationCode, abi.encode(
                agentRegistry, computeToken, energyToken, chipsToken,
                coolingToken, talentToken, dataToken, clearanceToken
            ));
        buildingRegistry = factory.deploy(bytecode, salt);
        console2.log("   Address:", buildingRegistry);
        console2.log("");

        // 2. ReputationLedger
        console2.log("2. Deploying ReputationLedger...");
        bytes32 salt2 = factory.generateSalt("ReputationLedger", VERSION);
        bytes memory bytecode2 = abi.encodePacked(type(ReputationLedger).creationCode, abi.encode(deployer));
        reputationLedger = factory.deploy(bytecode2, salt2);
        console2.log("   Address:", reputationLedger);
        console2.log("");

        // 3. EventOracle
        console2.log("3. Deploying EventOracle...");
        bytes32 salt3 = factory.generateSalt("EventOracle", VERSION);
        bytes memory bytecode3 = abi.encodePacked(type(EventOracle).creationCode, abi.encode(deployer));
        eventOracle = factory.deploy(bytecode3, salt3);
        console2.log("   Address:", eventOracle);
        console2.log("");

        // 4. ReflexWindowManager (no constructor args — uses msg.sender for admin)
        console2.log("4. Deploying ReflexWindowManager...");
        bytes32 salt4 = factory.generateSalt("ReflexWindowManager", VERSION);
        bytes memory bytecode4 = abi.encodePacked(type(ReflexWindowManager).creationCode);
        reflexWindowManager = factory.deploy(bytecode4, salt4);
        console2.log("   Address:", reflexWindowManager);
        console2.log("");

        // Grant ORACLE_ROLE to EventOracle
        ReflexWindowManager(reflexWindowManager).grantRole(keccak256("ORACLE_ROLE"), eventOracle);
        console2.log("   Granted ORACLE_ROLE to EventOracle");
        console2.log("");
    }

    function deployPhase4(address deployer) internal {
        console2.log("====================================");
        console2.log("Phase 4: Market + Intelligence");
        console2.log("====================================\n");

        // 1. InsurancePool
        console2.log("1. Deploying InsurancePool...");
        bytes32 salt = factory.generateSalt("InsurancePool", VERSION);
        bytes memory bytecode = abi.encodePacked(type(InsurancePool).creationCode, abi.encode(rateToken, deployer));
        insurancePool = factory.deploy(bytecode, salt);
        console2.log("   Address:", insurancePool);
        console2.log("");

        // 2. HedgeFactory (constructor takes rateToken_)
        console2.log("2. Deploying HedgeFactory...");
        bytes32 salt2 = factory.generateSalt("HedgeFactory", VERSION);
        bytes memory bytecode2 = abi.encodePacked(type(HedgeFactory).creationCode, abi.encode(rateToken));
        hedgeFactory = factory.deploy(bytecode2, salt2);
        console2.log("   Address:", hedgeFactory);
        console2.log("");

        // 3. MandateEchoOracle
        console2.log("3. Deploying MandateEchoOracle...");
        bytes32 salt3 = factory.generateSalt("MandateEchoOracle", VERSION);
        bytes memory bytecode3 = abi.encodePacked(type(MandateEchoOracle).creationCode, abi.encode(deployer));
        mandateEchoOracle = factory.deploy(bytecode3, salt3);
        console2.log("   Address:", mandateEchoOracle);
        console2.log("");

        // 4. LineageLedger (constructor takes admin, reputationLedger)
        console2.log("4. Deploying LineageLedger...");
        bytes32 salt4 = factory.generateSalt("LineageLedger", VERSION);
        bytes memory bytecode4 = abi.encodePacked(type(LineageLedger).creationCode, abi.encode(deployer, reputationLedger));
        lineageLedger = factory.deploy(bytecode4, salt4);
        console2.log("   Address:", lineageLedger);
        console2.log("");
    }

    function printDeploymentSummary(address deployer) internal view {
        console2.log("\n====================================");
        console2.log("Deployment Summary");
        console2.log("====================================");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("\nPhase 1: Independent Contracts");
        console2.log("  RoleRegistry:         ", roleRegistry);
        console2.log("  ClearanceRegistry:    ", clearanceRegistry);
        console2.log("  MapRegistry:          ", mapRegistry);
        console2.log("  AgentRegistry:        ", agentRegistry);
        console2.log("  AuditLog:             ", auditLog);
        console2.log("\nPhase 2: Token Layer");
        console2.log("  RateToken:            ", rateToken);
        console2.log("  ResourceTokenFactory: ", resourceTokenFactory);
        console2.log("  COMPUTE:              ", computeToken);
        console2.log("  CHIPS:                ", chipsToken);
        console2.log("  ENERGY:               ", energyToken);
        console2.log("  COOLING:              ", coolingToken);
        console2.log("  TALENT:               ", talentToken);
        console2.log("  DATA:                 ", dataToken);
        console2.log("  CLEARANCE:            ", clearanceToken);
        console2.log("\nPhase 3: Core Infrastructure");
        console2.log("  BuildingRegistry:     ", buildingRegistry);
        console2.log("  ReputationLedger:     ", reputationLedger);
        console2.log("  EventOracle:          ", eventOracle);
        console2.log("  ReflexWindowManager:  ", reflexWindowManager);
        console2.log("\nPhase 4: Market + Intelligence");
        console2.log("  InsurancePool:        ", insurancePool);
        console2.log("  HedgeFactory:         ", hedgeFactory);
        console2.log("  MandateEchoOracle:    ", mandateEchoOracle);
        console2.log("  LineageLedger:        ", lineageLedger);
        console2.log("====================================");
    }

    function printJSONManifest(address deployer) internal view {
        console2.log("\n====================================");
        console2.log("JSON Manifest");
        console2.log("====================================");
        console2.log("Copy to script/config/addresses.json:\n");
        console2.log("{");
        console2.log('  "chainId":', block.chainid, ",");
        console2.log('  "deployer": "', vm.toString(deployer), '",');
        console2.log('  "version": "', VERSION, '",');
        console2.log('  "timestamp":', block.timestamp, ",");
        console2.log('  "factory": "', vm.toString(address(factory)), '",');
        console2.log('  "contracts": {');
        console2.log('    "RoleRegistry": "', vm.toString(roleRegistry), '",');
        console2.log('    "ClearanceRegistry": "', vm.toString(clearanceRegistry), '",');
        console2.log('    "MapRegistry": "', vm.toString(mapRegistry), '",');
        console2.log('    "AgentRegistry": "', vm.toString(agentRegistry), '",');
        console2.log('    "AuditLog": "', vm.toString(auditLog), '",');
        console2.log('    "RateToken": "', vm.toString(rateToken), '",');
        console2.log('    "ResourceTokenFactory": "', vm.toString(resourceTokenFactory), '",');
        console2.log('    "COMPUTE": "', vm.toString(computeToken), '",');
        console2.log('    "CHIPS": "', vm.toString(chipsToken), '",');
        console2.log('    "ENERGY": "', vm.toString(energyToken), '",');
        console2.log('    "COOLING": "', vm.toString(coolingToken), '",');
        console2.log('    "TALENT": "', vm.toString(talentToken), '",');
        console2.log('    "DATA": "', vm.toString(dataToken), '",');
        console2.log('    "CLEARANCE": "', vm.toString(clearanceToken), '",');
        console2.log('    "BuildingRegistry": "', vm.toString(buildingRegistry), '",');
        console2.log('    "ReputationLedger": "', vm.toString(reputationLedger), '",');
        console2.log('    "EventOracle": "', vm.toString(eventOracle), '",');
        console2.log('    "ReflexWindowManager": "', vm.toString(reflexWindowManager), '",');
        console2.log('    "InsurancePool": "', vm.toString(insurancePool), '",');
        console2.log('    "HedgeFactory": "', vm.toString(hedgeFactory), '",');
        console2.log('    "MandateEchoOracle": "', vm.toString(mandateEchoOracle), '",');
        console2.log('    "LineageLedger": "', vm.toString(lineageLedger), '"');
        console2.log("  }");
        console2.log("}");
    }
}
