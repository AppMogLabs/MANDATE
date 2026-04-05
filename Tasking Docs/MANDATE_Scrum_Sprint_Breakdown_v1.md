# MANDATE — Scrum Sprint Breakdown
## Phase 2 Smart Contract Architecture
### Including Synthesis Hackathon MVP Scope

App Mog Labs | v1.0 | March 2026
Confidential Working Document

---

## 1. Executive Summary

This document breaks MANDATE's Phase 2 smart contract architecture (20 core contracts + 6 supporting contracts across 7 domains) into incremental, shippable Scrum sprints. The guiding principle is to deliver value early and often: each sprint produces a deployable, testable increment on MegaETH testnet.

The first increment — Sprint 0 (Hackathon MVP) — is scoped specifically to be submittable to The Synthesis hackathon (building window: March 13–22, 2026). This is not a stripped-down demo. It is a vertical slice of MANDATE's most distinctive architecture: autonomous AI agents operating under human-defined mandates, with on-chain trust infrastructure, scoped spending permissions, and verifiable cooperation — mapping directly to three of The Synthesis's four judging themes.

Subsequent sprints layer complexity onto this foundation: the order book, financial instruments, the intelligence layer, and finally integration testing and audit preparation. Each sprint is 2 weeks. Total estimated timeline for Phase 2: 12–14 weeks from Sprint 1 through Sprint 6, with the hackathon MVP delivered in 4 days as a parallel fast-track.

### 1.1 Native Token: RATE

The native utility token is **RATE** (ticker: RATE). It serves as the settlement layer for all economic activity: tile rent, information subscriptions, insurance premiums, staking, governance voting, and as the denominator of all resource trades on the order book. RATE is not a gas token (MegaETH uses ETH for gas). RATE is the in-game economic unit.

**Lore expansion:** RATE stands for **Resource Allocation & Throughput Entitlement**. In a machine-native economy where autonomous agents price, trade, and settle on behalf of human owners, the currency is not designed to feel precious or sovereign — it is designed to feel like what machines use to denominate value. Players are "high rate" or "low rate." The word is clinical, financial, and status-marking.

**Codebase convention:** Because "rate" is a common variable name in Solidity (burnRate, exchangeRate, interestRate), all references to the RATE token in smart contracts must use the prefix `rateToken` or `RATE_TOKEN` to avoid ambiguity. Example: `rateTokenBalance`, `RATE_TOKEN_ADDRESS`, `rateTokenTransfer`. This convention is enforced from Sprint 0 onward.

**Token specification:**
- Standard: ERC-20
- OZ 5.x base: ERC20, ERC20Burnable, ERC20Permit, AccessControl
- Minting: Governance multisig at launch, DAO contract later
- Initial supply: Pre-minted, zero ongoing emission
- Burning: Tile rent and information subscriptions permanently remove supply
- Not a gas token: MegaETH uses ETH for gas

---

## 2. Hackathon Strategy: The Synthesis (Completed, no longer relevant)

The Synthesis (synthesis.md) is an online Ethereum ecosystem hackathon running March 13–22, 2026, judged by both AI agents and humans. It focuses on four themes that map directly to MANDATE's core architecture:

| Synthesis Theme | MANDATE Alignment | MVP Deliverable |
|---|---|---|
| **Agents that Pay** | Scoped spending via on-chain action allowlist (bitmap). Agent operates within human-defined budget constraints. All settlements on-chain, auditable. | AgentRegistry with allowlist + RATE token + ResourceToken factory. Demo: agent executes permitted trades, blocked on unpermitted ones. |
| **Agents that Trust** | ERC-8004 agent identity and reputation. On-chain feedback between agents. Portable credentials via ERC-721 agent IDs. | AgentRegistry (ERC-8004 Identity) + ReputationLedger (ERC-8004 Reputation). Demo: agents register, interact, build reputation. |
| **Agents that Cooperate** | Smart contract commitments for bilateral trades. Human-defined negotiation boundaries (mandate constraints). Atomic swaps, no intermediary. | Simplified OrderBook with atomic swap settlement. Demo: two agents negotiate and settle a resource trade on-chain. |
| **Agents that Keep Secrets** | Three-tier information economy with gated access. Mandate Echo Oracles with hash commitments (information without disclosure). | Stretch goal only: InformationMarket tier-gating stub. Core MVP focuses on the first three themes. |

### 2.1 Why This Wins

MANDATE is not a hackathon project pretending to be a product. It is a product with a deeply architected Phase 2 specification that happens to have a natural vertical slice perfectly aligned with the hackathon themes. The MVP demonstrates real on-chain agent infrastructure, not a prototype. It uses live standards (ERC-8004), targets a real L2 (MegaETH), and solves real problems (scoped agent autonomy, verifiable trust, enforceable cooperation).

The judging is by AI agents. MANDATE's architecture is literally about AI agents. The meta-alignment is powerful.

---

## 3. Sprint Overview and Cadence

All sprints after Sprint 0 follow a 2-week cadence. Sprint 0 is a 4-day fast-track for the hackathon.

| Sprint | Duration | Focus | Key Deliverables | Contracts |
|---|---|---|---|---|
| **0 (MVP)** | 4 days | Hackathon vertical slice | RATE Token, ResourceTokenFactory (2 resources), AgentRegistry (ERC-8004), ReputationLedger, simplified OrderBook, AuditLog stub | 6–7 |
| **1** | 2 weeks | Core Token and Asset Layer | Full 7-resource deployment, BuildingRegistry (ERC-721), MapRegistry, construction recipes | 4–5 |
| **2** | 2 weeks | Market Infrastructure | Full OrderBook (linked list or RBTree), TWAP, HedgeFactory, InsurancePool, PredictionMarket | 4–5 |
| **3** | 2 weeks | World State and Events | EventOracle (EIP-712), ReflexWindowManager, EpochManager, TalentOracle, DataManager | 5 |
| **4** | 2 weeks | Agent Intelligence Layer | CoolingRelay, ComplianceDriftOracle, LineageLedger, GuardClauseMarketplace, MandateEchoOracle, RoleRegistry | 6–7 |
| **5** | 2 weeks | Integration and Hardening | Lease Swaps, Reflex extensions, cross-contract integration tests, gas benchmarks, Solady optimisation | Extensions |
| **6** | 2 weeks | Audit Prep and Mainnet | Security review, formal verification of critical paths, testnet soak, documentation, deployment scripts | All 26 |

Total estimated Phase 2 timeline: 4 days (Sprint 0) + 12 weeks (Sprints 1–6) = approximately 14 weeks including buffer. Sprint 0 runs in parallel with or slightly before Sprint 1.

---

## 4. Module Decomposition

The 26 contracts decompose into 7 modules. Each module maps to a Scrum increment with clear inputs, outputs, and acceptance criteria.

| Module | Contracts | Sprint | Dependencies |
|---|---|---|---|
| **A: Token and Asset** | RATE Token, ResourceTokenFactory, ResourceToken (×7), BuildingRegistry, MapRegistry | 0 (partial) + 1 | None (foundation layer) |
| **B: Market Infrastructure** | OrderBook (full), HedgeFactory, InsurancePool, PredictionMarket, InformationMarket | 0 (partial) + 2 | Module A (RATE + resources for trading) |
| **C: World State** | EventOracle, ReflexWindowManager, EpochManager, TalentOracle, DataManager | 3 | Module A (resource references), Module B (OrderBook for event impacts) |
| **D: Financial Instruments** | HedgeFactory children, InsurancePool children, PredictionMarket children | 2–3 | Module B (OrderBook TWAP), Module C (EventOracle for settlement) |
| **E: Security and Governance** | AgentRegistry (ERC-8004), AuditLog, ReputationLedger, RoleRegistry | 0 (core) + 4 (roles) | None for core; Module C for role-aware behaviour |
| **F: Agent Intelligence** | ComplianceDriftOracle, LineageLedger, CoolingRelay, GuardClauseMarketplace, MandateEchoOracle | 4 | Module C (ReflexWindowManager), Module E (ReputationLedger), Module B (OrderBook) |
| **G: Supporting** | ClearanceRegistry, SupplyChainRegistry (thin wrappers) | 3–4 | Module A (resource tokens), Module F (consumers) |

---

## 5. Sprint 0: Hackathon MVP (4 Days)

### 5.1 Scope and Rationale

The hackathon MVP delivers a vertical slice through MANDATE's architecture that demonstrates all three primary Synthesis themes (Agents that Pay, Trust, Cooperate) with real, deployable smart contracts on MegaETH testnet. The slice is chosen to maximise judging impact while laying genuine foundation for the full product.

### 5.2 Day-by-Day Plan

| Day | Focus | Deliverables | Acceptance Criteria |
|---|---|---|---|
| **1** | Foundation: Token + Agent Identity | RATE Token (OZ ERC20 + Burnable + Permit + AccessControl). ResourceTokenFactory + 2 tokens (COMPUTE, CHIPS). AgentRegistry skeleton (ERC-8004 Identity: register, ERC-721 agentId, agentURI). | RATE deploys and transfers. Factory deploys COMPUTE and CHIPS. Agent can register and receive NFT ID. All on MegaETH testnet. |
| **2** | Trust: Allowlist + Reputation + Audit | AgentRegistry: action allowlist (bitmap), validateAction gate. ReputationLedger (ERC-8004 Reputation: postFeedback, getScore). AuditLog stub (append-only, Solady storage). | Agent action blocked if not on allowlist. Feedback posted between agents updates score. Every action logged with timestamp and hash. |
| **3** | Cooperate: Simplified OrderBook | OrderBook: placeLimitOrder, cancelOrder, basic matching (price-time priority). Atomic swap settlement via SafeERC20. RATE-denominated pairs. | Agent A posts bid, Agent B posts ask, orders match, tokens swap atomically. Non-allowlisted action reverts. |
| **4** | Demo, Docs, Submit | End-to-end demo script (Foundry or Hardhat). README with architecture overview. Short video walkthrough. Devfolio submission. | Full flow: register agents → set allowlists → mint resources → place orders → match → verify reputation → audit trail. Runs on MegaETH testnet. |

### 5.3 MVP Contract List

| Contract | Scope for MVP | OZ 5.x | Lines (Est.) | Theme |
|---|---|---|---|---|
| **RATE Token** | Full implementation. Production-ready. | ERC20, ERC20Burnable, ERC20Permit, AccessControl | ~80 | Pay |
| **ResourceTokenFactory** | Full factory. Deploy 2 of 7 tokens. | AccessControl, Clones | ~60 | Pay |
| **ResourceToken** | Full template. COMPUTE + CHIPS only. | ERC20, ERC20Burnable, AccessControl | ~50 | Pay |
| **AgentRegistry** | ERC-8004 Identity + allowlist + guard gate. No guard signing yet. | ERC721, AccessControl, EIP712 | ~200 | Trust |
| **ReputationLedger** | ERC-8004 Reputation. Score + feedback. | Custom | ~120 | Trust |
| **AuditLog** | Append-only stub. Log struct + emit. | Custom (Solady) | ~60 | Trust |
| **OrderBook (simplified)** | Limit orders, basic matching, cancel. No TWAP, no reflex, no leases. | ReentrancyGuard, Pausable | ~250 | Cooperate |

**Estimated total MVP code:** ~820 lines of Solidity + ~300 lines of test/demo scripts.

**Stretch goal (Day 4 if time permits):** InformationMarket stub with tier-gated read access, demonstrating the "Agents that Keep Secrets" theme.

---

## 6. Sprint 1: Core Token and Asset Layer (2 Weeks)

Sprint 1 completes Module A. It extends the hackathon MVP's token layer to all 7 resources and adds the full building lifecycle.

| Story | Description | Points | Priority | Acceptance Criteria |
|---|---|---|---|---|
| S1.1 | Deploy remaining 5 resource tokens (ENERGY, COOLING, TALENT, DATA, CLEARANCE) via factory | 3 | P0 | All 7 tokens deployed, mintable by authorised buildings only |
| S1.2 | BuildingRegistry: ERC-721 with construct(), tier, metadata struct | 8 | P0 | Building minted as NFT, recipe resources burned, terrain check passes |
| S1.3 | Construction recipes: on-chain config table for all 16 building types | 5 | P0 | All recipes from v0.3 stored on-chain, governance-updatable via TimelockController |
| S1.4 | claimProduction(): time-based output with tierMultiplier and workerEfficiency | 5 | P0 | Production proportional to elapsed block.timestamp, TALENT burn on claim |
| S1.5 | MapRegistry: hex-tile grid, terrain types, tile claiming, escalating rent | 5 | P1 | Tiles claimable, rent burns RATE, escalating cost per additional tile |
| S1.6 | Two-step upgrade (initiate + finalise) with cooldown | 3 | P1 | Flash-upgrade exploit impossible; cooldown enforced via block.timestamp |
| S1.7 | demolish() with governance-controlled recovery parameter | 2 | P2 | NFT burned, tile released, 0% recovery at launch |

**Sprint 1 velocity target:** 31 points. Sprint deliverable: full token economy + building lifecycle on MegaETH testnet.

---

## 7. Sprint 2: Market Infrastructure (2 Weeks)

Sprint 2 completes Module B. The order book is the economic heart of MANDATE. This sprint also delivers the financial instrument factories.

| Story | Description | Points | Priority | Acceptance Criteria |
|---|---|---|---|---|
| S2.1 | Full OrderBook: sorted linked list, all 7 resource pairs vs RATE, price-time priority matching | 8 | P0 | Orders match correctly, partial fills work, events emitted |
| S2.2 | TWAP implementation (60-second window, block.timestamp) | 5 | P0 | TWAP resists single-block manipulation; tested with adversarial scenarios |
| S2.3 | HedgeFactory: parametric hedge creation via Clones, TWAP settlement | 5 | P0 | Hedge deploys as minimal proxy, settles automatically against TWAP |
| S2.4 | InsurancePool: stake, unstake (500s cooldown), bonding curve premiums, triggerClaim | 5 | P0 | Solvency ratio maintained, front-running prevented by cooldown |
| S2.5 | PredictionMarket: binary outcomes, constant-product AMM, EventOracle resolution | 5 | P1 | Markets resolve correctly, winnings claimable, deployed via Clones |
| S2.6 | InformationMarket: three-tier subscription (free/analyst/premium) | 3 | P1 | Tier gating works; premium content inaccessible without subscription |
| S2.7 | RedBlackTreeKV benchmark (if time): compare gas vs linked list at 50/100/500 levels | 3 | P2 | Benchmark results documented; architecture decision recorded |

**Sprint 2 velocity target:** 34 points. Sprint deliverable: live order book with hedging, insurance, and prediction markets on testnet.

---

## 8. Sprint 3: World State, Events, and Financial Instruments (2 Weeks)

Sprint 3 completes Module C and connects Module D. The EventOracle drives game dynamics; the ReflexWindowManager is the shared dependency for the entire intelligence layer.

| Story | Description | Points | Priority | Acceptance Criteria |
|---|---|---|---|---|
| S3.1 | EventOracle: publishEvent with EIP-712 signing, severity-gated multi-sig, resource impact arrays | 8 | P0 | Events published with valid signature, high-severity requires 2-of-3 |
| S3.2 | ReflexWindowManager: singleton, openReflexWindow/closeReflexWindow/isReflexActive | 5 | P0 | 100ms window opens on event, isReflexActive returns correct bool, closes after window |
| S3.3 | EventOracle extension: calls ReflexWindowManager.openReflexWindow on publishEvent | 3 | P0 | Reflex window automatically active after every world event |
| S3.4 | EpochManager: epoch lifecycle, reset trigger, reputation carry-over interface | 5 | P1 | Epoch starts/ends correctly, top 20% reputation agents identified |
| S3.5 | TalentOracle: migration rate calculation, conditions score, triggerMigration | 3 | P1 | TALENT migrates from low-conditions to high-conditions agents |
| S3.6 | DataManager: ingest with source hash provenance | 2 | P2 | DATA ingestion recorded with parent hash on-chain |
| S3.7 | Connect HedgeFactory + InsurancePool to EventOracle for settlement triggers | 5 | P1 | Hedges settle on event; insurance claims trigger on oracle data |

**Sprint 3 velocity target:** 31 points. Sprint deliverable: world events drive market dynamics; reflex window infrastructure ready.

---

## 9. Sprint 4: Security, Governance, and Agent Intelligence (2 Weeks)

Sprint 4 is the most complex sprint. It completes Module E (roles) and the entire Module F (Agent Intelligence Layer). Build order from v0.3 annex is strictly followed.

| Story | Description | Points | Priority | Build Step |
|---|---|---|---|---|
| S4.1 | RoleRegistry: 5 sovereign roles, epoch-scoped assignment, AccessControl base | 3 | P0 | Prerequisite for CoolingRelay and ComplianceDriftOracle |
| S4.2 | OrderBook extension: executeReflexCancellation with guard hash, nonce mapping, ReflexWindowManager check | 5 | P0 | Build step 2: Reflex Response Loops |
| S4.3 | CoolingRelay: joinGraph, exitGraph, propagateFailure, P0 mitigation (150ms queue during reflex) | 8 | P0 | Build step 3: P0 risk resolution tested |
| S4.4 | ComplianceDriftOracle: publishDriftVector, recalibrateClearance, premium forecasts, ±10% cap | 5 | P1 | Build step 4 |
| S4.5 | LineageLedger: ingestWithParent, poison nodes (5% rep burn), purity query (analyst tier gate) | 5 | P1 | Build step 5 |
| S4.6 | GuardClauseMarketplace: list/purchase/activate/validate, cartel farming prevention, self-buy cooldown | 8 | P1 | Build step 6 |
| S4.7 | MandateEchoOracle: commitVector, reliability score, spam mitigation (30-block min, gas doubling) | 5 | P1 | Build step 7 |
| S4.8 | ClearanceRegistry + SupplyChainRegistry (thin supporting contracts) | 3 | P2 | Supporting Module G |

**Sprint 4 velocity target:** 42 points (highest complexity sprint). Sprint deliverable: full intelligence layer deployed, P0 reflex-COOLING collision mitigated.

---

## 10. Sprint 5: Integration, Hardening, and Testnet (2 Weeks)

Sprint 5 focuses on cross-contract integration, gas optimisation, and MegaETH-specific hardening. No new contracts — this sprint connects everything and stress-tests it.

| Story | Description | Points | Priority |
|---|---|---|---|
| S5.1 | OrderBook extension: Dynamic Resource Lease Swaps (postLeaseOrder, executeMatchedLease, cancelLeaseOrder) | 5 | P1 |
| S5.2 | Full guard agent flow: EIP-712 signed guard approval + executeWithGuardSig single-transaction path | 5 | P0 |
| S5.3 | Cross-module integration tests: event → reflex window → cancellation → reputation update → audit log | 8 | P0 |
| S5.4 | Solady storage benchmarks for AuditLog and LineageLedger on MegaETH testnet (bucket multiplier impact) | 3 | P1 |
| S5.5 | Gas profiling: measure all critical paths (order matching, claim production, reflex cancellation, COOLING propagation) | 3 | P1 |
| S5.6 | TransparentUpgradeableProxy deployment for all singletons + TimelockController (48h, 3-of-5 multisig) | 5 | P0 |
| S5.7 | Epoch reset end-to-end: EpochManager triggers reset, reputation carry-over, LineageLedger pruning | 5 | P1 |
| S5.8 | Adversarial testing: flash loan resistance (TWAP), reentrancy fuzzing, allowlist bypass attempts | 5 | P0 |

**Sprint 5 velocity target:** 39 points. Sprint deliverable: all 26 contracts deployed and integrated on MegaETH testnet, passing adversarial test suite.

---

## 11. Sprint 6: Audit Prep and Mainnet Readiness (2 Weeks)

Sprint 6 prepares for external security audit and mainnet deployment. Focus shifts from feature development to documentation, formal verification, and operational readiness.

| Story | Description | Points | Priority |
|---|---|---|---|
| S6.1 | Security audit preparation: NatSpec documentation on all external functions, invariant annotations | 5 | P0 |
| S6.2 | Formal verification: critical path properties (allowlist enforcement, TWAP window bounds, reflex nonce uniqueness) | 8 | P0 |
| S6.3 | Deployment scripts: deterministic CREATE2 deployment sequence for all 26 contracts on MegaETH mainnet | 5 | P0 |
| S6.4 | Testnet soak: 72-hour continuous test with simulated agent traffic (50+ agents, world events every 5 minutes) | 5 | P0 |
| S6.5 | Operational runbook: monitoring alerts, circuit breaker procedures (Pausable), upgrade process documentation | 3 | P1 |
| S6.6 | Phase 3 handoff document: all tokenomics decision gates from v0.3 annex with recommended values from testnet data | 3 | P1 |
| S6.7 | Phase 4 handoff document: agent interaction protocol requirements, bytecode parser spec, echo simulation hook spec | 3 | P2 |

**Sprint 6 velocity target:** 32 points. Sprint deliverable: audit-ready codebase, deployment scripts, operational documentation.

---

## 12. Dependency Map and Critical Path

The critical path runs through these sequential dependencies:

**RATE Token + ResourceTokenFactory** (Sprint 0/1) → **OrderBook** (Sprint 0/2) → **EventOracle + ReflexWindowManager** (Sprint 3) → **Agent Intelligence Layer** (Sprint 4) → **Integration** (Sprint 5)

Parallel tracks that do not block the critical path:

| Parallel Track | Can Start After | Blocks Nothing Until |
|---|---|---|
| BuildingRegistry + MapRegistry | Sprint 0 (tokens exist) | Sprint 5 (integration tests) |
| AgentRegistry (ERC-8004 extensions) | Sprint 0 (core exists) | Sprint 4 (guard clause marketplace needs it) |
| InsurancePool + PredictionMarket | Sprint 2 (OrderBook exists) | Sprint 4 (CoolingRelay references InsurancePool) |
| RedBlackTreeKV benchmark | Any time | Sprint 2 (OrderBook architecture decision) |

---

## 13. Risk Register

| Risk | Likelihood | Impact | Sprint | Mitigation |
|---|---|---|---|---|
| Sprint 4 overload (42 points, highest complexity) | High | High | 4 | Pre-build CoolingRelay and ComplianceDriftOracle interfaces in Sprint 3. Pair program on GuardClauseMarketplace. |
| MegaETH testnet instability during hackathon | Medium | Critical | 0 | Local Foundry fork as fallback. All contracts EVM-compatible, deploy to any testnet if needed. |
| ERC-8004 v2 breaking changes mid-build | Low | Medium | 1–4 | All ERC-8004 contracts behind TransparentUpgradeableProxy. Migration path documented. |
| Solady storage bucket expansion on MegaETH | Medium | Medium | 5 | Benchmark in Sprint 5. AuditLog off-chain migration path designed as contingency. |
| Guard clause validation (8-opcode limit) too restrictive | Medium | Low | 4 | Governance-adjustable opcode limit. Phase 4 bytecode parser can relax constraints. |
| Hackathon judges unfamiliar with MegaETH | Medium | Medium | 0 | README includes MegaETH explainer. Demo video shows real testnet transactions with block explorer links. |

---

## 14. Definition of Done

Every sprint increment must satisfy all of the following before it is considered complete:

| Category | Requirement |
|---|---|
| **Code** | All contracts compile with solc 0.8.24+. No compiler warnings. NatSpec on all external functions. |
| **Tests** | 100% branch coverage on critical paths (order matching, allowlist checks, reflex window). Minimum 80% overall coverage. |
| **Security** | ReentrancyGuard on all token-transferring functions. CEI pattern enforced. SafeERC20 on all transfers. No use of block.number for time logic. |
| **MegaETH** | Deployed to MegaETH testnet. Gas costs within budget (< 500K gas for order matching, < 1M for complex operations). |
| **Integration** | All cross-contract calls tested with mock and live contracts. AgentRegistry.validateAction gate tested on every write path. |
| **Documentation** | Interface definitions match implementation. Changelog updated. Open questions documented. |

---

## Appendix A: Synthesis Hackathon Alignment Matrix

Detailed mapping of MANDATE contracts to Synthesis judging criteria.

| Synthesis Criterion | MANDATE Contract(s) | How It Demonstrates the Criterion |
|---|---|---|
| **Scoped spending permissions** | AgentRegistry (allowlist bitmap) | Human owner defines which transaction types the agent can execute. Bitmap enforced at contract level — LLM prompt injection cannot bypass it. |
| **On-chain settlement** | OrderBook + RATE Token | All trades settle atomically via SafeERC20 transfers. No intermediary. Verifiable on MegaETH block explorer. |
| **Auditable history** | AuditLog (Solady) | Every agent action logged with timestamp, input hash, guard approval status. Append-only, immutable. |
| **On-chain reputation** | ReputationLedger (ERC-8004) | Structured feedback conforming to ERC-8004 schema. Any third-party reputation aggregator can read MANDATE agent reputation without custom integration. |
| **Portable agent credentials** | AgentRegistry (ERC-8004 Identity) | Agent identity is an ERC-721 NFT. No platform can delist. Resolves to off-chain agentURI for discoverability. |
| **Smart contract commitments** | OrderBook atomic swaps | Trade terms enforced by protocol. Once submitted, neither party can renege. No intermediary arbitration. |
| **Human-defined boundaries** | Mandate system + allowlist | Owner sets strategy (mandate), constraints (allowlist), risk limits (guard clauses). Agent operates freely within these boundaries. |
| **Composable primitives** | HedgeFactory, InsurancePool, PredictionMarket | Escrow, staking, slashing, conditional payouts — all composable building blocks any agent can integrate. |

---

## Appendix B: User Story Backlog Summary

Total backlog: 42 user stories across 7 sprints (including Sprint 0). Summary by priority:

| Priority | Count | Total Points | Description |
|---|---|---|---|
| **P0** | 18 | ~95 | Critical path items. Must complete for increment to be shippable. Includes all security requirements. |
| **P1** | 16 | ~70 | High value. Should complete within sprint. Deferral requires explicit product owner approval. |
| **P2** | 8 | ~25 | Desirable. Can be deferred to next sprint without blocking dependencies. |

**Total estimated effort:** ~190 story points across 6 sprints + hackathon MVP.

**Average velocity required:** ~32 points per 2-week sprint (achievable for a focused 2-person team).

---

*End of Document*
*MANDATE Scrum Sprint Breakdown | App Mog Labs | v1.0 | March 2026*
