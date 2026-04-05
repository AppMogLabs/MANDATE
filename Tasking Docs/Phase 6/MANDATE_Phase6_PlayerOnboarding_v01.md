# MANDATE — Phase 6: Player Onboarding & Game Client Architecture

**App Mog Labs | v0.1 | April 2026**
**Handoff Document for Implementation Agent**

---

## 1. Purpose

This document specifies everything between "a person hears about MANDATE" and "their agent executes its first tick." It covers authentication, wallet provisioning, on-chain registration, role selection, the client-side agent runtime, the LLM proxy, the dashboard/sitrep UI, the mandate editor, and direct player actions.

Phase 6 is the player-facing layer. Phases 1-4 built the game mechanics, contracts, tokenomics, and agent protocol. Phase 5 specified server-side agent hosting for persistent 24/7 agents (a future upgrade). Phase 6 builds the **testnet-playable game client** that runs in the browser.

### What This Document Covers

- Player authentication and embedded wallet (Privy)
- On-chain registration (agent NFT, starter resources, role assignment)
- LLM proxy (thin pass-through for Anthropic CORS limitation)
- Client-side agent runtime (Web Worker — the MVA)
- Dashboard and sitrep UI (three-tier visual hierarchy)
- Mandate editor
- Direct player actions
- Integration with deployed contracts on MegaETH testnet

### What This Document Does NOT Cover

- Smart contract changes (none — all contracts are deployed and final)
- Server-side persistent agent hosting (that's Phase 5, a future upgrade)
- NPC agents (separate spec, needed for single-player but architecturally independent)
- Map UI (separate handoff document already delivered)
- LLM prompt engineering (Zone 1 system prompt content is a separate workstream)

---

## 2. The Player Journey

```
Person hears about MANDATE
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  1. ARRIVE                                           │
│     - Landing page or direct link to app             │
│     - Click "Play"                                   │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  2. AUTHENTICATE                                     │
│     - Social login: Google, email, or Discord        │
│     - Privy embedded wallet created invisibly         │
│     - Player never sees an address or seed phrase     │
│     - Gas sponsorship active — player never pays gas  │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  3. REGISTER ON-CHAIN                                │
│     - Backend calls PlayerOnboarding contract        │
│     - Atomic: mint agent NFT (ERC-8004 soulbound)   │
│       + mint starter RATE + mint starter resources    │
│       + set default allowlist bitmap                  │
│     - Player is now an on-chain entity                │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  4. SELECT ROLE                                      │
│     - Choose sovereign power (1 of 5)                │
│     - Terminal boot cinematic (skippable)             │
│     - RoleRegistry updated on-chain                   │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  5. LLM SETUP                                        │
│     - Player enters API key (Anthropic/OpenAI/Google)│
│     - OR selects free tier (MANDATE-funded Haiku)    │
│     - Key stored in sessionStorage only               │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  6. MANDATE MASTERY (tutorial)                       │
│     - Brief interactive tutorial on writing mandates │
│     - Player writes their first mandate              │
│     - Three layers explained with examples            │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│  7. AGENT ACTIVATES                                  │
│     - Web Worker starts the agent loop               │
│     - First tick: reads chain state, calls LLM,      │
│       proposes actions, guard validates, submits      │
│     - First sitrep appears on dashboard               │
│     - Player is now playing MANDATE                   │
└─────────────────────────────────────────────────────┘
```

Total time from "Click Play" to "Agent executing": target under 3 minutes.

---

## 3. Authentication — Privy Embedded Wallet

### Why Privy

Blockchain must be invisible. The player never sees a wallet address, never installs an extension, never manages a seed phrase. Privy creates a non-custodial embedded wallet behind a social login. MANDATE never holds the player's keys.

### Integration

Privy provides a React SDK. The frontend already uses React.

```
npm install @privy-io/react-auth
```

### Login Flow

1. Player clicks "Play"
2. Privy modal appears: Google, email, or Discord login options
3. Player authenticates via their chosen method
4. Privy creates an embedded wallet (MPC key splitting — non-custodial)
5. Frontend receives the wallet address
6. Frontend checks if this address is already registered (call AgentRegistry)
7. If new player → proceed to on-chain registration (step 3 in journey)
8. If returning player → load existing state, proceed to dashboard

### Gas Sponsorship

MegaETH gas is sub-cent. MANDATE sponsors all gas for all players via a paymaster. The player never sees a gas fee.

Privy supports paymaster configuration. Set up a paymaster contract on MegaETH testnet that approves all transactions from registered MANDATE agents. Fund it with testnet ETH.

### Session Management

- Privy manages sessions automatically
- Wallet persists across browser refreshes within the same session
- On session expiry or logout, wallet access is revoked
- Player re-authenticates next visit, Privy recovers the same wallet

### Hard Rules

1. **No MetaMask prompts. No wallet connect modals. No "connect wallet" button.** The wallet is invisible.
2. **No seed phrases. No private key exports.** Not for testnet. (Progressive disclosure for power users is a future feature.)
3. **MANDATE never holds player private keys.** Privy's MPC architecture ensures this.
4. **All transactions are gas-sponsored.** The player pays zero ETH for anything.

---

## 4. On-Chain Registration

### PlayerOnboarding Contract

A new contract (or a function on an existing admin contract) that atomically registers a new player. This is the ONE contract change needed — but it's an addition, not a modification to existing contracts.

**What it does in a single transaction:**

1. Calls `AgentRegistry.registerAgent()` — mints a soulbound ERC-8004 NFT to the player's embedded wallet address
2. Sets default allowlist bitmap — enables basic action types (ORDER_PLACE, ORDER_CANCEL, ORDER_MATCH, CLAIM_PRODUCTION, BUILD)
3. Mints starter RATE to the player's address (amount TBD — enough for ~3 days of tile rent + some trading)
4. Mints starter resources appropriate to the player's chosen role:
   - Compute Superpower: extra COMPUTE + ENERGY
   - Data-Rich State: extra DATA + ENERGY
   - Chip Power: extra CHIPS + ENERGY
   - Talent Hub: extra TALENT + ENERGY
   - Regulatory Power: extra CLEARANCE + ENERGY
5. Assigns role via RoleRegistry

**Who calls it:** MANDATE's backend, using an admin wallet with OPERATOR_ROLE. The player's embedded wallet is the *recipient*, not the *caller*. This avoids the chicken-and-egg problem of needing tokens to pay for the registration transaction.

**Access control:** Only MANDATE's admin wallet can call this function. Rate-limited to prevent abuse (max 1 registration per wallet address).

### Starter Resource Amounts

These need playtesting to calibrate, but initial values:

| Resource | All Roles | Role Bonus |
|----------|-----------|------------|
| RATE | 5,000 | — |
| COMPUTE | 100 | +200 (Compute Superpower) |
| ENERGY | 200 | — (all roles need ENERGY equally) |
| CHIPS | 50 | +100 (Chip Power) |
| COOLING | 50 | — |
| TALENT | 30 | +60 (Talent Hub) |
| DATA | 80 | +160 (Data-Rich State) |
| CLEARANCE | 40 | +80 (Regulatory Power) |

These should be constants in the contract, adjustable by admin.

---

## 5. LLM Proxy

### Why a Proxy

Anthropic's API does not set CORS headers — browser-origin requests are blocked. OpenAI and Google Gemini allow browser calls but expose the API key in client-side code. A thin proxy solves both problems.

### Architecture

The proxy is a minimal serverless function (AWS Lambda, Cloudflare Worker, or Fly.io). It does ONE thing: forward LLM requests with the player's API key attached.

```
Browser Web Worker                    LLM Proxy                     LLM Provider
      │                                  │                               │
      │  POST /api/llm                   │                               │
      │  { provider, model, prompt,      │                               │
      │    sessionToken }                │                               │
      │─────────────────────────────────→│                               │
      │                                  │  Look up API key from         │
      │                                  │  session memory               │
      │                                  │                               │
      │                                  │  POST provider API            │
      │                                  │  Authorization: Bearer <key>  │
      │                                  │──────────────────────────────→│
      │                                  │                               │
      │                                  │  ←── LLM response ───────────│
      │                                  │                               │
      │  ←── LLM response ──────────────│                               │
      │                                  │                               │
```

### API Key Flow

1. Player enters API key in settings panel
2. Key sent to proxy over TLS: `POST /api/register-key { key, provider }`
3. Proxy stores key in volatile memory (Map keyed by session token, TTL = session duration)
4. On each agent tick, Web Worker sends: `POST /api/llm { sessionToken, provider, model, messages }`
5. Proxy looks up key from session memory, attaches to provider request, forwards
6. Key is NEVER written to disk, database, or logs
7. On session expiry, key is evicted from memory

### Hard Rules

1. **Keys in volatile memory only.** No persistence. No logging.
2. **One endpoint: `/api/llm`.** The proxy doesn't do anything else.
3. **No prompt inspection or modification.** The proxy is a pass-through. It does not read, validate, or alter the prompt content.
4. **Rate limiting:** Max 2 requests per minute per session (prevents runaway agent loops). This allows the 30-second tick cycle with margin.
5. **Provider-agnostic:** The proxy forwards to whatever provider URL the session specifies. Adding a new provider requires zero proxy code changes.

### Free Tier

For testnet, MANDATE funds a shared Anthropic API key (Haiku). Players who select "Free Tier" during LLM setup get this key automatically. The proxy uses the shared key instead of a player-provided one. Rate-limited more aggressively: 60-second tick cycle, shorter max prompt length.

### Estimated Proxy Cost

Effectively zero for testnet. A single Cloudflare Worker or small Lambda handles hundreds of concurrent players. The LLM inference cost (paid to the provider) is the real expense, and that's either the player's cost (BYO key) or MANDATE's cost (free tier).

---

## 6. Client-Side Agent Runtime (MVA Web Worker)

This is the core of the game. See the separate **MVA Specification (MANDATE_MVA_Spec_v01.md)** for the full conceptual model (coupled OODA loops, general/soldier relationship, sitrep design). This section covers the technical implementation.

### Web Worker Architecture

The agent loop runs in a dedicated Web Worker to avoid blocking the UI thread.

```javascript
// agent-worker.js (simplified structure)

let mandate = null;     // Current mandate (Layers 1-3)
let apiConfig = null;   // LLM provider, model, proxy URL
let tickInterval = 30000; // 30 seconds default

// Main thread sends mandate updates and config
self.onmessage = (event) => {
  switch (event.data.type) {
    case 'SET_MANDATE': mandate = event.data.mandate; break;
    case 'SET_CONFIG':  apiConfig = event.data.config; break;
    case 'START':       startLoop(); break;
    case 'STOP':        stopLoop(); break;
    case 'TICK_NOW':    executeTick(); break; // Manual tick trigger
  }
};

async function executeTick() {
  // 1. OBSERVE — Read chain state
  const gameState = await readChainState();
  
  // 2. Sanitise external content (Layer 1)
  const sanitisedState = sanitiseExternalContent(gameState);
  
  // 3. Assemble four-zone prompt
  const prompt = assemblePrompt(mandate, sanitisedState);
  
  // 4. Call LLM via proxy
  const llmResponse = await callLLMProxy(prompt, apiConfig);
  
  // 5. Parse response
  const { actions, sitrep } = parseResponse(llmResponse);
  
  // 6. Guard validation (Layer 3) — deterministic TypeScript
  const { approved, rejected } = guardValidate(actions, mandate, gameState);
  
  // 7. Request signatures and submit approved actions
  for (const action of approved) {
    self.postMessage({ type: 'SIGN_AND_SUBMIT', action });
    // Main thread handles wallet signing via Privy
  }
  
  // 8. Generate and push sitrep
  const fullSitrep = enrichSitrep(sitrep, approved, rejected);
  self.postMessage({ type: 'SITREP', sitrep: fullSitrep });
  
  // 9. Store sitrep in IndexedDB for persistence
  self.postMessage({ type: 'STORE_SITREP', sitrep: fullSitrep });
}
```

### Reusable Code from Reference Implementation

Claude Code audited `reference-impl/mandate-agent/` and confirmed high reusability. The following modules port directly to the Web Worker with minimal adaptation:

| Module | Source | Adaptation Needed |
|--------|--------|-------------------|
| `decision/engine.ts` | LLM reasoning core | Inject API key + proxy URL instead of env vars |
| `decision/prompts.ts` | Prompt assembly | None — four-zone structure already implemented |
| `mandate/schema.ts` | Mandate types + validation | None |
| `mandate/hash.ts` | Mandate hashing | None |
| `chain/contracts.ts` | ABI bindings | None — viem is browser-native |
| `negotiation/types.ts` | MNP message types | None (deferred to P1 but types useful) |

**Needs new code (~400-600 lines):**
- Config injection (replace `process.env` with message-passed objects)
- LLM adapter (proxy URL routing instead of direct API calls)
- Wallet signing bridge (`postMessage` to main thread → Privy signs → result back)
- Sitrep generation (new — reference impl doesn't generate sitreps)
- IndexedDB storage for sitrep persistence
- Web Worker lifecycle management (start/stop/pause)

### What Happens When the Browser Closes

The agent stops. Sitreps are stored in IndexedDB and survive browser restarts. On reconnect, the dashboard shows:
- Sitreps from the last active session (from IndexedDB)
- On-chain state changes since last session (from AuditLog and chain reads)
- A "Session Summary" aggregating what happened

Future upgrade: Phase 5 server-side hosting for persistent 24/7 agents (RATE-purchasable feature).

### Signing Bridge

The agent submits actions every 30 seconds. The player cannot click "approve" each time.

**Solution: Privy session keys / scoped permissions.**

Privy embedded wallets support delegated signing where the app can sign transactions on behalf of the user for pre-approved transaction types. On login, the player approves a session that allows:
- Transactions to the OrderBook contract (place/cancel/match orders)
- Transactions to BuildingRegistry (claim production, construct, demolish)
- Transactions to MapRegistry (claim/release tiles)
- Transactions to AgentRegistry (for guard-approved actions)

This approval happens ONCE at login, not per transaction. If Privy doesn't support this granularity, the fallback is a dedicated agent EOA wallet:
- On registration, generate a separate EOA keypair stored in browser (encrypted in IndexedDB)
- Player's main wallet funds the agent wallet with a small amount of testnet ETH
- Agent wallet signs game transactions automatically
- Player's main wallet handles direct actions (intelligence purchases, etc.)

**Implementation agent: check Privy's session key documentation first. Only fall back to the dedicated EOA approach if session keys don't support contract-scoped permissions.**

---

## 7. Dashboard & Sitrep UI

### The Core Design Principle

The dashboard is the game. The player's primary experience is reading sitreps, interpreting the game state, and deciding whether to adjust their mandate. The dashboard must answer "What is my agent doing right now?" in under two seconds.

### Three-Tier Visual Hierarchy

| Tier | Content | Typography | Behaviour |
|------|---------|------------|-----------|
| **Tier 1 — Header** | Agent's current action/status, AGI Progress Score. When mandate editor is open, it takes Tier 1. | Large, high-contrast, animated where appropriate | Max 2-3 elements. Always visible. |
| **Tier 2 — Body** | Resource balances (with deltas), active market positions, incoming negotiations, active event alerts, sitrep feed | Helvetica Neue, professional ops console register. Clearly readable, lower contrast than Tier 1. | Always visible. Scrollable. |
| **Tier 3 — Fine Print** | OrderBook depth, transaction history, building specs, epoch countdown details, reputation scores, lineage data | Wudoo Mono, terminal register. Accessible via drill-down or hover. | Hidden by default. Available on demand. |

### Sitrep Feed (Tier 2, centrepiece)

The sitrep feed is the main panel. Each entry shows:

- **Timestamp** (relative: "2 minutes ago", "1 hour ago")
- **Summary line** in agent voice (Wudoo Mono): "Executed 2 trades. Acquired COMPUTE at 3.5 RATE. Market softening."
- **Alerts** highlighted by severity: critical (red pulse), warning (amber), info (dim)
- **Expandable detail** (tap/click to show full sitrep including reasoning, market conditions, mandate effectiveness)

Between player sessions, sitreps aggregate into a **Session Summary**: net resource changes, total trades, key events, unresolved alerts.

### Resource Bar (Tier 2, persistent)

Horizontal bar showing all 7 resources + RATE with:
- Current balance
- Delta since last check (↑ green / ↓ red / — grey)
- Trend sparkline (last 1 hour)

### Alert System

Alerts from sitreps bubble up to Tier 1 when severity is critical. Examples:
- "Rent due in 6 hours — 3 tiles at risk" (critical)
- "Guard rejected 4 consecutive actions — mandate constraints may be too tight" (warning)
- "World event fired: GPU Export Restriction" (warning)
- "Agent #23 buying CHIPS aggressively — possible cornering" (info)

### Aesthetic Direction

Westworld control room. Night Sky (#19191A) background. Moon White (#ECE8E8) text. Pastel accents from MegaETH brand kit for resource colours. The dual-typography system (Helvetica Neue for player layer, Wudoo Mono for agent/terminal layer) creates the two-register separation.

**The dashboard should feel like a portfolio management terminal, not a game UI.** Dense information, clean geometry, no decorative flourishes. Every pixel is functional. Players should occasionally forget they're playing a game.

---

## 8. Mandate Editor

### What the Player Writes

The mandate has three layers, as defined in Phase 4:

**Layer 1 — Strategic Intent (natural language)**
Free-form text. The player writes what they want their agent to do.
Example: "Prioritise COMPUTE acquisition. Trade surplus ENERGY at favourable rates. Avoid CHIPS market until price drops below 4 RATE. Accumulate DATA for a large training run next week."

**Layer 2 — Operational Constraints (structured JSON)**
The editor provides a form UI that generates the JSON. The player sets:
- Resource priorities (rank ordering)
- Price floors and ceilings per resource
- Maximum single trade size
- Reserve minimums (never sell below this balance)
- Risk tolerance (conservative / moderate / aggressive)
- Blocked counterparties (agent IDs to avoid trading with)

**Layer 3 — Machine Context (auto-populated)**
The system fills this automatically from on-chain state:
- Current balances
- Current market prices
- Active events
- Epoch progress
- Building inventory and production status

### Editor UI

The mandate editor takes Tier 1 when open (overlays the sitrep feed).

Layout:
- Left panel: Layer 1 text area (large, prominent)
- Right panel: Layer 2 constraint form (structured fields)
- Bottom strip: Layer 3 preview (read-only, auto-populated, collapsible)
- Submit button: "Deploy Mandate" — updates the agent's Zone 2 context immediately

The editor should show the **current active mandate** when opened, not a blank slate. The player edits their existing mandate, they don't write a new one from scratch each time.

### Mandate History

Store previous mandates in IndexedDB. Allow the player to view and restore previous mandates. This supports learning — "my mandate from yesterday worked better, let me revert."

---

## 9. Direct Player Actions

The player can act directly on the game at any time, bypassing the agent. Direct actions are signed by the embedded wallet and submitted immediately.

### Direct Action Panel (Tier 3, available on demand)

A panel accessible from the dashboard that exposes:

| Action | UI Element | Contract |
|--------|-----------|----------|
| Place order | Resource selector, amount, price, buy/sell toggle | OrderBook.placeOrder() |
| Cancel order | List of own open orders, cancel button per order | OrderBook.cancelOrder() |
| Claim tile | Click tile on map → confirm | MapRegistry.claimTile() |
| Release tile | Right-click owned tile → confirm | MapRegistry.releaseTile() |
| Place building | Select owned empty tile → building picker (filtered by terrain) → confirm | BuildingRegistry.construct() |
| Claim production | List of buildings with unclaimed output → claim button | BuildingRegistry.claimProduction() |
| Purchase intelligence | Subscription panel: free/analyst/premium tier | InformationMarket.subscribe() |

### Agent Awareness

The agent sees the results of player direct actions in the next tick's chain state read. The Zone 1 system prompt instructs the agent: "The player may take direct actions between your tick cycles. You will see the results in the game state. Do not duplicate or counteract player actions."

---

## 10. Technical Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Frontend framework | React (existing) | Already in place |
| Wallet | Privy React SDK | Embedded, non-custodial, social login |
| Chain interaction | viem + wagmi (existing) | Already in deps per Claude Code audit |
| Agent runtime | Web Worker (TypeScript) | Ported from reference-impl |
| Guard agent | TypeScript (in Web Worker) | Deterministic, not LLM |
| LLM proxy | Cloudflare Worker or AWS Lambda | ~100 lines, pass-through only |
| Sitrep storage | IndexedDB (browser) | Persists across refreshes |
| Gas sponsorship | Paymaster contract on MegaETH | Fund with testnet ETH |
| State reads | MegaETH RPC (via viem) | Public RPC for testnet |
| Dashboard | React components | Three-tier visual hierarchy |

---

## 11. Build Order

### Sprint 1 — Foundations (get a player registered and connected)

1. Privy integration: social login, embedded wallet creation
2. PlayerOnboarding contract: deploy to testnet
3. Registration flow: authenticate → register → role select
4. Replace hardcoded deployer address in frontend with connected wallet
5. Gas paymaster setup on MegaETH testnet

**Checkpoint:** A new player can sign in, get a wallet, receive an agent NFT and starter tokens, and see their balances in the frontend.

### Sprint 2 — Agent Runtime (get the agent loop running)

6. LLM proxy: deploy thin serverless function
7. Port reference-impl modules to Web Worker
8. Implement signing bridge (Privy session keys or fallback EOA)
9. Agent tick loop: observe → prompt → LLM call → parse → guard → submit
10. Basic sitrep generation and display

**Checkpoint:** Player writes a mandate, agent executes one tick, sitrep appears on dashboard, actions visible on Blockscout.

### Sprint 3 — Dashboard & Mandate Editor (make it playable)

11. Sitrep feed UI (Tier 2 centrepiece)
12. Resource bar with deltas and sparklines
13. Mandate editor (Layer 1 text + Layer 2 constraint form)
14. Alert system (critical/warning/info with visual hierarchy)
15. Direct action panel (manual orders, claim production)

**Checkpoint:** Player can write mandates, watch sitreps, adjust strategy, and take direct actions. This is a playable game.

### Sprint 4 — Polish & Integration

16. Sitrep aggregation (session summaries between visits)
17. Mandate history (view/restore previous mandates)
18. IndexedDB persistence for sitreps and mandate history
19. Map UI integration (from separate handoff — connect to dashboard)
20. Visual hierarchy polish (three-tier enforcement, typography, animations)

**Checkpoint:** The full testnet experience is playable and visually coherent.

---

## 12. Hard Boundaries for Implementation Agent

1. **DO NOT modify any deployed smart contract.** The only new contract is PlayerOnboarding. Everything else is read/write against existing deployed contracts.
2. **The guard agent is deterministic TypeScript. NOT an LLM.** This is a security-critical design decision from Phase 1. Do not change it.
3. **API keys are never persisted to disk or database.** Session memory only (browser sessionStorage + proxy volatile memory).
4. **The four-zone prompt architecture is the context structure.** Do not invent a different layout. See Phase 5, §4.
5. **Privy is the wallet provider.** Do not add MetaMask connect, WalletConnect, or any other wallet option. Blockchain is invisible.
6. **The agent runs client-side in a Web Worker.** Do not build a server-side agent runtime for Phase 6. That's Phase 5 (future).
7. **The proxy is a pass-through.** It does not read, validate, modify, or log prompt content.
8. **The visual hierarchy is three tiers.** Do not put Tier 3 content at Tier 1 prominence. Progressive disclosure over simultaneous display.

---

## 13. Open Questions for Implementation

1. **Privy session keys:** Does Privy support contract-scoped auto-signing? Check their docs. If not, implement the dedicated agent EOA fallback described in §6.
2. **Starter resource amounts:** The values in §4 are initial guesses. Expect to adjust after playtesting.
3. **Free tier rate limiting:** 60-second tick cycle for free tier vs 30-second for BYO key. Is 60 seconds too slow to feel engaging? May need playtesting.
4. **PlayerOnboarding contract permissions:** The admin wallet that calls this needs OPERATOR_ROLE on AgentRegistry, MINTER_ROLE on RateToken and all ResourceTokens, and write access to RoleRegistry. Verify these roles exist and are assignable on the deployed contracts.
5. **MegaETH testnet paymaster:** Does MegaETH testnet support ERC-4337 paymasters natively? If not, gas sponsorship may need a different approach (e.g., backend relayer that submits transactions on behalf of the player).

---

## Appendix A: Relationship to Other Phases

| Phase | What It Built | How Phase 6 Uses It |
|-------|--------------|-------------------|
| Phase 1 (Game Design) | Mechanics, roles, OODA model | Phase 6 implements the player-facing game loop |
| Phase 2 (Smart Contracts) | 26 deployed contracts | Phase 6 reads from and writes to these contracts |
| Phase 3 (Tokenomics) | RATE economics, resource supply | Phase 6 mints starter tokens, agent trades using these economics |
| Phase 4 (Agent Protocol) | MNP, mandate schema, four-zone prompt, guard | Phase 6 runs the agent using Phase 4's protocol |
| Phase 5 (Agent Hosting) | Server-side persistent runtime | Future upgrade. Phase 6's client-side MVA is the testnet version. Same agent loop logic, different execution environment. |

## Appendix B: Deployed Contract Addresses

All addresses are in `mandate-frontend/src/lib/addresses.ts`. The implementation agent should read from this file, not from this document. RateToken can be verified at: `https://megaeth-testnet-v2.blockscout.com/address/0x4cb785c678e309bcb86a4cfaee9feb4367985e1c`
