// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RateToken} from "../src/RateToken.sol";
import {ResourceToken} from "../src/ResourceToken.sol";
import {ResourceTokenFactory} from "../src/ResourceTokenFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ReputationLedger} from "../src/ReputationLedger.sol";
import {AuditLog} from "../src/AuditLog.sol";
import {OrderBook} from "../src/OrderBook.sol";
import {RoleRegistry} from "../src/RoleRegistry.sol";
import {MapRegistry} from "../src/MapRegistry.sol";
import {BuildingRegistry} from "../src/BuildingRegistry.sol";
import {EpochManager} from "../src/EpochManager.sol";
import {EventOracle} from "../src/EventOracle.sol";
import {InformationMarket} from "../src/InformationMarket.sol";
import {ReflexWindowManager} from "../src/ReflexWindowManager.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {ClearanceRegistry} from "../src/ClearanceRegistry.sol";
import {ComplianceDriftOracle} from "../src/ComplianceDriftOracle.sol";
import {LineageLedger} from "../src/LineageLedger.sol";
import {CoolingRelay} from "../src/CoolingRelay.sol";
import {InsurancePool} from "../src/InsurancePool.sol";
import {MandateEchoOracle} from "../src/MandateEchoOracle.sol";
import {EchoVerifier} from "../src/EchoVerifier.sol";
import {GuardClauseMarketplace} from "../src/GuardClauseMarketplace.sol";
import {NegotiationSettlement} from "../src/NegotiationSettlement.sol";
import {HedgeFactory} from "../src/HedgeFactory.sol";
import {EpochRewardManager} from "../src/EpochRewardManager.sol";
import {RentCollector} from "../src/RentCollector.sol";

/// @title DeployAll — Full MANDATE v0.3 deployment to MegaETH testnet
contract DeployAll is Script {
    // Storage slots to avoid stack-too-deep
    address public rateToken;
    address public factory;
    address[7] public resources; // COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE
    address public agentRegistry;
    address public auditLog;
    address public repLedger;
    address public roleRegistry;
    address public mapRegistry;
    address public buildingRegistry;
    address public epochManager;
    address public orderBook;
    address public eventOracle;
    address public infoMarket;
    address public reflexManager;
    address public predictionMarket;
    address public clearanceRegistry;
    address public complianceOracle;
    address public insurancePool;
    address public lineageLedger;
    address public coolingRelay;
    address public echoOracle;
    address public echoVerifier;
    address public guardMarketplace;
    address public negotiationSettlement;
    address public hedgeFactory;
    address public rewardManager;
    address public rentCollector;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("=== MANDATE Full Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(pk);

        _deployFoundation(deployer);
        _deployCoreEconomy(deployer);
        _deployEventsAndIntel(deployer);
        _deployEspionage(deployer);
        _deployAdvancedIntel(deployer);
        _deploySettlement(deployer);
        _grantRoles(deployer);

        vm.stopBroadcast();

        _printAddresses();
    }

    function _deployFoundation(address deployer) internal {
        rateToken = address(new RateToken(deployer));
        console2.log("RateToken:", rateToken);

        ResourceTokenFactory f = new ResourceTokenFactory(deployer);
        factory = address(f);
        console2.log("ResourceTokenFactory:", factory);

        resources[0] = f.deployResource("COMPUTE", "COMPUTE");
        resources[1] = f.deployResource("ENERGY", "ENERGY");
        resources[2] = f.deployResource("CHIPS", "CHIPS");
        resources[3] = f.deployResource("COOLING", "COOLING");
        resources[4] = f.deployResource("TALENT", "TALENT");
        resources[5] = f.deployResource("DATA", "DATA");
        resources[6] = f.deployResource("CLEARANCE", "CLEARANCE");
        console2.log("COMPUTE:", resources[0]);
        console2.log("ENERGY:", resources[1]);
        console2.log("CHIPS:", resources[2]);
        console2.log("COOLING:", resources[3]);
        console2.log("TALENT:", resources[4]);
        console2.log("DATA:", resources[5]);
        console2.log("CLEARANCE:", resources[6]);

        agentRegistry = address(new AgentRegistry(deployer));
        console2.log("AgentRegistry:", agentRegistry);

        auditLog = address(new AuditLog(deployer));
        console2.log("AuditLog:", auditLog);

        repLedger = address(new ReputationLedger(deployer));
        console2.log("ReputationLedger:", repLedger);

        roleRegistry = address(new RoleRegistry(deployer));
        console2.log("RoleRegistry:", roleRegistry);
    }

    function _deployCoreEconomy(address deployer) internal {
        mapRegistry = address(new MapRegistry(agentRegistry));
        console2.log("MapRegistry:", mapRegistry);

        buildingRegistry = address(new BuildingRegistry(
            agentRegistry, resources[0], resources[1], resources[2],
            resources[3], resources[4], resources[5], resources[6]
        ));
        console2.log("BuildingRegistry:", buildingRegistry);

        epochManager = address(new EpochManager(deployer));
        console2.log("EpochManager:", epochManager);

        orderBook = address(new OrderBook(
            rateToken, agentRegistry, repLedger, auditLog, epochManager, deployer
        ));
        console2.log("OrderBook:", orderBook);
    }

    function _deployEventsAndIntel(address deployer) internal {
        eventOracle = address(new EventOracle());
        console2.log("EventOracle:", eventOracle);

        infoMarket = address(new InformationMarket(rateToken, deployer));
        console2.log("InformationMarket:", infoMarket);

        reflexManager = address(new ReflexWindowManager());
        console2.log("ReflexWindowManager:", reflexManager);

        predictionMarket = address(new PredictionMarket(rateToken, deployer));
        console2.log("PredictionMarket:", predictionMarket);
    }

    function _deployEspionage(address deployer) internal {
        clearanceRegistry = address(new ClearanceRegistry());
        console2.log("ClearanceRegistry:", clearanceRegistry);

        complianceOracle = address(new ComplianceDriftOracle(
            clearanceRegistry, roleRegistry, infoMarket, deployer
        ));
        console2.log("ComplianceDriftOracle:", complianceOracle);

        insurancePool = address(new InsurancePool(rateToken));
        console2.log("InsurancePool:", insurancePool);

        lineageLedger = address(new LineageLedger(
            agentRegistry, repLedger, auditLog, infoMarket, rateToken, resources[5], deployer
        ));
        console2.log("LineageLedger:", lineageLedger);

        coolingRelay = address(new CoolingRelay(reflexManager, roleRegistry, deployer));
        console2.log("CoolingRelay:", coolingRelay);
    }

    function _deployAdvancedIntel(address deployer) internal {
        echoOracle = address(new MandateEchoOracle());
        console2.log("MandateEchoOracle:", echoOracle);

        echoVerifier = address(new EchoVerifier(
            agentRegistry, echoOracle, repLedger, auditLog, infoMarket, rateToken, deployer
        ));
        console2.log("EchoVerifier:", echoVerifier);

        guardMarketplace = address(new GuardClauseMarketplace(
            resources[0], repLedger, reflexManager, clearanceRegistry, epochManager, deployer
        ));
        console2.log("GuardClauseMarketplace:", guardMarketplace);
    }

    function _deploySettlement(address deployer) internal {
        negotiationSettlement = address(new NegotiationSettlement(
            agentRegistry, repLedger, auditLog, deployer
        ));
        console2.log("NegotiationSettlement:", negotiationSettlement);

        hedgeFactory = address(new HedgeFactory(rateToken, orderBook));
        console2.log("HedgeFactory:", hedgeFactory);

        rewardManager = address(new EpochRewardManager(
            rateToken, epochManager, agentRegistry, deployer
        ));
        console2.log("EpochRewardManager:", rewardManager);

        rentCollector = address(new RentCollector(
            rateToken, mapRegistry, buildingRegistry, deployer
        ));
        console2.log("RentCollector:", rentCollector);
    }

    function _grantRoles(address /*deployer*/) internal {
        console2.log("=== Granting Roles ===");

        // AuditLog LOGGER_ROLE
        bytes32 loggerRole = AuditLog(auditLog).LOGGER_ROLE();
        AuditLog(auditLog).grantRole(loggerRole, orderBook);
        AuditLog(auditLog).grantRole(loggerRole, agentRegistry);
        AuditLog(auditLog).grantRole(loggerRole, negotiationSettlement);
        AuditLog(auditLog).grantRole(loggerRole, echoVerifier);
        AuditLog(auditLog).grantRole(loggerRole, lineageLedger);
        console2.log("AuditLog LOGGER_ROLE granted");

        // RateToken MINTER_ROLE to EpochRewardManager
        RateToken(rateToken).grantRole(RateToken(rateToken).MINTER_ROLE(), rewardManager);
        console2.log("RateToken MINTER_ROLE -> EpochRewardManager");

        // MapRegistry OPERATOR_ROLE
        MapRegistry(mapRegistry).grantRole(MapRegistry(mapRegistry).OPERATOR_ROLE(), msg.sender);
        console2.log("MapRegistry OPERATOR_ROLE -> deployer");
    }

    function _printAddresses() internal view {
        console2.log("");
        console2.log("=== DEPLOYED ADDRESSES ===");
        console2.log("rateToken:", rateToken);
        console2.log("resourceTokenFactory:", factory);
        console2.log("COMPUTE:", resources[0]);
        console2.log("ENERGY:", resources[1]);
        console2.log("CHIPS:", resources[2]);
        console2.log("COOLING:", resources[3]);
        console2.log("TALENT:", resources[4]);
        console2.log("DATA:", resources[5]);
        console2.log("CLEARANCE:", resources[6]);
        console2.log("agentRegistry:", agentRegistry);
        console2.log("auditLog:", auditLog);
        console2.log("reputationLedger:", repLedger);
        console2.log("roleRegistry:", roleRegistry);
        console2.log("mapRegistry:", mapRegistry);
        console2.log("buildingRegistry:", buildingRegistry);
        console2.log("epochManager:", epochManager);
        console2.log("orderBook:", orderBook);
        console2.log("eventOracle:", eventOracle);
        console2.log("informationMarket:", infoMarket);
        console2.log("reflexWindowManager:", reflexManager);
        console2.log("predictionMarket:", predictionMarket);
        console2.log("clearanceRegistry:", clearanceRegistry);
        console2.log("complianceDriftOracle:", complianceOracle);
        console2.log("insurancePool:", insurancePool);
        console2.log("lineageLedger:", lineageLedger);
        console2.log("coolingRelay:", coolingRelay);
        console2.log("mandateEchoOracle:", echoOracle);
        console2.log("echoVerifier:", echoVerifier);
        console2.log("guardClauseMarketplace:", guardMarketplace);
        console2.log("negotiationSettlement:", negotiationSettlement);
        console2.log("hedgeFactory:", hedgeFactory);
        console2.log("epochRewardManager:", rewardManager);
        console2.log("rentCollector:", rentCollector);
    }
}
