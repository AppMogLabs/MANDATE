# MANDATE Frontend — Fix Pass #6

**Priority: Fix immediately**

---

## Bug 1: Mandate Mastery locks navigation — view keeps flicking back

**What's broken:** During Mandate Mastery, if the player tries to switch to a different view (Overview, Map, Market, etc.), the UI briefly shows the other view then snaps back to the Mandate tab. The mastery module is force-navigating to the Mandate view on every render, trapping the player.

**Fix:** The mastery module should NOT prevent navigation. When the player switches away from the Mandate tab during mastery:

1. **Pause the mastery** — stop any timed sequences, hide the instruction bar, let the player use the other view normally.
2. **Show a small return prompt** in the TopBar or as a floating indicator: "Mandate Mastery paused — [Resume]" in `--text-secondary`, Helvetica Neue, `--text-sm`. Clicking "Resume" navigates back to the Mandate tab and continues from where they left off.
3. **Do NOT force-navigate back.** The player has agency. If they want to look at the map mid-tutorial, let them.

Implementation: remove any `useEffect` that sets the active view to "Mandate" on every render or state change. Instead, set it once when the mastery step starts, and only redirect if the player explicitly clicks "Resume."

```typescript
// WRONG — forces view on every render
useEffect(() => {
  setActiveView('mandate');
}, [masteryStep]);

// RIGHT — set view once when mastery starts, then respect player navigation
useEffect(() => {
  if (masteryStep > 0 && !hasNavigatedAway) {
    setActiveView('mandate');
  }
}, [masteryStep]); // only on step change, not on every render

// When player switches view during mastery:
const handleViewChange = (view: string) => {
  setActiveView(view);
  if (isMasteryActive) {
    setHasNavigatedAway(true);
    setShowResumePrompt(true);
  }
};
```

---

## Bug 2: "Skip to game" is too small and hidden

**What's broken:** The "Skip to game" link during Mandate Mastery is small text in the bottom-right corner. Players who want to exit the tutorial can't find it easily, especially combined with Bug 1 (being unable to navigate away).

**Fix:** Make "Skip to game" more prominent in the instruction bar:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MANDATE MASTERY  Step 2 of 5                        [ Skip to game → ]     │
│ Write your own mandate. Use the constraint controls if unsure what to write.│
└──────────────────────────────────────────────────────────────────────────────┘
```

Changes:
- Move "Skip to game →" INTO the instruction bar, top-right corner (not bottom-right of the screen)
- Style as a visible button: `--surface-hover` background, `--text-secondary` text, 1px `--border-default` border, 28px height. Not a ghost link — a real button with a background.
- On hover: `--text-primary` text, `--border-focus` border
- The arrow (→) makes it clear this is an exit action

Additionally, add Escape key binding: pressing Escape during mastery shows a confirmation: "Exit Mandate Mastery? You can resume anytime from the command palette." with [Exit] and [Continue] buttons. This is the same escape hatch pattern as the dashboard tour.

---

## Bug 3: Map mode toggles don't visually change the hex tiles (Overview or Map view)

**What's broken:** Switching between Terrain, Buildings, Territory, Production, and Intelligence modes doesn't produce visible changes on the hex tile circles. The colours appear identical across all modes.

**Root cause:** The hex tiles in the placeholder grid are likely rendered as SVG circles or divs with a fixed style. The map mode colour logic from Fix Pass #5 (getTileColour function) may not be connected to the actual tile rendering, or the colour changes are too subtle against the Night Sky background.

**Fix — ensure the colour logic actually applies:**

### Part A: Verify getTileColour is being called
Each hex tile component should read the current map mode from state and call getTileColour(tile, mode) to determine its fill colour. If the tiles are rendered as SVG circles:

```tsx
<circle
  cx={x} cy={y} r={radius}
  fill={getTileColour(tile, activeMapMode)}
  stroke={getTileStroke(tile, activeMapMode)}
  strokeWidth={activeMapMode === 'territory' ? 2 : 1}
/>
```

If the tiles are rendered as divs:
```tsx
<div style={{ backgroundColor: getTileColour(tile, activeMapMode) }}>
```

### Part B: Make the colour differences more obvious
The opacity values from Fix Pass #5 may be too subtle. Increase them for the placeholder grid so the differences are visible even on simple circles:

**Terrain mode:**
- Urban tiles: `--colour-compute` at **20%** opacity (was 12%)
- Industrial: `--colour-energy` at **20%**
- Research: `--colour-talent` at **20%**
- Coastal: `--colour-data` at **20%**
- Regulatory: `--colour-clearance` at **20%**
- Flat: `--surface-hover`

**Buildings mode:**
- Tiles WITH buildings: resource output colour at **25%** opacity, tier label stays visible
- Tiles WITHOUT buildings: `--surface-0` (fully dark — empty tiles almost disappear, emphasising built tiles)

**Territory mode:**
- Player-owned tiles: `--colour-compute` at **25%** opacity with **solid 2px** border in the same colour
- Rival-owned tiles: `--status-critical` at **15%** opacity with **1px dashed** border
- Unclaimed: no fill, `--border-default` 1px border only

**Production mode:**
- High production: resource colour at **30%** opacity
- Medium: **20%**
- Low: **10%**
- No building: dark/invisible

**Intelligence mode:**
- Covered tiles: `--colour-data` at **20%** opacity
- Uncovered: dark
- Espionage activity: **pulsing 2px border** in `--colour-talent`

### Part C: Add a visual transition
When switching modes, the tile colours should transition smoothly (200ms ease-out on fill/background-color). This makes the mode switch feel intentional rather than broken.

### Part D: Ensure mock tile data supports all modes
Each HexTile in the mock data needs enough data for all modes to produce different results. Check that the mock tiles have:
- `terrain` field (for Terrain mode) — should already exist
- `building` field with `type` and `tier` (for Buildings mode) — should already exist
- `owner` field (for Territory mode) — needs to include the player's name for some tiles AND rival names for others AND leave some unclaimed
- Production rate data (for Production mode) — derive from building type + tier using the Phase 3 production rates
- Intelligence coverage flag (for Intelligence mode) — add a `hasIntelCoverage: boolean` field to some tiles

If the mock data is missing any of these fields, add them. Without the data, the mode logic has nothing to differentiate.

---

## Bug 4: "Dominion-Prime Compute Superpower" is hardcoded — doesn't reflect role selection

**What's broken:** The top-right corner of the TopBar shows "Dominion-Prime Compute Superpower" regardless of which role the player selected during onboarding.

**Fix:** The TopBar should read from the player state, which should be updated when the player selects a role during onboarding.

### Part A: Pass role selection to player state
When the player selects a role in the Role Selection screen (or gets one via "Let the system decide"), store it in the shared app state that the TopBar reads:

```typescript
// In the onboarding flow, after role selection:
setPlayerState(prev => ({
  ...prev,
  role: selectedRole,  // 'Compute Superpower' | 'Data-Rich State' | etc.
}));
```

### Part B: Update TopBar to read dynamic role
The TopBar should display: `{playerState.name}  {playerState.role}` where:
- Player name: from mock data (e.g. "Dominion-Prime") — this can stay hardcoded for now
- Role: from player state, updated by role selection

### Part C: Update the agent name in the terminal boot
The boot sequence references "AGENT ALPHA-7" — this should also match the mock player state's agent name. Currently the mock data has `agentName: "Alpha-7"` — verify this is consistent with what's shown in the boot script and the agent feed.

### Part D: Generate role-appropriate agent names
For extra polish, each role could have a thematically appropriate default agent name:
- Compute Superpower: "Alpha-7" (computing/processing feel)
- Data-Rich State: "Archon-3" (knowledge/archive feel)  
- Chip Power: "Forge-9" (fabrication/industrial feel)
- Talent Hub: "Nexus-5" (connection/network feel)
- Regulatory Power: "Sentinel-1" (oversight/authority feel)

This is optional polish — the important fix is that the role in the TopBar matches the selection.

---

## Acceptance Criteria

- [ ] During Mandate Mastery, switching views does NOT snap back — mastery pauses and shows "Resume" prompt
- [ ] "Skip to game" button is visible inside the instruction bar (not hidden in bottom-right corner)
- [ ] "Skip to game" is styled as a real button with background, not a ghost text link
- [ ] Escape key during mastery shows exit confirmation
- [ ] Hex tiles visually change colour when switching between all 5 map modes
- [ ] Terrain mode: tiles tinted by terrain type at 20% resource colour opacity
- [ ] Buildings mode: built tiles highlighted, empty tiles dark
- [ ] Territory mode: player tiles have coloured borders, rival tiles have dashed borders, unclaimed have no fill
- [ ] Production mode: heatmap intensity based on production output
- [ ] Intelligence mode: covered vs uncovered distinction visible
- [ ] Map mode transitions have 200ms colour crossfade
- [ ] Active map mode toggle has Moon White bottom border indicator
- [ ] TopBar role display reflects the role selected during onboarding
- [ ] TopBar shows correct role for all 5 role selections including "Let the system decide"
- [ ] The "2 Issues" Next.js error badge is investigated and resolved
