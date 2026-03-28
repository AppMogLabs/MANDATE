/**
 * Contract ABI bindings and typed helpers for viem.
 * Thin wrappers around the generated ABIs from Foundry.
 */

import { type Abi } from "viem";
import AgentRegistryABI from "../../abis/AgentRegistry.json";
import OrderBookABI from "../../abis/OrderBook.json";
import ResourceTokenABI from "../../abis/ResourceToken.json";
import RateTokenABI from "../../abis/RateToken.json";
import ReputationLedgerABI from "../../abis/ReputationLedger.json";
import AuditLogABI from "../../abis/AuditLog.json";
import BuildingRegistryABI from "../../abis/BuildingRegistry.json";
import EventOracleABI from "../../abis/EventOracle.json";
import EpochManagerABI from "../../abis/EpochManager.json";
import MandateEchoOracleABI from "../../abis/MandateEchoOracle.json";
import NegotiationSettlementABI from "../../abis/NegotiationSettlement.json";
import ReflexWindowManagerABI from "../../abis/ReflexWindowManager.json";
import RoleRegistryABI from "../../abis/RoleRegistry.json";
import MapRegistryABI from "../../abis/MapRegistry.json";

export const ABIS = {
  agentRegistry: AgentRegistryABI as Abi,
  orderBook: OrderBookABI as Abi,
  resourceToken: ResourceTokenABI as Abi,
  rateToken: RateTokenABI as Abi,
  reputationLedger: ReputationLedgerABI as Abi,
  auditLog: AuditLogABI as Abi,
  buildingRegistry: BuildingRegistryABI as Abi,
  eventOracle: EventOracleABI as Abi,
  epochManager: EpochManagerABI as Abi,
  mandateEchoOracle: MandateEchoOracleABI as Abi,
  negotiationSettlement: NegotiationSettlementABI as Abi,
  reflexWindowManager: ReflexWindowManagerABI as Abi,
  roleRegistry: RoleRegistryABI as Abi,
  mapRegistry: MapRegistryABI as Abi,
} as const;

export const RESOURCE_NAMES = [
  "COMPUTE",
  "CHIPS",
  "DATA",
  "ENERGY",
  "TALENT",
  "COOLING",
  "CLEARANCE",
] as const;

export type ResourceName = (typeof RESOURCE_NAMES)[number];
