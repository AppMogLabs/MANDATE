# Claude Code Prompt: Add Gameplay Feedback Panel to MANDATE Dashboard

## Context

You are working on the MANDATE frontend — an on-chain AI arms race strategy game on MegaETH testnet. The player dashboard currently has no way for a player to understand whether they're doing well. The primary win condition — **AGI Progress Score** — is not displayed anywhere. Neither are several other pieces of gameplay feedback that would help players understand their position, track progress, or feel motivated to return.

This task adds a **Gameplay Feedback Panel** to the dashboard. The panel has two jobs: (1) tell the player whether they're winning, and (2) give them a reason to come back.

## Design System (mandatory)

- **Background:** Night Sky `#19191A`
- **Primary text:** Moon White `#ECE8E8`
- **Font (dashboard layer):** Helvetica Neue
- **Font (machine/terminal layer):** Wudoo Mono
- **Aesthetic:** Westworld control room / Bloomberg Terminal. Dense information, clinical, no gamified enthusiasm. This should look like a portfolio performance summary, not a game HUD. Think Bloomberg's P&L summary — the numbers tell the story, the design stays out of the way.

Resource colour mapping uses MegaETH pastel accents — check existing codebase for the mapped colours. If not yet mapped, use distinct pastels from the MegaETH brand kit for each of the seven resources.

---

## What to Build

### 1. AGI Progress Score (PRIMARY — this is the win condition)

The AGI Progress Score is a composite of four components. **There is no existing contract function that returns a pre-computed score.** You need to read the components individually and compute the composite client-side.

**Components and how to read them:**

| Component | Weight | Source | How to Read |
|---|---|---|---|
| Resource Stack | 25% | ResourceToken contracts (×7) | Sum `balanceOf(agentAddress)` across all 7 resource tokens (COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE). Normalise each against total circulating supply to get a 0–1 ratio per resource, then average. Scale to 0–2500. |
| Building Tier | 25% | BuildingRegistry (ERC-721) | Read all buildings owned by the agent. Each has a tier (1/2/3). Score = sum of tier values, weighted by building type importance (processing > production > influence > yield > infrastructure). Scale to 0–2500. |
| Intelligence Network Strength | 25% | InformationMarket subscription tier + MandateEchoOracle reliability score + ReputationLedger composite score | Combine: current subscription tier (0/1/2 → mapped to 0/833/1666), echo reliability score (0–10000 bps → scaled to 0–834), and reputation composite. Average and scale to 0–2500. |
| Processing Chain Completion | 25% | BuildingRegistry | Check which stages of the processing chain the player has operational: (1) Raw resource production → (2) Training Cluster (COMPUTE + DATA → weights) → (3) Alignment Lab (weights + TALENT → models) → (4) Deployed Model (inference revenue). Each stage = 625 points. Full chain = 2500. |

**Composite = sum of four components. Range: 0–10,000.**

**Display:**
- Large, prominent number at the top of the panel.
- Four component sub-scores shown as compact horizontal bar gauges beneath the headline number, labelled: `RESOURCES`, `BUILDINGS`, `INTELLIGENCE`, `CHAIN`.
- Each bar is filled proportionally (0–2500 range) with a subtle colour per component.

**IMPORTANT:** The exact weighting formula is not finalised. Use equal 25% weights. Add a `// TODO: Confirm AGI Progress Score weights with game design` comment. Extract the score computation into a standalone utility function (`computeAGIProgressScore`) — this will later be mirrored on-chain, so keep it clean, pure, and well-documented.

---

### 2. Score Trend (the "am I improving?" signal)

**Why this matters:** A score of 6,200 means nothing without context. The player needs to know whether they're going up or down.

**Implementation:**

Store score snapshots in `localStorage` (or IndexedDB if you prefer), keyed by `mandate-score-history-{playerAddress}`. On each poll cycle (every 30 seconds), record `{ timestamp, score, components }`. Keep the last 48 hours of data. On session start, load history and compute:

- **Session delta:** Score change since the player opened the dashboard this session.
- **24h delta:** Score change over the last 24 hours.
- **Sparkline:** A small inline sparkline chart (last 24 hours) next to the headline score. Use SVG — no charting library needed for this.

**Display:**
- Next to the headline score: a small arrow (▲ green / ▼ red / ─ neutral) with the 24h delta value.
- Below the score: a compact 24h sparkline, roughly 200×40px. Night Sky background, Moon White line, no axis labels — just the shape of the trend.

**On first session (no history):** Show "—" for the delta and no sparkline. Don't fake data.

---

### 3. Relative Position (the "where do I stand?" signal)

**Why this matters:** Research shows relative positioning is the strongest driver of continued play. "You are #3 of 12" is more motivating than "your score is 6,200". The gap to the player above matters more than the absolute number.

**Implementation:**

Read all registered agents from `AgentRegistry` and compute their AGI Progress Scores using the same `computeAGIProgressScore` function. Sort descending. Find the current player's rank.

**Display:**
- `Rank: #3 of 12 agents`
- `340 points behind #2` (gap to player above) — this is the aspirational target
- `1,200 points ahead of #4` (gap to player below) — this is the comfort buffer

If the player is #1, show: `#1 of 12 agents — leading by 580 points`
If the player is last, show: `#12 of 12 agents — 240 points behind #11`

**Performance note:** Computing scores for all agents on every poll is expensive. Cache the leaderboard with a 60-second TTL. The player's own score updates every 30 seconds; the leaderboard recalculates every 60 seconds. This means rank may lag slightly — that's fine.

---

### 4. Epoch Progress & Countdown

Read from `EpochManager`:
- `getCurrentEpoch()` → epoch number
- `getEpochEndTimestamp()` → end time
- `isEpochActive()` → active flag

**Display:**
- Current epoch number
- Countdown timer to epoch end: `12d 4h 22m` (ticking live, update every minute)
- Visual progress bar showing percentage through the 28-day epoch
- When <7 days remain, change the countdown colour to amber
- When <3 days remain, change to red — this is the "survived full epoch" milestone zone

---

### 5. RATE Balance & Daily Drip Status

Read from `RateToken` (`rateToken` / `RATE_TOKEN` — use this naming convention, it's a hard codebase rule):
- `balanceOf(playerAddress)` → current RATE balance

The daily drip is 4,500 RATE per active player per day, qualifying with ≥1 on-chain action in past 24 hours. Check if `EpochRewardManager` exists in `mandate-frontend/src/lib/addresses.ts`. If it does, read claim status. If it doesn't exist yet, show the RATE balance only and add a `// TODO: Wire daily drip claim status when EpochRewardManager is deployed`.

**Display:**
- RATE balance prominently, formatted with commas (e.g., `34,200 RATE`)
- If drip status available: `Drip claimed ✓` or `Drip available — 4,500 RATE`
- 24h RATE change (from localStorage history): `+2,300 today` or `-1,100 today`

---

### 6. Resource Summary Bar

Read `balanceOf(agentAddress)` from all 7 ResourceToken contracts.

**Display:** Compact row showing all 7 resource balances with colour-coded dots or small blocks. Each shows abbreviated name and balance. Zero balances are flagged with a subtle warning indicator (dimmed or pulsing dot) — a zero resource is a vulnerability the player needs to know about.

Layout: single row or 2×4 grid, whichever fits the panel width. Use Wudoo Mono for the numbers.

---

### 7. Reputation Score & Carry-Over Status

Read from `ReputationLedger`:
- Composite reputation score (0–10000 bps)
- If the four signals are individually readable (deal completion, disinformation, anomaly count, age/activity), show them as a mini breakdown

**Display:**
- Single number: `Reputation: 6,420`
- **Critical context:** Flag whether the player is in the top 20% or bottom 80%. This determines epoch carry-over: top 20% keep 50% of resource balances; bottom 80% reset to zero. This is the single most important piece of information for late-epoch strategy.
- Display as: `Top 20% — 50% resources carry over` (green) or `Bottom 80% — resources reset at epoch end` (amber/red)
- If the player is close to the 20% threshold, show the gap: `180 points below top 20% cutoff`

---

### 8. Milestone Tracker

Milestones are one-time-per-epoch achievements. Show completion status:

| Milestone | Reward | How to Detect |
|---|---|---|
| First building constructed | 5,000 RATE | Player owns ≥1 building in BuildingRegistry |
| First OrderBook trade | 2,000 RATE | Player has ≥1 completed trade (check AuditLog events or OrderBook fill events) |
| First Training Cluster built | 10,000 RATE | Player owns a Training Cluster building |
| First Deployed Model operational | 20,000 RATE | Player owns a Deployed Model building |
| Survived full epoch | 10,000 RATE | Only achievable if player is active in final week — show as `In progress (Xd left)` with days remaining |

**Display:**
- Checklist format in Wudoo Mono (this is the machine layer)
- Completed: `✓ First building         +5,000 RATE` (dimmed, done)
- Available: `○ Training Cluster      +10,000 RATE` (bright, actionable)
- In progress: `◐ Survive epoch         18d left`
- Show total earned vs total available: `Earned: 7,000 / 47,000 RATE`

**Ordering:** Show incomplete milestones first (sorted by reward value, highest first), then completed milestones dimmed below.

---

### 9. "While You Were Away" Summary (the check-in hook)

**Why this matters:** MANDATE agents act autonomously. When a player returns, the first thing they want to know is "what happened while I was gone?" This is the check-in compulsion loop — the world kept moving.

**Implementation:**

On session start, read recent events relevant to the player from the on-chain logs. Sources:

- `AuditLog`: Recent actions by the player's agent (trades executed, buildings built, resources spent)
- `OrderBook` events: Any orders filled or cancelled
- `EventOracle`: World events that fired since last session
- `ReputationLedger`: Reputation changes

Determine "last session" from the most recent timestamp in localStorage score history, or fall back to 24 hours ago.

**Display:**
- A compact summary at the top of the panel on session start, styled in Wudoo Mono (terminal layer):

```
SINCE LAST SESSION (14h ago)
─────────────────────────────
Agent executed 3 trades
World event: GPU Shortage (sev 6)
COMPUTE balance: 1,204 → 890 (▼314)
Reputation: 6,420 → 6,480 (▲60)
Score: 5,800 → 6,200 (▲400, rank #3→#3)
```

- After the player has been active for 2+ minutes, fade this summary to collapsed state (still accessible via expand toggle).
- If no significant events occurred: `No major changes while you were away.`
- If this is the first session ever (no history): skip this section entirely.

**Scope constraint:** This section reads *only from on-chain events and localStorage*. It does NOT require a backend indexer. If reading historical events is too expensive on MegaETH RPC (e.g., log scanning is slow), limit the lookback to the last 100 blocks and add `// TODO: Replace with indexer-backed event history for deeper lookback`.

---

### 10. Processing Chain Visualisation

**Why this matters:** The processing chain is the core strategic spine. Players need to see where they are in the chain and what's missing.

**Display:** A simple horizontal pipeline:

```
[RESOURCES] → [TRAINING CLUSTER] → [ALIGNMENT LAB] → [DEPLOYED MODEL] → [REVENUE]
    ✓               ✓                    ○                  ○               ○
```

- Completed stages: filled / bright
- Missing stages: hollow / dimmed
- Currently blocked (missing prerequisite resources): show which resource is the bottleneck

This is a compact visualisation — one row, five nodes. Use Wudoo Mono. If the player has no buildings yet, this immediately tells them what to build first.

---

## Layout

The panel is a **sidebar or right-hand column**, not a full page. It lives alongside the main map/dashboard view. Suggested visual hierarchy (top to bottom):

```
┌──────────────────────────────────────────┐
│  ⚡ WHILE YOU WERE AWAY (14h)           │  ← Collapsible, shown on session start
│  Agent executed 3 trades                 │
│  World event: GPU Shortage (sev 6)       │
│  Score: 5,800 → 6,200 (▲400)            │
├──────────────────────────────────────────┤
│                                          │
│  AGI PROGRESS SCORE                      │
│          6,200  ▲ +400 (24h)            │  ← Large number + trend arrow + delta
│  ┄┄┄┄╱╲┄┄┄╱╲╱╲┄╱╲╱╲╲┄┄                │  ← 24h sparkline
│                                          │
│  RESOURCES  ████████░░░░  1,840          │  ← Four component bars
│  BUILDINGS  ██████░░░░░░  1,450          │
│  INTEL      ████░░░░░░░░    980          │
│  CHAIN      █████████░░░  1,930          │
│                                          │
│  Rank: #3 of 12                          │
│  340 pts behind #2  ·  1,200 ahead of #4 │
├──────────────────────────────────────────┤
│  EPOCH 2            ████████░░  68%      │
│  12d 4h 22m remaining                    │
├──────────────────────────────────────────┤
│  RATE: 34,200       +2,300 today         │
│  Drip: Claimed ✓                         │
├──────────────────────────────────────────┤
│  CHAIN PROGRESS                          │
│  [RES]✓ → [TRAIN]✓ → [ALIGN]○ → [DEPLOY]○ → [REV]○ │
│  Bottleneck: Need TALENT for Alignment Lab│
├──────────────────────────────────────────┤
│  RESOURCES                               │
│  ● COMPUTE 1,204  ● ENERGY 890          │
│  ● CHIPS 45       ● COOLING 670         │
│  ● TALENT 12      ● DATA 340            │
│  ● CLEARANCE 200                         │
│  ⚠ TALENT critically low                │
├──────────────────────────────────────────┤
│  REPUTATION: 6,420                       │
│  ██████████████░░░░░░ Top 20%           │
│  50% resources carry over at epoch end   │
├──────────────────────────────────────────┤
│  MILESTONES        Earned: 7,000 / 47,000│
│  ○ Deployed Model           +20,000 RATE │
│  ○ Training Cluster         +10,000 RATE │
│  ◐ Survive epoch (18d left) +10,000 RATE │
│  ✓ First building            +5,000 RATE │
│  ✓ First trade               +2,000 RATE │
└──────────────────────────────────────────┘
```

---

## Technical Notes

- **Contract addresses:** All in `mandate-frontend/src/lib/addresses.ts`. Use what's deployed. If a contract has a `0x...` placeholder or is missing, skip that section with a TODO comment.
- **RPC:** MegaETH testnet, `https://carrot.megaeth.com/rpc`, Chain ID 6343.
- **RATE token naming:** All code references must use `rateToken` / `RATE_TOKEN` prefix. Hard codebase convention.
- **Score computation:** Extract into `src/lib/scoring.ts` as a pure function: `computeAGIProgressScore(resources, buildings, intelligence, chain) → { total, components }`. This will later be mirrored on-chain.
- **Leaderboard computation:** Extract into `src/lib/leaderboard.ts`. Cache with 60-second TTL.
- **Score history:** Store in localStorage under `mandate-score-history-{address}`. Schema: `Array<{ timestamp: number, score: number, components: { resources: number, buildings: number, intelligence: number, chain: number }, rateBalance: number }>`. Prune entries older than 48 hours on each write.
- **Polling intervals:** Player's own score: 30 seconds. Leaderboard: 60 seconds. Epoch countdown: tick every 60 seconds (it's days-scale, not seconds-scale). "While you were away": once on session start only.
- **Read-only:** This entire panel makes zero write transactions.
- **Graceful degradation:** Every section must work independently. If any contract call fails or a contract isn't deployed, show `—` for that value. Don't crash the panel. Don't show loading spinners forever — if data isn't available after 5 seconds, show `—` and stop.
- **Responsive:** The panel should work as a sidebar on desktop and collapse to a top summary bar on mobile (score + rank + epoch countdown visible, everything else in an expandable drawer).

---

## Hard Boundaries

- **Do NOT** create or modify smart contracts. Frontend-only.
- **Do NOT** invent score formulas beyond the equal-weight composite described above.
- **Do NOT** add animations, particle effects, confetti, achievement popups, or gamified UI elements. The trend arrow and sparkline are the maximum visual flair. This is a Bloomberg Terminal aesthetic.
- **Do NOT** use any font other than Helvetica Neue (dashboard) and Wudoo Mono (terminal/machine layer).
- **Do NOT** add sound effects, browser notifications, or push notifications. Those are a separate feature if ever.
- **Do NOT** build a backend indexer. Everything reads from on-chain state and localStorage. If something needs an indexer, add a TODO comment and move on.
- **Do NOT** display other players' resource balances or detailed breakdowns — only ranks and scores. Partial information asymmetry is a game design feature.

---

## Files to Check First

1. `mandate-frontend/src/lib/addresses.ts` — which contracts are deployed
2. Existing component structure — follow the patterns already in use
3. ABI files — what's available in the frontend build
4. Existing hooks / providers — reuse the RPC provider and wallet connection patterns

## Definition of Done

- AGI Progress Score is visible, computed live from on-chain data, updating every 30 seconds
- Score trend arrow and 24h sparkline are visible (or show `—` on first session)
- Player rank and gap to neighbours are visible
- Epoch countdown is ticking
- RATE balance is visible with 24h change
- Processing chain visualisation shows completed and missing stages
- Resource balances are visible with colour coding and zero-warnings
- Reputation score shows carry-over status (top 20% vs bottom 80%)
- Milestone tracker shows completion with incomplete milestones prioritised
- "While you were away" summary appears on session start (or is cleanly skipped if no history)
- Score computation is extracted into `src/lib/scoring.ts` as a reusable pure function
- All sections degrade gracefully when data is unavailable
- Follows existing codebase patterns and design system
- Responsive: works as sidebar on desktop, collapses to summary on mobile
- No TypeScript errors, no console errors
