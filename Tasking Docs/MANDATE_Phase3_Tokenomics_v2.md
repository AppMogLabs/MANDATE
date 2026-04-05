# MANDATE — Phase 3: Tokenomics Specification

**App Mog Labs | v2.0 | March 2026**  
**Status:** Complete — all parameters resolved, simulation validated  
**Supersedes:** v1.0 and all PHASE_3_PLACEHOLDER values in the codebase

---

## Changelog: v1.0 → v2.0

**Claude Code: read this section first. These are changes made after v1.0 was delivered. If you implemented v1.0, the following items need to be updated, removed, or added.**

### Removed from Active Scope

1. **HedgeFactory** — Removed entirely. Parametric hedges are redundant with PredictionMarket (AMM provides liquidity without needing a counterparty). Contract remains in codebase but should not be deployed or configured. Remove from deployment scripts. Its three placeholder parameters (TWAP_WINDOW, MIN_STAKE, MAX_PAYOUT_MULTIPLIER) are no longer Phase 3 scope.

2. **OrderBook Lease Swaps** — Removed entirely. With 28-day epoch resets, building demolition, and top-20% resource carry-over, temporary resource lending has no strong use case. Bottom-80% players reset to zero at epoch boundary, making cross-epoch leases near-certain defaults. Top-20% already have resources. Straight OrderBook trades cover the same need. Remove lease swap functions from OrderBook or leave dormant. Its three placeholder parameters (MIN_LEASE_EPOCHS, MIN_REP_PENALTY_BPS, epoch duration for lease expiry) are no longer Phase 3 scope.

### Added

3. **GuardClauseMarketplace two-tier model** — Templates can be listed with or without passing `validateTemplate()`. Listings that pass validation get a `verified` flag. Listings that don't pass are still listed but marked unverified. Add a `bool verified` field to the template struct. `listTemplate()` should attempt validation and store the result, not reject unverified listings.

4. **InsurancePool mechanic clarification + fix** — `triggerClaim()` must only pay policyholders who were actually affected by the specific COOLING cascade event. Wire InsurancePool to read CoolingRelay propagation events. Currently pays ALL active policyholders regardless of whether they were affected.

5. **Phase 4 flagged items (3 new mechanics documented for future implementation):**
   - Echo Verification and Auditor Role (Section 16) — self-verification + challenger bounties for MandateEchoOracle reliability scoring
   - LineageLedger Redesign (Section 16) — vulnerability window mechanic replacing the current manual poison boolean. 4-hour window after DATA transfers, covert poisoning, purity-to-production-efficiency connection
   - Both are documented in detail but NOT to be implemented in Phase 3

### Changed

6. **Daily drip increased** — from 2,500 to 4,500 RATE per active player per day (faucet must cover ~90% of premium spending since there is no DEX at launch)

---

## 1. Economic Model

RATE is a microtransaction premium currency. The core game — building, producing, trading, competing — is free to play. RATE buys premium features that improve information, speed, and strategic positioning. Each purchase feels trivial. Aggregate spending is meaningful.

RATE has zero initial supply. All RATE enters circulation through gameplay: daily activity drips and one-time milestone bonuses, all freshly minted. There is no pre-minted supply, no liquidity pool at launch, no financial on-ramp, and no team allocation. The token starts with zero monetary value. If a secondary market forms organically later, that is community-driven, not protocol-facilitated.

**Design philosophy:** RATE should feel like API tokens. Players don't think about spending them individually, but notice when they run out and need to claim more.

---

## 2. RATE Token

| Parameter | Value |
|---|---|
| Initial supply | 0 (zero pre-mint) |
| Total supply cap | None (uncapped) |
| Ongoing mint | Gameplay faucet + milestone bonuses |
| Burn mechanisms | Subscriptions, tile rent, CLEARANCE fees, premium features, prediction market platform fees |
| Net supply direction | Inflationary early (accumulation), stabilises as burns approach mint rate |

### Supply Projection (100 active players)

| Epoch | Cumulative Minted | Estimated Burns | Net Circulating |
|---|---|---|---|
| 1 | ~16,600,000 | ~4,700,000 | ~11,900,000 |
| 2 | ~33,200,000 | ~14,000,000 | ~19,200,000 |
| 3 | ~49,800,000 | ~28,000,000 | ~21,800,000 |
| 4+ (steady state) | +16,600,000/epoch | ~14,000,000/epoch | Grows ~2.6M/epoch |

---

## 3. Epoch Structure

| Parameter | Value |
|---|---|
| Duration | 28 days (2,419,200 seconds) |
| Start | Roles assigned, starting positions set |
| End | Winner declared by AGI Progress Score |
| Winner determination | Composite of resource stack, building tiers, intelligence network strength, processing chain completion |

### Carry-Over Rules

| Element | Rule |
|---|---|
| Reputation (all 4 signals) | Full carry-over, all players |
| RATE balance | Full carry-over, all players |
| Resources (top 20% by reputation) | 50% of balances carry over |
| Resources (bottom 80%) | Reset to zero |
| Buildings | All demolished — forces rebuild every epoch |
| Tiles | All released — fresh land grab each epoch |
| OrderBook orders | Cancelled, escrow returned |
| Insurance policies | Expired, pool reset |
| Prediction markets | Resolved or voided |

---

## 4. Gameplay Faucet

### Daily Drip

| Parameter | Value |
|---|---|
| Amount | 4,500 RATE per active player per day |
| Qualification | ≥ 1 on-chain action in past 24 hours |
| Source | Freshly minted via EpochRewardManager |

### Milestone Bonuses (one-time per player per epoch, freshly minted)

| Milestone | Reward (RATE) |
|---|---|
| First building constructed | 5,000 |
| First OrderBook trade | 2,000 |
| First Training Cluster built | 10,000 |
| First Deployed Model operational | 20,000 |
| Survived full epoch (active in final week) | 10,000 |
| Epoch winner (1st place) | 500,000 |
| 2nd place | 200,000 |
| 3rd place | 100,000 |
| Top 10 finish | 50,000 |

---

## 5. Premium Feature Pricing

All prices are protocol-level defaults (floors). Player-to-player intelligence trades at market rates on the OrderBook. All premium feature payments are burned permanently.

| Feature | Cost (RATE) | Notes |
|---|---|---|
| Purity scan | 200 | Per query |
| Analyst intel peek | 150 | Per access |
| Premium intelligence | 1,000 | Daily access (replaces 30-day subscription) |
| Drift forecast | 100 | Per 30-block forecast |
| Prediction market stake | 500 | Escrowed, returned to winner |
| Insurance premium | Dynamic | Bonding curve pricing |

---

## 6. Tile Rent

### Escalating Rent Curve (burned permanently)

| Tiles Held | Per-Tile Daily Rent (RATE) | Multiplier |
|---|---|---|
| 1–3 | 100 | 1.0× |
| 4–5 | 150 | 1.5× |
| 6–10 | 250 | 2.5× |
| 11–15 | 500 | 5.0× |
| 16–20 | 1,000 | 10.0× |

### Grace Period

3 days unpaid before auto-release. Buildings on unpaid tiles are demolished. Grace period resets on full payment including accumulated debt.

---

## 7. Resource Production

### Differentiated Production Rates (per hour, tier 1)

| Resource | Building | Rate | Personality |
|---|---|---|---|
| COMPUTE | Data Centre | 5.0 | Fast, fungible, abundant |
| COMPUTE | Deployed Model | 8.0 | Premium (processing chain reward) |
| ENERGY | Power Plant | 4.0 | Universal bottleneck |
| ENERGY | Solar Array | 2.5 | Cheaper build, lower output |
| CHIPS | Fabrication Contract | 1.5 | Deliberately scarce |
| COOLING | Cooling Infrastructure | 3.0 | Moderate |
| TALENT | Recruiting Pipeline | 1.2 | Deliberately scarce |
| DATA | Data Acquisition Hub | 3.5 | Moderate |
| CLEARANCE | Lobbying Office | 2.0 | Political capital |
| CLEARANCE | Patent Portfolio | 3.0 | Premium (IP protection reward) |

### Tier Multipliers

| Tier | Multiplier |
|---|---|
| 1 | 1.0× |
| 2 | 1.5× |
| 3 | 2.25× |

---

## 8. Resource Upkeep

### TALENT Upkeep

| Parameter | Value |
|---|---|
| TALENT_REQUIREMENT_PER_HOUR | 0.5 per building |
| Support ratio | 1 Recruiting Pipeline (1.2/hr) supports ~2.4 buildings |
| Insufficient TALENT | Worker efficiency degrades linearly to 10% floor |

### ENERGY Upkeep (new mechanism)

| Parameter | Value |
|---|---|
| ENERGY_REQUIREMENT_PER_HOUR | 0.3 per building |
| Support ratio | 1 Power Plant (4.0/hr) supports ~13 buildings |
| Insufficient ENERGY | Energy efficiency degrades linearly to 10% floor |
| Combined efficiency | min(talentEfficiency, energyEfficiency) |

---

## 9. Processing Chain Input Burns

### Training Cluster (per hour of operation)

| Input | Burn Rate |
|---|---|
| COMPUTE | 2.0 |
| DATA | 1.5 |

### Alignment Lab (per hour of operation)

| Input | Burn Rate |
|---|---|
| COMPUTE | 1.5 |
| DATA | 1.0 |
| ENERGY | 0.5 |

---

## 10. Reputation System

### Signal Weights

| Signal | Weight | Decay |
|---|---|---|
| Deal completion rate | 3000 (30%) | Exponential toward 5000, 0.001 bps/sec (~58 days to neutral) |
| Disinformation score | 3000 (30%) | Exponential toward 5000, 0.001 bps/sec |
| Anomaly count | 2500 (25%) | None (permanent) |
| Age/activity | 1500 (15%) | None (monotonic) |

### Normalization

| Parameter | Value |
|---|---|
| Anomaly cap | 100 anomalies = worst score |
| Activity cap | 1000 actions = maximum score |

### Composite Calculation

```
composite = (dealRate × 3000 + invertedDisinfo × 3000 + normalizedAnomaly × 2500 + normalizedActivity × 1500) / 10000
```

---

## 11. Intelligence Layer Parameters

### GuardClauseMarketplace

| Parameter | Value |
|---|---|
| COMPUTE_PRICE_FLOOR | 50 COMPUTE |
| ACTIVATION_BONUS_BPS | 300 (3% deal completion bonus to seller) |
| ACTIVATION_PENALTY_SELLER_BPS | 300 (3% on incorrect activation) |
| ACTIVATION_PENALTY_BUYER_BPS | 100 (1% on incorrect activation) |
| ACTIVATION_CLEARANCE_FEE_BPS | 100 (1% CLEARANCE burn per activation) |
| SELF_BUY_COOLDOWN_MS | 300 ms |

### Two-Tier Marketplace Model

The GuardClauseMarketplace supports two tiers of product in the same marketplace:

**Unverified skills (cheaper, knowledge-based):** Any player can list a strategy template — a structured description of their approach to a specific scenario. These do not need to pass `validateTemplate()`. Cheap to list at the 50 COMPUTE floor. The buyer gets strategic knowledge but must implement it in their mandate manually. The seller's reputation is the only quality signal. New players start here and build their track record over time.

**Verified executable clauses (premium, validated):** Experienced players submit bytecode-validated templates that pass `validateTemplate()` — the 8-opcode, whitelisted-calls, gas-capped format. These are flagged as "verified" in the marketplace. They cost more because they're proven logic and (in Phase 4) will be automatically executable by the buyer's agent during reflex windows. High-reputation sellers with strong activation success rates command premium prices.

Both tiers use the same `listTemplate()` function. The difference is whether the template passes `validateTemplate()` — if it does, the listing is marked as verified. If not, it's still listed but marked unverified. Buyers can filter by verification status and seller reputation.

Pricing is market-determined above the 50 COMPUTE floor. Verified templates from high-reputation sellers naturally command higher prices. Unverified skills from new players sell cheap. Over time, a player who consistently sells effective unverified skills builds enough reputation to start submitting verified templates at higher prices.

No code changes required — the existing contract supports both paths. `validateTemplate()` is validation, not a listing gate. The implementation handoff should clarify that listing must work with or without passing validation, and that a `verified` flag should be stored alongside the template for buyer filtering.

### ComplianceDriftOracle

| Parameter | Value |
|---|---|
| MAX_DELTA_PERCENT | 10 (±10% per publish) |
| MIN_PUBLISH_INTERVAL_MS | 200 ms |
| RECALIBRATION_BURN_BPS | 200 (2% CLEARANCE burn on non-self recalibration) |

### CoolingRelay

| Parameter | Value |
|---|---|
| JOIN_LOCKUP_MS | 500 ms |
| EXIT_DELAY_MS | 2000 ms |
| PROPAGATION_CHANCE_BPS | 2000 (20% per edge) |
| REFLEX_QUEUE_DELAY_MS | 150 ms |
| MAX_CASCADE_DEPTH | 3 hops (new — bounds cascade damage) |

---

## 12. Financial Instruments

### InsurancePool

| Parameter | Value |
|---|---|
| BASE_PREMIUM_BPS | 500 (5%) |
| UNSTAKE_COOLDOWN | 86,400 seconds (24 hours) |
| MIN_SOLVENCY_RATIO_BPS | 12000 (120%) |

**How it works:**

The InsurancePool protects players against COOLING cascade damage — failures that propagate from other players' nodes through the relay graph.

Two roles interact with the pool:

**Policyholders** buy protection. A player connected to a COOLING relay graph calls `purchasePolicy()`, specifying coverage amount (e.g. 10,000 RATE) and duration (e.g. 7 days). The contract calculates the premium via bonding curve — at 5% base rate with low utilisation, 7 days of 10,000 RATE coverage costs roughly 960 RATE. The premium is paid upfront and goes into the pool's reserves.

**Underwriters** provide the capital that backs policies. They call `stake()` to deposit RATE into the pool. Their staked capital covers payouts when claims trigger. In return, they earn a share of accumulated premiums. Underwriting is a bet that claims will be rare — if COOLING cascades are infrequent, underwriters profit from premiums exceeding payouts. If cascades are frequent, underwriters lose staked capital.

**When a COOLING cascade hits:** The operator calls `triggerClaim()`. The contract identifies affected policyholders and pays their coverage amount from the underwriters' staked capital. Underwriters' `totalStaked` decreases by the total payout.

**The 24-hour unstake cooldown** prevents underwriters from seeing a cascade developing and withdrawing their capital before claims fire. Once you stake, you're committed for at least one full check-in cycle.

**Implementation fix required:** The current `triggerClaim()` pays ALL active policyholders regardless of whether they were affected by the specific COOLING event. This must be changed — only players whose nodes actually received propagation from the CoolingRelay should be eligible for payout. The InsurancePool needs to read from CoolingRelay's propagation events to determine which addresses were affected. Without this fix, every event drains the entire pool, making underwriting unviable.

### ~~HedgeFactory~~ (Removed from Active Scope)

The HedgeFactory is dormant. Parametric hedges are functionally redundant with the PredictionMarket, which provides better liquidity (AMM vs requiring a counterparty), flexible entry/exit (buy/sell outcome tokens anytime vs binary create/settle), and information utility (prediction prices feed guard clause activation conditions). The HedgeFactory contract remains in the codebase but is not deployed, not configured, and not part of the active economy. Its three placeholder parameters (TWAP_WINDOW, MIN_STAKE, MAX_PAYOUT_MULTIPLIER) are no longer Phase 3 scope.

### PredictionMarket

| Parameter | Value |
|---|---|
| INITIAL_LIQUIDITY | 10,000 RATE (provided by market creator) |
| PLATFORM_FEE_BPS | 100 (1%) |

### ~~OrderBook Lease Swaps~~ (Removed from Active Scope)

Lease swaps are dormant. With 28-day epochs, building resets, and top-20% resource carry-over, the temporary resource lending mechanic lacks a strong use case. The bottom 80% of players reset to zero at epoch boundary, making cross-epoch leases near-certain defaults. The top 20% already start with 50% resources and don't need leases. Straight resource-for-resource or resource-for-RATE trades on the OrderBook cover the same need without the complexity. The lease swap code remains in the OrderBook contract but is not deployed or configured. Its three placeholder parameters (MIN_LEASE_EPOCHS, MIN_REP_PENALTY_BPS, epoch duration for lease expiry) are no longer Phase 3 scope. The epoch duration parameter (2,419,200 seconds / 28 days) still applies to the EpochManager contract.

---

## 13. InformationMarket Pricing Update

The 30-day subscription model is replaced with daily access pricing.

| Tier | Price | Duration |
|---|---|---|
| Free | 0 | Always |
| Analyst | 150 RATE | Daily |
| Premium | 1,000 RATE | Daily |

---

## 14. Simulation Results

Five scenarios tested across 12 epochs (1 year) with 100 players.

| Scenario | RATE Supply | CLEARANCE Floor | Insurance Solvency | Composite Rep |
|---|---|---|---|---|
| Balanced Play | ~45M | ~336 | ~300% | ~4800 |
| Aggressive Compute | ~38M | ~200 | ~250% | ~4600 |
| DATA Poison Cartel | ~40M | ~300 | ~280% | ~3500 |
| Dense COOLING | ~42M | ~320 | ~64% | ~4700 |
| Low Activity (30 players) | ~13M | ~340 | ~300% | ~4800 |

**Key findings:**
1. CLEARANCE supply holds under all scenarios. Production exceeds burns.
2. Reputation degrades gracefully. No single attack vector destroys overall trust.
3. COOLING cascades bounded by 3-hop cap. Dense graphs under heavy failure intentionally bankrupt insurance — this is the designed catastrophe.
4. RATE supply stabilises after epoch 3. No runaway inflation or deflation.
5. No death spirals detected in any scenario.

---

## 15. Complete Placeholder Resolution

### Parameters Changed (from existing placeholders)

| Contract | Parameter | Old | New |
|---|---|---|---|
| RateToken | INITIAL_SUPPLY | 1,000,000 × 1e18 | 0 |
| BuildingRegistry | BASE_PRODUCTION_RATE | 100 × 1e18 (single) | Per-building-type mapping |
| BuildingRegistry | TALENT_REQUIREMENT_PER_HOUR | 10 × 1e18 | 0.5 × 1e18 |
| BuildingRegistry | Processing burn rates | 1C + 1D / hour | 2C + 1.5D (Training), 1.5C + 1D + 0.5E (Alignment) |
| InformationMarket | SUBSCRIPTION_DURATION | 30 days | 1 day |
| InformationMarket | ANALYST_PRICE | 100 × 1e18 | 150 × 1e18 |
| InformationMarket | PREMIUM_PRICE | 500 × 1e18 | 1,000 × 1e18 |
| InsurancePool | UNSTAKE_COOLDOWN | 500 seconds | 86,400 seconds |
| PredictionMarket | INITIAL_LIQUIDITY | 1,000 × 1e18 | 10,000 × 1e18 |
| ReputationLedger | WEIGHT_DEAL_RATE | 2500 | 3000 |
| ReputationLedger | WEIGHT_DISINFO | 2500 | 3000 |
| ReputationLedger | WEIGHT_ACTIVITY | 2500 | 1500 |
| ReputationLedger | DECAY_RATE_PER_SECOND | 1 | 0.001 |
| GuardClauseMarketplace | COMPUTE_PRICE_FLOOR | 500 | 50 |

### Parameters Unchanged

| Contract | Parameter | Value |
|---|---|---|
| OrderBook | MIN_ORDER_AMOUNT | 1e15 |
| BuildingRegistry | MIN_WORKER_EFFICIENCY | 1000 bps |
| InsurancePool | BASE_PREMIUM_BPS | 500 |
| InsurancePool | MIN_SOLVENCY_RATIO_BPS | 12000 |
| PredictionMarket | PLATFORM_FEE_BPS | 100 |
| ReputationLedger | WEIGHT_ANOMALY | 2500 |
| ReputationLedger | ANOMALY_NORMALIZATION_CAP | 100 |
| ReputationLedger | ACTIVITY_NORMALIZATION_CAP | 1000 |
| LineageLedger | POISON_BURN_BPS | 500 |
| GuardClauseMarketplace | ACTIVATION_BONUS_BPS | 300 |
| GuardClauseMarketplace | ACTIVATION_PENALTY_SELLER_BPS | 300 |
| GuardClauseMarketplace | ACTIVATION_PENALTY_BUYER_BPS | 100 |
| GuardClauseMarketplace | ACTIVATION_CLEARANCE_FEE_BPS | 100 |
| GuardClauseMarketplace | SELF_BUY_COOLDOWN_MS | 300 |
| ComplianceDriftOracle | MAX_DELTA_PERCENT | 10 |
| ComplianceDriftOracle | MIN_PUBLISH_INTERVAL_MS | 200 |
| ComplianceDriftOracle | RECALIBRATION_BURN_BPS | 200 |
| CoolingRelay | JOIN_LOCKUP_MS | 500 |
| CoolingRelay | EXIT_DELAY_MS | 2000 |
| CoolingRelay | PROPAGATION_CHANCE_BPS | 2000 |
| CoolingRelay | REFLEX_QUEUE_DELAY_MS | 150 |

### New Parameters (must be added to code)

| Contract | Parameter | Value |
|---|---|---|
| BuildingRegistry | ENERGY_REQUIREMENT_PER_HOUR | 0.3 × 1e18 |
| BuildingRegistry | buildingProductionRate[type] | Per-building mapping (see Section 7) |
| BuildingRegistry | Deployed Model output | COMPUTE at 8.0/hr |
| BuildingRegistry | Patent Portfolio output | CLEARANCE at 3.0/hr |
| CoolingRelay | MAX_CASCADE_DEPTH | 3 |
| MapRegistry/RentCollector | BASE_TILE_RENT_DAILY | 100 RATE |
| MapRegistry/RentCollector | RENT_GRACE_PERIOD | 259,200 seconds (3 days) |
| EpochRewardManager | DAILY_DRIP_AMOUNT | 4,500 RATE |
| EpochRewardManager | Milestone rewards | See Section 4 |
| EpochManager | EPOCH_DURATION | 2,419,200 seconds (28 days) |

### New Contracts Required

| Contract | Purpose |
|---|---|
| EpochRewardManager | Faucet drip + milestone distribution. Mints RATE via MINTER_ROLE. |
| RentCollector | Escalating tile rent. Burns RATE. Grace period + auto-release. |
| EpochManager | Epoch lifecycle: start, end, role assignment, carry-over, reset. |

### Implementation Changes Required

| Change | Contract |
|---|---|
| Replace single BASE_PRODUCTION_RATE with per-building-type mapping | BuildingRegistry |
| Add ENERGY upkeep mechanism (_burnEnergyUpkeep) | BuildingRegistry |
| Add Deployed Model → COMPUTE and Patent Portfolio → CLEARANCE outputs | BuildingRegistry |
| Creator-funded liquidity (transfer from msg.sender) | PredictionMarket |
| Add MAX_CASCADE_DEPTH enforcement | CoolingRelay |
| Wire reputation bonus on successful activation | GuardClauseMarketplace |
| Wire anomaly increment on incorrect activation | GuardClauseMarketplace |
| Connect epoch counter to EpochManager | GuardClauseMarketplace |
| Gate getDriftForecast() on InformationMarket tier | ComplianceDriftOracle |
| Build SupplyChainRegistry or wire recalibration directly | ComplianceDriftOracle |
| Update signal weights to 3000/3000/2500/1500 | ReputationLedger |
| Update decay rate to 0.001 | ReputationLedger |
| Change subscription model to daily access | InformationMarket |
| Set INITIAL_SUPPLY to 0 | RateToken |
| Fix triggerClaim() to only pay affected policyholders (read CoolingRelay propagation events) | InsurancePool |
| Add verified flag to template listings (pass/fail validateTemplate stored on listing) | GuardClauseMarketplace |
| Allow listing without passing validateTemplate (unverified tier) | GuardClauseMarketplace |

---

## 16. Phase 4 Flagged Items

The following mechanics were designed during Phase 3 tokenomics work but are Phase 4 (Agent Interaction Layer) deliverables. They are documented here for continuity.

### Echo Verification and Auditor Role

The MandateEchoOracle's reliability score currently has no update mechanism. Phase 4 must implement the following flow:

**Self-verification:** After a world event resolves, the echo publisher has 24 hours to reveal the plaintext behind their hash. The contract verifies: (a) the reveal matches the hash, and (b) the agent's actual OrderBook trades in the 60-second post-event window match the revealed intent. If both match, the publisher's deal completion signal improves by 200 bps.

**Challenger mechanism:** If the publisher does not self-verify within 24 hours, premium-tier subscribers can submit a challenge proving a mismatch between the published echo and the agent's actual on-chain activity. Valid challenges:
- Worsen the publisher's disinformation signal by 500 bps
- Transfer 500 RATE from the publisher to the challenger as a bounty
- Invalid challenges (no actual mismatch) cost the challenger 200 RATE (spam prevention)

**The auditor role:** This creates a new player archetype — the auditor. Their gameplay loop: pay for premium subscription (1,000 RATE/day), monitor all published echoes, catch dishonest publishers, earn bounties. At ~2 valid challenges per day, the role breaks even on subscription costs. More dishonesty in the ecosystem makes auditing more profitable, which attracts more auditors, which deters dishonesty. Self-regulating.

**Parameters (Phase 4):**

| Parameter | Value |
|---|---|
| Self-verification window | 24 hours (86,400 seconds) after event resolution |
| Successful self-verification bonus | +200 bps deal completion signal |
| Valid challenge penalty (publisher) | -500 bps disinformation signal |
| Challenge bounty (publisher → challenger) | 500 RATE |
| Invalid challenge cost (challenger) | 200 RATE |
| Premium subscription required to challenge | Yes |

**Implementation notes:**
- Requires reading OrderBook trade history from AuditLog for the 60-second post-event window
- Hash comparison logic: agent reveals plaintext, contract hashes it and compares to stored commitment
- Challenge verification: contract compares revealed intent (or inferred from hash pattern) against actual trades
- RATE bounty transfer requires MandateEchoOracle to hold escrow or call RateToken.transferFrom() on the publisher

### Other Phase 4 Items (from Annex)

These items were already documented in the Phase 2 Annex and remain Phase 4 scope:

- **Guard-agent bytecode parser:** Converts purchased GuardClauseMarketplace templates into executable conditional bytecode within the agent's context window.
- **Reflex pre-approval workflow:** Guard agent pre-signs reflex actions that the agent can submit during a window without a separate guard round-trip.
- **Agent negotiation protocol:** Off-chain bilateral negotiation with on-chain atomic settlement.

### LineageLedger Redesign — Vulnerability Window Mechanic

The current LineageLedger implementation is a standalone contract with no mechanical connection to DATA token flows. Players manually call `ingestWithParent()` with a poison boolean — there is no reason to use it, no connection to actual DATA transfers, and nothing covert about the poison flag on a public blockchain.

Phase 4 must redesign the LineageLedger around a vulnerability window mechanic:

**How it works:**

1. A DATA token transfer occurs — player buys DATA on OrderBook or claims production from Data Acquisition Hub.
2. The transfer automatically opens a 4-hour vulnerability window on the receiver's address. The LineageLedger records the transfer and starts a countdown.
3. During the 4-hour window, any rival can call `poisonPipeline(address target)` on the LineageLedger. This costs the attacker 5% of their disinformation reputation score (burned). The target's purity score drops.
4. After 4 hours, the window closes. The DATA is "processed" and can no longer be poisoned.
5. The target does not know their pipeline was poisoned unless they pay for a premium purity scan (200 RATE).
6. When the target's Training Cluster claims production, the contract checks their purity score. Low purity = degraded output. The same COMPUTE and DATA tokens are burned, but the model produced is worse.

**Gameplay dynamics:**

- **Receiver:** Knows there's a 4-hour window after every DATA acquisition. Can pay for a purity scan before feeding data into a Training Cluster. Creates a cost-benefit decision: spend 200 RATE to check, or risk it?
- **Attacker:** Monitors OrderBook and production claims for DATA transfers. Has 4 hours to act. Costs 5% disinformation reputation — a real price. Must decide if sabotaging this rival is worth the permanent reputation damage.
- **Premium subscriber:** Can see contamination events. Can sell the information ("your DATA was poisoned") to the victim for RATE, creating an intelligence broker role.

**Integration with BuildingRegistry:**

Training Cluster and Alignment Lab `claimProduction()` must check the caller's purity score from the LineageLedger and apply it as an efficiency multiplier. A purity score of 100 (clean) = full output. A purity score of 50 = 50% output. Score of 0 = zero useful output.

**Parameters (Phase 4):**

| Parameter | Value |
|---|---|
| Vulnerability window duration | 4 hours (14,400 seconds) |
| Poison cost (attacker) | 500 bps (5%) of disinformation reputation, burned |
| Starting purity score | 50 (neutral — must be earned up to 100) |
| Maximum purity score | 100 |
| Minimum purity score | 0 |
| Purity impact per poison event | -20 points |
| Purity gain per clean training run | +5 points |
| Purge action (burn DATA tokens to restore purity) | +15 points, costs DATA tokens equal to one training cycle |
| Purity scan cost | 200 RATE (existing premium feature price) |
| Training Cluster efficiency modifier | Output × (purityScore / 100) |

**Purity recovery is active, not passive.** Score does not recover over time. It recovers by processing clean DATA (successful training runs that were not poisoned) or by purging contaminated data (burning DATA tokens for immediate partial recovery). This creates additional DATA token demand — poisoned players must acquire fresh DATA to rebuild their pipelines, driving OrderBook trading volume and benefiting Data-Rich State players who control DATA supply.

**Implementation notes:**

- LineageLedger needs a hook into DATA token transfers. Either override ResourceToken's `_update()` for the DATA token to call LineageLedger, or use an event-listener pattern where the LineageLedger reads DATA Transfer events.
- Vulnerability windows tracked via `mapping(address => uint256) windowExpiry` — set to `block.timestamp + 14400` on each DATA transfer.
- `poisonPipeline()` checks that `block.timestamp < windowExpiry[target]` before allowing the action.
- BuildingRegistry's `claimProduction()` for Training Cluster and Alignment Lab must call `LineageLedger.getPurityScore(msg.sender)` and multiply output accordingly.
- Purity score recovery happens at epoch boundary via EpochManager.

---

*MANDATE Phase 3: Tokenomics Specification | App Mog Labs | v2.0 | March 2026*
