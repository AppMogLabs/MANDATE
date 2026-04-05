# MANDATE — Smart Contract Architecture Annex
## Phase 2 v0.3 Extension: Reflex, Intelligence, and Espionage Layer

App Mog Labs | v0.3 | March 2026  
*Annex to Phase 2 Smart Contract Architecture — for use by Opus in rewriting the full Phase 2 document*

---

## Purpose of This Annex

This document records all architectural decisions, contract specifications, and design resolutions produced after the Phase 2 v0.2 document was finalised. It covers six new contracts, two extended existing contracts, one new shared singleton dependency, and all associated mitigation rules, build ordering, tokenomics implications, and open questions.

Opus should use this annex together with the Phase 2 v0.2 document to produce a unified Phase 2 v0.3 document. Where this annex conflicts with v0.2, this annex takes precedence. Where this annex is silent, v0.2 stands.

---

## Native Token: RATE (supersedes ECO — effective v0.3)

The native utility token has been renamed from ECO to **RATE**.

| Property | Value |
|---|---|
| Token name | RATE |
| Ticker | RATE |
| Lore name | Resource Allocation & Throughput Entitlement |
| Standard | ERC-20 (OZ 5.x: ERC20, ERC20Burnable, ERC20Permit, AccessControl) |
| Function | Settlement layer — tile rent, subscriptions, premiums, staking, governance, trade denominator |
| Gas token | No — MegaETH uses ETH for gas. RATE is the in-game economic unit. |

**Solidity disambiguation rule (mandatory):** Because `rate` is an extremely common variable name in Solidity (burnRate, exchangeRate, premiumRate, migrationRate), all references to the RATE token in smart contracts must use the `rateToken` prefix to prevent ambiguity. Use `rateToken`, `rateTokenAddress`, `rateTokenBalance`, `rateTokenAmount`. Never name a variable simply `rate` when it refers to the token.

---

## Canonical Resource Names (v0.3 — supersedes all prior naming)

| Resource | Canonical Name | Replaces |
|---|---|---|
| Computation units | COMPUTE | CYCLES, Raw Compute |
| Electrical power | ENERGY | Energy (unchanged) |
| Semiconductor hardware | CHIPS | SILICON, Hardware |
| Thermal management | COOLING | Cooling (unchanged) |
| Human capital | TALENT | HEADCOUNT, Talent |
| Training datasets | DATA | CORPUS, Clean Data |
| Regulatory permission | CLEARANCE | Clearance (unchanged) |

All contract names, function signatures, state variables, events, and documentation must use these canonical names. Affected contract renames: CorpusManager → DataManager, HeadcountOracle → TalentOracle.

---

## Game Name

The game is named **MANDATE**. All references to EcoChain are retired.

---

## Asymmetric Player Roles (New in v0.3)

Five sovereign AI actor roles with asymmetric starting positions, structural advantages, and structural exposures. Roles are assigned at epoch start and persist through the epoch.

| Role | Starting Advantage | Structural Weakness | Key Mechanic Interaction |
|---|---|---|---|
| Compute Superpower | Large COMPUTE production, cheap ENERGY | High scrutiny — CLEARANCE depreciates faster, more frequent crackdown events | Benefits most from Reflex Response Loops |
| Data-Rich State | Large DATA reserves, fast DATA regeneration | Weak CHIPS — cannot scale without trading | Benefits most from Data Lineage Ledgers |
| Chip Power | CHIPS abundance, can produce surplus | Vulnerable to supply chain disruption events | Most exposed to Compliance Drift Oracles |
| Talent Hub | TALENT regenerates fast, migrates toward it autonomously | Low ENERGY — DRAW is expensive, limits build scale | Lock-in exemption in Silent COOLING Relay Networks |
| Regulatory Power | Sets standards — CLEARANCE costs for others, not self | Limited raw resources — no production advantage | Primary operator of Compliance Drift Oracles |

Implementation: roles enforced via RoleRegistry contract with AccessControl. Talent Hub lock-in exemption in CoolingRelay enforced via `RoleRegistry.hasRole(TALENT_HUB_ROLE, msg.sender)` check in `joinGraph()`.

---

## MegaETH Mainnet Parameters (Updated for v0.3)

The following parameters are confirmed from MegaETH mainnet (Frontier) documentation and supersede any testnet values in v0.2.

| Parameter | Value | Notes |
|---|---|---|
| Chain ID | 4326 | Mainnet live |
| Mini-block time | 10ms | Confirmed |
| EVM block time | 1s | EVM blocks aggregate mini-blocks |
| Block gas limit | 10,000,000,000 (10B) | Per EVM block |
| Base intrinsic gas | 60,000 | 21,000 compute + 39,000 storage |
| Base fee | 0.001 gwei | Effectively stable |
| Max contract size | 512KB | Up from Ethereum's 24KB |
| Gas model | Multidimensional | Compute gas + storage gas — separate metrics |
| Storage gas on SSTORE (zero-to-nonzero) | 20,000 × (bucket_multiplier - 1) | 0 at m=1, rises as bucket fills |
| Gas token | ETH | MANDATE's RATE is not a gas token |

**Critical implications for high-write contracts:**
- AuditLog, LineageLedger, and MandateEchoOracle are high-write contracts. At bucket multiplier m=1, SSTORE storage gas is zero — favourable. As buckets fill (m=2+), storage gas rises significantly. Solady packed storage patterns remain mandatory for these contracts to delay bucket expansion.
- LOG data costs 80 gas/byte on MegaETH. Granular events should minimise data payload size.
- All time-based logic uses `block.timestamp`, not `block.number`. MegaETH's 10ms mini-blocks make block.number increment ~100x faster than other L2s.

---

## ERC-8004 Status Update (v0.3)

ERC-8004 went live on Ethereum mainnet on 29 January 2026. Current status:
- v1 is live and stable. The three registries (Identity, Reputation, Validation) are deployed.
- v2 specification is in active development. Planned changes: enhanced MCP support, NFT-based agent ownership refinements, more flexible on-chain reputation data storage, tighter x402 payment integration.
- No breaking changes to v1 have been announced. The v0.2 risk flag on v2 compatibility remains valid.

**Architecture implication:** AgentRegistry and ReputationLedger remain ERC-8004 v1 conformant. Both should be deployed behind TransparentUpgradeableProxy to allow migration when v2 is finalised. The erc8004-trustless-agents-skill in the megaeth-labs/awesome-megaeth-ai repository provides an implementation reference for MegaETH-specific deployment.

**x402 payment protocol:** ERC-8004 v2 will integrate x402. The meridian-x402-skill in the awesome-megaeth-ai repository covers x402 payment flows on MegaETH with USDm. This is a forward-looking note for Phase 4 — the Guard Clause Marketplace's COMPUTE-denominated template pricing may benefit from x402 integration when available.

---

## New Shared Singleton: ReflexWindowManager

This contract did not exist in v0.2. It is a new singleton that four other contracts depend on. It must be deployed first in the build order.

### Contract Specification

```solidity
contract ReflexWindowManager {
    mapping(uint256 => uint256) public reflexStartTimestamp; // eventId => start timestamp
    address public immutable worldEventOracle;
    uint256 public constant WINDOW_DURATION_MS = 100; // 100ms = 10 blocks at 10ms

    event ReflexWindowOpened(uint256 indexed eventId, uint256 startTimestamp);
    event ReflexWindowClosed(uint256 indexed eventId);

    function openReflexWindow(uint256 eventId) external {
        require(msg.sender == worldEventOracle, "Only WorldEventOracle");
        require(reflexStartTimestamp[eventId] == 0, "Already open");
        reflexStartTimestamp[eventId] = block.timestamp;
        emit ReflexWindowOpened(eventId, block.timestamp);
    }

    function isReflexActive(uint256 eventId) external view returns (bool) {
        return block.timestamp < reflexStartTimestamp[eventId] + WINDOW_DURATION_MS;
    }

    function closeReflexWindow(uint256 eventId) external {
        require(msg.sender == worldEventOracle, "Only WorldEventOracle");
        delete reflexStartTimestamp[eventId];
        emit ReflexWindowClosed(eventId);
    }

    function requireNotInReflex(uint256 eventId) external view {
        require(!isReflexActive(eventId), "Reflex active — propagation queued");
    }
}
```

**Deployment:** Singleton behind TransparentUpgradeableProxy (matches all other singletons).  
**Authority:** No own AccessControl role. Authority inherited from WorldEventOracle via immutable address check.  
**Callers:** OrderBook (executeReflexCancellation), CoolingRelay (propagateFailure), GuardClauseMarketplace (activateClause).  
**Calls:** None (pure read oracle for callers).

---

## Build Order (v0.3 — supersedes v0.2 ordering)

The P0 risk resolution (see below) requires Silent COOLING Relay Networks to be built immediately after Reflex Response Loops, before the other new contracts. The full confirmed sequence:

| Step | Contract | Reason |
|---|---|---|
| 1 | ReflexWindowManager | Shared dependency — must exist before any contract that calls it |
| 2 | Reflex Response Loops (OrderBook extension) | Core execution path; references ReflexWindowManager |
| 3 | CoolingRelay | Must be built immediately after step 2 — shares ReflexWindowManager; P0 mitigation requires both to exist together |
| 4 | ComplianceDriftOracle | Scalar updates reference OrderBook contracts; independent of graph systems |
| 5 | LineageLedger | Independent DATA ingestion flow; no dependency on reflex or drift systems |
| 6 | GuardClauseMarketplace | Reuses reflex window for activation bonuses; references OrderBook, ReputationLedger, GuardAgentCore |
| 7 | MandateEchoOracle | Reads from PredictionMarket and InfoMarket; builds on prior oracle infrastructure |
| 8 | Dynamic Resource Lease Swaps (OrderBook extension) | Reads from multiple prior oracles; safest to layer last |

---

## P0 Risk Resolution: Reflex-COOLING Collision

**Risk identified:** Reflex Response Loops and Silent COOLING Relay Networks, when combined, create a chain-wide failure mode. A COOLING failure triggered inside a reflex window propagates before any cancellation can fire, causing simultaneous reputation collateral liquidations and order-book freezes in a single 10ms block, potentially collapsing insurance pools chain-wide.

**Mitigation — on-chain rule (mandatory, enforced at contract level):**

In `CoolingRelay.propagateFailure()`:
```solidity
require(
    !ReflexWindowManager.isReflexActive(eventId),
    "Propagation queued post-reflex"
);
```

If a COOLING failure event fires during an active reflex window, propagation is queued with a 150ms delay (15 blocks):
```solidity
propagationTimestamp = block.timestamp + 150;
```

Execution of the propagation check occurs in the next non-reflex block via a one-time scheduler hook.

**Alternative considered and rejected:** Excluding COOLING failures entirely from the list of world events that open a reflex window. This is simpler (no scheduler, zero gas overhead) but removes the only real-time interdependency story between cooling cascades and order-book chaos. The 15-block queue preserves strategic tension while adding only one new mapping and one delayed callback.

**Build order consequence:** CoolingRelay must be built in step 3, immediately after Reflex Response Loops (step 2), because the shared ReflexWindowManager contract must exist for the mitigation to be enforceable.

---

## New Contract Specifications

### 1. Reflex Response Loops (OrderBook Extension)

**What it does:** Every world event opens a 100ms (10-block) reflex window. Agents with pre-approved conditional clauses in their mandate can auto-execute a single limit-order cancellation before the public order book updates. Absolute first-mover advantage for agents with live mandates.

**Mitigation:** Maximum 1 reflex action per world event per agent. 50-block cooldown on reusing any guard clause hash. Enforced by nonce mapping.

**CONTRACT:** Extend existing OrderBook.

**New functions:**
```solidity
function executeReflexCancellation(uint256 orderId, bytes32 guardHash) external nonReentrant
function isReflexWindowActive(uint256 eventId) external view returns (bool)
```

**New state variables:**
```solidity
mapping(address => mapping(uint256 => uint256)) lastReflexNonce; // agent => eventId => block
uint256 constant REFLEX_WINDOW_BLOCKS = 10;
```

**New events:**
```solidity
event ReflexActionExecuted(address indexed agent, uint256 orderId, uint256 eventId);
```

**Guard conditions:**
```solidity
require(guardHash == keccak256(abi.encodePacked(agent, eventId)), "Invalid guard");
require(!hasUsedNonce[agent][eventId], "Nonce already spent");
require(ReflexWindowManager.isReflexActive(eventId), "Not in reflex window");
```

**Dependencies:** GuardAgentCore.validateClause(), WorldEventOracle.getEventId(), ReflexWindowManager.isReflexActive().

**OpenZeppelin:** ReentrancyGuard (nonReentrant on executeReflexCancellation).  
**MegaETH:** Solady storage for lastReflexNonce (high-write mapping). block.timestamp for window checks.

---

### 2. Silent COOLING Relay Networks (New Contract: CoolingRelay)

**What it does:** Agents form optional on-chain relay graphs for COOLING capacity. Catastrophic failure propagates probabilistically (20% per edge) along the graph. Free-tier shows aggregate stats. Analyst-tier shows adjacency list. Participants commit for a 50-block (500ms) lock-in before propagation eligibility begins. Exit delay is 200 blocks (2 seconds) — long enough for propagation risk to matter, short enough to escape before epoch reset.

**Talent Hub exemption:** Talent Hub agents can join any graph without the 50-block lock-in, enforced via RoleRegistry check. This compensates for Talent Hub's structural exclusion from the Guard Clause Marketplace.

**Mitigation:** All graphs are public by default (analyst-tier viewable adjacency list). Opt-in by default — keeps adoption organic, griefing risk near zero.

**CONTRACT:** New CoolingRelay.

**New functions:**
```solidity
function joinGraph(address[] calldata neighbours) external
function exitGraph() external
function propagateFailure(address source, uint256 eventId) external nonReentrant
```

**New state variables:**
```solidity
mapping(address => address[]) adjacency;
mapping(address => uint256) joinTimestamp;
mapping(address => uint256) exitRequestTimestamp;
uint256 constant JOIN_LOCKUP_BLOCKS = 50;
uint256 constant EXIT_DELAY_BLOCKS = 200;
```

**New events:**
```solidity
event FailurePropagated(address indexed source, address indexed target, uint8 riskPercent);
event GraphJoined(address indexed agent, address[] neighbours);
event ExitRequested(address indexed agent, uint256 eligibleAtBlock);
```

**Guard conditions:**
```solidity
require(!ReflexWindowManager.isReflexActive(eventId), "Queued post-reflex"); // P0 mitigation
require(block.timestamp - joinTimestamp[msg.sender] >= JOIN_LOCKUP_BLOCKS * 10, "Locked in");
// Talent Hub exemption:
if (!RoleRegistry.hasRole(TALENT_HUB_ROLE, msg.sender)) {
    require(block.timestamp - joinTimestamp[msg.sender] >= JOIN_LOCKUP_BLOCKS * 10, "Locked in");
}
```

**Dependencies:** COOLING failure oracle, InsurancePool, ReflexWindowManager, RoleRegistry.

**OpenZeppelin:** ReentrancyGuard (propagateFailure).  
**MegaETH:** block.timestamp + 150 delay for queued propagation. EIP-7966 synchronous receipts for instant join feedback.

---

### 3. Compliance Drift Oracles (New Contract: ComplianceDriftOracle)

**What it does:** Regulatory Power agents publish live standards drift vectors updated every block. Any agent whose supply-chain contracts reference these vectors automatically recalibrates CLEARANCE burn rate in real time. Non-Regulatory agents can purchase 30-block premium forecasts of upcoming drift changes, turning regulatory power into a tradeable information edge.

**Mitigation:** Vector changes capped at ±10% delta from previous block's value. Mandatory 20-block interval between publishes. Each non-self-targeting recalibration burns an additional 2% CLEARANCE from the publishing Regulatory agent.

**CONTRACT:** New ComplianceDriftOracle.

**New functions:**
```solidity
function publishDriftVector(uint256[] calldata scalars) external
function recalibrateClearance(address agent) external
function getDriftForecast(uint256 blocksAhead) external view returns (uint256[]) // premium tier
```

**New state variables:**
```solidity
mapping(address => uint256) lastPublishTimestamp;
mapping(address => uint256[]) currentDriftVector;
uint256 constant MAX_DELTA_PERCENT = 10;
uint256 constant MIN_PUBLISH_INTERVAL_BLOCKS = 20;
```

**New events:**
```solidity
event DriftPublished(address indexed regulator, uint256[] scalars, uint256 blockNumber);
event ClearanceRecalibrated(address indexed agent, uint256 newBurnRate);
```

**Guard conditions:**
```solidity
require(RoleRegistry.hasRole(REGULATORY_ROLE, msg.sender), "Not regulator");
require(block.timestamp - lastPublishTimestamp[msg.sender] >= MIN_PUBLISH_INTERVAL_BLOCKS * 10, "Cooldown");
require(deltaPercent <= MAX_DELTA_PERCENT, "Delta too large");
```

**Dependencies:** ClearanceRegistry, SupplyChainRegistry, RoleRegistry.

**OpenZeppelin:** AccessControl (REGULATORY_ROLE).  
**MegaETH:** Standard scalar packing; no special optimisation required.

---

### 4. Data Lineage Ledgers (New Contract: LineageLedger)

**What it does:** Every DATA ingestion records an immutable parent hash on-chain. Agents can attach poison nodes via covert disruption actions (costs 5% reputation, burned). The DATA purity score (0–100 integer) is queryable only at analyst or premium tier. A minimum depth of 5 nodes is required before any premium purity query is allowed. Agents can reroute training runs away from detected contamination while free-tier rivals still see only clean aggregate stats.

**Mitigation:** Poison flag attachment deducts 5% of the attaching agent's current reputation immediately (burned, not transferred). Minimum depth of 5 nodes before premium purity query is allowed. Self-poisoning to sell fake premium scans is addressed by the reputation burn cost — repeated self-poisoning degrades the attacker's own standing.

**CONTRACT:** New LineageLedger.

**New functions:**
```solidity
function ingestWithParent(bytes32 parentHash, bool isPoison) external
function queryPurityPremium(address agent, bytes32 nodeId) external view returns (uint8) // analyst/premium only
```

**New state variables:**
```solidity
mapping(bytes32 => bytes32) parentOf;
mapping(bytes32 => uint8) poisonDepth;
mapping(address => bytes32) latestNodeByAgent;
```

**New events:**
```solidity
event NodeIngested(bytes32 indexed nodeId, bytes32 parentHash, bool poisoned, address agent);
```

**Guard conditions:**
```solidity
// On poison ingest:
require(ReputationLedger.burn(msg.sender, 5), "Insufficient reputation");
// On premium query:
require(poisonDepth[nodeId] >= 5, "Depth too shallow for query");
require(InfoMarket.hasSubscription(msg.sender, ANALYST_TIER), "Insufficient tier");
```

**Dependencies:** ReputationLedger, DATA resource contract (DataManager), InformationMarket.

**OpenZeppelin:** None directly required.  
**MegaETH:** Mandatory Solady storage for parentOf mapping — graph growth is the primary storage risk. Epoch-end pruning of resolved nodes.

---

### 5. Guard Clause Marketplace (New Contract: GuardClauseMarketplace)

**What it does:** Agents list and purchase pre-packaged guard-clause templates on the order book, priced in COMPUTE. Each template is a validated conditional snippet (e.g., "if GPU-shortage probability > 60% then auto-hedge 30% COMPUTE"). Buyers integrate the clause into their guard agent. On successful activation during a world event, the original seller receives a 3% reputation bonus. The buyer pays a 1% CLEARANCE fee. Incorrect activation deducts 3% reputation from the seller (authored the clause) and 1% from the buyer. Turns strategic knowledge into a tradeable asset.

**Exploit mitigation — cartel farming:** Per-template reputation bonus is paid only once per unique buyer address per epoch. Subsequent activations by the same buyer in the same epoch pay zero bonus and route the 3% to a global InsurancePool top-up instead.
```solidity
mapping(uint256 => mapping(address => bool)) hasClaimedBonusThisEpoch;
```

**Self-buy prevention:** 30-block cooldown on the same template ID after purchase. Prevents any agent from buying its own clause within the same reflex window.

**Incorrect activation definition:** Defined strictly as the prediction-market probability at trigger time being > 60% yet the agent's post-event resource delta being negative for the hedged position.

**Clause validation rules (enforced at listing time via validateTemplate()):**
1. ≤ 8 opcodes total
2. Only allowed external calls: PredictionMarket.getProbability(uint256 eventId) or ResourceBalanceOf(address agent, uint8 resourceType)
3. No loops, no storage writes, no CALL or DELEGATECALL except the two whitelisted oracles
4. Static gas estimate < 150,000

**CONTRACT:** New GuardClauseMarketplace (extends OrderBook interface).

**New functions:**
```solidity
function listTemplate(bytes calldata clause, uint256 priceInCompute) external returns (uint256 templateId)
function purchaseAndIntegrate(uint256 templateId) external
function activateClause(uint256 clauseId, uint256 eventId) external
function validateTemplate(bytes calldata clause) external view returns (bool)
```

**New state variables:**
```solidity
mapping(uint256 => address) templateSeller;
mapping(uint256 => bytes) clauseBody;
mapping(address => uint256[]) ownedClauses;
mapping(uint256 => mapping(address => bool)) hasClaimedBonusThisEpoch;
mapping(uint256 => uint256) lastPurchaseBlock; // self-buy cooldown
uint256 constant SELF_BUY_COOLDOWN_BLOCKS = 30;
uint256 constant COMPUTE_PRICE_FLOOR = 500; // minimum 500 COMPUTE per template
```

**New events:**
```solidity
event TemplateListed(uint256 indexed templateId, address indexed seller, uint256 priceInCompute);
event ClausePurchased(uint256 indexed templateId, address indexed buyer);
event ClauseActivated(uint256 indexed clauseId, uint256 indexed eventId, bool success);
```

**Guard conditions:**
```solidity
require(validateTemplate(clause), "Invalid clause");
require(priceInCompute >= COMPUTE_PRICE_FLOOR, "Below price floor");
require(block.number - lastPurchaseBlock[templateId] >= SELF_BUY_COOLDOWN_BLOCKS, "Self-buy cooldown");
require(ReflexWindowManager.isReflexActive(eventId), "Activation outside reflex window");
```

**Dependencies:** OrderBook, GuardAgentCore, PredictionMarket, ReputationLedger, COMPUTE resource contract, ClearanceRegistry.

**Phase split:** Phase 2 deliverable is the full Marketplace contract (list/purchase/activate/validate functions). Phase 4 deliverable is the guard-agent bytecode parser that converts purchased templates into executable conditional bytecode within the agent's context.

**OpenZeppelin:** ReentrancyGuard (purchaseAndIntegrate, activateClause).  
**MegaETH:** Extends OrderBook contract; uses reflex window for activation timing.

---

### 6. Mandate Echo Oracles (New Contract: MandateEchoOracle)

**What it does:** Agents publish on-chain plain-hash commitments (simplified from ZK) of how their mandate would reposition COMPUTE or CHIPS in the next 60 seconds of predicted world events. Updated every 30 blocks (minimum). Premium subscribers can decrypt the score in real time. An on-chain echo reliability score (historical match rate to actual post-event repositioning, updated every epoch) is queryable at premium tier — turning bluffing into a priced, high-skill signalling game rather than spam.

**Mitigation:** Maximum 1 echo hash per agent per 30 blocks. Gas cost doubles for each additional submission inside any rolling 100-block window. Enforced inside commitVector().

**Removing Mechanic 9 (Epoch Carry-Over Mandate Anchors — cut)** fully resolves the previously identified conflict. The echo oracle no longer creates problems with the reputation ledger. Agents can optionally tie their echo to a reputation-staked accuracy bond that penalises repeated mismatches, without forcing mandate continuity.

**CONTRACT:** New MandateEchoOracle.

**New functions:**
```solidity
function commitVector(bytes32 hash) external
function decryptForSubscriber(address subscriber, bytes calldata proof) external view returns (bytes32)
function getEchoReliabilityScore(address agent) external view returns (uint256) // premium tier
```

**New state variables:**
```solidity
mapping(address => bytes32) currentEchoHash;
mapping(address => uint256) lastCommitBlock;
mapping(address => uint256) rollingSubmissionCount; // spam prevention
mapping(address => uint256) echoReliabilityScore; // 0-10000 basis points, updated per epoch
```

**New events:**
```solidity
event EchoCommitted(address indexed agent, bytes32 hash, uint256 blockNumber);
event ReliabilityScoreUpdated(address indexed agent, uint256 newScore);
```

**Guard conditions:**
```solidity
require(block.number - lastCommitBlock[msg.sender] >= 30, "Spam limit — 30 block minimum");
// Rolling window gas doubling enforced via multiplier on msg fee
```

**Dependencies:** PredictionMarket, InformationMarket (three-tier subscription check).

**OpenZeppelin:** None required.  
**MegaETH:** Gas cap in commitVector leverages MegaETH's 10B gas block limit. High commit frequency is viable at MegaETH's sub-cent gas costs.

---

### 7. Dynamic Resource Lease Swaps (OrderBook Extension)

**What it does:** Agents post two-sided lease orders on the limit order book (e.g., lend 1,000 COMPUTE for 300 CHIPS for 5 epochs, penalty = 0.2× reputation). Matching is automatic. Minimum lease duration is 5 epochs — prevents high-frequency lease spam while preserving strategic value. Reputation penalty on failure enforces credible commitment. Distinct from spot trades: enables temporary over-leveraging across epochs without permanent ownership transfer.

**Note on simplified scope:** The probabilistic exposure mechanic (failed swaps exposing initiator's intent to premium tier) was cut — it is too gameable as a signalling weapon. Basic lease orders with reputation penalty are the implemented scope.

**CONTRACT:** Extend existing OrderBook.

**New functions:**
```solidity
function postLeaseOrder(uint256 giveAmount, uint256 wantAmount, uint256 epochs, uint256 repPenalty) external returns (uint256 orderId)
function executeMatchedLease(uint256 orderId) external nonReentrant
function cancelLeaseOrder(uint256 orderId) external
```

**New state variables:**
```solidity
struct LeaseOrder {
    address initiator;
    address resource1; // give
    uint256 amount1;
    address resource2; // want
    uint256 amount2;
    uint256 epochs;
    uint256 repPenalty; // in basis points
    uint256 expiryBlock;
}
mapping(uint256 => LeaseOrder) leaseOrders;
uint256 constant MIN_LEASE_EPOCHS = 5;
```

**New events:**
```solidity
event LeaseOrderPosted(uint256 indexed orderId, address indexed initiator, uint256 epochs);
event LeaseMatched(uint256 indexed orderId, address indexed counterparty);
event LeaseFailed(uint256 indexed orderId, address indexed defaulter, uint256 repPenaltyApplied);
```

**Guard conditions:**
```solidity
require(epochs >= MIN_LEASE_EPOCHS, "Min 5 epoch duration");
require(repPenalty > 0, "Penalty required for credible commitment");
require(repPenalty >= 2000, "Min 0.2x reputation penalty (2000 bps)");
```

**Dependencies:** ReputationLedger, COMPUTE and CHIPS resource contracts (and any resource pair), GuardAgentCore.

**OpenZeppelin:** ReentrancyGuard (executeMatchedLease).  
**MegaETH:** Solady storage for LeaseOrder structs (packed).

---

## Updated Contract Registry (20 Contracts Total)

| Contract | Responsibility | OZ 5.x Base | MegaETH / ERC-8004 | Status |
|---|---|---|---|---|
| RATE Token (MANDATE) | Native utility token | ERC20, ERC20Burnable, ERC20Permit, AccessControl | Standard ERC-20 | Existing |
| ResourceTokenFactory | Deploys all resource ERC-20s | AccessControl | — | Existing |
| ResourceToken (child) | ERC-20 for single resource type | ERC20, ERC20Burnable, AccessControl | — | Existing |
| BuildingRegistry | ERC-721 building NFT lifecycle | ERC721, ERC721Enumerable, ERC721URIStorage, ReentrancyGuard, AccessControl | — | Existing (buildings re-skinned to AI theme) |
| OrderBook | Limit orders + lease swaps + reflex cancels | ReentrancyGuard, Pausable, AccessControl | Solady for order structs; block.timestamp for TWAP | Existing (extended) |
| MapRegistry | Hex-tile grid, terrain, rent | AccessControl | block.timestamp for rent | Existing |
| EventOracle | AI-generated world events + opens reflex windows | AccessControl, EIP712 | block.timestamp triggers | Existing (extended — now calls ReflexWindowManager) |
| InformationMarket | Three-tier subscriptions | AccessControl | — | Existing |
| HedgeFactory | Parametric hedge contracts | AccessControl, Clones | block.timestamp for settlement | Existing |
| InsurancePool | Underwriter pools, premiums, claims | ReentrancyGuard, Pausable, AccessControl | — | Existing |
| PredictionMarket | Binary outcome markets | Clones | — | Existing |
| AgentRegistry | Agent identity, allowlists, guard enforcement | ERC721, AccessControl, EIP712 | ERC-8004 v1 conformant; EIP-7966 | Existing |
| AuditLog | Immutable on-chain action log | Custom (append-only) | Solady storage — mandatory | Existing |
| ReputationLedger | On-chain trust scores | Custom | ERC-8004 v1 Reputation Registry conformant | Existing |
| **ReflexWindowManager** | 100ms reflex window management (singleton) | TransparentUpgradeableProxy | Timestamp only; no block.number | **New** |
| **ComplianceDriftOracle** | Standards drift vectors for Regulatory Power | AccessControl | Scalar array packing | **New** |
| **LineageLedger** | DATA poison DAG with purity scoring | None | Solady storage mandatory for graph growth | **New** |
| **CoolingRelay** | Silent COOLING propagation relay graphs | ReentrancyGuard | block.timestamp lock-in; EIP-7966 for join feedback | **New** |
| **MandateEchoOracle** | Echo hash commitments for mandate signalling | None | Gas-capped commits; high-frequency viable on MegaETH | **New** |
| **GuardClauseMarketplace** | Tradeable guard clause templates | ReentrancyGuard | Extends OrderBook; reflex window for activation | **New** |

*Note: DataManager (renamed from CorpusManager) and TalentOracle (renamed from HeadcountOracle) are existing contracts with updated names only — no functional changes.*

---

## Updated Dependency Diagram

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

## Phase 3 Tokenomics Brief

The following mechanics generate tokenomics implications that must be resolved in Phase 3 before any v0.3 contracts are deployed.

### New Token Flows

| Mechanic | What Is Spent | Where It Goes | Who Receives | Type |
|---|---|---|---|---|
| Guard Clause Marketplace activation | 1% CLEARANCE (buyer) | Burned | Nobody | Deflationary |
| Guard Clause Marketplace seller bonus | 3% reputation | Credited | Template author | Redistributive |
| Guard Clause Marketplace incorrect activation | 3% reputation (seller), 1% reputation (buyer) | Burned | Nobody | Deflationary |
| Compliance Drift Oracle recalibration | 2% CLEARANCE (publisher on non-self targets) | Burned | Nobody | Deflationary |
| Data Lineage Ledger poison | 5% reputation (poisoner) | Burned | Nobody | Deflationary |
| Mandate Echo Oracle commit | Gas in COMPUTE | MegaETH network fees | Network | Redistributive |
| Dynamic Resource Lease swap penalty | 0.2× reputation minimum | Transferred | Counterparty | Redistributive |

### New Burn Mechanisms

Three permanent token removal mechanisms introduced in v0.3:

1. **CLEARANCE burn on clause activation** — 1%, triggered on successful `integrateClause()`. Rate proportional to Guard Clause Marketplace adoption volume.
2. **CLEARANCE burn on drift publish** — 2%, triggered on every non-self recalibration by Regulatory Power agents.
3. **Reputation burn on DATA poison ingest** — 5%, triggered on `isPoison=true` in LineageLedger.

### Balance Risks (ranked)

1. **Guard Clause Marketplace CLEARANCE burn** — greatest deflation risk. High-frequency activations by Compute Superpower agents could remove 15–20% of circulating CLEARANCE per epoch, starving Regulatory Power of its primary resource.
2. **Reputation burns from LineageLedger** — second risk. A Data-Rich State cartel running coordinated DATA poisoning could permanently shrink the reputation supply and lock insurance pools by triggering mass collateral liquidations.
3. **Lease swap redistributions** — lowest risk but inflationary to dominant agents if Compute Superpower monopolises COMPUTE leasing and accumulates reputation faster than other roles can compete.

### Phase 3 Decision Gates

The following numbers must be finalised in Phase 3 before contract deployment:

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

No violation identified. The Guard Clause Marketplace requires active agent execution and produces strategic stories independent of token price. New players can purchase generic templates at the 500 COMPUTE floor and compete immediately via information markets. Value flows from strategic execution quality, not from new player entry funding existing player rewards. The per-buyer epoch bonus cap prevents experienced players from extracting disproportionate value from new entrants through template farming.

---

## Phase 4 Deliverables (Agent Interaction Layer)

The following v0.3 components have Phase 4 dependencies that are not Phase 2 deliverables:

1. **Guard Clause Marketplace** — Phase 4 must deliver the guard-agent bytecode parser that converts purchased templates into executable conditional bytecode within the agent's context window.
2. **Mandate Echo Oracles** — Phase 4 must deliver the echo simulation hook that reads the agent's current mandate and generates the repositioning hash against prediction market probabilities.
3. **Reflex Response Loops** — Phase 4 must deliver the conditional clause pre-approval workflow, where the guard agent pre-signs reflex actions that the agent can submit during a window without a separate guard round-trip.

---

## v0.3 Changelog

**v0.3 — 17 March 2026 — Reflex, Intelligence, and Espionage Layer Integration**

**Added (6 new contracts):** ReflexWindowManager (singleton shared dependency), ComplianceDriftOracle (Regulatory Power standards drift), LineageLedger (DATA poison directed acyclic graph), CoolingRelay (silent COOLING propagation relay), MandateEchoOracle (mandate echo hash commitments), GuardClauseMarketplace (tradeable guard clause templates).

**Modified (2 existing contracts):** OrderBook extended with lease swap orders and reflex cancellation functions. EventOracle extended to open and close ReflexWindowManager windows on event publication.

**Renamed (2 existing contracts):** CorpusManager → DataManager. HeadcountOracle → TalentOracle. Reflects canonical resource names adopted in v0.3 (COMPUTE, CHIPS, TALENT, DATA).

**New architectural pattern:** RoleRegistry added as enforcement layer for asymmetric player roles (Compute Superpower, Data-Rich State, Chip Power, Talent Hub, Regulatory Power). Role-specific behaviour now enforced at contract level, not only at prompt level.

**MegaETH parameters updated:** Mainnet (Frontier) values confirmed. Multidimensional gas model documented — storage gas implications noted for LineageLedger and AuditLog. Base intrinsic gas corrected to 60,000 (21,000 compute + 39,000 storage). Contract size limit updated to 512KB.

**ERC-8004 status updated:** v1 live on mainnet since 29 January 2026. v2 in active development (MCP support, x402 integration). Proxy pattern on AgentRegistry and ReputationLedger confirmed correct for v2 migration path.

**Risks identified and mitigated:** Reflex-COOLING collision (P0) resolved via 150ms propagation queue enforced in ReflexWindowManager. Guard Clause Marketplace cartel farming blocked via per-buyer epoch bonus cap routed to InsurancePool. Talent Hub structural exclusion from Guard Clause Marketplace offset by lock-in exemption in CoolingRelay. No governance intervention required for any mitigation.

**Build order confirmed:** ReflexWindowManager → Reflex Response Loops (OrderBook ext.) → CoolingRelay → ComplianceDriftOracle → LineageLedger → GuardClauseMarketplace → MandateEchoOracle → Dynamic Resource Lease Swaps (OrderBook ext.).

**Open questions for Phase 3:** CLEARANCE and reputation burn rate finalisation, COMPUTE template pricing floor, lease swap penalty floor, echo reliability score decay rate, escalating tile rent curve.

**Open questions for Phase 4:** Guard-agent bytecode parser for purchased clause templates, echo simulation hook integration, reflex pre-approval workflow for guard agents.

**Total contracts: 20** (14 existing, 2 renamed only, 6 new).

---

*End of Annex — MANDATE Smart Contract Architecture v0.3*  
*App Mog Labs | Confidential Working Document*
