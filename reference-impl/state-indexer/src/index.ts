// Core state indexer
export { fetchGameState, mapRoleId, formatBalance } from "./indexer.js";

// Types
export type { GameState, ContractAddresses, ResourceName } from "./types.js";
export { RESOURCE_NAMES } from "./types.js";

// ABI fragments for typed contract interaction (spec section 5.3)
export {
  AGENT_REGISTRY_ABI,
  ERC20_ABI,
  REPUTATION_LEDGER_ABI,
  ORDER_BOOK_ABI,
  EPOCH_MANAGER_ABI,
  INFORMATION_MARKET_ABI,
  ROLE_REGISTRY_ABI,
  NEGOTIATION_SETTLEMENT_ABI,
} from "./abis.js";
