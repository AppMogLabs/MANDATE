# MANDATE Frontend — Step 3: Contract Integration Layer

**App Mog Labs | March 2026**
**Scope: Deploy to MegaETH testnet + wire frontend to live chain data**

---

## Read This First

This is the step that makes MANDATE real. The frontend currently runs on mock data. The reference agent currently runs against a local configuration. This handoff:

1. Deploys all contracts to MegaETH testnet
2. Seeds the chain with initial game state (resources, agents, buildings, events)
3. Replaces every mock data source in the frontend with live chain reads
4. Connects the frontend to the reference agent's activity stream
5. Makes the mandate editor submit real on-chain hash commitments

After this step, the epoch timer counts down for real, the order book shows actual bids and asks, and the agent feed shows live transactions.

### Prerequisites

- Foundry installed (`forge`, `cast`, `anvil`)
- MegaETH testnet ETH in a deployer wallet (faucet: check MegaETH docs)
- The `contracts/` directory with all 559 passing tests
- The `mandate-frontend/` directory from Steps 1-4
- The `mandate-agent/` directory from Phase 4
- Node.js 20+, pnpm

### Hard Boundaries

Do not:
- Deploy to MegaETH mainnet (testnet only)
- Modify any smart contract logic (contracts are locked — deploy as-is)
- Change the mandate schema (finalised in Phase 4)
- Implement account abstraction or session keys (v2 scope)
- Build a production wallet connection flow (use a simple private key or injected provider for testnet)

---

## Part 1: Deploy to MegaETH Testnet

### 1.1 Chain Configuration

```
Chain:        MegaETH Testnet
Chain ID:     6343
RPC:          https://carrot.megaeth.com/rpc
Explorer:     https://megaeth-testnet-v2.blockscout.com
Gas token:    ETH (testnet)
Base fee:     ~0.001 gwei
```

Note: The GDD and Phase 2 docs reference Chain ID 4326 (mainnet). For testnet deployment, use Chain ID 6343. The contracts are chain-agnostic — they use `block.timestamp` not `block.number`, so they work identically on testnet.

### 1.2 Deployment Sequence

The existing `Deploy.s.sol` script deploys the Sprint 0 contracts (7 core). For the full v0.3 architecture, we need all 20 core + 6 supporting contracts. If a full deployment script doesn't exist yet for the v0.3 contracts, deploy in this order (from the Phase 2 annex build order):

**Phase A — Foundation (no dependencies):**
1. RateToken (RATE)
2. ResourceTokenFactory → deploy 7 ResourceTokens (COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE)
3. AgentRegistry (ERC-8004 Identity)
4. AuditLog
5. ReputationLedger (ERC-8004 Reputation)
6. RoleRegistry

**Phase B — Core Economy:**
7. MapRegistry
8. BuildingRegistry
9. EpochManager
10. OrderBook (depends on RateToken, AgentRegistry, ReputationLedger, AuditLog)

**Phase C — Events and Intelligence:**
11. EventOracle
12. InformationMarket
13. ReflexWindowManager (singleton — must exist before reflex-dependent contracts)
14. PredictionMarket

**Phase D — Espionage Layer:**
15. ComplianceDriftOracle
16. ClearanceRegistry
17. LineageLedger (depends on DataManager)
18. DataManager
19. CoolingRelay (depends on ReflexWindowManager, RoleRegistry, InsurancePool)
20. InsurancePool

**Phase E — Advanced Intelligence:**
21. MandateEchoOracle (depends on PredictionMarket, InformationMarket)
22. GuardClauseMarketplace (depends on OrderBook, ReputationLedger, AgentRegistry, ReflexWindowManager)

**Phase F — Settlement:**
23. NegotiationSettlement (depends on AgentRegistry, RateToken, ResourceTokens)

**If some v0.3 contracts haven't been implemented yet** (only Sprint 0 was built by Claude Code initially), deploy what exists and stub the rest. The frontend can show "Coming soon" for views that depend on undeployed contracts. The critical path for a playable prototype is: RateToken, ResourceTokenFactory (×7 tokens), AgentRegistry, OrderBook, ReputationLedger, AuditLog, EpochManager, and EventOracle. Everything else is additive.

### 1.3 Deployment Script

```bash
# Set environment
export PRIVATE_KEY=0x<deployer-private-key>
export RPC_URL=https://carrot.megaeth.com/rpc

# Run tests first (sanity check)
cd contracts
forge test -vv

# Deploy
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --chain-id 6343

# Record deployed addresses
# The script should output all contract addresses — copy them into:
# 1. mandate-frontend/src/lib/addresses.ts
# 2. mandate-agent/.env
# 3. contracts/README.md (testnet deployment table)
```

### 1.4 Seed the Chain

After deployment, seed the chain with initial game state so the frontend has data to display:

```bash
# Run the demo script to register agents and execute initial trades
forge script script/Demo.s.sol:Demo \
  --rpc-url $RPC_URL \
  --broadcast

# Additionally, seed with:
# 1. Register 5+ agents (one per role) with distinct names
# 2. Mint initial resource allocations per role (from Phase 3 starting balances)
# 3. Place 10-20 orders on the OrderBook across different resource pairs
# 4. Publish 2-3 world events via EventOracle
# 5. Set epoch start timestamp and duration (28 days from now)
```

Write a `Seed.s.sol` script that does all of the above in one transaction batch. This makes it easy to reset and reseed the testnet state.

### 1.5 Record Deployed Addresses

Create a shared addresses file that both the frontend and agent consume:

```typescript
// mandate-frontend/src/lib/addresses.ts
// Also used by mandate-agent via import or .env

export const TESTNET_ADDRESSES = {
  chainId: 6343,
  rpc: 'https://carrot.megaeth.com/rpc',
  ws: 'wss://carrot.megaeth.com/ws',  // Verify WebSocket endpoint
  explorer: 'https://megaeth-testnet-v2.blockscout.com',
  
  contracts: {
    rateToken: '0x...',
    resourceTokenFactory: '0x...',
    resources: {
      COMPUTE: '0x...',
      ENERGY: '0x...',
      CHIPS: '0x...',
      COOLING: '0x...',
      TALENT: '0x...',
      DATA: '0x...',
      CLEARANCE: '0x...',
    },
    agentRegistry: '0x...',
    orderBook: '0x...',
    reputationLedger: '0x...',
    auditLog: '0x...',
    epochManager: '0x...',
    eventOracle: '0x...',
    mapRegistry: '0x...',
    buildingRegistry: '0x...',
    informationMarket: '0x...',
    reflexWindowManager: '0x...',
    mandateEchoOracle: '0x...',
    negotiationSettlement: '0x...',
    // Add remaining as deployed
  }
} as const;
```

---

## Part 2: Frontend Integration Layer

### 2.1 Tech Stack Additions

| Package | Purpose | Version |
|---------|---------|---------|
| wagmi | React hooks for Ethereum | ^2.x |
| viem | TypeScript Ethereum client | ^2.x |
| @tanstack/react-query | Server state management (wagmi dependency) | ^5.x |

Install:
```bash
cd mandate-frontend
pnpm add wagmi viem @tanstack/react-query
```

### 2.2 Provider Setup

Create a wagmi config and wrap the app:

```typescript
// src/lib/wagmi-config.ts
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' },
  },
});

export const config = createConfig({
  chains: [megaethTestnet],
  transports: {
    [megaethTestnet.id]: http(),
  },
});
```

Wrap the app in `layout.tsx`:
```tsx
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient();

// Wrap existing layout
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
</WagmiProvider>
```

### 2.3 Contract ABIs

Copy the ABI JSON files from `contracts/out/` (Foundry output) or from `mandate-agent/abis/` into `mandate-frontend/src/lib/abis/`. Create typed contract instances:

```typescript
// src/lib/contracts.ts
import { TESTNET_ADDRESSES } from './addresses';
import RateTokenABI from './abis/RateToken.json';
import OrderBookABI from './abis/OrderBook.json';
// ... etc

export const contracts = {
  rateToken: {
    address: TESTNET_ADDRESSES.contracts.rateToken as `0x${string}`,
    abi: RateTokenABI,
  },
  orderBook: {
    address: TESTNET_ADDRESSES.contracts.orderBook as `0x${string}`,
    abi: OrderBookABI,
  },
  // ... all contracts
} as const;
```

### 2.4 Data Hooks — Replacing Mock Data

Create React hooks that replace every mock data import. Each hook reads from the chain and falls back to mock data if the chain is unreachable (graceful degradation during development).

**File structure:**
```
src/hooks/chain/
├── useResourceBalances.ts    # Replaces mock/resources.ts
├── useOrderBook.ts           # Replaces mock/orderbook.ts
├── useAgentFeed.ts           # Replaces mock/feed.ts (from AuditLog events)
├── useWorldEvents.ts         # Replaces mock/events.ts
├── useEpochState.ts          # Replaces mock/epoch.ts
├── useReputationScores.ts    # Replaces mock/intelligence.ts (partial)
├── useMapTiles.ts            # Replaces mock/map.ts
├── usePlayerState.ts         # Replaces mock/player.ts
└── index.ts                  # Barrel exports
```

#### useResourceBalances.ts

```typescript
import { useReadContracts } from 'wagmi';
import { contracts } from '@/lib/contracts';
import { TESTNET_ADDRESSES } from '@/lib/addresses';
import { mockResources } from '@/mock/resources'; // fallback

const RESOURCE_NAMES = ['COMPUTE', 'ENERGY', 'CHIPS', 'COOLING', 'TALENT', 'DATA', 'CLEARANCE'] as const;

export function useResourceBalances(playerAddress: `0x${string}`) {
  const balanceReads = RESOURCE_NAMES.map(name => ({
    address: TESTNET_ADDRESSES.contracts.resources[name] as `0x${string}`,
    abi: contracts.resourceToken.abi,
    functionName: 'balanceOf',
    args: [playerAddress],
  }));

  const rateRead = {
    address: contracts.rateToken.address,
    abi: contracts.rateToken.abi,
    functionName: 'balanceOf',
    args: [playerAddress],
  };

  const { data, isLoading, error } = useReadContracts({
    contracts: [...balanceReads, rateRead],
  });

  if (error || !data) {
    return { data: mockResources, isLive: false, isLoading };
  }

  // Transform chain data into ResourceBalance[] shape matching mock type
  const resources = RESOURCE_NAMES.map((name, i) => ({
    resource: name,
    balance: data[i]?.result as bigint ?? 0n,
    // Price and sparkline come from OrderBook reads (separate hook)
    // Production/consumption come from BuildingRegistry reads
  }));

  return { data: resources, isLive: true, isLoading };
}
```

#### useOrderBook.ts

```typescript
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { contracts } from '@/lib/contracts';
import { mockOrderBook } from '@/mock/orderbook'; // fallback

export function useOrderBook(resourcePair: string) {
  // Read current order book state
  // OrderBook contract should have view functions for:
  // - getBestBid(pairHash) → price, volume
  // - getBestAsk(pairHash) → price, volume
  // - getOrderBookDepth(pairHash, levels) → bids[], asks[]
  
  // Watch for new order events (real-time updates)
  useWatchContractEvent({
    address: contracts.orderBook.address,
    abi: contracts.orderBook.abi,
    eventName: 'OrderPlaced',
    onLogs(logs) {
      // Update local state with new order
    },
  });

  useWatchContractEvent({
    address: contracts.orderBook.address,
    abi: contracts.orderBook.abi,
    eventName: 'OrderMatched',
    onLogs(logs) {
      // Update local state — remove matched orders, update last price
    },
  });

  // Fallback to mock if chain unavailable
  // Return OrderBookSnapshot shape matching the mock type
}
```

#### useAgentFeed.ts

```typescript
import { useWatchContractEvent } from 'wagmi';
import { contracts } from '@/lib/contracts';
import { mockFeed } from '@/mock/feed'; // fallback

export function useAgentFeed() {
  const [entries, setEntries] = useState<AgentFeedEntry[]>([]);

  // Watch AuditLog for new agent actions
  useWatchContractEvent({
    address: contracts.auditLog.address,
    abi: contracts.auditLog.abi,
    eventName: 'ActionLogged',
    onLogs(logs) {
      const newEntries = logs.map(log => ({
        id: log.transactionHash,
        timestamp: Number(log.args.timestamp) * 1000,
        agentName: resolveAgentName(log.args.agentId), // lookup from AgentRegistry
        action: decodeActionType(log.args.actionType),
        detail: decodeActionData(log.args.data),
        tier: classifyTier(log.args.actionType),
      }));
      setEntries(prev => [...prev, ...newEntries].slice(-200)); // keep last 200
    },
  });

  // Also watch OrderBook events for trade-specific entries
  useWatchContractEvent({
    address: contracts.orderBook.address,
    abi: contracts.orderBook.abi,
    eventName: 'OrderMatched',
    onLogs(logs) {
      // Add TRADE entries to feed
    },
  });

  return entries.length > 0 ? entries : mockFeed; // fallback
}
```

#### useEpochState.ts

```typescript
import { useReadContract } from 'wagmi';
import { contracts } from '@/lib/contracts';

export function useEpochState() {
  const { data: epochNumber } = useReadContract({
    address: contracts.epochManager.address,
    abi: contracts.epochManager.abi,
    functionName: 'getCurrentEpoch',
  });

  const { data: endTimestamp } = useReadContract({
    address: contracts.epochManager.address,
    abi: contracts.epochManager.abi,
    functionName: 'getEpochEndTimestamp',
  });

  // Calculate time remaining client-side (updates every second via React state)
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  useEffect(() => {
    if (!endTimestamp) return;
    const interval = setInterval(() => {
      setTimeRemaining(Math.max(0, Number(endTimestamp) - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [endTimestamp]);

  return {
    epochNumber: epochNumber ? Number(epochNumber) : 3,
    endTimestamp: endTimestamp ? Number(endTimestamp) : 0,
    timeRemaining,
    isLive: !!epochNumber,
  };
}
```

### 2.5 Wallet Connection (Testnet Only)

For testnet, use the simplest possible wallet connection. No WalletConnect, no Privy, no session keys — those are production concerns. Two options:

**Option A (simplest): Hardcoded private key in .env.local**
```env
NEXT_PUBLIC_PLAYER_ADDRESS=0x1234...abcd
NEXT_PUBLIC_PLAYER_PRIVATE_KEY=0x... # TESTNET ONLY — never in production
```

The frontend reads balances for this address. Transactions are signed with this key. This is fine for testnet testing where the same person runs the frontend and the agent.

**Option B (slightly better): Browser wallet injection**
Support MetaMask / Rabby via wagmi's injected connector:
```typescript
import { injected } from 'wagmi/connectors';

// Add to wagmi config
connectors: [injected()],
```

Add a "Connect Wallet" button in the TopBar that appears only when no wallet is connected. Once connected, the player's address is used for all reads and the wallet signs transactions.

**Recommendation:** Implement Option B with Option A as a fallback. If no wallet is connected and no env var is set, fall back to mock data (the current behaviour).

### 2.6 Swapping Mock Data for Live Data

The swap should be mechanical, not architectural. Every component that currently imports from `@/mock/` should instead use the corresponding chain hook:

| Current Import | Replace With | Notes |
|----------------|-------------|-------|
| `import { mockResources } from '@/mock/resources'` | `useResourceBalances(playerAddress)` | Returns same shape |
| `import { mockOrderBook } from '@/mock/orderbook'` | `useOrderBook(selectedPair)` | Returns same shape |
| `import { mockFeed } from '@/mock/feed'` | `useAgentFeed()` | Returns same shape |
| `import { mockEpoch } from '@/mock/epoch'` | `useEpochState()` | Returns same shape |
| `import { mockEvents } from '@/mock/events'` | `useWorldEvents()` | Returns same shape |
| `import { mockPlayer } from '@/mock/player'` | `usePlayerState(playerAddress)` | Returns same shape |
| `import { mockReputation } from '@/mock/intelligence'` | `useReputationScores()` | Returns same shape |
| `import { mockMap } from '@/mock/map'` | `useMapTiles()` | Returns same shape |

**The mock data files should NOT be deleted.** They remain as fallbacks when the chain is unreachable. Every hook should return `{ data, isLive, isLoading, error }` so the UI can show a "Live" or "Mock" indicator.

### 2.7 Live/Mock Indicator

Add a small indicator in the StatusBar (bottom of the screen):

- When reading live chain data: green StatusDot + "Live · MegaETH Testnet" in `--text-tertiary`
- When falling back to mock: amber StatusDot + "Mock Data" in `--text-tertiary`
- When chain is unreachable: red StatusDot + "Offline" in `--text-tertiary`

This makes it immediately obvious whether you're looking at real or simulated data.

### 2.8 Real-Time Event Subscriptions

MegaETH supports WebSocket subscriptions for mini-block events. Use these for:

- **OrderBook events** (OrderPlaced, OrderMatched, OrderCancelled): update the DOM price ladder in real-time
- **AuditLog events** (ActionLogged): feed the agent activity sidebar
- **EventOracle events** (WorldEventPublished): trigger news feed updates and alert banners
- **EpochManager events** (EpochStarted, EpochEnded): handle epoch transitions

```typescript
// src/hooks/chain/useChainSubscriptions.ts
import { useWatchContractEvent } from 'wagmi';

export function useChainSubscriptions() {
  // Subscribe to all relevant events
  // Dispatch updates to the appropriate state stores
  // Handle reconnection on WebSocket drop
}
```

If the MegaETH WebSocket endpoint (`wss://carrot.megaeth.com/ws`) is not available or unstable on testnet, fall back to polling every 5 seconds via `useReadContract` with a `refetchInterval`.

---

## Part 3: Mandate Editor Integration

### 3.1 Mandate Submission Flow (Real)

Currently the mandate editor's submit flow uses a mock 500ms delay. Replace with actual on-chain hash commitment:

```typescript
// In the MandateEditor submit handler:

const handleSubmit = async () => {
  // 1. Compute mandate hash (same algorithm as reference agent)
  const hash = computeMandateHash(layer1Text, layer2Constraints);
  
  // 2. Submit hash to MandateEchoOracle
  const tx = await writeContract({
    address: contracts.mandateEchoOracle.address,
    abi: contracts.mandateEchoOracle.abi,
    functionName: 'commitVector',
    args: [hash],
  });
  
  // 3. Wait for confirmation (should be near-instant on MegaETH)
  await waitForTransactionReceipt({ hash: tx });
  
  // 4. Send the full mandate JSON to the reference agent
  // (via WebSocket to agent's local server, or write to shared file)
  await sendMandateToAgent(mandateJson);
  
  // 5. Update UI
  setSubmitState('SUCCESS');
};
```

### 3.2 Frontend ↔ Agent Communication

The frontend needs to send mandate updates to the reference agent and receive status/activity data back. For testnet, use a simple WebSocket bridge:

```typescript
// src/hooks/useAgentConnection.ts

export function useAgentConnection(agentWsUrl: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    const ws = new WebSocket(agentWsUrl); // e.g. ws://localhost:8546
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'status') setAgentStatus(msg.data);
      if (msg.type === 'action') appendToFeed(msg.data);
    };

    return () => ws.close();
  }, [agentWsUrl]);

  const sendMandate = (mandate: MandateSchema) => {
    ws.send(JSON.stringify({ type: 'mandate_update', data: mandate }));
  };

  return { isConnected, agentStatus, sendMandate };
}
```

The reference agent needs a corresponding WebSocket server (add to `mandate-agent/src/index.ts`) that:
- Accepts mandate updates from the frontend
- Broadcasts agent status every 10 seconds (current balances, last action, confidence)
- Broadcasts each action as it's executed (for the activity feed)

If WebSocket is too complex for the initial integration, a simpler approach: the agent writes its status and recent actions to a JSON file, and the frontend polls that file via a local API route. This is uglier but works.

### 3.3 Agent Status in TopBar

Add an agent connection indicator next to the player name in the TopBar:

- Green dot + "Agent Online" when the WebSocket to the reference agent is connected
- Red dot + "Agent Offline" when disconnected
- The agent's current confidence level (from the mandate interpretation) shown as: "Confidence: High" in `--text-secondary`

---

## Part 4: Configuration

### 4.1 Frontend Environment Variables

```env
# .env.local (mandate-frontend)

# Chain
NEXT_PUBLIC_CHAIN_ID=6343
NEXT_PUBLIC_RPC_URL=https://carrot.megaeth.com/rpc
NEXT_PUBLIC_WS_URL=wss://carrot.megaeth.com/ws
NEXT_PUBLIC_EXPLORER_URL=https://megaeth-testnet-v2.blockscout.com

# Player (testnet only)
NEXT_PUBLIC_PLAYER_ADDRESS=0x...

# Agent connection
NEXT_PUBLIC_AGENT_WS_URL=ws://localhost:8546

# Feature flags
NEXT_PUBLIC_USE_LIVE_DATA=true    # false = always use mock data
```

### 4.2 Agent Environment Variables

Update `mandate-agent/.env` with deployed addresses:

```env
RPC_URL=https://carrot.megaeth.com/rpc
WS_URL=wss://carrot.megaeth.com/ws
CHAIN_ID=6343

AGENT_PRIVATE_KEY=0x...
AGENT_ID=1

# All deployed contract addresses
RATE_TOKEN=0x...
ORDER_BOOK=0x...
AGENT_REGISTRY=0x...
# ... etc (from addresses.ts)

LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-20250514

DECISION_INTERVAL_MS=30000
FRONTEND_WS_PORT=8546
```

---

## Part 5: Testing the Full Loop

Once everything is deployed and wired:

### Test 1: Frontend reads live data
1. Start the frontend: `cd mandate-frontend && pnpm dev`
2. Open `localhost:3000`
3. Verify: StatusBar shows "Live · MegaETH Testnet" (green dot)
4. Verify: Epoch timer shows real time remaining
5. Verify: Resource badges show actual on-chain balances
6. Verify: Order book shows actual orders from the seed script

### Test 2: Agent runs against testnet
1. Start the agent: `cd mandate-agent && pnpm start`
2. Verify: Agent connects to MegaETH RPC
3. Verify: Agent reads chain state (logged in console)
4. Verify: Agent makes at least one decision (even if it's "hold — no action needed")

### Test 3: Frontend ↔ Agent communication
1. Both frontend and agent running
2. Verify: TopBar shows "Agent Online" (green dot)
3. Write a mandate in the editor and submit
4. Verify: Agent receives the mandate (logged in console)
5. Verify: Agent's next decision cycle uses the new mandate
6. Verify: Agent actions appear in the frontend's activity feed

### Test 4: Full game loop
1. Mandate submitted → agent trades → order book updates → frontend reflects new prices and balances
2. Verify the entire loop completes without errors

---

## Acceptance Criteria

### Deployment
- [ ] All Sprint 0 contracts deployed to MegaETH testnet (Chain ID 6343)
- [ ] Deployed addresses recorded in `addresses.ts`
- [ ] Seed script populates: 5+ agents, initial resource balances, 10+ orders, epoch configured
- [ ] Demo script runs successfully against testnet

### Frontend Integration
- [ ] wagmi + viem + react-query installed and configured
- [ ] MegaETH testnet chain definition working
- [ ] All 8 chain hooks created (balances, orderbook, feed, events, epoch, reputation, map, player)
- [ ] Every mock data import has a corresponding chain hook with fallback
- [ ] Live/Mock indicator visible in StatusBar
- [ ] Epoch timer reads real `block.timestamp` and counts down correctly
- [ ] Resource balances update when on-chain state changes
- [ ] Order book reflects actual OrderBook contract state
- [ ] Agent feed shows AuditLog events in real-time (or via polling)
- [ ] World events appear from EventOracle

### Wallet Connection
- [ ] MetaMask/Rabby injection works via wagmi connector
- [ ] Fallback to .env address when no wallet connected
- [ ] Fallback to mock data when neither wallet nor .env is available

### Mandate Integration
- [ ] Submit mandate computes hash and commits to MandateEchoOracle on-chain
- [ ] Mandate JSON sent to reference agent via WebSocket
- [ ] Agent confirms receipt of new mandate

### Agent Connection
- [ ] WebSocket bridge between frontend and reference agent
- [ ] Agent status visible in TopBar (online/offline + confidence)
- [ ] Agent actions stream to frontend activity feed via WebSocket
- [ ] Agent disconnection handled gracefully (fallback to chain event polling)

### Full Loop
- [ ] Write mandate → agent reads it → agent trades → OrderBook updates → frontend shows new state
- [ ] This loop completes within 60 seconds on MegaETH testnet
