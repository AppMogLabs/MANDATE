// AgentRegistry — read agent identity and allowlist bitmap
export const AGENT_REGISTRY_ABI = [
  "function agentIdOf(address agent) view returns (uint256)",
  "function allowlistOf(uint256 agentId) view returns (uint256)",
] as const;

// RateToken / ResourceToken (ERC-20) — balance and decimal reads
export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

// ReputationLedger — agent reputation score
export const REPUTATION_LEDGER_ABI = [
  "function getReputation(address agent) view returns (uint256)",
] as const;

// OrderBook — price discovery reads
export const ORDER_BOOK_ABI = [
  "function getSpotPrice(address resourceToken) view returns (uint256)",
  "function getTWAP(address resourceToken, uint256 window) view returns (uint256)",
] as const;

// EpochManager — epoch lifecycle reads
export const EPOCH_MANAGER_ABI = [
  "function getCurrentEpoch() view returns (uint256)",
  "function getEpochDuration() pure returns (uint256)",
  "function isEpochActive() view returns (bool)",
] as const;

// InformationMarket — intelligence tier access
export const INFORMATION_MARKET_ABI = [
  "function getTierAccess(address user) view returns (uint8)",
] as const;

// RoleRegistry — agent role assignment
export const ROLE_REGISTRY_ABI = [
  "function getRole(address agent) view returns (uint8)",
] as const;

// NegotiationSettlement — deal tracking
export const NEGOTIATION_SETTLEMENT_ABI = [
  "function getPairNonce(address agentA, address agentB) view returns (uint256)",
  "function totalDealsSettled() view returns (uint256)",
] as const;
