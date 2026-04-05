import { TESTNET_ADDRESSES } from './addresses';
import RateTokenABI from './abis/RateToken.json';
import ResourceTokenABI from './abis/ResourceToken.json';
import OrderBookABI from './abis/OrderBook.json';
import AgentRegistryABI from './abis/AgentRegistry.json';
import ReputationLedgerABI from './abis/ReputationLedger.json';
import AuditLogABI from './abis/AuditLog.json';
import EpochManagerABI from './abis/EpochManager.json';
import EventOracleABI from './abis/EventOracle.json';
import MandateEchoOracleABI from './abis/MandateEchoOracle.json';
import MapRegistryABI from './abis/MapRegistry.json';
import BuildingRegistryABI from './abis/BuildingRegistry.json';

const addr = TESTNET_ADDRESSES.contracts;

export const contracts = {
  rateToken: {
    address: addr.rateToken as `0x${string}`,
    abi: RateTokenABI,
  },
  orderBook: {
    address: addr.orderBook as `0x${string}`,
    abi: OrderBookABI,
  },
  agentRegistry: {
    address: addr.agentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
  },
  reputationLedger: {
    address: addr.reputationLedger as `0x${string}`,
    abi: ReputationLedgerABI,
  },
  auditLog: {
    address: addr.auditLog as `0x${string}`,
    abi: AuditLogABI,
  },
  epochManager: {
    address: addr.epochManager as `0x${string}`,
    abi: EpochManagerABI,
  },
  eventOracle: {
    address: addr.eventOracle as `0x${string}`,
    abi: EventOracleABI,
  },
  mandateEchoOracle: {
    address: addr.mandateEchoOracle as `0x${string}`,
    abi: MandateEchoOracleABI,
  },
  mapRegistry: {
    address: addr.mapRegistry as `0x${string}`,
    abi: MapRegistryABI,
  },
  buildingRegistry: {
    address: addr.buildingRegistry as `0x${string}`,
    abi: BuildingRegistryABI,
  },
  resourceToken: {
    abi: ResourceTokenABI,
  },
} as const;

export const RESOURCE_NAMES = ['COMPUTE', 'ENERGY', 'CHIPS', 'COOLING', 'TALENT', 'DATA', 'CLEARANCE'] as const;
