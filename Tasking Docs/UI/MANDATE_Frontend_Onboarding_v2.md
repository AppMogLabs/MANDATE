# MANDATE Frontend — Onboarding v2 Spec

**App Mog Labs | March 2026**
**Replaces: Step 4 OnboardingFlow.tsx (current implementation)**

---

## Read This First

The current onboarding (v1) is too thin. It jumps from a brief demonstration to a mandate editor with insufficient scaffolding. Players who aren't familiar with strategy games don't understand what they're looking at. Players who aren't familiar with AI don't understand why mandate quality matters. And nobody gets a tour of the dashboard.

This spec replaces the entire onboarding implementation with a modular, interruptible, resumable system. The core principles:

1. **Interruptible and resumable.** Players can bail after any phase and jump into the game. Unfinished modules remain available from the command palette.
2. **Progressive disclosure.** Don't front-load everything. Teach what's needed now, let players discover the rest.
3. **Learn by doing.** No modal tutorials. No overlay tooltips. Players learn by interacting with the real interface.
4. **The iteration prompt is sacred.** If a player starts the Mandate Mastery module, they must experience the iteration feedback loop at least once. This is the most important learning moment in the entire game.

### Dependencies

- Step 1 + Step 2 complete (design system, static UI shell)
- Step 4 MandateEditor component complete (three-layer editor)
- Fix Pass #3 complete (submit flow not stuck)
- All mock data from Step 4 available

### Hard Boundaries

Do not:
- Implement actual LLM integration (mock interpretations only)
- Build multiplayer matchmaking or epoch joining flow
- Implement real chain transactions
- Add the crypto toggle back (reserved for Step 3)

---

## Architecture: Three Independent Modules

The onboarding consists of three modules that can be completed in sequence or individually:

```
FIRST LOAD:
  Role Selection → Terminal Boot (Phase 1) → [optional] Dashboard Tour (Phase 2) → [optional] Mandate Mastery (Phase 3) → Game

FROM MENU (anytime):
  Command Palette → Tutorials → Dashboard Tour / Mandate Mastery
```

**State tracking:** Track which modules the player has completed in React state (component-level — no localStorage per artifact constraints). On first load, all modules are marked incomplete. Completing a module marks it done. If the player refreshes, state resets — this is acceptable for the current build.

**Menu access:** After first load, add two entries to the command palette under a TUTORIALS category:
```
TUTORIALS
  Dashboard Tour       (✓ completed / ○ recommended)
  Mandate Mastery      (✓ completed / ○ recommended)
```

The "○ recommended" label appears if the module hasn't been completed. It disappears once completed but the tutorial remains launchable.

---

## Pre-Boot: Role Selection

The very first screen a new player sees. Appears before the terminal boot sequence.

### Layout

Centred on Night Sky background. No game UI visible behind — this is a full-screen takeover.

```
MANDATE

Select your sovereign role

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│                 │ │                 │ │                 │
│    COMPUTE      │ │   DATA-RICH     │ │   CHIP          │
│    SUPERPOWER   │ │   STATE         │ │   POWER         │
│                 │ │                 │ │                 │
│  Large compute  │ │  Large DATA     │ │  CHIPS          │
│  capacity.      │ │  reserves.      │ │  abundance.     │
│  Cheap energy.  │ │  Fast DATA      │ │  Surplus for    │
│                 │ │  regeneration.  │ │  trade.         │
└─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│                 │ │                 │
│    TALENT       │ │   REGULATORY    │
│    HUB          │ │   POWER         │
│                 │ │                 │
│  TALENT         │ │  Sets standards │
│  regenerates    │ │  others pay     │
│  fast.          │ │  CLEARANCE.     │
└─────────────────┘ └─────────────────┘

            [ Let the system decide ]
```

### Visual Design

- Role cards: `--surface-1` background, 1px `--border-default` border, 200px × 160px
- Role name: Wudoo Mono, `--text-primary`, `--text-lg`, uppercase
- Description: Helvetica Neue, `--text-secondary`, `--text-sm`. Show ONLY the starting advantage — not the weakness. The weakness is revealed during the boot sequence for dramatic effect.
- Hover state: border changes to `--border-focus`, subtle glow using the role's primary resource colour at 10% opacity
- Selected state: border solid in `--border-active` (Moon White), background shifts to `--surface-2`
- "Let the system decide": ghost button, Wudoo Mono, `--text-tertiary`, centred below the role cards. On click, randomly selects a role with a brief shuffle animation (the cards flash their borders in sequence for 1 second, then one is selected).

### Role-to-Resource Colour Mapping

Each role card's hover glow uses the colour of its primary resource:
- Compute Superpower → `--colour-compute` (#7EAAD4)
- Data-Rich State → `--colour-data` (#90D79F)
- Chip Power → `--colour-chips` (#F5949D)
- Talent Hub → `--colour-talent` (#F786C6)
- Regulatory Power → `--colour-clearance` (#6DD0A9)

### After Selection

The screen fades to black (500ms). Then the terminal boot begins.

---

## Phase 1: Terminal Boot Sequence

### Concept

The screen is black. A blinking cursor appears. Green monospace text begins typing, character by character, as if an intelligence is composing a briefing in real time. The feel: you're being briefed by the system itself. Not a tutorial NPC. Not a narrator. The AI that runs the game is addressing you directly.

### Technical Implementation

- Full-screen, Night Sky (#19191A) background — pure darkness
- Text: Wudoo Mono, `--colour-data` (#90D79F) — the soft green from the MegaETH palette. NOT bright green (#00FF00). This reads as terminal-authentic without looking like a 1980s movie.
- Cursor: block cursor, blinking at 530ms interval (standard terminal blink rate)
- Typing speed: 50 characters per second base, with variable pauses:
  - End of line: 100ms pause
  - End of section (blank line): 400ms pause
  - Before role reveal: 800ms pause (dramatic beat)
  - Before final "AWAITING MANDATE_": 600ms pause
- Occasional "rethink" moments: at 2-3 predetermined points, the system types a word, pauses, deletes it character by character (40ms per character), and types a different word. This subtle detail reinforces that the system is choosing its words carefully — it's intelligent, not scripted.
  - Example: types "sufficient" → deletes → types "critical" 
  - Example: types "manage" → deletes → types "outpace"
- Line wrapping: 70 characters per line max. Left-aligned. No right margin.
- Lines that start with `>` get a slightly brighter text colour (`--text-primary` / Moon White instead of green) — these are system labels, not briefing prose.
- Scroll behaviour: if text exceeds viewport, the view scrolls up smoothly to keep the typing position at ~70% of screen height.

### Skip Behaviour

- Clicking anywhere or pressing any key during the sequence instantly reveals all remaining text (no animation) and holds on the final state for 2 seconds before transitioning.
- A subtle "Press any key to skip" appears in `--text-tertiary` at the bottom of the screen after 5 seconds of playback.
- The "Skip to game →" link from v1 is NOT present during the boot sequence. This is a 60-second experience, not a tutorial they're trapped in. Let it play.

### The Script

Five versions exist — one per role. The situation brief and critical sections are identical across all roles. Only the YOUR ASSIGNMENT block changes.

**Universal sections (all roles):**

```
> MANDATE STRATEGIC INTELLIGENCE SYSTEM
> CLEARANCE: SOVEREIGN OPERATOR
> SESSION: EPOCH 3

> SITUATION BRIEF:

Five sovereign powers are competing to build artificial
general intelligence. Each controls a [sufficient→critical] piece
of the supply chain. None is self-sufficient.

COMPUTE requires CHIPS to build. CHIPS require ENERGY to
fabricate. Fabrication requires TALENT to operate. TALENT
migrates toward better conditions. Better conditions
require CLEARANCE from regulators. Regulators extract
payment from everyone.

The economy is real. Prices are not set — they emerge
from what agents buy and sell. When three powers start
training runs simultaneously, COMPUTE price spikes. When
a supply chain disruption hits, CHIPS become scarce.
Read the market. Anticipate the moves.
```

**Role-specific block (example: Compute Superpower):**

```
> YOUR ASSIGNMENT:

> ROLE: COMPUTE SUPERPOWER
> ADVANTAGE: Large compute capacity. Cheap energy access.
> WEAKNESS: High regulatory scrutiny. CLEARANCE depreciates
  1.5x faster than other roles.

> OBJECTIVE: Highest AGI Progress Score when the epoch
  closes. Build infrastructure. Run training cycles.
  Deploy models. Generate inference revenue.
  [Manage→Outpace] four rivals doing the same.
```

**Role-specific blocks for other roles:**

*Data-Rich State:*
```
> ROLE: DATA-RICH STATE
> ADVANTAGE: Large DATA reserves. Fast DATA regeneration.
> WEAKNESS: Weak CHIPS supply. Cannot scale compute
  without trading.
```

*Chip Power:*
```
> ROLE: CHIP POWER
> ADVANTAGE: CHIPS abundance. Surplus available for trade.
> WEAKNESS: Single points of failure. Vulnerable to supply
  chain disruption events.
```

*Talent Hub:*
```
> ROLE: TALENT HUB
> ADVANTAGE: TALENT regenerates fast. Migrates toward you
  autonomously.
> WEAKNESS: Low ENERGY. Limits your build scale.
```

*Regulatory Power:*
```
> ROLE: REGULATORY POWER
> ADVANTAGE: You set standards. Others pay CLEARANCE costs.
  You do not.
> WEAKNESS: Limited raw resources. No production advantage.
```

**Universal closing (all roles):**

```
> CRITICAL:

You do not operate directly. You have an autonomous AI
agent — ALPHA-7 — that executes on your behalf. It will
trade resources, negotiate with rival agents, build
infrastructure, and respond to market conditions.

It follows your MANDATE — your strategic instructions.
A precise mandate produces a focused agent.
A vague mandate produces a chaotic one.

Your skill is not clicking faster. Your skill is
thinking clearer.

> EPOCH 3 INITIALISING...
> AGENT ALPHA-7 STANDING BY
> AWAITING MANDATE_
```

The `[sufficient→critical]` and `[Manage→Outpace]` notations indicate the "rethink" moments where the system types one word, deletes it, and types the replacement.

### Transition to Dashboard

After the final line ("AWAITING MANDATE_"), the cursor blinks for 2 seconds. Then:

1. The green text fades out (500ms)
2. The game dashboard fades in from black (500ms)
3. A prompt bar appears at the top of the dashboard (inside the layout, not a modal):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ○ Recommended: Take the Dashboard Tour (2 min)    [Start Tour]  [Skip →]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

This bar is `--surface-2` background, Helvetica Neue text, sits below the TopBar. It auto-dismisses after 30 seconds if not interacted with. Clicking "Skip" dismisses it immediately. Clicking "Start Tour" launches Phase 2.

---

## Phase 2: Dashboard Tour

### Concept

A spotlight-based guided tour of the actual game UI. Each step highlights one panel or area, dims everything else, and shows a brief explanation. The player is looking at the real interface with real mock data — not a screenshot or a simplified version.

### Implementation

- **Spotlight effect**: The highlighted panel gets a 2px `--border-focus` border and full opacity. Everything else dims to 40% opacity with `pointer-events: none` (can't click dimmed areas during the tour).
- **Explanation card**: A floating card (200-300px wide) positioned near the highlighted panel (not overlapping it). `--surface-2` background, 1px `--border-default` border, 4px border radius.
- **Navigation**: "Next" button (primary style) and "End tour" link (`--text-tertiary`). Keyboard: Enter/Space = Next, Escape = End tour. Step indicator: "3 of 6" in `--text-tertiary`.
- **Transition between steps**: 300ms crossfade — old spotlight dims, new spotlight brightens.

### Tour Steps

**Step 1: Resource Bar (TopBar)**
- Spotlight: The 7 resource badges + RATE balance in the TopBar
- Card position: Below the TopBar, centred
- Text: "Your resources. Seven types plus RATE, your currency. Each updates in real time as your agent trades. Hover any resource for detail."
- Interactive prompt: "Try hovering COMPUTE now." The tour pauses until the player hovers a resource badge (triggering the tooltip they've already seen from Fix Pass 01). After the tooltip appears and is dismissed, "Next" becomes available.

**Step 2: World Map**
- Spotlight: The map panel
- Card position: Right side of map
- Text: "The world. Each hex is a tile with a terrain type — industrial zones produce CHIPS, research corridors produce TALENT. Claim tiles. Build on them. The map modes at the top show different data layers."
- Interactive prompt: "Click 'Buildings' to see a different view." Tour pauses until the player clicks the Buildings map mode toggle. "Next" appears after they've switched modes.

**Step 3: Order Book**
- Spotlight: The order book DOM ladder
- Card position: Left of the order book
- Text: "The market. Every resource trades against RATE. Prices emerge from real supply and demand — no one sets them. Green rows are buy orders. Red rows are sell orders. The gap between them is the spread."
- No interactive prompt — this is observation only.

**Step 4: Agent Activity Feed**
- Spotlight: The right sidebar (agent feed)
- Card position: Left of the sidebar
- Text: "Your agent's live feed. Every action it takes shows up here — trades, negotiations, mandate executions. Colour-coded by type. This is how you monitor what your agent is doing."
- No interactive prompt.

**Step 5: News Feed**
- Spotlight: The news/events panel below the order book
- Card position: Above the panel
- Text: "World events. Supply disruptions, regulatory changes, talent migrations — events affect resource supply and demand. Colour-coded by resource type. Reading these before other players is an edge."
- No interactive prompt.

**Step 6: Mandate Tab**
- Spotlight: The "Mandate" tab in the ViewSwitcher
- Card position: Below the ViewSwitcher
- Text: "Your most important screen. This is where you write your agent's instructions — your mandate. A precise mandate produces a precise agent."
- Interactive prompt: "Click Mandate to see the editor." Tour pauses until the player clicks the tab. When the Mandate view loads, the tour ends with a final card:
- Closing card: "That's the overview. When you're ready, write your first mandate. The Mandate Mastery tutorial walks you through it step by step." [Start Mandate Mastery] [I'll explore on my own]

### Tour Completion

When the tour ends (either completed or skipped):
- Mark Phase 2 as complete in onboarding state
- Dismiss the spotlight overlay
- If the player clicked "Start Mandate Mastery", immediately begin Phase 3
- If they clicked "I'll explore on my own" or "End tour", return to normal gameplay
- The "Tutorials" entry in the command palette updates: "Dashboard Tour ✓"

---

## Phase 3: Mandate Mastery

### Concept

The player learns to write, submit, and iterate on mandates by actually doing it with the real editor. This uses the MandateEditor component directly — no modals, no simplified versions. The player is in the Mandate view, writing real mandates, with guided prompts appearing as instruction bars inside the panel.

### Instruction Bar

A persistent bar at the top of the Mandate view during mastery:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MANDATE MASTERY  Step 2 of 5              [Skip to game →]                  │
│ Write your own mandate. Use the constraint controls if unsure what to write.│
└──────────────────────────────────────────────────────────────────────────────┘
```

- `--surface-2` background with a subtle left border in `--colour-compute` (2px)
- Title: Wudoo Mono, `--text-primary`, `--text-sm`
- Step counter: `--text-tertiary`
- Instruction: Helvetica Neue, `--text-secondary`, `--text-sm`
- "Skip to game": ghost link, `--text-tertiary`, always visible

### AI-Naive Extra Scaffolding

If the player did NOT check "I've used AI tools" in the self-declaration, the following extras appear during Mandate Mastery. These are additive — they don't replace any steps, they add supplementary UI.

**Emotional mandate translator:** If the player types mandate text that contains emotional/subjective language (detected via keyword list: "please", "careful", "don't let them", "try to", "be smart", "do your best", "make sure"), a subtle inline prompt appears below the text area:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 💡 Your agent responds better to specific instructions.             │
│                                                                      │
│ "Please be careful with CHIPS"                                       │
│  → "Maintain minimum 500 CHIPS reserve at all times"                │
│                                                                      │
│ [Apply suggestion]  [Dismiss]                                        │
└──────────────────────────────────────────────────────────────────────┘
```

This implements the "translate emotional mandate to mechanical" pattern from the research. The suggestion replaces the vague text with a specific constraint. Clicking "Apply" also moves the constraint to Layer 2 if applicable.

**"Same input ≠ same output" notice:** After the first mandate is submitted and the mock round plays, a one-time notice appears in the results:

```
Note: Your agent interprets your mandate freshly each round. The same 
mandate may produce slightly different actions depending on market 
conditions. This is strategic variance, not a bug.
```

This appears once, never again.

### Mastery Steps

**Step 1: "See the difference"**

The without/with mandate demonstration from v1 (Round Zero), but improved:

- Plays inside the Mandate view, not as a modal overlay
- The left panel (where the editor normally is) shows a split view:
  - Top half: "WITHOUT MANDATE" — a mini activity feed showing chaotic agent actions using real FeedEntry components with colour-coded badges
  - Bottom half: "WITH MANDATE" — the same scenario but with strategic actions
- The right panel shows the mandate text that produced the strategic behaviour, rendered in the real Agent Interpretation panel format
- Duration: ~15 seconds. Auto-advances to Step 2.
- Instruction bar: "Step 1 of 5 — This is what your agent does without a mandate vs. with one."

**Step 2: "Edit a template"**

- The MandateEditor loads with a pre-written template mandate in Layer 1, appropriate to the player's role
- Layer 2 is visible but collapsed (the player can expand it if they want, but isn't forced to)
- The instruction bar says: "Step 2 of 5 — Edit this mandate to match your strategy. Change numbers, add constraints, remove lines — make it yours."
- The "Submit Mandate" button requires at least one edit (same as v1, but with the "Edit the mandate above to continue" text from Fix Pass 02)
- After submission: a 15-second mock round plays in the agent feed. Results appear in a compact results bar below the instruction bar:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ROUND RESULT: 4 trades executed. Avg price: 1.34 RATE. Net P&L: +120 RATE  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Auto-advances to Step 3 after 5 seconds (or on click).

**Step 3: "Write your own"**

- The editor clears. Layer 2 is expanded by default.
- Instruction bar: "Step 3 of 5 — Write your own mandate. Use the controls below if you're not sure what to write."
- The Clarity Score is highlighted with a subtle pulse animation on first appearance (draws attention to it)
- If the Clarity Score is below 30 after the player has typed at least 20 characters, a nudge appears below the score: "Try adding a resource priority or a trade limit."
- After submission: mock round plays. Results shown alongside Step 2 results for comparison:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ROUND RESULT: 6 trades. Avg price: 1.28 RATE. P&L: +210 RATE              │
│ vs. previous: +75% improvement in P&L                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Step 4: "Iterate" (SACRED — do not cut)**

This is the most important step in the entire onboarding.

- The editor reloads with the Step 3 mandate pre-filled
- The results from Step 3 are visible in a compact panel on the right, with specific annotations:

```
WHAT HAPPENED:
• Your agent bought COMPUTE at 1.45 when the book had
  offers at 1.30. No price ceiling was set.
• Two trades were rejected by counterparties below your
  reputation threshold — consider lowering to 3500 to
  access more liquidity.
• CHIPS reserve held at 634 (above your 500 floor ✓)

SUGGESTED IMPROVEMENTS:
```

Below the analysis, 3 clickable suggestion chips:

```
[Add COMPUTE price ceiling: 1.35]
[Lower reputation threshold to 3500]
[Add ENERGY sell trigger at 2.0+]
```

Clicking a chip adds the constraint to Layer 2 and generates the corresponding text. The player can also manually edit the mandate text.

- Instruction bar: "Step 4 of 5 — Refine your mandate based on what happened. Great strategists iterate."
- After submission: results play and are compared to Step 3:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ROUND RESULT: 8 trades. Avg price: 1.31 RATE. P&L: +340 RATE              │
│ vs. previous: +62% improvement in P&L                                      │
│ ITERATE TO IMPROVE — this is the core skill of MANDATE                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

The results should always show improvement from Step 3 to Step 4 (mock data is scripted to ensure this). The player needs to feel the improvement loop working.

**Step 5: "You're ready"**

Brief closing message in the instruction bar (not a modal):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MANDATE MASTERY COMPLETE                                                     │
│                                                                              │
│ Your agent is operating on your latest mandate. Update it anytime —          │
│ conditions change, your strategy should too. Check the agent feed to         │
│ monitor execution. Check the news for market-moving events.                  │
│                                                                              │
│ Good luck.                                           [Dismiss]               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The instruction bar dismisses. The player is in the game. The Mandate view stays active — they're looking at their real editor with their real mandate.

### What the AI Toggle Controls

If "I've used AI tools" was checked in self-declaration:
- Step 1 (without/with demonstration) is skipped — AI-literate players already know input quality matters
- The emotional mandate translator does NOT appear
- The "same input ≠ same output" notice does NOT appear
- Steps 2, 3, 4, 5 remain unchanged — these are game-specific, not AI-general

If "I'm familiar with strategy games" was checked:
- Phase 2 (Dashboard Tour) steps are faster — explanation text is shorter, interactive prompts are removed (strategy gamers don't need to be told to hover a resource or click a map mode)
- Phase 3 (Mandate Mastery) is unchanged — writing mandates is unique to MANDATE regardless of strategy experience

---

## Self-Declaration Screen (Revised)

The self-declaration screen now appears AFTER role selection and BEFORE the terminal boot. It's the last screen before the experience begins.

### Flow

```
Role Selection → Self-Declaration → Terminal Boot → Dashboard → [Tour] → [Mastery] → Game
```

### Layout

```
MANDATE

Before we begin:

☐ I'm familiar with strategy games
☐ I've used AI tools (ChatGPT, Claude, etc.)

                [Begin]
```

Two toggles, not three. The crypto toggle is removed (blockchain is invisible — nothing to teach). Each toggle uses the custom Toggle component (checkboxes, not radio buttons — independent selections).

If both are checked → Terminal boot plays, then player lands in the game with the recommendation bar ("Take the Dashboard Tour") but no automatic onboarding.

If neither is checked → Terminal boot plays, then Dashboard Tour starts automatically (no recommendation bar — it just begins), then Mandate Mastery is recommended after the tour.

If only strategy is checked → Dashboard Tour is abbreviated (shorter text, no interactive prompts), Mandate Mastery runs with AI-naive scaffolding.

If only AI is checked → Dashboard Tour runs normally, Mandate Mastery runs without extra scaffolding.

---

## Mock Data Requirements

### New mock data needed:

**onboarding-boot-scripts.ts:**
```typescript
export interface BootScript {
  role: PlayerRole;
  lines: BootLine[];
}

export interface BootLine {
  text: string;
  isLabel: boolean;          // true = render in Moon White with > prefix
  rethink?: {                // optional "delete and retype" moment
    original: string;        // word to type first
    replacement: string;     // word to replace it with
  };
  pauseAfter?: number;       // ms pause after this line (default: 100)
}
```

Create 5 boot scripts (one per role). Universal sections are shared, only the YOUR ASSIGNMENT block differs.

**onboarding-mastery-scripts.ts:**
```typescript
export interface MasteryRoundScript {
  feedEntries: TimedFeedEntry[];    // timed entries for the mock round
  results: RoundResult;
}

export interface TimedFeedEntry {
  delay: number;                    // ms after round start
  entry: AgentFeedEntry;
}

export interface RoundResult {
  tradesExecuted: number;
  avgPrice: number;
  pnl: number;
  annotations?: string[];          // what-happened notes for Step 4
  suggestions?: string[];          // clickable chip text for Step 4
}
```

Create scripts for: `chaoticAgent` (Step 1 top), `strategicAgent` (Step 1 bottom), `templateRound` (Step 2), `ownMandateRound` (Step 3), `iteratedMandateRound` (Step 4 — must show improvement over Step 3).

**emotional-keywords.ts:**
```typescript
export const EMOTIONAL_KEYWORDS = [
  'please', 'careful', 'try to', 'be smart', 'do your best',
  'make sure', 'don\'t let', 'hope', 'maybe', 'if possible',
  'kind of', 'sort of', 'I think', 'perhaps', 'nicely'
];

export const EMOTIONAL_TRANSLATIONS: Record<string, string> = {
  'please be careful with CHIPS': 'Maintain minimum 500 CHIPS reserve at all times',
  'try to get a good price': 'Set maximum buy price at current market + 10%',
  'don\'t let them take advantage': 'Reject any trade where we give more value than we receive',
  'be smart about trading': 'Compare prices across all counterparties before executing',
  'make sure we have enough ENERGY': 'Maintain ENERGY reserve above 200 at all times',
  // ... more mappings
};
```

---

## Acceptance Criteria

### Role Selection
- [ ] Role selection screen renders with 5 role cards and "Let the system decide" button
- [ ] Each card shows role name and starting advantage only (not weakness)
- [ ] Hover state shows resource-coloured glow
- [ ] "Let the system decide" triggers shuffle animation and random selection
- [ ] Selected role is stored and passed to the boot sequence

### Terminal Boot
- [ ] Full-screen black background with Wudoo Mono green text (#90D79F)
- [ ] Character-by-character typing at ~50 chars/sec with section pauses
- [ ] 2-3 "rethink" moments where text is deleted and replaced
- [ ] Role-specific assignment block matches selected role
- [ ] Weakness is revealed during boot (not shown on selection screen)
- [ ] Clicking or pressing any key skips to end state
- [ ] "Press any key to skip" appears after 5 seconds
- [ ] Smooth transition from boot to dashboard (green text fades out, dashboard fades in)
- [ ] Recommendation bar appears after transition

### Dashboard Tour
- [ ] Spotlight effect highlights one panel at a time, dims everything else
- [ ] 6 tour steps covering: resources, map, order book, agent feed, news, mandate tab
- [ ] Steps 1, 2, and 6 have interactive prompts (hover resource, click map mode, click mandate tab)
- [ ] "End tour" link always available
- [ ] Escape key ends tour
- [ ] Tour is launchable from command palette after first completion
- [ ] Strategy-gamer variant: shorter text, no interactive prompts

### Mandate Mastery
- [ ] Step 1: Without/with mandate demonstration plays using real FeedEntry components
- [ ] Step 2: Real editor loads with template, requires one edit before submit
- [ ] Step 3: Empty editor with Layer 2 expanded, clarity score visible and reactive
- [ ] Step 4: Pre-filled mandate with annotations and suggestion chips, results show improvement
- [ ] Step 5: Completion message in instruction bar, dismisses to normal editor
- [ ] All steps use the real MandateEditor component (not modals or simplified versions)
- [ ] Instruction bar visible throughout with step counter and "Skip to game" link
- [ ] Results bar shows metrics after each round with comparison to previous

### AI-Naive Scaffolding
- [ ] Emotional mandate translator appears when subjective keywords detected (only if AI toggle unchecked)
- [ ] Translator shows specific before→after suggestion with Apply/Dismiss
- [ ] "Same input ≠ same output" notice appears once after first submission (only if AI toggle unchecked)
- [ ] AI-literate players (toggle checked) skip Step 1 and don't see translator or variance notice

### Module System
- [ ] Command palette shows "Dashboard Tour" and "Mandate Mastery" under TUTORIALS category
- [ ] Completed modules show ✓, uncompleted show "○ recommended"
- [ ] Modules are re-launchable from command palette at any time
- [ ] Interrupting a module (via Skip or navigating away) doesn't break the game state
- [ ] Modules can be resumed from the command palette (restart from beginning is acceptable)
