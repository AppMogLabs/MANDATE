# MANDATE — Minimum Viable Agent (MVA) Specification v0.2

**App Mog Labs | v0.2 | April 2026**
**Handoff Document for Implementation Agent**

---

## Changelog from v0.1

- Resolved: CORS investigation complete. Anthropic blocked, OpenAI/Gemini allowed. Thin proxy required.
- Resolved: Reference implementation audited. High reusability confirmed. ~400-600 lines of glue code.
- Added: UX visual hierarchy (three-tier) mapped to OODA engagement tiers.
- Added: Sitrep aggregation design for between-session summaries.
- Added: Signing bridge specification (Privy session keys with EOA fallback).
- Moved open questions from "blocking" to "resolve during implementation."

---

## 1. What This Is

The Minimum Viable Agent is the client-side game agent that runs in the player's browser. It implements the tactical OODA loop (Observe → Orient → Decide → Act) every 30 seconds, executing the player's mandate against deployed contracts on MegaETH testnet.

The MVA is the soldier. The player is the general. The sitrep is the communication channel between them.

---

## 2. The General/Soldier Model

The player and the agent form a team operating two coupled OODA loops at different speeds.

**The General (player):**
- Sees the whole battlefield via the dashboard
- Sets the battle plan (mandate) based on strategic pattern recognition
- Does not micromanage individual trades or production claims
- Updates the battle plan when the strategic picture changes
- Occasionally reaches down for a direct order during time-critical moments
- Reads sitreps to assess whether the current plan is working

**The Soldier (agent):**
- Has clear orders (the mandate) and executes them with tactical autonomy
- Makes moment-to-moment decisions within mandate boundaries
- Reports back via sitreps — what it did, why, and what it observed that the general might want to know
- Has confidence that if the strategic picture changes, new orders will come
- Does not second-guess the mandate or try to be the general

**The Sitrep:**
- Not a raw log — it's the soldier's assessment filtered through what matters to the general
- Good sitreps let the player skip straight from Observe to Orient
- Every sitrep is a prompt to orient: "here's what changed — what do you think?"

---

## 3. Two Coupled OODA Loops

### The Agent's Loop (Tactical — every 30 seconds)

```
OBSERVE  → Read chain state via viem: balances, open orders,
           buildings, events, price movements
    ↓
ORIENT   → LLM processes game state against current mandate
           (four-zone prompt: System > Mandate > Game State > External)
    ↓
DECIDE   → LLM proposes actions within mandate parameters
           Returns structured JSON: actions[] + sitrep{}
    ↓
ACT      → Guard validates each action (deterministic TypeScript)
           Approved actions signed via embedded wallet
           Submitted to MegaETH
           Sitrep pushed to dashboard
    ↓
    └──→ [next tick] ──→ OBSERVE
```

### The Player's Loop (Strategic — variable speed)

```
OBSERVE  → Read sitreps + dashboard (Tier 1-2 visual hierarchy)
    ↓
ORIENT   → Interpret: pattern recognition, strategic assessment
           (This is the human's advantage — the agent cannot do this)
    ↓
DECIDE   → Update mandate / Take direct action / Do nothing
    ↓
ACT      → New mandate deployed to agent / TX signed via wallet
    ↓
    └──→ [agent loop continues] ──→ OBSERVE
```

### How the Loops Couple

Each loop's output changes the other loop's input:
- Player's mandate update → changes agent's orientation next tick
- Agent's actions → change game state → appear in next sitrep
- Sitrep → changes what player observes → may trigger mandate update

**The skill gap is orientation speed.** The player who reads the game state better and encodes that read into a mandate before their rival's loop catches up will win.

---

## 4. Three Tiers of Player Engagement

Each tier maps to the OODA loop at different depths AND the three-tier visual hierarchy.

### Tier 1 — The Glance (30 seconds)

**OODA:** Observe only. Quick orient.
**Visual:** Tier 1 header — agent status, AGI Progress Score, critical alerts.
**Player action:** Reads, nods, closes. Or sees alert → pulled into Tier 2.
**Design test:** "Is my strategy working?" answerable in under 2 seconds.

### Tier 2 — The Adjustment (5-15 minutes)

**OODA:** Full Observe → Orient → Decide → Act.
**Visual:** Tier 2 body — sitrep feed, resource balances, market data, mandate editor.
**Player action:** Revises mandate, purchases intelligence, reviews building efficiency.
**Design test:** Player leaves Tier 2 feeling smarter about the game.

### Tier 3 — Deep Play (30+ minutes)

**OODA:** Rapid repeated cycles. Player's loop approaches agent's loop speed.
**Visual:** Tier 3 fine print — OrderBook depth, tx history, building specs, lineage data.
**Player action:** Manual orders, negotiations, guard clause purchases, prediction bets.
**Design test:** The most engaged moments happen when the player *chooses* to get involved.

---

## 5. The Sitrep

Every tick, the LLM produces two outputs: **actions** (what the soldier does) and a **sitrep** (what the soldier reports).

### Response Schema

```json
{
  "actions": [
    {
      "type": "ORDER_PLACE | ORDER_CANCEL | ORDER_MATCH | CLAIM_PRODUCTION | BUILD | DEMOLISH",
      "params": { },
      "reasoning": "One sentence explaining why, referencing the mandate."
    }
  ],
  "sitrep": {
    "summary": "2-3 sentence tactical summary of this tick.",
    "market_conditions": "Brief assessment of resource market state.",
    "alerts": [
      {
        "severity": "critical | warning | info",
        "message": "What the general needs to know.",
        "suggested_action": "Optional recommendation. Recommend but don't decide."
      }
    ],
    "mandate_effectiveness": {
      "actions_attempted": 0,
      "actions_approved": 0,
      "actions_rejected": 0,
      "rejection_reasons": []
    },
    "confidence": "high | medium | low"
  }
}
```

### Action Type → Contract Mapping (P0 Scope)

| Action Type | Contract | Function |
|-------------|----------|----------|
| ORDER_PLACE | OrderBook | placeOrder() |
| ORDER_CANCEL | OrderBook | cancelOrder() |
| ORDER_MATCH | OrderBook | matchOrder() |
| CLAIM_PRODUCTION | BuildingRegistry | claimProduction() |
| BUILD | BuildingRegistry | construct() |
| DEMOLISH | BuildingRegistry | demolish() |

Deferred to P1: MNP_SEND, MNP_RESPOND, REFLEX_EXECUTE.

### Sitrep Design Principles

1. **Lead with the assessment, not the data.** "CHIPS market tightening" beats a list of raw orders.
2. **Flag what changed.** Don't report stable state. Report deltas.
3. **Include reasoning.** "Sold COMPUTE because price exceeded your ceiling of 4.0" — lets the player evaluate their settings.
4. **Surface mandate friction.** If the guard is rejecting frequently, the mandate is too tight.
5. **Recommend but don't decide.** "Consider raising CHIPS priority" — the general gives the orders.

### Sitrep Aggregation (Between Sessions)

When the player returns after being away, they see:
- **Latest sitrep** (most recent tick before agent stopped)
- **Session summary**: total trades, net resource changes, key alerts, notable events (aggregated from all sitreps since last player visit, stored in IndexedDB)
- **Trend indicators**: resource balance charts, price movements
- **Unresolved alerts**: warnings that haven't been addressed by a mandate update

---

## 6. Guard Validation

The guard is deterministic TypeScript running in the Web Worker alongside the agent loop. It is NOT an LLM. It cannot be prompt-injected.

### Validation Order (per proposed action)

1. **Action type permitted?** Check against on-chain allowlist bitmap: `AgentRegistry.validateAction(agent, actionType)` — read-only check before submitting
2. **Mandate constraints satisfied?** Check Layer 2 JSON:
   - Price within floor/ceiling for this resource?
   - Trade size within maximum?
   - Reserve minimum maintained after this trade?
   - Counterparty not on blocked list?
   - Risk tolerance not exceeded?
3. **Balance sufficient?** Check on-chain balance for the proposed spend
4. **Rate limit respected?** Max 5 actions per tick (prevents runaway LLM behaviour)

### On Rejection

- Action is NOT submitted
- Rejection reason recorded in sitrep `mandate_effectiveness`
- Player sees: "Guard rejected ORDER_PLACE for CHIPS — amount exceeded single-trade maximum"
- Frequent rejections signal to the player that their mandate constraints need adjustment

---

## 7. Technical Implementation

### Reusable from Reference Implementation

Confirmed by Claude Code audit of `reference-impl/mandate-agent/`:

| Module | What It Does | Adaptation |
|--------|-------------|------------|
| `decision/engine.ts` | LLM reasoning core | Replace env vars with injected config |
| `decision/prompts.ts` | Four-zone prompt assembly | None |
| `mandate/schema.ts` | Mandate types + validation | None |
| `mandate/hash.ts` | Mandate hashing | None |
| `chain/contracts.ts` | ABI bindings (viem) | None — browser-native |
| `negotiation/types.ts` | MNP message types | None (deferred but types useful) |

### New Code Required (~400-600 lines)

| Component | Purpose |
|-----------|---------|
| Web Worker shell | `setInterval` tick loop, `postMessage` interface with main thread |
| Config injection | Replace `process.env` with object injection via `postMessage` |
| LLM proxy adapter | Route calls through `/api/llm` proxy endpoint instead of direct API |
| Signing bridge | `postMessage` to main thread → Privy signs → result back to worker |
| Sitrep generator | Extract sitrep from LLM response, enrich with guard results, format for dashboard |
| IndexedDB adapter | Store/retrieve sitreps and mandate history |
| Sitrep aggregator | Summarise N sitreps into a session summary for between-visit display |

### LLM Proxy Routing

```
Web Worker                          Proxy                        Provider
    │                                 │                              │
    │  POST /api/llm                  │                              │
    │  { sessionToken,                │                              │
    │    provider: "anthropic",       │                              │
    │    model: "claude-haiku-...",   │                              │
    │    messages: [...] }            │                              │
    │────────────────────────────────→│                              │
    │                                 │  Attach API key from         │
    │                                 │  session memory              │
    │                                 │  POST api.anthropic.com      │
    │                                 │────────────────────────────→│
    │                                 │                              │
    │                                 │  ←── response ──────────────│
    │  ←── response ─────────────────│                              │
```

Anthropic: routed through proxy (CORS blocked).
OpenAI: can go direct or through proxy (player's choice — proxy is safer for key exposure).
Google Gemini: can go direct or through proxy (supports referrer restrictions as alternative).

**Default all providers through the proxy.** Simplifies the Web Worker code (one code path) and protects all API keys.

### Signing Bridge

```
Web Worker                          Main Thread                    MegaETH
    │                                    │                            │
    │  postMessage({                     │                            │
    │    type: 'SIGN_AND_SUBMIT',       │                            │
    │    action: { ... }                │                            │
    │  })                               │                            │
    │──────────────────────────────────→│                            │
    │                                    │  Privy signs tx            │
    │                                    │  (session key, no popup)  │
    │                                    │                            │
    │                                    │  Submit signed tx          │
    │                                    │───────────────────────────→│
    │                                    │                            │
    │                                    │  ←── tx receipt ──────────│
    │  ←── postMessage({ result })──────│                            │
```

---

## 8. P0 Scope (What To Build for Testnet)

### In Scope

| Capability | Contracts | Why Essential |
|-----------|-----------|---------------|
| Resource trading | OrderBook, ResourceTokens, RateToken | Core economic loop |
| Production claiming | BuildingRegistry | Resources come from buildings |
| Building placement | BuildingRegistry, MapRegistry | Player builds infrastructure |
| Tile claiming | MapRegistry | Territory expansion |
| Balance monitoring | All ERC-20s | Agent needs this for decisions |
| Event awareness | EventOracle | Agent adjusts to world events |
| Reputation reading | ReputationLedger | Agent considers counterparty trust |

### Deferred (P1+)

| Capability | Why Deferred |
|-----------|-------------|
| MNP negotiations | Needs multiplayer or NPCs |
| Guard Clause Marketplace | Advanced feature |
| Prediction markets | Information economy layer |
| Insurance/hedging | Financial instruments layer |
| Echo oracles | Espionage layer |
| DATA lineage/purity | Espionage layer |
| Compliance drift | Role-specific mechanic |
| COOLING relay | Multiplayer mechanic |
| Reflex responses | Needs active event engine |

### Acceptance Criteria

The MVA is "done" when a player can:
1. Write a mandate in the editor
2. Watch their agent execute trades and claim production over multiple ticks
3. Read sitreps that explain what the agent did and why
4. Adjust the mandate based on sitrep feedback
5. See the agent's behaviour change in the next tick cycle
6. Take a direct action (e.g., place a manual order) and see the agent not duplicate it
7. Close the browser, reopen, and see a session summary of what happened

---

## 9. Agent Awareness of Direct Player Actions

When the player takes a direct action (manual order, claim tile, etc.), the agent sees the results in the next tick's chain state read. The Zone 1 system prompt must include:

```
IMPORTANT: The player (your commanding officer) may take direct actions 
between your tick cycles. You will see the results in the game state — 
new orders, changed balances, new buildings. These are deliberate 
decisions by the player. Do not duplicate, counteract, or second-guess 
them. Treat direct player actions as having the same authority as the 
mandate itself. If a direct action appears to conflict with the mandate, 
the direct action takes precedence — the player knows something you don't.
```

---

## 10. Error Handling

| Error | Behaviour | Player Notification |
|-------|-----------|-------------------|
| LLM call fails (bad key, rate limit) | Skip tick, retry next tick | "Agent paused — LLM call failed. Check API key." |
| LLM returns unparseable response | Skip tick, log anomaly | "Agent skipped a cycle — couldn't understand LLM response." |
| Guard rejects all actions | Log rejections, continue next tick | "Guard rejected all proposed actions this tick. Your mandate constraints may need adjustment." (Show rejection reasons) |
| On-chain revert | Log revert reason | "Transaction reverted — [reason]. This may indicate insufficient balance or a permission issue." |
| Wallet signing fails | Skip action, continue tick | "Couldn't sign transaction. Check wallet connection." |
| Browser tab hidden | Reduce tick frequency to 60s | None (transparent optimisation) |

---

## 11. Implementation Priority

### Phase A — Core Loop (MVP)

1. Web Worker shell with tick loop
2. Port `decision/engine.ts` and `decision/prompts.ts` from reference-impl
3. Port `chain/contracts.ts` (viem ABI bindings)
4. LLM proxy integration
5. Basic guard validation (allowlist + balance check)
6. Signing bridge to main thread → Privy
7. Basic sitrep output (postMessage to main thread)

**Test:** Agent executes one tick, action appears on Blockscout.

### Phase B — Sitrep & Dashboard

8. Sitrep generator (parse LLM response, enrich with guard results)
9. Sitrep feed UI component (Tier 2)
10. Resource bar with deltas (Tier 2)
11. IndexedDB storage for sitreps
12. Alert system (critical/warning/info)

**Test:** Player sees sitreps appearing in real-time as agent executes ticks.

### Phase C — Mandate Editor & Direct Actions

13. Mandate editor: Layer 1 text + Layer 2 constraint form
14. Mandate deployment: postMessage to Web Worker
15. Direct action panel (manual orders, claim production)
16. Mandate history (IndexedDB)

**Test:** Player writes mandate, agent behaviour changes. Player places manual order, agent doesn't duplicate it.

### Phase D — Polish

17. Sitrep aggregation (session summaries)
18. Three-tier visual hierarchy enforcement
19. Tier 3 drill-down panels (OrderBook depth, tx history)
20. Agent status indicator in Tier 1 header
21. Error handling UX (all cases from §10)

**Test:** Full testnet experience is playable and visually coherent.
