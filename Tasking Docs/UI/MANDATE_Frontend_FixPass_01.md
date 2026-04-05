# MANDATE Frontend — Fix Pass #1

**Priority: Fix before next review**

---

## Bug 1: Mandate view not implemented

**What's broken:** Clicking the "Mandate" tab in the ViewSwitcher does nothing — no view loads, no placeholder, nothing changes.

**Fix:** Create a placeholder Mandate view at `/src/components/views/MandateView.tsx`. This is a Phase 4 deliverable so the view should NOT attempt to build the full mandate editor. Instead, render a placeholder that:

- Shows the panel structure where the mandate editor will live (left: editor area, right: agent interpretation preview)
- Displays the player's current mock mandate as read-only text in Wudoo Mono (add a `currentMandate` string field to the PlayerState mock data — something like: "Prioritise COMPUTE acquisition. Trade surplus ENERGY at no less than 1.5:1 ratio. Reject deals with agents below 4000 reputation. Maintain minimum 500 CHIPS reserve.")
- Shows a "Mandate Clarity Score" placeholder (e.g. 72/100) with a simple progress bar using `--colour-compute`
- Below the mandate text, show a read-only summary: "Active constraints: 4 | Last updated: 2h ago | Agent confidence: High"
- The whole thing should feel like a real panel that's displaying an existing mandate, not a "coming soon" page

**Register:** Wudoo Mono for the mandate text itself. Helvetica Neue for labels and the clarity score.

Wire this view into the ViewSwitcher and PanelLayout so clicking "Mandate" (or pressing ⌘6) actually navigates to it.

---

## Bug 2: Resource badges in TopBar have no hover tooltip

**What's broken:** Hovering over the abbreviated resource labels (CMP, NRG, CHP, etc.) does nothing. Per the handoff spec, these should show CK3-style nested tooltips.

**Fix:** Add a tooltip to each ResourceBadge in the TopBar. On hover, show:

```
COMPUTE (CMP)
━━━━━━━━━━━━━━━━━━
Balance:      1,234.56
Price:        1.23 RATE
1h Change:    +3.2%
━━━━━━━━━━━━━━━━━━
Production:   45.0 / hr
Consumption:  38.2 / hr
Net Flow:     +6.8 / hr
━━━━━━━━━━━━━━━━━━
Produced by:  Data Centres, Deployed Models
Consumed by:  Training Runs, Inference, Guard Clauses
```

- Use the existing CK3 nested tooltip component
- The resource name, "Produced by", and "Consumed by" building names should themselves be hoverable (linking to further tooltips with building details or resource details) — this is the nested tooltip chain in action
- Numbers in the tooltip use tabular nums
- Top section (balance/price/change) in Helvetica Neue
- "Produced by" / "Consumed by" building names are game terms and should be hoverable, linking to a building type tooltip

Add the production/consumption data to the ResourceBalance mock data type if not already present. The GDD Section 5.1 has the full resource catalogue with "Produced By" and "Consumed By" for each resource.

---

## Bug 3: Agent Activity Feed lacks colour coding

**What's broken:** All feed entries appear in the same visual treatment. There's no colour differentiation by action type or notification tier.

**Fix — two layers of colour coding:**

### Layer 1: Left border by notification tier (per handoff spec)

This was specified in the handoff but appears not to be implemented:

| Tier | Left border | Example actions |
|------|-------------|-----------------|
| Critical (`--status-critical` / `#F5949D`) | 3px solid | GUARD_CLAUSE failure, COOLING_CASCADE, agent error |
| Warning (`--status-warning` / `#F5AF94`) | 2px solid | NEGOTIATE (outcome pending), MANDATE_EXEC, large trades |
| Info (no visible border or `--text-tertiary` 1px) | 1px solid | Routine TRADE, ECHO_SIGNAL, LINEAGE_CHECK, REPUTATION |

### Layer 2: Action keyword colour coding (new)

The action type keyword at the end of each feed entry (TRADE, GUARD_CLAUSE, ECHO_SIGNAL, etc.) should be colour-coded. Map each action type to a colour from the MegaETH palette:

```
TRADE           → --text-secondary (#A8A4A4)     /* Most common, should be subdued */
NEGOTIATE       → --colour-clearance (#6DD0A9)   /* Diplomatic action, teal */
GUARD_CLAUSE    → --status-warning (#F5AF94)      /* Defensive/protective, warm */  
ECHO_SIGNAL     → --colour-talent (#F786C6)       /* Intelligence/signal, stands out */
LINEAGE_CHECK   → --colour-data (#90D79F)         /* Data integrity, green */
MANDATE_EXEC    → --colour-compute (#7EAAD4)      /* Core strategic action, blue */
ORACLE_READ     → --colour-cooling (#70BAD2)      /* Information retrieval, cyan */
REPUTATION      → --colour-energy (#F5AF94)       /* Score change, peach */
```

The keyword should be rendered as a badge-style element: the coloured text on a subtle background tint (the same colour at ~10% opacity). This makes scanning the feed much faster — you can spot GUARD_CLAUSE events at a glance without reading every line.

**The agent name** in each entry should remain Moon White. The timestamp should remain `--text-tertiary`. Only the action keyword gets colour treatment.

---

## Bug 4: News Feed below order book lacks colour coding

**What's broken:** The world events / news feed panel below the order book has category tags (CHIPS, SUPPLY CHAIN, COMPUTE, REGULATORY, ENERGY, TALENT) but they all appear to be the same visual treatment.

**Fix:** Colour-code the category tags using the resource accent colours:

```
CHIPS           → --colour-chips (#F5949D)
SUPPLY_CHAIN    → --colour-chips (#F5949D)     /* Shares CHIPS colour — supply chain events are CHIPS-adjacent */
COMPUTE         → --colour-compute (#7EAAD4)
REGULATORY      → --colour-clearance (#6DD0A9)
ENERGY          → --colour-energy (#F5AF94)
TALENT          → --colour-talent (#F786C6)
DATA            → --colour-data (#90D79F)
COOLING         → --colour-cooling (#70BAD2)
GENERAL         → --text-secondary (#A8A4A4)    /* Fallback for uncategorised */
```

Render category tags as: coloured text on a subtle background tint (same colour at ~12% opacity, 4px border-radius, 4px horizontal padding). Same badge treatment as the agent feed keywords. The headline text itself stays Moon White. The timestamp stays `--text-tertiary`.

---

## Polish: Ensure consistent badge rendering

Both the agent feed keywords (Bug 3 Layer 2) and the news feed category tags (Bug 4) should use the same visual component — extract a shared `Tag` or `CategoryBadge` component if one doesn't exist:

```tsx
interface TagProps {
  label: string;
  colour: string;  // CSS custom property value, e.g. var(--colour-compute)
}
```

Renders as: text in `colour`, background in `colour` at 10-12% opacity, `font-terminal` (Wudoo Mono), `text-xs`, 2px border-radius, 4-6px horizontal padding. Compact — should not dominate the line it's in.

---

## Acceptance Criteria

- [ ] Clicking "Mandate" tab or pressing ⌘6 loads the Mandate placeholder view
- [ ] Mandate view shows current mandate text in Wudoo Mono with clarity score
- [ ] Hovering any TopBar resource badge shows a detailed tooltip with balance, price, production, consumption, net flow, and building cross-references
- [ ] Tooltip content for resource badges supports nested hovering (building names are hoverable)
- [ ] Agent activity feed entries have coloured left borders by notification tier
- [ ] Agent activity feed action keywords (TRADE, GUARD_CLAUSE, etc.) are colour-coded badges
- [ ] News feed category tags (CHIPS, COMPUTE, REGULATORY, etc.) are colour-coded badges matching resource accents
- [ ] A shared Tag/CategoryBadge component is used for both feed keywords and news categories
- [ ] No regressions in existing functionality (layout, panel switching, command palette, etc.)
