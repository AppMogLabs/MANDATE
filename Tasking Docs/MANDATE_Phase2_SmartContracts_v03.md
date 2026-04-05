# MANDATE — Phase 2: Smart Contract Architecture

**App Mog Labs | v0.3 | March 2026**

*Updated with OpenZeppelin 5.x, MegaETH AI Tooling, ERC-8004, and EthSkills references*

*Confidential Working Document*

---

## External Dependencies and Tooling Review

Before detailing the contract architecture, this section documents the external resource audits conducted during Phase 2 and their impact on design decisions. Each finding is tagged with a colour-coded label throughout the document: **[OZ 5.x]** for OpenZeppelin Contracts, **[MegaETH]** for MegaETH-specific tooling from the awesome-megaeth-ai repository, **[ERC-8004]** for the Trustless Agents standard, and **[EthSkills]** for patterns drawn from the EthSkills knowledge base.

### OpenZeppelin Contracts 5.x

OpenZeppelin Contracts is the industry-standard library for secure smart contract development, providing audited implementations of ERC-20, ERC-721, access control, security primitives, and upgrade infrastructure. Version 5.x introduces AccessManager for unified cross-contract permission management, namespaced storage for safe upgrades, and gas-optimised data structures. MANDATE uses OpenZeppelin 5.x as the base layer for all token contracts, access control, reentrancy protection, pausability, and upgrade proxies. Specific mappings are detailed per contract in each task section.

### MegaETH AI Developer Skills and Awesome-MegaETH-AI

The megaeth-labs/awesome-megaeth-ai repository curates AI-powered tools for building on MegaETH. The megaeth-dev-skill by 0xBreadguy covers Foundry setup, EIP-7966 (eth_sendRawTransactionSync) for instant transaction receipts, the MegaEVM gas model, storage optimisation with Solady patterns, WebSocket mini-block subscriptions via the Realtime API, and debugging with mega-evme. The RedBlackTreeKV demo provides a gas-efficient on-chain key-value store using red-black trees optimised for MegaETH's storage cost model. Additionally, the erc8004-trustless-agents-skill provides an AI coding skill for on-chain agent identity, reputation, and validation.

### ERC-8004: Trustless Agents

ERC-8004 is a live Ethereum standard (mainnet since 29 January 2026) that provides three lightweight on-chain registries — Identity, Reputation, and Validation — enabling autonomous agents to discover, trust, and interact across organisational boundaries without pre-existing trust. It extends Google's Agent-to-Agent (A2A) protocol with blockchain-based trust mechanisms. The Identity Registry uses ERC-721 tokens as agent identifiers. The Reputation Registry enables structured, on-chain feedback between agents. The Validation Registry supports cryptographic and economic verification of agent work (stake-secured re-execution, zkML proofs, TEE attestations). This standard maps directly onto MANDATE's AgentRegistry and ReputationLedger, and adoption is recommended to ensure third-party composability with the broader agent ecosystem.

### EthSkills

EthSkills (ethskills.com) is a knowledge base providing Ethereum development patterns for AI agents. Its Security SKILL.md reinforces our architectural decisions around SafeERC20, TWAP-based oracles over spot prices, and CEI plus ReentrancyGuard. Its L2s SKILL.md confirms that block.timestamp (not block.number) should be used for all time-based logic on L2s, since block.number increments at wildly different rates across chains. This is critical for MANDATE's TWAP windows, upgrade cooldowns, rent periods, and production cycle calculations — all must use block.timestamp for chain portability.

> **Tag Legend (used throughout this document)**
>
> **[OZ 5.x]** = OpenZeppelin Contracts 5.x proven module | **[MegaETH]** = MegaETH-specific optimisation | **[ERC-8004]** = Trustless Agents standard | **[EthSkills]** = EthSkills security/best-practice pattern

---

## MegaETH Mainnet Parameters (Confirmed for v0.3)

| Parameter | Value | Notes |
|---|---|---|
| Chain ID | 4326 | Mainnet (Frontier) live |
| Mini-block time | 10ms | Confirmed |
| EVM block time | 1 second | EVM blocks aggregate mini-blocks |
| Block gas limit | 10,000,000,000 (10B) | Per EVM block |
| Base intrinsic gas | 60,000 | 21,000 compute + 39,000 storage |
| Base fee | 0.001 gwei | Effectively stable |
| Max contract size | 512KB | Up from Ethereum's 24KB |
| Gas model | Multidimensional | Compute gas + storage gas — separate metrics |
| Storage gas (SSTORE zero→nonzero) | 20,000 × (bucket_multiplier - 1) | 0 at m=1, rises as bucket fills |
| Gas token | ETH | MANDATE's RATE is not a gas token |

**Critical implications for high-write contracts:** AuditLog, LineageLedger, and MandateEchoOracle are high-write contracts. At bucket multiplier m=1, SSTORE storage gas is zero — favourable. As buckets fill (m=2+), storage gas rises significantly. Solady packed storage patterns remain mandatory for these contracts to delay bucket expansion. LOG data costs 80 gas/byte on MegaETH — granular events should minimise data payload size. All time-based logic uses `block.timestamp`, not `block.number`.

---

## Canonical Resource Names (v0.3)

| Resource | Canonical Name | Replaces | Token Standard |
|---|---|---|---|
| Computation units | COMPUTE | CYCLES, Raw Compute | ERC-20 |
| Electrical power | ENERGY | Energy (unchanged) | ERC-20 |
| Semiconductor hardware | CHIPS | SILICON, Hardware | ERC-20 |
| Thermal management | COOLING | Cooling (unchanged) | ERC-20 |
| Human capital | TALENT | HEADCOUNT, Talent | ERC-20 |
| Training datasets | DATA | CORPUS, Clean Data | ERC-20 |
| Regulatory permission | CLEARANCE | Clearance (unchanged) | ERC-20 |

All contract names, function signatures, state variables, events, and documentation use these canonical names. Affected contract renames from v0.2: CorpusManager → DataManager, HeadcountOracle → TalentOracle.

---

## Task 1: Contract Registry

### 1.1 Design Philosophy

MANDATE's contract architecture follows four governing principles. First, the factory pattern is used wherever multiple instances of the same contract type exist (resource tokens, buildings, hedge contracts) to reduce deployment complexity and enforce uniform interfaces. Second, singleton contracts manage global state (order book, map registry, event oracle, reputation ledger) and serve as canonical reference points for all agents and third-party integrators. Third, every contract that holds state relevant to external consumers emits granular events for API composability — this is a first-class requirement, not a nice-to-have.

**Fourth (added in v0.2):** wherever an audited, battle-tested OpenZeppelin 5.x module exists for required functionality, MANDATE inherits it rather than reimplementing. Custom logic is written only for game-specific mechanics that no existing standard covers. This reduces audit surface area, accelerates development, and leverages the security of code that has been deployed across billions of dollars in TVL.

The architecture comprises 20 core contracts grouped into seven domains: Token and Asset (3 contracts), Market Infrastructure (2, both extended in v0.3), World State and Events (3, plus ReflexWindowManager), Financial Instruments (3), Security and Governance (3, plus RoleRegistry), and the Agent Intelligence Layer (6 new contracts in v0.3). Six supporting contracts provide lightweight infrastructure services. Each is described below with its OpenZeppelin base contracts and MegaETH-specific considerations annotated.

### 1.2 Updated Contract Registry (20 Core Contracts)

| Contract | Responsibility | OZ 5.x Base | MegaETH / ERC-8004 | Status |
|---|---|---|---|---|
| RATE Token (MANDATE) | Native utility token | ERC20, ERC20Burnable, ERC20Permit, AccessControl | Standard ERC-20 | Existing |
| ResourceTokenFactory | Deploys all resource ERC-20s | AccessControl | — | Existing |
| ResourceToken (child ×7) | ERC-20 for single resource type | ERC20, ERC20Burnable, AccessControl (MINTER_ROLE) | — | Existing |
| BuildingRegistry | ERC-721 building NFT lifecycle | ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, AccessControl | — | Existing (re-skinned to AI theme) |
| OrderBook | Limit orders + lease swaps + reflex cancels | ReentrancyGuard, Pausable, AccessControl | Solady for order structs; block.timestamp for TWAP; benchmark RedBlackTreeKV | Existing (extended v0.3) |
| MapRegistry | Hex-tile grid, terrain, rent | AccessControl | block.timestamp for rent | Existing |
| EventOracle | AI-generated world events + opens reflex windows | AccessControl, EIP712 | block.timestamp triggers | Existing (extended v0.3) |
| InformationMarket | Three-tier subscriptions | AccessControl | — | Existing |
| HedgeFactory | Parametric hedge contracts | AccessControl; children via Clones (EIP-1167) | block.timestamp for settlement | Existing |
| InsurancePool | Underwriter pools, premiums, claims | ReentrancyGuard, Pausable, AccessControl | — | Existing |
| PredictionMarket | Binary outcome markets | Children via Clones (EIP-1167) | — | Existing |
| AgentRegistry | Agent identity, allowlists, guard enforcement | ERC721 (via ERC-8004 Identity Registry), AccessControl, EIP712 | ERC-8004 v1 conformant; EIP-7966 for agent TX flow | Existing |
| AuditLog | Immutable on-chain action log | Custom (append-only) | Solady storage — mandatory | Existing |
| ReputationLedger | On-chain trust scores | Custom (via ERC-8004 Reputation Registry) | ERC-8004 v1 conformant | Existing |
| **ReflexWindowManager** | 100ms reflex window management (singleton) | TransparentUpgradeableProxy | Timestamp only; no block.number | **New in v0.3** |
| **ComplianceDriftOracle** | Standards drift vectors for Regulatory Power | AccessControl | Scalar array packing | **New in v0.3** |
| **LineageLedger** | DATA poison DAG with purity scoring | None | Solady storage mandatory for graph growth | **New in v0.3** |
| **CoolingRelay** | Silent COOLING propagation relay graphs | ReentrancyGuard | block.timestamp lock-in; EIP-7966 for join feedback | **New in v0.3** |
| **MandateEchoOracle** | Echo hash commitments for mandate signalling | None | Gas-capped commits; high-frequency viable on MegaETH | **New in v0.3** |
| **GuardClauseMarketplace** | Tradeable guard clause templates | ReentrancyGuard | Extends OrderBook; reflex window for activation | **New in v0.3** |

*Note: DataManager (renamed from CorpusManager) and TalentOracle (renamed from HeadcountOracle) are existing contracts with updated names only — no functional changes.*

### 1.2.1 Global Infrastructure (All Singletons)

- **[OZ 5.x] TransparentUpgradeableProxy (EIP-1967):** All singleton contracts deployed behind OpenZeppelin's transparent proxy. Logic upgrades do not redeploy state.
- **[OZ 5.x] TimelockController:** Upgrade authority held by governance multisig (3-of-5) with mandatory 48-hour delay between proposal and execution. Matches OpenZeppelin's recommended governance pattern.
- **[OZ 5.x] Clones (EIP-1167):** Factory-spawned contracts (InsurancePool, PredictionMarket, individual HedgeContracts) use minimal proxies for gas-efficient deployment. Each clone costs ~45,000 gas vs ~2M+ for a full deployment.
- **[MegaETH] eth_sendRawTransactionSync (EIP-7966):** All agent-submitted transactions use MegaETH's synchronous receipt API for instant confirmation. This collapses the perceived latency of the guard agent's approval flow from two blocks to near-zero.
- **[EthSkills] block.timestamp over block.number:** All time-dependent logic (TWAP windows, cooldowns, rent periods, production cycles, hedge expiry, upgrade timelocks) uses block.timestamp. MegaETH's 10ms blocks make block.number unreliable for cross-chain portability.

### 1.3 Dependency Graph Summary

The dependency flow is hierarchical. The AgentRegistry (ERC-8004 conformant) sits at the top of every write path — no state-mutating transaction reaches any contract without first passing through the AgentRegistry's validateAction() gate. The ResourceTokenFactory and RATE Token are the most depended-upon contracts, called by virtually every other contract in the system. The EventOracle feeds data downstream to the financial instrument layer (HedgeFactory, InsurancePool, PredictionMarket) and indirectly to the BuildingRegistry via production rate modifiers. The EventOracle also opens and closes reflex windows via the ReflexWindowManager, which is the shared dependency for the entire Agent Intelligence Layer. The AuditLog is write-only from the system's perspective — it receives data from every transaction but no contract depends on it for execution logic, keeping it off the critical path. The ReputationLedger (ERC-8004 Reputation Registry conformant) reads from the AuditLog and OrderBook to compute scores that feed back into market terms. The RoleRegistry enforces asymmetric player roles across CoolingRelay (Talent Hub exemption) and ComplianceDriftOracle (Regulatory Power gate).

### 1.4 Build Order (v0.3)

The P0 risk resolution (Reflex-COOLING collision, see Task 8) requires CoolingRelay to be built immediately after Reflex Response Loops. The confirmed sequence:

| Step | Contract | Reason |
|---|---|---|
| 1 | ReflexWindowManager | Shared dependency — must exist before any contract that calls it |
| 2 | Reflex Response Loops (OrderBook extension) | Core execution path; references ReflexWindowManager |
| 3 | CoolingRelay | Must be built immediately after step 2 — P0 mitigation requires both to exist together |
| 4 | ComplianceDriftOracle | Scalar updates reference OrderBook; independent of graph systems |
| 5 | LineageLedger | Independent DATA ingestion flow; no dependency on reflex or drift systems |
| 6 | GuardClauseMarketplace | Reuses reflex window for activation bonuses; references OrderBook, ReputationLedger |
| 7 | MandateEchoOracle | Reads from PredictionMarket and InformationMarket; builds on prior oracle infrastructure |
| 8 | Dynamic Resource Lease Swaps (OrderBook extension) | Reads from multiple prior oracles; safest to layer last |

### 1.5 Open Questions

- Should InsurancePool instances be permissionlessly creatable, or should a governance vote gate new risk-class pools?
- The PredictionMarket factory needs a minimum stake threshold to prevent spam market creation. Deferred to Phase 3.
- MapRegistry tile data: should terrain be immutable or mutable via events?
- **[ERC-8004]** ERC-8004 v2 tracking: The standard is evolving toward v2 with NFT-based agent ownership, flexible on-chain reputation data storage, and x402 payment integration. Monitor the EIP discussion thread for breaking changes before implementation begins.

---

## Task 2: Token Contract Architecture

### 2.1 Native Token (RATE)

The native token is a standard ERC-20 called RATE (Resource Allocation & Throughput Entitlement). It serves three functions: governance (voting on protocol upgrades and parameter changes), payment (tile rent, information subscriptions, insurance premiums, computation fees), and staking (hedge contracts, prediction markets, insurance underwriting). RATE is not a gas token — MegaETH uses ETH for gas. RATE is the in-game economic unit.

> **[OZ 5.x] Implementation: RATE Token inherits from four OpenZeppelin modules**
>
> ERC20 (core standard), ERC20Burnable (permanent token removal for rent/subscription sinks), ERC20Permit (EIP-2612 gasless approvals — critical for agent-to-agent flows where the agent approves and transfers in one step), and AccessControl (role-based minting authority with MINTER_ROLE for treasury distribution). This replaces ~400 lines of custom Solidity with audited, battle-tested code.

Minting authority for RATE is controlled by a governance multisig at launch, transitioning to a DAO contract in a later phase. Initial supply is pre-minted. Ongoing emission is zero — no inflationary rewards. All RATE in circulation comes from the initial distribution or from yield generated by buildings (which redistributes existing RATE from a treasury pool, not minting new supply). This is the Axie lesson applied: no Ponzi tokenomics.

Burning: RATE is burned (permanently removed from supply) when spent on tile rent and information subscriptions. This creates persistent deflationary pressure proportional to game activity. Insurance premiums and hedge stakes are not burned — they are redistributed to counterparties.

### 2.2 Resource Tokens (Factory Pattern)

All seven resource types (COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE) are deployed as individual ERC-20 contracts via the ResourceTokenFactory. The factory pattern is chosen over ERC-1155 for three reasons: ERC-20 is universally supported in DeFi tooling, individual contracts allow per-resource access control, and separate contracts isolate failure.

> **[OZ 5.x] Each ResourceToken inherits: ERC20 + ERC20Burnable + AccessControl**
>
> Minting is restricted via AccessControl's MINTER_ROLE, granted only to addresses registered in the BuildingRegistry as active production buildings of the correct type. This is deterministic enforcement — no LLM prompt can bypass a missing role.

> **[EthSkills] SafeERC20 on all token interactions**
>
> All contracts that transfer resource tokens (OrderBook, BuildingRegistry, HedgeFactory, InsurancePool) must use OpenZeppelin's SafeERC20 wrapper. This is the EthSkills Security SKILL.md #4 recommendation applied proactively.

Minting is restricted to addresses registered in the BuildingRegistry as active production or processing buildings. A Data Centre can mint COMPUTE; a Training Cluster can mint model weights (and must simultaneously burn COMPUTE + DATA as input). The mint function checks: (a) the caller is a registered building of the correct type, (b) the building is on a valid tile, (c) the building has sufficient TALENT allocation (TALENT has been consumed for this cycle), and (d) the production amount does not exceed the building's per-cycle cap adjusted for tier and event modifiers.

Burning is triggered in two contexts: construction (building a Training Cluster burns COMPUTE, CHIPS, ENERGY as defined in the BuildingRegistry's recipe table) and processing (a Training Cluster burns COMPUTE + DATA to mint model weights). Burns are called by the BuildingRegistry during construct() and claimProduction() for processing buildings.

### 2.3 Building NFTs (Single ERC-721 Contract)

All buildings are minted as tokens within a single BuildingRegistry contract that implements ERC-721. The single-contract approach stores building type, tier, tile coordinates, and operational state as on-chain metadata within a struct mapped by token ID.

> **[OZ 5.x] BuildingRegistry inherits: ERC721 + ERC721Enumerable + ERC721URIStorage + ReentrancyGuard + AccessControl**
>
> ERC721Enumerable enables efficient on-chain queries (all buildings owned by an agent, all buildings on a tile range). ERC721URIStorage allows each building to point to IPFS-hosted cosmetic metadata via tokenURI while keeping gameplay-relevant data in on-chain structs. ReentrancyGuard protects claimProduction() which mints resource tokens to the caller. AccessControl gates construct(), upgrade(), and demolish() via the AgentRegistry's AGENT_ROLE.

### 2.4 Interface Definitions

```
// === IResourceTokenFactory ===
function deployResource(string name, string symbol, uint256 supplyCap) -> address
function setMintAuthority(address token, address building, bool authorised) -> void
function getTokenAddress(string symbol) -> address
event ResourceDeployed(address indexed token, string symbol)
event MintAuthorityUpdated(address indexed token, address indexed building, bool authorised)

// === IResourceToken (ERC-20 + OZ ERC20Burnable + OZ AccessControl) ===
// Inherits: transfer, approve, transferFrom, balanceOf, totalSupply, permit (EIP-2612)
function mint(address to, uint256 amount) -> void  // onlyRole(MINTER_ROLE)
function burn(uint256 amount) -> void  // inherited from ERC20Burnable
function burnFrom(address from, uint256 amount) -> void  // inherited from ERC20Burnable
event Mint(address indexed to, uint256 amount, address indexed minter)

// === IBuildingRegistry (OZ ERC721 + ERC721Enumerable + ERC721URIStorage) ===
function construct(uint8 buildingType, uint32 tileId, address agent) -> uint256 tokenId
function upgrade(uint256 tokenId) -> void
function demolish(uint256 tokenId) -> void
function claimProduction(uint256 tokenId) -> uint256 amountProduced  // nonReentrant
function setWorkerAllocation(uint256 tokenId, uint256 talentPerCycle) -> void
function getBuildingInfo(uint256 tokenId) -> BuildingStruct
event BuildingConstructed(uint256 indexed tokenId, uint8 buildingType, uint32 tileId, address agent)
event BuildingUpgraded(uint256 indexed tokenId, uint8 newTier)
event BuildingDemolished(uint256 indexed tokenId)
event ProductionClaimed(uint256 indexed tokenId, address resource, uint256 amount)
```

### 2.5 Open Questions

- Should resource tokens have a hard supply cap or soft cap via production rates? Recommendation: soft cap. Resource sinks provide natural deflation.
- **[OZ 5.x]** ERC20Permit on resource tokens: EIP-2612 gasless approvals should be implemented on all resource tokens for agent workflows.
- Building NFT metadata: all gameplay-relevant data on-chain; cosmetic metadata via tokenURI pointing to IPFS.

---

## Task 3: The Order Book Contract

### 3.1 Design Rationale

The order book is the economic heart of MANDATE. MegaETH's sub-$0.01 gas and 10ms blocks shift the on-chain complexity tradeoff dramatically — patterns prohibitively expensive on mainnet become viable.

### 3.2 Data Structures

Two implementation paths are under evaluation:

**Option A (baseline): Sorted doubly-linked list.** Insertion/deletion at known positions are O(1), iteration is sequential and cache-friendly, simpler to audit. Finding insertion point for new price levels is O(n) in distinct price levels — acceptable for typically <100 active levels.

> **[MegaETH] Option B (recommended for benchmarking): RedBlackTreeKV**
>
> The megaeth-labs/RedBlackTreeKV-demo provides a gas-efficient on-chain key-value store using red-black trees optimised for MegaETH's storage cost model. O(log n) insertion, deletion, and lookup for price levels. For MANDATE's order book, where price levels may exceed 100 during volatile events (GPU shortages, supply shocks), the red-black tree is likely more performant. Recommendation: benchmark both implementations with realistic order distributions on MegaETH testnet before committing.

Each order is a struct containing: orderId (uint256), owner (address), price (uint256, denominated in RATE per unit of resource), quantity (uint256), timestamp (uint64, using block.timestamp per EthSkills L2 guidance), and pointers to next/previous orders at the same price level.

Trading pairs are keyed by hash of (resourceTokenAddress, RATE token address). All resource trading is against RATE — no direct resource-to-resource pairs. This simplifies from O(n²) pairs to O(n) and concentrates liquidity.

### 3.3 Order Placement and Matching

> **[OZ 5.x] ReentrancyGuard + Pausable on all matching functions**
>
> The OrderBook inherits ReentrancyGuard (nonReentrant modifier on placeLimitOrder, marketOrder, cancelOrder) and Pausable (circuit breaker for emergencies). Pausable enables the governance multisig to halt trading during a detected exploit, matching the circuit breaker requirement from Task 8.7.

Limit orders: an agent calls placeLimitOrder(pair, side, price, quantity). Balance checked, tokens escrowed. Matching proceeds price-time priority.

Market orders: marketOrder(pair, side, quantity). Fills against best available prices. If book exhausted before fully filled, remaining quantity reverts.

Partial fills: remaining quantity stays on book, OrderPartialFill event emitted.

Cancellation: cancelOrder(orderId) removes order, returns escrowed tokens.

### 3.4 Price Discovery

> **[EthSkills] TWAP over spot prices — mandatory for all oracle-dependent contracts**
>
> EthSkills Security SKILL.md #5: "Never use DEX spot prices as oracles. A flash loan can manipulate any pool's spot price within a single transaction." All hedge settlements, insurance triggers, and reputation calculations must use the TWAP, never the last-trade spot price.

The TWAP is computed over a configurable window (default: 60 seconds, using **block.timestamp** — not block numbers, which increment at 100x the rate of other L2s on MegaETH). The TWAP window of 60 seconds provides resistance to single-block manipulation while remaining responsive enough for game dynamics.

### 3.5 Reflex Response Loops (v0.3 Extension)

Every world event opens a 100ms (10-block) reflex window via the ReflexWindowManager. Agents with pre-approved conditional clauses can auto-execute a single limit-order cancellation before the public order book updates. Absolute first-mover advantage for agents with live mandates.

**Mitigation:** Maximum 1 reflex action per world event per agent. 50-block cooldown on reusing any guard clause hash. Enforced by nonce mapping.

```
// New functions (OrderBook extension)
function executeReflexCancellation(uint256 orderId, bytes32 guardHash) external nonReentrant
function isReflexWindowActive(uint256 eventId) external view returns (bool)

// Guard conditions
require(guardHash == keccak256(abi.encodePacked(agent, eventId)), "Invalid guard");
require(!hasUsedNonce[agent][eventId], "Nonce already spent");
require(ReflexWindowManager.isReflexActive(eventId), "Not in reflex window");

event ReflexActionExecuted(address indexed agent, uint256 orderId, uint256 eventId);
```

**Dependencies:** GuardAgentCore.validateClause(), EventOracle.getEventId(), ReflexWindowManager.isReflexActive().

**[OZ 5.x]** ReentrancyGuard (nonReentrant on executeReflexCancellation). **[MegaETH]** Solady storage for lastReflexNonce (high-write mapping).

### 3.6 Dynamic Resource Lease Swaps (v0.3 Extension)

Agents post two-sided lease orders on the limit order book (e.g., lend 1,000 COMPUTE for 300 CHIPS for 5 epochs, penalty = 0.2× reputation). Matching is automatic. Minimum lease duration is 5 epochs. Reputation penalty on failure enforces credible commitment. Distinct from spot trades: enables temporary over-leveraging across epochs without permanent ownership transfer.

```
function postLeaseOrder(uint256 giveAmount, uint256 wantAmount, uint256 epochs, uint256 repPenalty) external returns (uint256 orderId)
function executeMatchedLease(uint256 orderId) external nonReentrant
function cancelLeaseOrder(uint256 orderId) external

struct LeaseOrder {
    address initiator; address resource1; uint256 amount1;
    address resource2; uint256 amount2; uint256 epochs;
    uint256 repPenalty; uint256 expiryBlock;
}

require(epochs >= MIN_LEASE_EPOCHS, "Min 5 epoch duration");
require(repPenalty >= 2000, "Min 0.2x reputation penalty (2000 bps)");

event LeaseOrderPosted(uint256 indexed orderId, address indexed initiator, uint256 epochs);
event LeaseMatched(uint256 indexed orderId, address indexed counterparty);
event LeaseFailed(uint256 indexed orderId, address indexed defaulter, uint256 repPenaltyApplied);
```

**[OZ 5.x]** ReentrancyGuard (executeMatchedLease). **[MegaETH]** Solady storage for LeaseOrder structs (packed).

### 3.7 Agent Interaction Pattern

> **[MegaETH] eth_sendRawTransactionSync for agent order submission**
>
> Using EIP-7966, agents receive instant transaction receipts when submitting orders. Combined with MegaETH's 10ms blocks, the order book feels like a real-time trading system, not a blockchain.

### 3.8 Interface Definition

```
// === IOrderBook (inherits OZ ReentrancyGuard + Pausable + AccessControl) ===
struct Order { uint256 id; address owner; uint256 price; uint256 quantity; uint64 timestamp; }

function placeLimitOrder(address pair, uint8 side, uint256 price, uint256 qty) -> uint256 orderId  // nonReentrant whenNotPaused
function marketOrder(address pair, uint8 side, uint256 qty) -> uint256 filledQty  // nonReentrant whenNotPaused
function cancelOrder(uint256 orderId) -> void  // nonReentrant
function getTopOfBook(address pair) -> (uint256 bestBid, uint256 bestAsk)
function getTWAP(address pair, uint64 windowSeconds) -> uint256  // uses block.timestamp
function getBookDepth(address pair, uint8 side, uint256 levels) -> Order[]

event OrderPlaced(uint256 indexed orderId, address indexed pair, uint8 side, uint256 price, uint256 qty)
event OrderFilled(uint256 indexed orderId, uint256 fillQty, uint256 fillPrice, address indexed counterparty)
event OrderPartialFill(uint256 indexed orderId, uint256 fillQty, uint256 remaining)
event OrderCancelled(uint256 indexed orderId)
```

### 3.9 Open Questions

- **[MegaETH]** RedBlackTreeKV benchmark: compare against sorted linked list with 50, 100, 500, and 1000 active price levels on MegaETH testnet.
- MegaETH sequencer fair ordering guarantees: investigate front-running risk. Consider commit-reveal for large orders if needed.

---

## Task 4: Building Lifecycle Contracts

### 4.1 Construction

Construction is a single atomic transaction: construct(buildingType, tileId, agent). The BuildingRegistry performs five checks: (1) agent registered and action on allowlist, (2) tile exists with compatible terrain and no existing building, (3) agent holds sufficient resource tokens, (4) recipe retrieved from on-chain lookup table, (5) all required resources burned via ResourceToken.burnFrom() using SafeERC20 wrapper.

### 4.2 Construction Recipes (MANDATE AI Theme)

| Building | COMPUTE | ENERGY | CHIPS | COOLING | TALENT | DATA | CLEARANCE | Terrain |
|---|---|---|---|---|---|---|---|---|
| Data Centre | 10 | 8 | 5 | 3 | 2 | — | — | High-density urban |
| Power Plant | 5 | — | 3 | 2 | 2 | — | — | Industrial zone |
| Solar Array | 3 | — | 2 | 1 | 1 | — | — | Industrial zone |
| Fabrication Contract | 8 | 5 | — | 2 | 3 | — | 2 | Industrial zone |
| Recruiting Pipeline | 3 | 2 | 1 | — | — | 2 | 1 | High-density urban |
| Data Acquisition Hub | 5 | 3 | 2 | 1 | 2 | — | — | Coastal/port |
| Cooling Infrastructure | 4 | 3 | 3 | — | 1 | — | — | Industrial zone |
| Training Cluster | 15 | 10 | 8 | 5 | 5 | 3 | — | Research corridor |
| Alignment Lab | 10 | 8 | 5 | 3 | 8 | 5 | 3 | Research corridor |
| Lobbying Office | 3 | 2 | 1 | — | 3 | — | — | Regulatory district |
| Intelligence Network | 8 | 5 | 3 | 2 | 5 | 3 | 2 | Regulatory district |
| Media Arm | 5 | 3 | 2 | 1 | 3 | 2 | — | Coastal/port |
| Deployed Model (yield) | 12 | 8 | 5 | 4 | 5 | — | 3 | Any |
| Patent Portfolio (yield) | 5 | 3 | 2 | — | 8 | 5 | 5 | Regulatory district |
| Road (segment) | 2 | 1 | 1 | — | — | — | — | Any |
| Security Perimeter | 3 | 2 | 3 | 1 | 1 | — | 1 | Any |

Note: these values are initial parameters subject to balancing. They are stored in an on-chain config contract that can be updated via governance (behind TimelockController), not hardcoded. Processing buildings (Training Cluster, Alignment Lab) consuming multiple resource types create demand pull-through for the entire supply chain.

### 4.3 Production Cycle

Production is triggered by claimProduction(tokenId). All time calculations use **block.timestamp** (not block.number) per EthSkills guidance.

Production amount: (currentTimestamp - lastProductionTimestamp) × baseRate × tierMultiplier × eventModifier × workerEfficiency. The tierMultiplier increases with upgrades (1.0x at tier 1, 1.5x at tier 2, 2.25x at tier 3). The eventModifier is read from the EventOracle. The workerEfficiency is a function of TALENT consumption: if the building's talentAllocation drops below its requirement, efficiency scales linearly down to a floor of 10%.

For processing buildings (Training Cluster, Alignment Lab), claimProduction() additionally checks input resources and burns them before minting output. A Training Cluster claiming production must have COMPUTE + DATA available to burn.

**Note: ENERGY is the universal upkeep resource.** Every production and processing building requires ongoing ENERGY consumption. An agent neglecting energy infrastructure sees their entire operation degrade. The ENERGY bottleneck is structural, not optional.

### 4.4 Upgrade Path

Buildings have three tiers. Two-step upgrade (initiate + finalise) prevents flash-upgrade exploits. Cooldown measured in seconds via block.timestamp.

### 4.5 TALENT Upkeep

Every building requires ongoing TALENT allocation. Each time claimProduction() is called, the contract burns TALENT tokens proportional to elapsed time. If insufficient TALENT, reduced workerEfficiency is computed. TALENT migration toward better conditions means this problem compounds — neglect creates a spiral.

### 4.6 Destruction and Demolition

demolish(tokenId) burns the NFT via ERC721's _burn(). Tile released, no resources refunded. A governance-controlled parameter (behind TimelockController) allows partial recovery — set to 0% at launch.

### 4.7 Interface Definition

```
// === IBuildingRegistry (extended) ===
struct BuildingInfo {
    uint8 buildingType; uint8 tier; uint32 tileId; address owner;
    uint64 lastProductionTimestamp; uint256 talentAllocation;  // uses block.timestamp
    uint256 productionAccumulator; bool upgradeInProgress; uint64 upgradeFinalTimestamp;
}
struct Recipe { address[] resources; uint256[] amounts; }
function getRecipe(uint8 buildingType, uint8 tier) -> Recipe
function initiateUpgrade(uint256 tokenId) -> void
function finaliseUpgrade(uint256 tokenId) -> void
function getWorkerEfficiency(uint256 tokenId) -> uint256  // 0-10000 basis points
```

---

## Task 5: The Event Oracle and Impact Contracts

### 5.1 Oracle Architecture

The EventOracle is a singleton contract that serves as the canonical source of truth for world events. Events are published by an off-chain AI event engine. The event engine signs each event with a private key held in a hardware security module (HSM).

> **[OZ 5.x] EIP712 for typed event signatures + AccessControl for publisher management**
>
> The EventOracle inherits OpenZeppelin's EIP712 for structured, typed data signing. AccessControl manages the PUBLISHER_ROLE. Multi-sig requirement for high-severity events (≥ 7) is enforced via SENIOR_PUBLISHER_ROLE requiring 2-of-3 signatures.

This is a trusted oracle model. World events in MANDATE are synthetic — generated by the game's own AI, not sourced from the real world. Trust is mitigated by: (a) parameters published on-chain and auditable, (b) immutable event logging, (c) governance path to replace the operator.

### 5.2 v0.3 Extension: EventOracle Opens Reflex Windows

In v0.3, the EventOracle is extended to open and close reflex windows via the ReflexWindowManager on every event publication. When publishEvent() is called, the EventOracle also calls ReflexWindowManager.openReflexWindow(eventId), making the 100ms reflex window immediately active for all contracts in the Agent Intelligence Layer.

### 5.3 Event Structure

Each event struct contains: eventId (uint256), eventType (enum: GPUShortage, PowerGridFailure, RegulatorycrackDown, TalentExodus, FrontierModelRelease, SupplyChainDisruption, GeopoliticalTension, AISafetyIncident), severity (uint8, 1–10), affectedRegion (uint32), startTimestamp (uint64, block.timestamp), durationSeconds (uint64), and an array of ResourceImpact structs. Cascade effects are pre-computed off-chain and published as flat impact arrays.

### 5.4 Oracle Security

Three attack vectors and mitigations: event fabrication (HSM + multi-sig for severity ≥ 7), event suppression (commit-reveal on random seed), parameter manipulation (governance vote + 7-day timelock via TimelockController).

### 5.5 Interface Definition

```
// === IEventOracle (inherits OZ AccessControl + EIP712) ===
enum EventType { GPUShortage, PowerGridFailure, RegCrackdown, TalentExodus, FrontierRelease, SupplyChainDisruption, Geopolitical, AISafetyIncident }
struct ResourceImpact { address resource; int16 productionModBps; int16 demandModBps; }
struct WorldEvent {
    uint256 eventId; EventType eventType; uint8 severity; uint32 region;
    uint64 startTimestamp; uint64 durationSeconds; ResourceImpact[] impacts;
}
function publishEvent(WorldEvent event, bytes signature) -> void  // onlyRole(PUBLISHER_ROLE), EIP712 verified, opens reflex window
function resolveEvent(uint256 eventId) -> void
function getActiveEvents() -> WorldEvent[]
function getResourceModifier(address resource) -> (int16 productionMod, int16 demandMod)
event EventPublished(uint256 indexed eventId, EventType eventType, uint8 severity, uint32 region)
event EventResolved(uint256 indexed eventId)
```

---

## Task 6: Parametric Hedge and Insurance Contracts

### 6.1 Parametric Hedge Contracts

Binary payout contracts. Creation via HedgeFactory.createHedge() with parameters: resourceAddress, direction, thresholdBps, windowSeconds (block.timestamp), stakeAmount, payoutMultiplier. Settlement reads TWAP, not spot price.

> **[OZ 5.x] Clones (EIP-1167) for hedge contract deployment**
>
> Each active hedge deployed as a minimal proxy clone (~45K gas vs ~2M+ for full deployment). Template upgrades governed via TimelockController.

### 6.2 Insurance Pool Contracts

> **[OZ 5.x] ReentrancyGuard + Pausable on InsurancePool**
>
> triggerClaim() distributes RATE to multiple policyholders — ReentrancyGuard prevents re-entrance. Unstaking cooldown (500 seconds) prevents underwriters from front-running claims.

Premium pricing via bonding curve based on utilisation ratio. Solvency managed with 120% minimum threshold.

### 6.3 Prediction Market Contracts

Binary outcome markets via constant-product AMM. Resolution tied to EventOracle. Children deployed via Clones (EIP-1167).

### 6.4 Interface Definitions

```
// === IHedgeFactory (OZ AccessControl; children via OZ Clones) ===
struct HedgeParams {
    address resource; uint8 direction; uint16 thresholdBps;
    uint64 windowSeconds; uint256 stakeAmount; uint16 payoutMultiplierBps;
}
function createHedge(HedgeParams params) -> uint256 hedgeId
function matchHedge(uint256 hedgeId) -> void
function settleHedge(uint256 hedgeId) -> void
function cancelUnmatchedHedge(uint256 hedgeId) -> void
event HedgeCreated(uint256 indexed hedgeId, address indexed creator, HedgeParams params)
event HedgeMatched(uint256 indexed hedgeId, address indexed counterparty)
event HedgeSettled(uint256 indexed hedgeId, address winner, uint256 payout)

// === IInsurancePool (OZ ReentrancyGuard + Pausable + AccessControl) ===
function stake(uint256 amount) -> void
function initiateUnstake(uint256 amount) -> void
function finaliseUnstake() -> void
function purchasePolicy(uint256 coverageAmount, uint64 durationSeconds) -> uint256 policyId
function triggerClaim() -> void  // nonReentrant
function getSolvencyRatio() -> uint256
function getPremiumRate() -> uint256
event PolicyPurchased(uint256 indexed policyId, address holder, uint256 coverage, uint256 premium)
event ClaimTriggered(uint256 totalPayout, uint256 claimants)

// === IPredictionMarket (children via OZ Clones) ===
function createMarket(uint256 eventId, string question, uint64 expiryTimestamp) -> uint256 marketId
function buyOutcome(uint256 marketId, uint8 outcome, uint256 amount) -> uint256 tokensReceived
function resolveMarket(uint256 marketId) -> void
function claimWinnings(uint256 marketId) -> uint256 payout
event MarketCreated(uint256 indexed marketId, uint256 eventId, string question)
event MarketResolved(uint256 indexed marketId, uint8 winningOutcome)
```

---

## Task 7: Security and Guard Agent Contracts

> **[ERC-8004] Major architectural update: AgentRegistry and ReputationLedger adopt ERC-8004**
>
> ERC-8004 (Trustless Agents) went live on Ethereum mainnet in January 2026. It provides three on-chain registries — Identity, Reputation, and Validation — that map directly onto MANDATE's AgentRegistry and ReputationLedger. Adopting ERC-8004 gives MANDATE immediate composability with the broader agent ecosystem.

### 7.1 The Action Allowlist (AgentRegistry, ERC-8004 Extended)

The AgentRegistry is built on ERC-8004's Identity Registry, which uses ERC-721 tokens as agent identifiers. Each registered agent receives an agentId (NFT token ID) resolving to an off-chain registration file (agentURI). On top of the ERC-8004 base, MANDATE adds the action allowlist — a bitmap stored per agent defining permitted transaction types.

This is deterministic enforcement. If the action type is not on the allowlist, it cannot execute regardless of what the LLM submitted.

### 7.2 Guard Agent Approval (Two-Step Commit with EIP-712)

> **[OZ 5.x] EIP712 for typed guard signatures**
>
> Prevents signature replay attacks. Makes guard approvals human-readable in wallet UIs.

**Optimised path:** The guard pre-signs the action payload (EIP-712 typed data). The agent submits a single transaction containing both the action calldata and the guard's signature. The AgentRegistry verifies on-chain, checks allowlist, forwards call — all in one transaction.

> **[MegaETH] eth_sendRawTransactionSync collapses guard approval latency**
>
> Agent can request guard pre-approval, submit signed transaction, and receive confirmation — all in under 20ms. Five-layer security architecture feels invisible.

### 7.3 Audit Trail (AuditLog)

> **[MegaETH] Solady storage patterns for gas-efficient logging**
>
> Solady's packed storage and assembly-optimised writes reduce per-entry gas cost by 20-40%. AuditLog is the highest-write contract in MANDATE.

Append-only. Records agentAddress, actionType, targetContract, inputHash, timestamp (block.timestamp), guardApproved, outcome.

### 7.4 Reputation Ledger (ERC-8004 Reputation Registry)

> **[ERC-8004] ReputationLedger built on ERC-8004 Reputation Registry**
>
> MANDATE's four reputation signals are encoded as structured feedback entries conforming to the ERC-8004 schema. Any third-party reputation aggregator that understands ERC-8004 can read MANDATE agents without custom integration.

Four signals: deal completion rate, disinformation score, anomaly count, age/activity. Scores decay toward neutral over time (exponential decay). Market consequences are economic (spread penalties, higher premiums), not access restrictions.

### 7.5 ERC-8004 Validation Registry Integration

Each guard approval/rejection posted as a validation entry. Future extensions: stake-secured re-execution, TEE attestations, zkML proofs.

### 7.6 Interface Definitions

```
// === IAgentRegistry (ERC-8004 Identity Registry + MANDATE extensions) ===
function registerAgent(address agentAddress, string agentURI) -> uint256 agentId
function updateAllowlist(uint256 agentId, uint256 actionBitmap) -> void
function validateAction(address agent, uint8 actionType) -> bool
function executeWithGuardSig(address agent, uint8 actionType, address target, bytes calldata, bytes guardSig) -> bytes result
function updateAgentURI(uint256 agentId, string newURI) -> void
event AgentRegistered(uint256 indexed agentId, address indexed agentAddress, string agentURI)
event AllowlistUpdated(uint256 indexed agentId, uint256 newBitmap)
event ActionExecuted(uint256 indexed agentId, uint8 actionType, bool success)

// === IAuditLog (custom, Solady-optimised storage) ===
struct LogEntry {
    address agent; uint8 actionType; address target; bytes32 inputHash;
    uint64 timestamp; bool guardApproved; bool success;
}
function logAction(LogEntry entry) -> void  // onlyAgentRegistry
function getAgentHistory(address agent, uint64 fromTimestamp, uint64 toTimestamp) -> LogEntry[]
event ActionLogged(address indexed agent, uint8 indexed actionType, bytes32 inputHash, bool success)

// === IReputationLedger (ERC-8004 Reputation Registry + MANDATE scoring) ===
function getScore(address agent) -> uint256
function getScoreBreakdown(address agent) -> (uint256 dealRate, uint256 disinfoScore, uint256 anomalyCount, uint256 ageFactor)
function postFeedback(uint256 agentId, uint8 score, bytes32 tags, string evidenceURI) -> void
function reportAnomaly(address agent, bytes32 evidenceHash) -> void
event ScoreUpdated(address indexed agent, uint256 newScore, uint8 component)
event FeedbackPosted(uint256 indexed agentId, address indexed reporter, uint8 score)
```

---

## Task 8: Agent Intelligence Layer (New in v0.3)

### 8.1 ReflexWindowManager (Shared Singleton)

This contract did not exist in v0.2. It is the shared dependency for the entire Agent Intelligence Layer and must be deployed first.

```solidity
contract ReflexWindowManager {
    mapping(uint256 => uint256) public reflexStartTimestamp;
    address public immutable worldEventOracle;
    uint256 public constant WINDOW_DURATION_MS = 100; // 100ms = 10 blocks

    function openReflexWindow(uint256 eventId) external  // only WorldEventOracle
    function isReflexActive(uint256 eventId) external view returns (bool)
    function closeReflexWindow(uint256 eventId) external  // only WorldEventOracle
    function requireNotInReflex(uint256 eventId) external view

    event ReflexWindowOpened(uint256 indexed eventId, uint256 startTimestamp);
    event ReflexWindowClosed(uint256 indexed eventId);
}
```

Deployed behind TransparentUpgradeableProxy. Authority inherited from WorldEventOracle via immutable address check.

### 8.2 ComplianceDriftOracle

Regulatory Power agents publish live standards drift vectors. Non-Regulatory agents can purchase 30-block premium forecasts. Vector changes capped at ±10% delta, mandatory 20-block interval. Each non-self-targeting recalibration burns 2% CLEARANCE from the publisher.

```
function publishDriftVector(uint256[] calldata scalars) external  // onlyRole(REGULATORY_ROLE)
function recalibrateClearance(address agent) external
function getDriftForecast(uint256 blocksAhead) external view returns (uint256[])  // premium tier
event DriftPublished(address indexed regulator, uint256[] scalars, uint256 blockNumber);
event ClearanceRecalibrated(address indexed agent, uint256 newBurnRate);
```

**[OZ 5.x]** AccessControl (REGULATORY_ROLE). **Dependencies:** ClearanceRegistry, SupplyChainRegistry, RoleRegistry.

### 8.3 LineageLedger

Every DATA ingestion records an immutable parent hash on-chain. Poison nodes cost 5% reputation (burned). Purity score (0–100) queryable at analyst/premium tier only. Minimum depth 5 nodes before premium query allowed.

```
function ingestWithParent(bytes32 parentHash, bool isPoison) external
function queryPurityPremium(address agent, bytes32 nodeId) external view returns (uint8)
event NodeIngested(bytes32 indexed nodeId, bytes32 parentHash, bool poisoned, address agent);
```

**[MegaETH]** Mandatory Solady storage for parentOf mapping — graph growth is the primary storage risk. Epoch-end pruning of resolved nodes.

### 8.4 CoolingRelay

Agents form optional on-chain relay graphs for COOLING capacity. Failure propagates probabilistically (20% per edge). 50-block lock-in, 200-block exit delay. Talent Hub agents exempt from lock-in via RoleRegistry check.

**P0 Mitigation (Reflex-COOLING Collision):** If a COOLING failure fires during an active reflex window, propagation is queued with a 150ms delay:

```
require(!ReflexWindowManager.isReflexActive(eventId), "Propagation queued post-reflex");
propagationTimestamp = block.timestamp + 150;
```

```
function joinGraph(address[] calldata neighbours) external
function exitGraph() external
function propagateFailure(address source, uint256 eventId) external nonReentrant
event FailurePropagated(address indexed source, address indexed target, uint8 riskPercent);
event GraphJoined(address indexed agent, address[] neighbours);
```

**[OZ 5.x]** ReentrancyGuard. **Dependencies:** InsurancePool, ReflexWindowManager, RoleRegistry.

### 8.5 GuardClauseMarketplace

Agents list and purchase guard-clause templates priced in COMPUTE. Successful activation: 3% reputation bonus to seller, 1% CLEARANCE fee from buyer. Incorrect activation: 3% reputation deducted from seller, 1% from buyer. Per-buyer epoch bonus cap prevents cartel farming (excess routed to InsurancePool).

**Clause validation rules (enforced at listing time):** ≤ 8 opcodes, only whitelisted external calls (PredictionMarket.getProbability, ResourceBalanceOf), no loops/storage writes, static gas estimate < 150,000.

```
function listTemplate(bytes calldata clause, uint256 priceInCompute) external returns (uint256 templateId)
function purchaseAndIntegrate(uint256 templateId) external
function activateClause(uint256 clauseId, uint256 eventId) external
function validateTemplate(bytes calldata clause) external view returns (bool)

require(validateTemplate(clause), "Invalid clause");
require(priceInCompute >= COMPUTE_PRICE_FLOOR, "Below price floor");  // 500 COMPUTE minimum
require(ReflexWindowManager.isReflexActive(eventId), "Activation outside reflex window");

event TemplateListed(uint256 indexed templateId, address indexed seller, uint256 priceInCompute);
event ClausePurchased(uint256 indexed templateId, address indexed buyer);
event ClauseActivated(uint256 indexed clauseId, uint256 indexed eventId, bool success);
```

**Phase split:** Phase 2 = full Marketplace contract. Phase 4 = guard-agent bytecode parser.

**[OZ 5.x]** ReentrancyGuard. **Dependencies:** OrderBook, PredictionMarket, ReputationLedger, COMPUTE resource contract, ClearanceRegistry, ReflexWindowManager.

### 8.6 MandateEchoOracle

Agents publish plain-hash commitments of how their mandate would reposition COMPUTE or CHIPS in the next 60 seconds. Updated every 30 blocks minimum. Premium subscribers decrypt in real time. Echo reliability score (historical match rate) queryable at premium tier.

**Spam mitigation:** Max 1 echo per 30 blocks. Gas cost doubles for additional submissions in any rolling 100-block window.

```
function commitVector(bytes32 hash) external
function decryptForSubscriber(address subscriber, bytes calldata proof) external view returns (bytes32)
function getEchoReliabilityScore(address agent) external view returns (uint256)  // premium tier

require(block.number - lastCommitBlock[msg.sender] >= 30, "Spam limit");

event EchoCommitted(address indexed agent, bytes32 hash, uint256 blockNumber);
event ReliabilityScoreUpdated(address indexed agent, uint256 newScore);
```

**Dependencies:** PredictionMarket, InformationMarket (three-tier subscription check).

---

## Task 9: Architectural Risk Assessment

### 9.1 Reentrancy

All three vulnerable contracts (OrderBook, InsurancePool, BuildingRegistry) now inherit **OpenZeppelin's ReentrancyGuard** with nonReentrant on every token-transferring function. Additionally, CEI pattern enforced. Defence in depth matches EthSkills Security SKILL.md recommendation.

### 9.2 Oracle Manipulation

TWAP window corrected from 100 blocks (1 second on MegaETH — dangerously short) to 60-second timestamp-based window. Resistant to single-block manipulation. Oracle insider trading mitigated by monitoring + EIP-712 signed events.

### 9.3 P0 Risk: Reflex-COOLING Collision

**Risk:** A COOLING failure triggered inside a reflex window propagates before any cancellation can fire, causing simultaneous reputation collateral liquidations and order-book freezes, potentially collapsing insurance pools chain-wide.

**Mitigation:** In CoolingRelay.propagateFailure(): `require(!ReflexWindowManager.isReflexActive(eventId))`. If triggered during reflex, propagation queued with 150ms delay. 15-block queue preserves strategic tension while preventing chain-wide cascade.

### 9.4 Flash Loan Attack Vectors

Hedge and insurance contracts settle against TWAP (60-second window), not spot price. TWAP cannot be manipulated in a single transaction. Matches EthSkills Security SKILL.md #5.

### 9.5 Upgrade Path and Governance

> **[OZ 5.x] Full OpenZeppelin upgrade infrastructure**
>
> All singletons behind TransparentUpgradeableProxy (EIP-1967). TimelockController (3-of-5 multisig, 48-hour delay). Namespaced storage (ERC-7201) prevents layout collisions. Factory-spawned children use Clones and are not individually upgradeable.

### 9.6 Updated Risk Priority Matrix

| Risk | Likelihood | Impact | Priority | Mitigation Status |
|---|---|---|---|---|
| Flash loan on spot price | High | Critical | P0 | Mitigated: TWAP (60s window, block.timestamp) |
| Reflex-COOLING collision | Medium | Critical | P0 | Mitigated: 150ms propagation queue in ReflexWindowManager |
| Oracle insider trading | Medium | High | P0 | Mitigated: monitoring + EIP-712; needs multi-operator v2 |
| Insurance-economy feedback loop | Low | Critical | P0 | Mitigated: OZ Pausable circuit breaker + settlement delay |
| Reentrancy in OrderBook | Medium | High | P1 | Mitigated: OZ ReentrancyGuard + CEI pattern |
| Tile squatting griefing | Medium | Medium | P1 | Mitigated: escalating rent |
| TWAP window too short | Medium | High | P1 | Resolved: 60s timestamp-based (was 100 blocks = 1s) |
| Guard Clause Marketplace cartel farming | Medium | Medium | P1 | Mitigated: per-buyer epoch bonus cap routed to InsurancePool |
| CLEARANCE deflation from clause activations | Medium | Medium | P2 | Phase 3 decision: burn rate cap |
| AuditLog storage costs | High | Low | P2 | Partially mitigated: Solady; monitor for off-chain migration |
| Guard agent downtime | Low | Medium | P2 | Design owner-signed emergency fallback |
| ERC-8004 v2 breaking changes | Low | Medium | P2 | Mitigated: proxy pattern on AgentRegistry + ReputationLedger |

---

## Task 10: Supporting Contract Interfaces

These six contracts are referenced as dependencies across the core architecture. The following are lightweight interface definitions sufficient for integration — pending full design in a later sprint.

### 10.1 RoleRegistry

Stores and checks asymmetric player roles for the five sovereign AI actor types. Enforces role-specific behaviour at contract level.

```
enum SovereignRole { ComputeSuperpower, DataRichState, ChipPower, TalentHub, RegulatoryPower }

function registerRole(address agent, uint8 role) -> void  // onlyAdmin
function hasRole(uint8 role, address agent) -> bool
function getRole(address agent) -> uint8
function getRoleAgents(uint8 role) -> address[]

event RoleAssigned(address indexed agent, uint8 indexed role);
event RoleRevoked(address indexed agent, uint8 indexed role);
```

**[OZ 5.x]** AccessControl base. **Callers:** CoolingRelay (Talent Hub exemption), ComplianceDriftOracle (Regulatory Power check). **Lifecycle:** Roles assigned at epoch start, persist through epoch, reset by EpochManager.

### 10.2 ClearanceRegistry

Manages CLEARANCE balances and burn rates. Wraps the CLEARANCE ResourceToken with game-specific rate mechanics.

```
function burn(address agent, uint256 amount) -> void
function getBalance(address agent) -> uint256
function recalibrateRate(address agent, uint256 newRateBps) -> void
function getCurrentRate(address agent) -> uint256  // basis points

event RateRecalibrated(address indexed agent, uint256 newRateBps);
event ClearanceBurned(address indexed agent, uint256 amount, string reason);
```

**Callers:** ComplianceDriftOracle (recalibrateRate), GuardClauseMarketplace (burn on activation). **Implementation note:** delegates to CLEARANCE ResourceToken.burn() internally; the registry adds rate-tracking state on top.

### 10.3 DataManager

Renamed from CorpusManager. Handles DATA resource ingestion with source provenance.

```
function ingest(address agent, uint256 amount, bytes32 sourceHash) -> void
function getBalance(address agent) -> uint256
function getSourceHash(address agent) -> bytes32

event DataIngested(address indexed agent, uint256 amount, bytes32 sourceHash);
```

**Callers:** LineageLedger (dependency for poison DAG tracking). **Implementation note:** wraps the DATA ResourceToken with ingestion-specific provenance metadata.

### 10.4 TalentOracle

Renamed from HeadcountOracle. Tracks TALENT migration between agents based on conditions differential. TALENT migrates autonomously toward agents offering better conditions.

```
function getMigrationRate(address from, address to) -> uint256  // tokens per second
function triggerMigration(address from, address to, uint256 amount) -> void
function getConditionsScore(address agent) -> uint256  // 0-10000 basis points

event TalentMigrated(address indexed from, address indexed to, uint256 amount);
event ConditionsUpdated(address indexed agent, uint256 newScore);
```

**Callers:** TALENT resource contract, InformationMarket (three-tier feed data). **Design note:** conditions score derived from agent's ENERGY availability, building tier, and CLEARANCE standing — higher scores attract TALENT from neighbours with lower scores.

### 10.5 EpochManager

Manages epoch lifecycle: start, end, reset, and carry-over mechanics.

```
function getCurrentEpoch() -> uint256
function getEpochEndTimestamp() -> uint64
function isEpochActive() -> bool
function triggerReset() -> void  // onlyGovernance (behind TimelockController)
function getTopRepAgents(uint256 n) -> address[]  // top N% for reputation carry-over

event EpochStarted(uint256 indexed epochId, uint64 startTimestamp);
event EpochEnded(uint256 indexed epochId, address winner, uint256 winnerScore);
event ResetExecuted(uint256 indexed newEpochId);
```

**Callers:** ReputationLedger (carry-over calculation), MandateEchoOracle (epoch-scoped reliability scores), GuardClauseMarketplace (per-buyer epoch bonus cap). **Design note:** winner determined by highest AGI Progress Score — composite of resource stack, building tier, and intelligence network strength.

### 10.6 SupplyChainRegistry

Maps agents to their active supply-chain contracts so ComplianceDriftOracle knows which agents to recalibrate when a drift vector changes.

```
function registerContract(address agent, bytes32 contractHash) -> void
function getAgentContracts(address agent) -> bytes32[]
function deregisterContract(address agent, bytes32 contractHash) -> void

event ContractRegistered(address indexed agent, bytes32 contractHash);
event ContractDeregistered(address indexed agent, bytes32 contractHash);
```

**Callers:** ComplianceDriftOracle (only consumer). **Design note:** thinnest supporting contract — effectively a permissioned mapping. Agent self-registers; deregistration has no cooldown.

---

## Phase 3 Tokenomics Brief

The following mechanics generate tokenomics implications that must be resolved in Phase 3 before any v0.3 contracts are deployed.

### New Token Flows

| Mechanic | What Is Spent | Where It Goes | Type |
|---|---|---|---|
| Guard Clause Marketplace activation | 1% CLEARANCE (buyer) | Burned | Deflationary |
| Guard Clause Marketplace seller bonus | 3% reputation | Credited to template author | Redistributive |
| Guard Clause Marketplace incorrect activation | 3% rep (seller), 1% rep (buyer) | Burned | Deflationary |
| Compliance Drift Oracle recalibration | 2% CLEARANCE (publisher, non-self targets) | Burned | Deflationary |
| Data Lineage Ledger poison | 5% reputation (poisoner) | Burned | Deflationary |
| Mandate Echo Oracle commit | Gas (ETH) | MegaETH network fees | Redistributive |
| Dynamic Resource Lease swap penalty | 0.2× reputation minimum | Transferred to counterparty | Redistributive |

### Balance Risks (Ranked)

1. **Guard Clause Marketplace CLEARANCE burn** — greatest deflation risk. High-frequency activations could remove 15–20% of circulating CLEARANCE per epoch.
2. **Reputation burns from LineageLedger** — coordinated DATA poisoning could permanently shrink reputation supply and trigger mass collateral liquidations.
3. **Lease swap redistributions** — lowest risk but inflationary to dominant agents if Compute Superpower monopolises COMPUTE leasing.

### Phase 3 Decision Gates

| Parameter | Proposed Value | Fixed or Adjustable |
|---|---|---|
| Reputation bonus rate (clause seller) | 3% | Governance-adjustable via RoleRegistry |
| CLEARANCE burn rate (clause activation) | 1% | Fixed at contract deploy |
| COMPUTE pricing floor for clause templates | 500 COMPUTE | Governance-adjustable |
| Reputation burn rate for DATA poisoning | 3–7% range | Adjustable within range |
| Lease swap reputation penalty floor | 0.2× reputation (2,000 bps) | Fixed at contract deploy |
| CLEARANCE burn on drift publish | 2% | Fixed at contract deploy |
| Echo reliability score decay rate | TBD | Phase 3 decision |
| Escalating rent curve for tile squatting | TBD | Phase 3 decision |
| Minimum prediction market stake | TBD | Phase 3 decision |

### Axie Lesson Check

No violation identified. The Guard Clause Marketplace requires active agent execution and produces strategic stories independent of token price. New players can purchase generic templates at the 500 COMPUTE floor and compete immediately via information markets. Value flows from strategic execution quality, not from new player entry funding existing player rewards.

---

## Phase 4 Deliverables (Agent Interaction Layer)

The following v0.3 components have Phase 4 dependencies that are not Phase 2 deliverables:

1. **Guard Clause Marketplace** — Phase 4 must deliver the guard-agent bytecode parser that converts purchased templates into executable conditional bytecode within the agent's context window.
2. **Mandate Echo Oracles** — Phase 4 must deliver the echo simulation hook that reads the agent's current mandate and generates the repositioning hash against prediction market probabilities.
3. **Reflex Response Loops** — Phase 4 must deliver the conditional clause pre-approval workflow, where the guard agent pre-signs reflex actions the agent can submit during a window without a separate guard round-trip.

---

## Appendix A: Consolidated Open Questions

### Tokenomics (Phase 3 Decision)

- Initial RATE supply and distribution schedule
- Building yield rates (how much RATE does a Deployed Model generate per cycle?)
- Tile rent pricing curve and burn rate
- Information subscription pricing tiers
- CLEARANCE and reputation burn rate finalisation
- COMPUTE template pricing floor
- Echo reliability score decay rate
- Escalating rent curve for tile squatting

### Technical Architecture (Requires Research)

- **[MegaETH]** RedBlackTreeKV benchmark: compare against sorted linked list for OrderBook price levels on MegaETH testnet
- **[MegaETH]** Solady AuditLog benchmark: measure gas savings of packed storage vs standard struct storage
- **[MegaETH]** eth_sendRawTransactionSync latency: measure end-to-end for guard-approved transactions on MegaETH testnet
- MegaETH sequencer fair ordering guarantees (front-running risk)
- MegaETH storage cost model at scale (AuditLog, LineageLedger feasibility)
- **[EthSkills]** block.timestamp verification: confirm MegaETH's block.timestamp granularity is sufficient for 60-second TWAP windows
- **[ERC-8004]** ERC-8004 v2 timeline: monitor EIP discussion thread for v2 spec finalisation date
- EIP-712 typed data schema for guard signatures

### Governance (Requires Policy Decision)

- Multisig composition for upgrade authority (TimelockController admins)
- Timelock duration for contract upgrades (48 hours proposed)
- Insurance pool creation governance (permissioned vs. permissionless)
- Event engine parameter change process

### Phase 4 (Agent Interaction Layer)

- Guard-agent bytecode parser for purchased clause templates
- Echo simulation hook integration
- Reflex pre-approval workflow for guard agents

---

## Appendix B: OpenZeppelin Module Mapping

| OZ Module | Used By | Purpose |
|---|---|---|
| ERC20 | RATE Token, ResourceToken | Core ERC-20 standard implementation |
| ERC20Burnable | RATE Token, ResourceToken | Token burning for rent, construction, processing sinks |
| ERC20Permit | RATE Token, ResourceToken | EIP-2612 gasless approvals for agent workflows |
| ERC721 | BuildingRegistry, AgentRegistry | Core NFT standard for buildings and agent identity |
| ERC721Enumerable | BuildingRegistry | On-chain enumeration of buildings by owner/tile |
| ERC721URIStorage | BuildingRegistry, AgentRegistry | Off-chain metadata (IPFS artwork, ERC-8004 agentURI) |
| AccessControl | All contracts except AuditLog | Role-based permissioning (MINTER, PUBLISHER, AGENT, REGULATORY roles) |
| ReentrancyGuard | OrderBook, BuildingRegistry, InsurancePool, CoolingRelay, GuardClauseMarketplace | Prevents re-entrance during token transfers |
| Pausable | OrderBook, InsurancePool | Emergency circuit breaker for trading halts |
| EIP712 | EventOracle, AgentRegistry | Typed data signing for oracle events and guard approvals |
| TimelockController | All singletons (via proxy) | 48-hour governance delay for contract upgrades |
| TransparentUpgradeableProxy | All singletons | EIP-1967 proxy for state-preserving upgrades |
| Clones | HedgeFactory, InsurancePool factory, PredictionMarket factory | EIP-1167 minimal proxies for gas-efficient child deployment |
| SafeERC20 | OrderBook, BuildingRegistry, HedgeFactory, InsurancePool | Safe token transfer wrapper for all ERC-20 operations |

---

## Appendix C: Contract Dependency Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE                     │
│                                                             │
│  [ReflexWindowManager] ← called by OrderBook,              │
│                           CoolingRelay,                     │
│                           GuardClauseMarketplace            │
│  ↑ opened/closed by [EventOracle]                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TOKEN AND ASSET                           │
│                                                             │
│  [RATE Token] ──► [ResourceTokenFactory]                    │
│                       └──► [ResourceToken ×7]              │
│  [BuildingRegistry] ──► [MapRegistry]                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  MARKET INFRASTRUCTURE                       │
│                                                             │
│  [OrderBook] ◄── [HedgeFactory]                            │
│      ↑ extended by Reflex Response Loops                   │
│      ↑ extended by Lease Swaps                             │
│  [PredictionMarket]                                        │
│  [InformationMarket]                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               WORLD STATE AND EVENTS                        │
│                                                             │
│  [EventOracle] ──► [ReflexWindowManager]                   │
│  [TalentOracle] ──► migration data                         │
│  [DataManager] ──► DATA ingestion                          │
│  [EpochManager] ──► epoch resets                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               FINANCIAL INSTRUMENTS                         │
│                                                             │
│  [InsurancePool] ◄── [CoolingRelay]                        │
│  [HedgeFactory]                                            │
│  [PredictionMarket]                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              SECURITY AND GOVERNANCE                        │
│                                                             │
│  [AgentRegistry] ──► all write paths (gateway)            │
│  [AuditLog] ◄── every agent action                        │
│  [ReputationLedger] ←reads── AuditLog, OrderBook          │
│  [RoleRegistry] ──► asymmetric role enforcement           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            AGENT INTELLIGENCE LAYER (new in v0.3)          │
│                                                             │
│  [ComplianceDriftOracle] ──► ClearanceRegistry             │
│                                                             │
│  [LineageLedger] ──► DataManager                           │
│                  ──► ReputationLedger (burn)               │
│                  ──► InformationMarket (tier check)        │
│                                                             │
│  [MandateEchoOracle] ──► PredictionMarket                  │
│                      ──► InformationMarket (tier check)    │
│                                                             │
│  [GuardClauseMarketplace] ──► OrderBook                    │
│                           ──► ReputationLedger             │
│                           ──► AgentRegistry/GuardAgentCore │
│                           ──► PredictionMarket             │
│                           ──► ReflexWindowManager          │
│                                                             │
│  [CoolingRelay] ──► InsurancePool                          │
│                 ──► ReflexWindowManager (P0 mitigation)    │
│                 ──► RoleRegistry (Talent Hub exemption)    │
└─────────────────────────────────────────────────────────────┘

All singleton contracts behind TransparentUpgradeableProxy (EIP-1967)
with TimelockController governance (48-hour delay, 3-of-5 multisig).
AgentRegistry (ERC-8004 v1) validates every write path.
AuditLog uses Solady storage optimisations.
Factory-spawned children use OZ Clones (EIP-1167).
```

---

## v0.3 Changelog

**v0.3 — 17 March 2026 — Reflex, Intelligence, and Espionage Layer Integration**

**Game renamed:** EcoChain → MANDATE. All references updated throughout.

**Native token renamed:** ECO → RATE (Resource Allocation & Throughput Entitlement). All documentation, interface definitions, and variable naming conventions updated. Smart contract variable convention: all references to the RATE token use `rateToken` prefix to avoid collision with common Solidity variable names (burnRate, premiumRate, etc.).

**Resources renamed:** Timber/Stone/Iron/Food/Planks/Steel/Coal → COMPUTE/ENERGY/CHIPS/COOLING/TALENT/DATA/CLEARANCE. Buildings re-skinned to AI arms race theme.

**Added (6 new contracts):** ReflexWindowManager, ComplianceDriftOracle, LineageLedger, CoolingRelay, MandateEchoOracle, GuardClauseMarketplace.

**Added (6 supporting contracts):** RoleRegistry, ClearanceRegistry, DataManager, TalentOracle, EpochManager, SupplyChainRegistry — lightweight interface definitions for integration.

**Modified (2 existing contracts):** OrderBook extended with lease swap orders and reflex cancellation functions. EventOracle extended to open/close ReflexWindowManager windows.

**Renamed (2 existing contracts):** CorpusManager → DataManager. HeadcountOracle → TalentOracle.

**New architectural pattern:** RoleRegistry for asymmetric player roles (Compute Superpower, Data-Rich State, Chip Power, Talent Hub, Regulatory Power).

**MegaETH parameters updated:** Mainnet (Frontier) values confirmed. Multidimensional gas model documented. Base intrinsic gas corrected to 60,000. Contract size limit 512KB.

**ERC-8004 status updated:** v1 live since 29 January 2026. v2 in active development. Proxy pattern confirmed correct for migration.

**Risks identified and mitigated:** Reflex-COOLING collision (P0) via 150ms propagation queue. Guard Clause Marketplace cartel farming via per-buyer epoch bonus cap. Talent Hub lock-in exemption in CoolingRelay.

**Build order confirmed:** ReflexWindowManager → Reflex Response Loops → CoolingRelay → ComplianceDriftOracle → LineageLedger → GuardClauseMarketplace → MandateEchoOracle → Lease Swaps.

**Total contracts: 20 core + 6 supporting = 26.**

---

*End of Document*

*MANDATE Phase 2: Smart Contract Architecture | App Mog Labs | v0.3 | March 2026*
