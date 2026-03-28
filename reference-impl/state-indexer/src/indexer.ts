import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import type { GameState, ContractAddresses, ResourceName } from "./types.js";
import { RESOURCE_NAMES } from "./types.js";
import {
  AGENT_REGISTRY_ABI,
  ERC20_ABI,
  REPUTATION_LEDGER_ABI,
  ORDER_BOOK_ABI,
  EPOCH_MANAGER_ABI,
  INFORMATION_MARKET_ABI,
  ROLE_REGISTRY_ABI,
} from "./abis.js";

// Spec role mapping: uint8 -> human-readable role name
const ROLE_MAP: Readonly<Record<number, string>> = {
  0: "ComputeSuperpower",
  1: "DataRichState",
  2: "ChipPower",
  3: "TalentHub",
  4: "RegulatoryPower",
} as const;

const TIER_MAP: Readonly<Record<number, "free" | "analyst" | "premium">> = {
  0: "free",
  1: "analyst",
  2: "premium",
} as const;

const DEFAULT_DECIMALS = 18;
const TWAP_WINDOW_SECONDS = 3600n; // 1-hour TWAP window

/**
 * Maps a uint8 role ID from the RoleRegistry contract to a human-readable role name.
 * Returns "Unknown" for unrecognized role IDs.
 */
export function mapRoleId(roleId: number): string {
  return ROLE_MAP[roleId] ?? "Unknown";
}

/**
 * Converts a wei-denominated bigint to a human-readable number using the given decimals.
 * Defaults to 18 decimals (standard ERC-20).
 */
export function formatBalance(wei: bigint, decimals: number = DEFAULT_DECIMALS): number {
  return Number(formatUnits(wei, decimals));
}

/**
 * Fetches the full Layer 3 game state for a given agent address by reading on-chain contracts.
 * Uses typed ABI decoding per spec section 5.3 — never passes raw undecoded bytes.
 *
 * This is a PULL model: state is fetched on demand, not via subscriptions.
 */
export async function fetchGameState(
  agentAddress: string,
  provider: JsonRpcProvider,
  addresses: ContractAddresses
): Promise<GameState> {
  // Instantiate typed contract instances
  const agentRegistry = new Contract(addresses.agentRegistry, AGENT_REGISTRY_ABI, provider);
  const rateToken = new Contract(addresses.rateToken, ERC20_ABI, provider);
  const reputationLedger = new Contract(addresses.reputationLedger, REPUTATION_LEDGER_ABI, provider);
  const orderBook = new Contract(addresses.orderBook, ORDER_BOOK_ABI, provider);
  const epochManager = new Contract(addresses.epochManager, EPOCH_MANAGER_ABI, provider);
  const informationMarket = new Contract(addresses.informationMarket, INFORMATION_MARKET_ABI, provider);
  const roleRegistry = new Contract(addresses.roleRegistry, ROLE_REGISTRY_ABI, provider);

  const resourceContracts: ReadonlyArray<{ name: ResourceName; contract: Contract; address: string }> =
    RESOURCE_NAMES.map((name) => ({
      name,
      contract: new Contract(addresses.resourceTokens[name], ERC20_ABI, provider),
      address: addresses.resourceTokens[name],
    }));

  // Parallel read: core identity + block info
  const [agentIdRaw, roleIdRaw, block] = await Promise.all([
    agentRegistry.agentIdOf(agentAddress) as Promise<bigint>,
    roleRegistry.getRole(agentAddress) as Promise<bigint>,
    provider.getBlock("latest"),
  ]);

  const agentId = Number(agentIdRaw);
  const role = mapRoleId(Number(roleIdRaw));
  const blockNumber = block?.number ?? 0;
  const timestamp = block?.timestamp ?? 0;

  // Parallel read: balances, reputation, epoch, subscription, market prices
  const [
    rateBalanceRaw,
    reputationRaw,
    currentEpochRaw,
    epochDurationRaw,
    tierAccessRaw,
    ...resourceResults
  ] = await Promise.all([
    rateToken.balanceOf(agentAddress) as Promise<bigint>,
    reputationLedger.getReputation(agentAddress) as Promise<bigint>,
    epochManager.getCurrentEpoch() as Promise<bigint>,
    epochManager.getEpochDuration() as Promise<bigint>,
    informationMarket.getTierAccess(agentAddress) as Promise<bigint>,
    ...resourceContracts.map(({ contract }) => contract.balanceOf(agentAddress) as Promise<bigint>),
  ]);

  // Build balance map
  const currentBalances: Record<string, number> = {
    RATE: formatBalance(rateBalanceRaw),
  };

  for (let i = 0; i < RESOURCE_NAMES.length; i++) {
    currentBalances[RESOURCE_NAMES[i]] = formatBalance(resourceResults[i]);
  }

  // Fetch TWAP prices for each resource in parallel
  const twapResults = await Promise.all(
    resourceContracts.map(({ address }) =>
      safeCall(() => orderBook.getTWAP(address, TWAP_WINDOW_SECONDS) as Promise<bigint>, 0n)
    )
  );

  const marketSnapshot: Record<string, { twapPrice: number; bookDepth: number; recentVolume: number }> = {};
  for (let i = 0; i < RESOURCE_NAMES.length; i++) {
    marketSnapshot[RESOURCE_NAMES[i]] = {
      twapPrice: formatBalance(twapResults[i]),
      bookDepth: 0, // Requires off-chain aggregation in future phases
      recentVolume: 0, // Requires event indexing in future phases
    };
  }

  // Map tier access
  const tierValue = Number(tierAccessRaw);
  const tier = TIER_MAP[tierValue] ?? "free";

  // Compute epoch time remaining (best-effort)
  const currentEpoch = Number(currentEpochRaw);
  const epochDuration = Number(epochDurationRaw);
  const epochStartApprox = currentEpoch * epochDuration;
  const timeRemaining = Math.max(0, epochStartApprox + epochDuration - timestamp);

  return {
    agentId,
    role,
    currentBalances,
    buildingPortfolio: [], // BuildingRegistry integration deferred to Phase 4 building module
    reputationScore: formatBalance(reputationRaw),
    activeCommitments: {
      openOrders: 0, // Requires OrderBook event indexing
      pendingSettlements: 0, // Requires NegotiationSettlement event indexing
      activeInsurance: 0, // InsurancePool not yet deployed
      activePredictions: 0, // PredictionMarket not yet deployed
    },
    epochProgress: {
      currentEpoch,
      timeRemaining,
      agiProgressScore: 0, // Requires cross-agent aggregation
    },
    marketSnapshot,
    intelligenceSubscriptions: { tier },
    activeClauses: [], // GuardClauseMarketplace integration deferred
    blockNumber,
    timestamp,
  };
}

/**
 * Wraps a contract call with error handling, returning a fallback value on failure.
 * Prevents a single failed read from crashing the entire state assembly.
 */
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
