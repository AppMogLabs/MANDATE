# MANDATE Frontend — Fix Pass #5: Onboarding Bugs + Map View Issues

**Priority: Fix immediately**

---

## Bug 1: Terminal boot text hold time still too short

**What's broken:** The green terminal text still disappears too quickly after finishing. Previous fix increased it to 4 seconds but it's still not enough time to read the role assignment and closing section.

**Fix:** Increase the hold time to **12 seconds** after the final line finishes typing. The full sequence:

1. All text finishes typing
2. Cursor blinks on `AWAITING MANDATE_` for **12 seconds**
3. Green text fades out over 500ms
4. MegaETH M icon pulse (see Bug 4 below)
5. Dashboard fades in over 500ms

The skip pattern (from Fix Pass #4) still applies:
- First keypress during typing → reveals all text instantly, starts the 12-second hold
- Second keypress during hold → skips to fade transition immediately

12 seconds is enough to read the role assignment block and the closing "Your skill is not clicking faster" section even if the player only starts reading when the typing finishes. Players who've already read it can press a key to skip.

---

## Bug 2: Dashboard Tour Step 1 — resource badge tooltip doesn't expand on hover

**What's broken:** Tour Step 1 says "hover over Compute to learn more" but hovering the CMP badge during the tour does not trigger the tooltip expansion. Clicking works and enables the Next button, but the hover tooltip is suppressed.

**Root cause:** The spotlight overlay is still interfering with hover events even if click events pass through. The tooltip component likely uses `mouseenter`/`mouseleave` events which are being blocked or intercepted by the overlay.

**Fix:** Two approaches (implement whichever is simpler):

**Approach A — CSS pointer-events hole:**
The spotlight overlay should have a rectangular "hole" cut out over the highlighted element where `pointer-events` are completely transparent. Use a CSS clip-path on the overlay to exclude the bounding box of the highlighted element:

```css
/* The dimming overlay covers everything EXCEPT the highlighted area */
.spotlight-overlay {
  position: fixed;
  inset: 0;
  background: rgba(25, 25, 26, 0.6); /* Night Sky at 60% */
  clip-path: polygon(
    /* Outer rectangle (full screen) */
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    /* Inner rectangle (highlighted element bounds) — creates the hole */
    ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px
  );
  pointer-events: auto; /* Dimmed areas block interaction */
}
```

This means the highlighted element's area has NO overlay on top of it at all — hover events work naturally.

**Approach B — Portal the tooltip above the overlay:**
If the tooltip renders in a React portal at a high z-index, ensure the portal's z-index is ABOVE the spotlight overlay's z-index. The overlay might be at z-50; ensure the tooltip portal is at z-60 or higher.

**Also:** Change the Step 1 instruction text to be more explicit:

Current: "hover over Compute to learn more"
Better: "Hover over the CMP badge above to see resource details"

And ensure the 5-second fallback timeout from Fix Pass #4 is working — if hover still doesn't trigger, the Next button should appear after 5 seconds regardless.

---

## Bug 3: Dashboard Tour Step 2 — clicking "Buildings" map mode does nothing

**What's broken:** Tour Step 2 highlights the map and says "click Buildings to see a different view." Clicking the Buildings map mode toggle does not change the map view. The Next button doesn't appear because the interactive prompt is waiting for the mode change that never happens.

**Root cause:** Two possible issues:

1. The map mode toggles are non-functional (see Bug 5 below — the map modes don't do anything even outside the tour). If the toggles don't work normally, they won't work during the tour either.
2. The spotlight overlay is blocking click events on the map mode toggle buttons, similar to Bug 2.

**Fix:**

### Part A: Fix the interactive prompt to detect the click
The click detection should listen for a click on any map mode toggle button, not for the map actually changing. Even if the map doesn't visually update (because map modes aren't implemented — see Bug 5), the click should be detected and the Next button should appear.

```typescript
// Listen for click on any map mode button within the highlighted area
const handleMapModeClick = () => {
  setInteractionComplete(true);
};
```

### Part B: Ensure map mode toggles are clickable during the tour
Same pointer-events fix as Bug 2 — the spotlight overlay needs a hole cut out over the entire highlighted area including the toggle buttons.

### Part C: 5-second fallback
Same pattern as Bug 2 — if the click isn't detected after 5 seconds, show the Next button anyway.

---

## Bug 4: Game UI flashes briefly before onboarding appears

**What's broken:** When the app loads, the normal game dashboard renders for a split second before the onboarding overlay appears on top. This breaks immersion — the player sees the complex dashboard before they've been introduced to it.

**Fix — two parts:**

### Part A: Prevent game UI flash
The onboarding state should be checked BEFORE rendering the main app layout. If the onboarding hasn't been completed (or hasn't started), render ONLY the onboarding component — don't render the game dashboard at all behind it.

```tsx
// In page.tsx or layout.tsx
if (onboardingState === 'ROLE_SELECTION' || onboardingState === 'SELF_DECLARATION' || onboardingState === 'TERMINAL_BOOT') {
  // Render ONLY the onboarding component — no game UI at all
  return <OnboardingFlow state={onboardingState} />;
}

// Only render the game dashboard after the boot sequence completes
return (
  <>
    <GameDashboard />
    {onboardingState === 'DASHBOARD_TOUR' && <DashboardTour />}
    {onboardingState === 'MANDATE_MASTERY' && <MandateMastery />}
  </>
);
```

The key insight: the Role Selection, Self-Declaration, and Terminal Boot screens are full-screen takeovers. The game UI should not exist in the DOM at all during these phases. Only once the boot sequence fades out should the game dashboard mount.

### Part B: MegaETH M icon transition
Between the terminal boot fade-out and the dashboard fade-in, insert the MegaETH M icon mark:

1. Terminal boot green text fades out (500ms) → screen is fully black (Night Sky)
2. MegaETH M icon mark fades in at centre of screen
   - Use the M icon SVG from the brand kit (download from `https://static.megaeth.com/brand-kit/megaeth-brand-kit.zip`)
   - Colour: Moon White (#ECE8E8) at 30% opacity initially
   - Size: approximately 120px × 120px (large but not filling the screen)
   - Animation: fades from 0% to 30% opacity over 400ms, holds for 600ms, fades to 0% over 400ms
   - Total duration: ~1.4 seconds
   - Subtle pulse: during the hold, a single gentle scale pulse from 1.0 to 1.03 and back (400ms ease-in-out). One pulse only — not a repeating animation.
3. After the M icon fades out → dashboard fades in (500ms)

If the M icon SVG is not available in the codebase, create a text-based fallback: the letter "M" in Wudoo Mono at 120px font size, same fade animation. This can be replaced with the real SVG later.

Total transition time: boot text holds 12s → fade out 500ms → black 200ms → M icon 1400ms → black 200ms → dashboard fade in 500ms ≈ 15 seconds from last typed character to dashboard visible. Players who double-press to skip get: text appears instantly → 500ms fade → M icon 1400ms → dashboard. About 2.5 seconds.

---

## Bug 5: Overview and Map views are identical

**What's broken:** The "Overview" and "Map" tabs in the ViewSwitcher both render the same content — just the hex map. They should be different:

- **Overview** is the default multi-panel layout: map (left, ~65% width) + order book DOM ladder (right top) + news feed (right bottom). This is the preset layout from the Step 1+2 handoff spec.
- **Map** is the map taking the full main panel area with no order book or news feed beside it. A dedicated full-screen map view for when the player wants to focus on territory and buildings.

**Fix:** The Overview layout should use the "Overview" preset panel configuration from Step 2 (map + order book + news stacked right). The Map layout should render the WorldMap component taking 100% of the main panel area. These are two different panel layout presets, not two names for the same view.

Check PanelLayout.tsx — the layout presets were defined in the Step 1+2 handoff. Overview and Map should map to different preset configurations. If the Map preset doesn't exist (only Overview, Market, Buildings, Intelligence were defined), add one:

**Map preset layout:**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│              World Map (full width)              │
│              with map mode toggles               │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

The map mode toggles (Terrain, Buildings, Territory, Production, Intelligence) appear at the top of the map panel in both Overview and Map views.

---

## Bug 6: Map mode toggles don't change anything

**What's broken:** The five map mode toggles (Terrain, Buildings, Territory, Production, Intelligence) exist as buttons but clicking them produces no visual change on the hex grid. Every mode looks identical.

**Fix:** Each map mode should change two things: the tile fill colours and the tooltip content on hover. Since this is a placeholder hex grid (the rendering library hasn't been chosen yet), the implementation can be simplified to colour changes on the CSS/SVG hex elements.

### Tile colour by mode:

**Terrain mode (default):**
Each terrain type gets a distinct subtle background tint:
- High-density urban: `--colour-compute` at 12% opacity
- Industrial zone: `--colour-energy` at 12% opacity
- Research corridor: `--colour-talent` at 12% opacity
- Coastal/port: `--colour-data` at 12% opacity
- Regulatory district: `--colour-clearance` at 12% opacity
- Flat/mixed: `--surface-hover` (no tint — neutral)

**Buildings mode:**
- Tiles with buildings: tinted by the building's output resource colour at 15% opacity, with the building tier indicator (T1/T2/T3) visible
- Empty tiles: `--surface-1` (dark, receding — emphasis on built tiles)

**Territory mode:**
- Tiles owned by the player: `--colour-compute` at 20% opacity (or the player's role colour) with a solid 2px border in the same colour
- Tiles owned by rivals: `--status-critical` at 10% opacity with a 1px dashed border
- Unclaimed tiles: `--surface-1` with no border

**Production mode:**
- Heatmap: tiles tinted by their production output rate. Higher production = more saturated colour. Use the resource colour of whatever the tile's building produces. Tiles with no building = dark/neutral.
- Colour intensity: 5% opacity for low production, 25% opacity for high production, interpolated

**Intelligence mode:**
- Tiles where the player has intelligence coverage (analyst or premium subscription active): `--colour-data` at 15% opacity
- Tiles with no coverage: `--surface-1`
- Tiles with known espionage activity (from mock data — echo signals, lineage checks): pulsing border in `--colour-talent`

### Tooltip content by mode:

When hovering a tile, the tooltip content should change based on the active mode:

- **Terrain**: terrain type, eligible buildings, strategic value description
- **Buildings**: building name, tier, production rate, TALENT allocation, ENERGY consumption
- **Territory**: owner name, claim date, rent cost, adjacent territories
- **Production**: resource output per hour, building efficiency, upkeep costs
- **Intelligence**: coverage tier, last scan timestamp, purity score (for DATA tiles), echo reliability (for agents on tile)

Use the existing CK3-style nested tooltip component. Tooltip content comes from the mock data — add any missing fields to the HexTile mock type if needed.

### Active mode indicator:

The currently selected map mode toggle should have:
- `--border-active` (Moon White) bottom border (2px)
- `--text-primary` text colour (other toggles use `--text-secondary`)
- Clicking a different toggle switches the mode with a 200ms crossfade on the tile colours

---

## Acceptance Criteria

- [ ] Terminal boot text holds for 12 seconds after final line, then fades
- [ ] First keypress reveals all text, second keypress during hold skips to transition
- [ ] Resource badge tooltip appears on hover during Dashboard Tour Step 1
- [ ] Map mode toggle click is detected during Dashboard Tour Step 2
- [ ] All tour steps show Next button after 5-second fallback timeout
- [ ] No game UI flash before onboarding — role selection, self-declaration, and boot render WITHOUT the game dashboard behind them
- [ ] MegaETH M icon mark pulses between boot fade-out and dashboard fade-in (~1.4s)
- [ ] Overview and Map are different views (Overview = multi-panel, Map = full-width map)
- [ ] All 5 map modes produce visually distinct tile colouring
- [ ] Active map mode toggle has a visible selected state
- [ ] Tile hover tooltips show different content based on active map mode
- [ ] Map mode transitions use a 200ms crossfade
