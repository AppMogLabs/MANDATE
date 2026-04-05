# MANDATE Frontend — Step 4: Mandate Editor & Onboarding Flow

**App Mog Labs | March 2026**
**Design Spec for Claude Code Implementation**

---

## Read This First

This document specifies the mandate editor UI and the player onboarding flow. These are the two most design-sensitive pieces in the entire frontend — the mandate editor is the core interaction of the game, and the onboarding flow determines whether players stay past the first 10 minutes.

**The mandate editor is not a text box.** It is a three-layer interface that scaffolds the transition from structured inputs to free-form strategic writing. New players use the structured builder. Experienced players write free text. The editor serves both simultaneously and makes the transition between them natural.

**The onboarding flow is not a tutorial.** It is a sequence of playable rounds that teach through demonstration, not documentation. No modal tutorials. No overlay tooltips. No "click here to continue." Players learn by doing, with the game progressively revealing complexity as they demonstrate competency.

### Dependencies

- Step 1 + Step 2 must be complete (design system, component library, static shell)
- The mandate schema is not yet finalised in Phase 4. This spec defines the editor's interaction model and data shape. The Phase 4 protocol spec will adopt or adapt this shape. If conflicts arise, flag them — do not resolve them.
- Onboarding uses mock data throughout. No chain connection needed.

### Hard Boundaries

Do not:
- Implement actual LLM integration (the agent interpretation preview uses mock responses)
- Build the guard agent validation flow (Phase 4 scope)
- Implement real mandate submission to chain (uses mock confirmation)
- Build the template gallery with user-generated content (use pre-written templates only)
- Choose an LLM provider or model for the interpretation preview

---

## Part 1: The Mandate Editor

### 1.1 The Three-Layer Mandate Model

Every mandate has three layers visible in the editor. The player directly controls Layers 1 and 2. Layer 3 is read-only context.

**Layer 1 — Strategic Intent (free text)**
What the player wants to achieve, in their own words. This is the natural-language mandate. It lives in a Wudoo Mono text area and is the primary input for experienced players.

Example:
```
Prioritise COMPUTE acquisition for the next training run. Trade surplus 
ENERGY at no less than 1.5:1 ratio. Build a second Data Centre if CHIPS 
price drops below 2.0. Avoid deals with agents below 4000 reputation. 
Maintain minimum 500 CHIPS reserve at all times.
```

**Layer 2 — Operational Constraints (structured)**
Machine-readable parameters that constrain the agent's behaviour. These are set via UI controls (sliders, dropdowns, toggles, number inputs) and rendered as a structured block below the free text. Players can also type constraints directly in Layer 1 — the UI should detect structured patterns and offer to move them to Layer 2.

**Layer 3 — Machine Context (read-only)**
Chain state the agent reads automatically: current resource balances, building inventory, market prices, epoch progress, role-specific modifiers, active reflex clauses. Displayed as a collapsible read-only panel so the player can see exactly what their agent knows.

### 1.2 Editor Layout

```
┌─────────────────────────────────────────┬──────────────────────────┐
│                                         │                          │
│  MANDATE EDITOR                         │  AGENT INTERPRETATION    │
│                                         │                          │
│  ┌─────────────────────────────────┐    │  "Based on your mandate, │
│  │ Layer 1: Strategic Intent       │    │   I plan to..."          │
│  │                                 │    │                          │
│  │ [Wudoo Mono text area]          │    │  • Priority actions      │
│  │ [free text, resizable]          │    │  • Constraints detected  │
│  │                                 │    │  • Potential conflicts   │
│  └─────────────────────────────────┘    │  • Confidence level      │
│                                         │                          │
│  ┌─────────────────────────────────┐    │                          │
│  │ Layer 2: Operational Constraints│    │                          │
│  │                                 │    │                          │
│  │ [Structured controls]           │    │                          │
│  │ [Sliders, dropdowns, toggles]   │    │                          │
│  └─────────────────────────────────┘    │                          │
│                                         │                          │
│  ▸ Layer 3: Machine Context (collapsed) │                          │
│                                         ├──────────────────────────┤
│  ┌─────────────────────────────────┐    │  MANDATE HISTORY         │
│  │ [Submit Mandate]  [Save Draft]  │    │  v3 ← v2 ← v1           │
│  │ Clarity Score: 78/100           │    │  [Diff view]             │
│  └─────────────────────────────────┘    │                          │
│                                         │                          │
└─────────────────────────────────────────┴──────────────────────────┘
```

Left panel (~60% width): The editor itself — Layers 1, 2, 3, and the submit controls.
Right panel (~40% width): Agent interpretation preview (top) and mandate history with diff view (bottom).

### 1.3 Layer 1: Strategic Intent — The Text Area

**Visual design:**
- Wudoo Mono font, `--text-base` (14px)
- Night Sky background with `--surface-1` for the input area
- 1px `--border-default` border, `--border-focus` on focus
- Min height: 120px. Resizable vertically (drag handle at bottom).
- Line numbers in `--text-tertiary` on the left margin (like a code editor — reinforces the "this is instructions, not prose" mental model)
- Placeholder text (when empty): "Write your strategic intent here. What do you want your agent to prioritise? What should it avoid? What are your constraints?" in `--text-tertiary`

**Inline intelligence:**
- As the player types, detect resource names (COMPUTE, ENERGY, etc.) and highlight them in their resource accent colour. This provides instant visual feedback that the system understands game-specific terms.
- Detect numeric values near resource names and underline them — these are potential constraint values that could be moved to Layer 2.
- Detect agent names mentioned in the text and render them as subtle badges.

**Template insertion:**
- A "Templates" button in the top-right of the text area opens a dropdown of pre-written mandate templates appropriate to the player's role. Selecting a template replaces the text area content (with confirmation if content exists).
- Templates are categorised: "Aggressive", "Defensive", "Economic", "Diplomatic", "Balanced"
- Each template is a complete mandate appropriate to the role, with placeholder values marked in `[brackets]` that the player fills in.

**Prompt rewrite button:**
- A small "Enhance" button (icon: sparkle/wand) in the toolbar above the text area.
- On click: takes the current text, generates an enhanced version with more specific constraints (mock response in Step 4 — will be LLM-powered in production).
- Shows the enhanced version in a diff view — player accepts, rejects, or edits.
- This is the prompt rewrite pattern from the UX research. It lowers the articulation barrier by letting players edit rather than create from scratch.

### 1.4 Layer 2: Operational Constraints — The Structured Builder

Below the text area, a structured panel with sections that expand/collapse:

**Trading Constraints:**

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Trading Aggressiveness | Slider (1-10) | 5 | 1 = only accept favourable deals, 10 = accept any deal to acquire target |
| Minimum Trade Ratio | Number input per resource | 1.0 | Reject trades below this ratio (resource:RATE) |
| Preferred Counterparties | Multi-select (agent list) | None | Prioritise deals with these agents |
| Blocked Counterparties | Multi-select (agent list) | None | Never trade with these agents |
| Minimum Counterparty Reputation | Number input (0-10000) | 0 | Reject deals with agents below this score |

**Resource Reserves:**

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Reserve Floor per Resource | Number input × 7 | 0 each | Never let balance drop below this |
| Priority Resource | Single-select dropdown | None | Resource to acquire first |
| Secondary Resource | Single-select dropdown | None | Resource to acquire after priority |

**Risk Management:**

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Max Single Trade Size | Number input | Unlimited | Cap the size of any individual trade |
| Reflex Window Participation | Toggle | On | Allow agent to act in 100ms reflex windows |
| Auto-Hedge on Event | Toggle | Off | Automatically adjust positions when world events fire |
| Insurance Coverage | Toggle | Off | Purchase insurance if available and affordable |

**Diplomatic Stance:**

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Negotiation Style | Select: Cooperative / Neutral / Aggressive | Neutral | How the agent approaches bilateral negotiations |
| Alliance Willingness | Slider (1-10) | 5 | 1 = solo play, 10 = actively seek partnerships |
| Information Sharing | Select: None / Selective / Open | Selective | What the agent reveals in negotiations |

**Building Strategy:**

| Control | Type | Default | Description |
|---------|------|---------|-------------|
| Build Priority | Select: Expand / Upgrade / Consolidate | Expand | New buildings vs. upgrading existing vs. holding |
| Target Building | Select (building type list) | None | Next building to construct if resources allow |
| Tile Expansion Limit | Number input | 10 | Max tiles to claim |

**How Layer 2 interacts with Layer 1:**
- When a Layer 2 control is changed, a corresponding natural-language clause is appended to a "Generated Constraints" block below the Layer 1 text area. This block is visually distinct (slightly dimmed, with a "Generated from controls" label) but editable.
- Example: Setting "Minimum Counterparty Reputation" to 4000 generates: `Reject deals with agents below 4000 reputation.`
- If the player writes a constraint in Layer 1 that matches a Layer 2 control (e.g. "never let CHIPS drop below 500"), the UI shows a subtle prompt: "Move to structured constraint?" with a one-click action that sets the Reserve Floor for CHIPS to 500 and removes the text from Layer 1.
- This bidirectional sync is the key interaction. It teaches players that structured constraints and free text are two ways of saying the same thing.

### 1.5 Layer 3: Machine Context — Read-Only

A collapsible section showing what the agent can see from chain state:

- Current resource balances (7 resources + RATE)
- Current market prices for each resource pair
- Building inventory (list of owned buildings with tier and production status)
- Epoch progress (time remaining, current ranking)
- Role-specific modifiers (e.g. "Compute Superpower: CLEARANCE depreciates at 1.5× rate")
- Active world events (headlines + known impact)
- Active reflex clauses (from GuardClauseMarketplace purchases)

All read-only. Helvetica Neue for labels, Wudoo Mono for values. Default collapsed — expands on click. The purpose is transparency: the player can see exactly the same context their agent sees.

### 1.6 Agent Interpretation Preview (Right Panel)

**This is the intent preview pattern from the UX research — the single most important trust-building mechanism.**

After the player writes or modifies their mandate (with a 1-second debounce), the right panel shows the agent's interpretation:

```
AGENT INTERPRETATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Based on your mandate, I plan to:

1. ACQUIRE COMPUTE (high priority)
   → Scan order book for offers below 1.30 RATE
   → Accept up to 1.45 RATE if book is thin
   → Target: 2,000 units before training run

2. SELL surplus ENERGY
   → List at 1.50 RATE minimum
   → Accept 1.45 if buyer rep > 6000

3. BUILD Data Centre
   → Condition: CHIPS price < 2.00 RATE
   → Current CHIPS price: 2.15 — monitoring

4. MAINTAIN reserves
   → CHIPS floor: 500 (current: 634 ✓)
   → Will not trade below floor

CONSTRAINTS DETECTED: 5
POTENTIAL CONFLICTS: 0
CONFIDENCE: HIGH

⚠ Note: "Avoid deals with agents below 4000 
reputation" may limit available counterparties 
in current market (only 3 of 8 agents qualify).
```

**Visual design:**
- Wudoo Mono throughout (this is agent output — terminal register)
- Numbered plan items with clear action verbs
- Resource names highlighted in their accent colours
- Constraints count, conflicts count, and confidence level as summary metrics
- Warnings/notes in `--status-warning` colour for potential issues
- A "Refresh" button to manually re-trigger interpretation

**For Step 4 implementation:** Use mock interpretation responses. Create 5-6 pre-written interpretations that correspond to different mandate styles (aggressive trading, defensive holding, diplomatic, etc.). Pattern-match on keywords in the mandate text to select the most appropriate mock response. This will be replaced by actual LLM calls in production.

### 1.7 Mandate History (Right Panel, Bottom)

Below the interpretation preview:

- List of previous mandate versions: "v3 (current) | v2 (2h ago) | v1 (12h ago)"
- Click any version to see it in a read-only view
- "Compare" button shows a diff between any two versions (green for additions, red for removals — standard diff colouring but using `--status-success` and `--status-critical`)
- Performance annotations on each version: "v2: Active for 2 hours. 14 trades executed. Net P&L: +340 RATE"

This implements the iteration-reinforcement pattern from the UX research — making mandate evolution visible encourages the iterate-and-improve habit.

### 1.8 Mandate Clarity Score

Below the submit button, a prominent metric:

**Mandate Clarity Score: 78/100**

Visual: horizontal progress bar, colour interpolated from `--status-critical` (0-30) through `--status-warning` (30-70) to `--status-success` (70-100).

Scoring factors (shown on hover as a tooltip breakdown):
- Specificity: Are resources named explicitly? (0-25)
- Constraints: Are there measurable limits? (0-25)
- Priorities: Is there a clear ordering? (0-25)
- Completeness: Are all major domains covered (trading, building, risk, diplomacy)? (0-25)

For Step 4: implement as a simple heuristic scorer that counts keywords, numeric values, resource names, and conditional patterns. Not LLM-powered — this should be fast and deterministic so it updates as the player types.

### 1.9 Submit Flow

When the player clicks "Submit Mandate":

1. **Confirmation modal** — shows the full mandate (Layer 1 text + Layer 2 generated constraints) and the agent's interpretation side by side. "Your agent will execute based on this interpretation. Confirm?"
2. **Processing state** — 500ms deliberate delay with "Submitting mandate..." in Wudoo Mono (perceived reliability pattern from UX research — this will be an actual on-chain transaction in production)
3. **Confirmation** — "Mandate active. Your agent is now operating under v4." Brief, no celebration.
4. **Auto-checkpoint** — the previous mandate state is saved to history automatically

The "Save Draft" button saves without submitting. Drafts appear in the mandate history with a "draft" tag.

---

## Part 2: The Onboarding Flow

### 2.1 Architecture

The onboarding is a sequence of **5 guided rounds** that play before the main game begins. Each round teaches a specific concept through gameplay, not exposition. The player can skip the entire onboarding at any point ("Skip to game" button always visible, subdued, in the top-right).

The onboarding state is tracked in local component state (not chain, not localStorage — React state only, since artifacts can't use browser storage). If the player refreshes, onboarding restarts. This is acceptable for Step 4.

### 2.2 Self-Declaration Screen (Pre-Onboarding)

Before onboarding begins, a single screen with three independent toggles:

```
MANDATE

Before we begin, help us calibrate your experience.

□ I'm familiar with crypto and wallets
□ I'm familiar with strategy games  
□ I've used AI tools (ChatGPT, Claude, etc.)

[Begin]                              [Skip to game →]
```

**Visual design:**
- Centred on Night Sky background. No panels, no chrome — clean single-purpose screen.
- Helvetica Neue for the question. Wudoo Mono for the toggle labels.
- Checkboxes using the custom Toggle component (not native browser checkboxes).
- "Begin" button: primary style. "Skip to game": ghost style, `--text-tertiary`.

**What the toggles control:**
- Each unchecked box adds the corresponding tutorial track to the onboarding sequence.
- If all three are checked → skip directly to game (with a brief "Welcome back" message).
- If none are checked → full 5-round onboarding.
- Partial checks → abbreviated onboarding covering only the gaps.

### 2.3 Round Zero — "The Agent Without a Mandate"

**Purpose:** Establish the mental model that the player's mandate quality determines outcomes.

**What the player sees:**

1. A simplified game board (3 tiles, 2 agents visible, reduced to COMPUTE and ENERGY only — not all 7 resources).
2. Text overlay: "This is your agent. It has no mandate."
3. The agent acts randomly for ~10 seconds (mock): random trades, accepts bad deals, ignores a price spike. The activity feed shows chaotic, purposeless actions in Wudoo Mono.
4. Text overlay: "Now, with a mandate."
5. A well-written mandate fades in on the left side of the screen. The same scenario replays with the agent now acting strategically — buying low, selling high, rejecting bad deals.
6. The activity feed shows purposeful, logical actions.
7. Text overlay: "Your mandate is the difference. Let's write your first one."

**Visual design:**
- Dimmed main UI behind. The demonstration plays in a focused centre panel.
- No player interaction required — this is a 20-second demonstration, not a tutorial step.
- The agent activity feed is the star — the contrast between chaotic and strategic actions should be visceral.
- "Skip" link in bottom-right, `--text-tertiary`.

**Implementation:** Two pre-scripted mock feed sequences (chaotic and strategic) that play with timed delays to simulate real-time agent activity.

### 2.4 Round One — "Edit, Don't Create"

**Purpose:** Lower the articulation barrier by starting with editing, not writing.

**What the player sees:**

1. The mandate editor opens with a pre-written template mandate already in the text area, appropriate to the player's assigned role.
2. Text above the editor: "Here's a starting mandate for a [role name]. Edit it to match your strategy."
3. Three specific edits are highlighted with subtle annotations:
   - "Change this number to set your trade threshold"
   - "Replace this resource name with your priority"
   - "Remove this line if you don't want this constraint"
4. The agent interpretation panel updates in real-time as the player edits.
5. "Submit Mandate" button appears once the player has made at least one edit.
6. After submission, a brief round plays out (~15 seconds of mock agent activity) showing the mandate in action.
7. Outcome summary: "Your agent executed 4 trades. Net P&L: +120 RATE."

**What's simplified:**
- Only 3 resources visible (COMPUTE, ENERGY, CHIPS).
- Layer 2 constraints panel is hidden — text-only editing in this round.
- Only the player's agent visible — no rival agents.

### 2.5 Round Two — "Your Turn to Write"

**Purpose:** Transition from editing to authoring.

**What the player sees:**

1. The mandate editor opens empty. Layer 2 structured builder is now visible.
2. Text above: "Write your own mandate. Use the controls below if you're not sure what to write."
3. The structured builder (Layer 2) is expanded by default. As the player adjusts controls, generated text appears in a "Generated Constraints" block.
4. The player can also type directly in Layer 1.
5. The Clarity Score is visible and updates in real-time — a low score (below 40) triggers a subtle nudge: "Try adding a resource priority or a trade limit to improve your score."
6. After submission, a longer round plays out (~30 seconds) and the outcome is shown alongside the Round One outcome for comparison.

**What's new in this round:**
- Full mandate editor UI (Layers 1 + 2).
- Clarity Score visible and reactive.
- Comparison with previous round's performance.

### 2.6 Round Three — "The Iteration Round"

**Purpose:** Establish the habit of iterating on mandates.

**What the player sees:**

1. After Round Two's results, the editor reopens with the Round Two mandate pre-loaded.
2. The result summary is visible on the right: "Your agent bought COMPUTE at 1.45 when the market was 1.30. Consider adding a price ceiling."
3. Specific suggestions are shown as clickable chips: "Add price ceiling for COMPUTE" / "Increase reputation threshold" / "Add reserve floor for CHIPS"
4. Clicking a chip adds the corresponding constraint to Layer 2 and generates the text in the Generated Constraints block.
5. The mandate history panel shows v1 (Round One) → v2 (Round Two) → v3 (this edit) with diff view available.
6. After submission, results play out and are compared to Round Two.

**What's new:**
- Iteration suggestions based on previous round's performance.
- Mandate history with diff view.
- Direct comparison between consecutive mandate versions.

### 2.7 Round Four — "Constraints Are Power"

**Purpose:** Teach that specificity beats generality.

**What the player sees:**

1. Split-screen demonstration (no player input needed):
   - Left: an agent with a vague mandate ("Acquire resources and grow.")
   - Right: an agent with a specific mandate (full Layer 1 + Layer 2 constraints)
2. Both agents play through an identical scenario (~15 seconds).
3. Results appear side by side with clear metrics: trades executed, average price paid, resources acquired, P&L.
4. The specific mandate dramatically outperforms the vague one.
5. Text overlay: "Constraints don't limit your agent. They focus it."
6. The player's own mandate from Round Three reappears with the Clarity Score highlighted. A prompt: "Want to add more constraints before we begin?"

**What's new:**
- Direct A/B comparison of vague vs. specific mandates.
- Explicit articulation of the "constraints are power" principle.

### 2.8 Round Five — "The Full Game"

**Purpose:** Transition to the real game with all systems visible.

**What the player sees:**

1. Brief text: "You're ready. All systems are now active."
2. The full UI loads — all 7 resources, all panels, all views. The mandate editor retains whatever the player wrote in Round Three (plus any Round Four additions).
3. Rival agents are now visible in the activity feed and on the map.
4. The information market is active (free tier visible, analyst/premium locked).
5. No more guided overlays — the player is in the live game.

**Progressive reveals:**
- The Intelligence view tab pulses subtly once during the first epoch — drawing attention without forcing interaction.
- The first world event that fires shows a brief one-line explainer at the bottom: "World events affect resource supply and demand. Check the news feed."
- If the player hasn't edited their mandate in 10 minutes of game time, a subtle prompt in the mandate panel: "Your agent is operating on your last mandate. Update it if conditions have changed."

After this, no more onboarding elements appear. The player is in the game.

### 2.9 What Gets Skipped

Based on the self-declaration toggles:

**"I'm familiar with crypto"** → Skip: nothing in the current onboarding mentions crypto (by design — blockchain is invisible). This toggle exists for future use when Step 3 adds wallet features.

**"I'm familiar with strategy games"** → Skip: Round Five's progressive reveals (the subtle pulses and one-line explainers). Strategy gamers don't need nudges to explore the interface.

**"I've used AI tools"** → Skip: Round Zero (the without/with mandate demonstration) and Round Four (the constraints demonstration). AI-literate players already understand that input quality determines output quality.

**All three checked** → Skip all onboarding. Show a brief "Welcome" screen with the player's role assignment, then drop into the full game with an empty mandate editor.

---

## Part 3: Mock Data & Implementation Notes

### 3.1 New Mock Data Needed

Add to `/src/mock/`:

**mandate-templates.ts:**
```typescript
export interface MandateTemplate {
  id: string;
  name: string;
  category: 'aggressive' | 'defensive' | 'economic' | 'diplomatic' | 'balanced';
  applicableRoles: PlayerRole[];
  text: string;                    // Layer 1 text with [bracket] placeholders
  constraints: ConstraintValues;   // Layer 2 defaults
}
```

Create 3 templates per role (15 total) across the 5 categories. Each template should be a genuine, playable mandate — not filler text.

**mandate-interpretations.ts:**
```typescript
export interface MockInterpretation {
  keywords: string[];              // Mandate keywords that trigger this interpretation
  plan: InterpretationStep[];
  constraintsDetected: number;
  conflicts: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

export interface InterpretationStep {
  action: string;
  details: string[];
  resource?: ResourceType;
  priority: 'high' | 'medium' | 'low';
}
```

Create 6 mock interpretations matching different mandate styles.

**onboarding-scripts.ts:**
```typescript
export interface OnboardingFeedScript {
  entries: {
    delay: number;                 // ms after round start
    entry: AgentFeedEntry;
  }[];
}
```

Create: `chaoticAgentScript` (Round Zero without mandate), `strategicAgentScript` (Round Zero with mandate), `roundOneScript`, `roundTwoScript`, `roundThreeScript`, `vagueAgentScript` (Round Four left), `specificAgentScript` (Round Four right).

### 3.2 Clarity Score Heuristic

Implement as a pure function that scores the mandate text + Layer 2 constraints:

```typescript
function calculateClarityScore(text: string, constraints: ConstraintValues): ClarityBreakdown {
  return {
    specificity: scoreSpecificity(text),      // 0-25: count resource names, agent names, specific numbers
    constraints: scoreConstraints(constraints, text), // 0-25: count measurable limits (floors, ceilings, ratios)
    priorities: scorePriorities(text),         // 0-25: detect ordering words ("first", "then", "priority", "before")
    completeness: scoreCompleteness(text, constraints), // 0-25: check if trading, building, risk, diplomacy covered
    total: 0 // sum of above
  };
}
```

Should update on every keystroke (debounced 300ms). Pure computation, no LLM.

### 3.3 Resource Name Highlighting

Use a regex-based approach to detect the 7 canonical resource names (COMPUTE, ENERGY, CHIPS, COOLING, TALENT, DATA, CLEARANCE) plus RATE in the text area. Wrap them in `<span>` elements with the corresponding resource accent colour. Also detect common abbreviations (CMP, NRG, CHP, etc.) and highlight those.

This runs on every text change. Keep it fast — no debounce needed for this, it's a simple regex pass.

### 3.4 Bidirectional Layer 1 ↔ Layer 2 Sync

The hardest UI engineering problem in the editor. Rules:

1. **Layer 2 → Layer 1**: When a Layer 2 control changes, append or update the corresponding clause in the "Generated Constraints" block. Each generated clause has a data attribute linking it to its Layer 2 control. If the control is reset to default, remove the clause.

2. **Layer 1 → Layer 2**: When the player types a pattern that matches a Layer 2 control (e.g. "minimum 500 CHIPS" → Reserve Floor for CHIPS = 500), show a subtle inline suggestion: "📌 Move to constraint?" Clicking moves the value to Layer 2 and removes the text from Layer 1.

3. **Conflict resolution**: If Layer 1 text says "never trade CHIPS below 2.0" and Layer 2 has Minimum Trade Ratio for CHIPS set to 1.5, highlight the conflict in both places with `--status-warning` and a note: "Layer 1 says 2.0, Layer 2 says 1.5 — which should your agent follow?"

For Step 4 implementation: The Layer 2 → Layer 1 direction is the priority. Layer 1 → Layer 2 detection can be simplified to exact pattern matching (resource name + number within 10 characters) rather than full NLP.

### 3.5 Onboarding State Machine

```
START
  ↓
SELF_DECLARATION
  ↓ (toggles determine which rounds to include)
ROUND_ZERO (skippable if AI-literate)
  ↓
ROUND_ONE
  ↓
ROUND_TWO
  ↓
ROUND_THREE
  ↓
ROUND_FOUR (skippable if AI-literate)
  ↓
ROUND_FIVE → GAME
```

Each round has three phases: INTRO (text overlay, 2-3 seconds), PLAY (player interaction or demonstration), RESULT (outcome display, 5 seconds). Transitions between rounds are 500ms fades.

The state machine should be a simple React state reducer. No routing — the onboarding is an overlay on top of the main app, which loads in the background.

---

## Part 4: Visual Design Details

### 4.1 Mandate Editor Text Area

- Background: `--surface-1`
- Border: 1px `--border-default`, `--border-focus` on focus
- Text: Wudoo Mono, `--text-primary`, `--text-base`
- Line numbers: `--text-tertiary`, `--text-xs`, right-aligned in a 32px left gutter
- Placeholder: `--text-tertiary`, italic
- Resource highlights: inline `<span>` with the resource accent colour, no background
- Cursor: Moon White, standard text cursor
- Selection: `--colour-compute` at 20% opacity background

### 4.2 Layer 2 Controls

- Section headers: Helvetica Neue, `--text-lg`, `--text-primary`, with collapse chevron
- Labels: Helvetica Neue, `--text-sm`, `--text-secondary`
- Sliders: thin track (2px) in `--border-default`, thumb in `--text-primary`, active range in `--colour-compute`
- Number inputs: Wudoo Mono, 60px wide, right-aligned, `--surface-1` background
- Dropdowns: Helvetica Neue, `--surface-2` dropdown, `--border-default` border
- Toggles: existing Toggle component from Step 1

### 4.3 Agent Interpretation Panel

- Background: `--surface-1` (slightly raised from base)
- Title: "AGENT INTERPRETATION" in Helvetica Neue, `--text-secondary`, `--text-xs`, uppercase, letter-spacing 0.1em
- Body: Wudoo Mono throughout
- Plan numbers: `--text-primary`, bold
- Action text: `--text-primary`
- Detail text (indented with →): `--text-secondary`
- Resource mentions: highlighted in accent colour
- Metrics row: three items in a row — "Constraints: 5" / "Conflicts: 0" / "Confidence: HIGH" — using StatusDot colours
- Warnings: `--status-warning` text with ⚠ prefix

### 4.4 Clarity Score Bar

- Width: 100% of the bottom submit area
- Height: 8px
- Track: `--surface-hover` (empty portion)
- Fill: gradient from `--status-critical` (0) through `--status-warning` (50) to `--status-success` (100)
- Label: "Clarity Score: 78/100" in Helvetica Neue, `--text-secondary`, `--text-sm`, above the bar
- On hover: tooltip showing the four sub-scores with their individual bar segments

### 4.5 Onboarding Overlays

- Background: `--night-sky` at 90% opacity (game UI visible but dimmed behind)
- Centre panel: `--surface-2`, max-width 800px, rounded corners (4px — exception to the 0px panel rule, since this is a modal overlay)
- Text: Helvetica Neue for instructions, Wudoo Mono for any game content shown
- "Skip" link: `--text-tertiary`, bottom-right, always visible
- Transition: 300ms fade between screens

---

## Part 5: Acceptance Criteria

### Mandate Editor
- [ ] Three-layer editor layout renders correctly (text area + structured controls + machine context)
- [ ] Layer 1 text area uses Wudoo Mono with line numbers and resource name highlighting
- [ ] Layer 2 structured controls are functional for all 5 sections (Trading, Resources, Risk, Diplomacy, Building)
- [ ] Layer 2 changes generate corresponding text in the Generated Constraints block
- [ ] Layer 3 machine context panel shows mock chain state (collapsed by default, expandable)
- [ ] Agent interpretation preview updates (debounced 1s) when mandate text changes
- [ ] Interpretation shows numbered plan, constraints count, conflicts, confidence, and warnings
- [ ] Mandate history shows version list with timestamps and performance annotations
- [ ] Diff view between any two mandate versions works (additions green, removals red)
- [ ] Clarity Score updates in real-time as player types, with correct sub-score breakdown on hover
- [ ] Submit flow shows confirmation modal → processing state (500ms) → success message
- [ ] Save Draft saves without submitting, appears in history with "draft" tag
- [ ] Template dropdown shows role-appropriate templates, inserts on selection with confirmation
- [ ] Enhance button shows mock diff of improved mandate text
- [ ] All text follows dual typography register (Wudoo Mono for mandate/agent content, Helvetica Neue for UI chrome)

### Onboarding Flow
- [ ] Self-declaration screen renders with three toggles and Begin/Skip buttons
- [ ] Round Zero plays the without/with mandate demonstration as a timed sequence
- [ ] Round One loads with a pre-written template and requires at least one edit before submission
- [ ] Round Two shows the full editor with structured builder expanded by default
- [ ] Round Three pre-loads the previous mandate with iteration suggestions as clickable chips
- [ ] Round Four shows side-by-side vague vs. specific mandate comparison
- [ ] Round Five transitions to full game with all panels visible
- [ ] Skipping AI-related rounds works when "I've used AI tools" is checked
- [ ] Skipping strategy-related rounds works when "I'm familiar with strategy games" is checked
- [ ] "Skip to game" from any onboarding screen drops into the full game immediately
- [ ] Onboarding state survives view transitions (doesn't reset if player opens command palette)
- [ ] No tutorial modals, overlay tooltips, or "click here" markers — all teaching is through gameplay

---

## What Comes Next (Do Not Build Yet)

- **LLM integration**: Replace mock interpretations with actual LLM calls for the agent interpretation preview
- **Template gallery with user content**: Allow players to share and rate mandate templates
- **Guard agent validation**: Show guard agent's review of the mandate before submission
- **Mandate-to-chain submission**: Actual on-chain mandate hash commitment
- **Advanced onboarding analytics**: Track where players drop off, A/B test round order
