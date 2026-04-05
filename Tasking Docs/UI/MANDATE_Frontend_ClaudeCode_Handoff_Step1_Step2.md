# MANDATE Frontend — Claude Code Handoff: Step 1 + Step 2

**App Mog Labs | March 2026**
**Scope: Design System + Static UI Shell with Mock Data**

---

## Read This First

This handoff covers two sequential deliverables:

1. **Step 1 — Design System & Component Library**: Tailwind theme tokens, base components, typography system, colour system. Zero dependencies on contract state.
2. **Step 2 — Static UI Shell**: Full application layout with tiling panels, command palette, mock data feeds, and all major views. Fed entirely by mock data that matches the smart contract interfaces.

**You have access to the Figma MCP.** Use it for rapid iteration on component design and layout before implementing in code. Generate designs in Figma first, then build. This is the correct workflow — don't skip Figma and go straight to code.

**Do not build contract integration in this step.** No wagmi, no viem, no RPC connections, no wallet providers. All data comes from mock data files that will be swapped for live hooks in Step 3. This is deliberate — the smart contracts have outstanding fixes and Phase 4 is still in progress.

---

## Hard Boundaries

Do not:
- Connect to MegaETH RPC or any chain
- Implement wallet connection
- Make any decisions about the mandate editor's AI integration (Phase 4 scope)
- Implement the onboarding flow (depends on mandate schema finalisation)
- Choose a hex-tile map rendering library (flag options for review)
- Deviate from the MegaETH brand kit values specified below

Flag for review (do not decide):
- Hex-tile map library choice (Pixi.js vs canvas vs SVG vs WebGL)
- WebSocket strategy for real-time feeds (Step 3 concern)
- State management library (evaluate Zustand vs Jotai vs TanStack, recommend in a short note)

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14+ (App Router) | SSR not critical for game UI but App Router is the current standard. Static export is fine. |
| Styling | Tailwind CSS 4 | Custom theme tokens for MegaETH brand. No component library (no shadcn, no Radix) — build from scratch to match the aesthetic exactly. |
| Language | TypeScript (strict mode) | |
| Package manager | pnpm | |
| Command palette | cmdk (by Pacocoursey) | The only external UI dependency. Everything else is custom. |
| Charts | Lightweight Charts (by TradingView) or custom canvas | For order book price ladder and sparklines. Evaluate and recommend. |
| Fonts | Helvetica Neue + Wudoo Mono | See typography section. |
| Testing | Vitest + React Testing Library | Component tests for interactive elements. |

---

## 1. Design System — The Authoritative Values

### 1.1 Colour Palette

These values come directly from the MegaETH brand kit and the GDD. They are locked.

```
/* === Core === */
--night-sky: #19191A;          /* Primary background — all surfaces start here */
--moon-white: #ECE8E8;         /* Primary text and UI elements */

/* === Surface Elevation (derived from Night Sky) === */
--surface-0: #19191A;          /* Base canvas */
--surface-1: #1F1F20;          /* Raised panels, sidebars */
--surface-2: #252526;          /* Modals, overlays, command palette */
--surface-3: #2C2C2D;          /* Tooltips, dropdown menus */
--surface-hover: #333334;      /* Hover state on interactive surfaces */

/* === Text Hierarchy === */
--text-primary: #ECE8E8;       /* Moon White — headings, key data */
--text-secondary: #A8A4A4;     /* Descriptions, labels, secondary info */
--text-tertiary: #6B6868;      /* Disabled, placeholder, timestamps */
--text-inverse: #19191A;       /* Text on light accent backgrounds */

/* === MegaETH Brand Palette (official — from megaeth.com/brand-kit) === */
--full-moon: #DFD9D9;          /* Secondary light — subdued Moon White for less prominent text/borders */

/* === Resource Accent Colours (mapped from official MegaETH pastel range) === */
/* Source: https://www.megaeth.com/brand-kit — 8 official pastels */
--colour-compute: #7EAAD4;     /* Soft blue — fast, fungible. Official: #7EAAD4 */
--colour-energy: #F5AF94;      /* Warm peach — universal bottleneck. Official: #F5AF94 */
--colour-chips: #F5949D;       /* Soft rose — scarce, geopolitical. Official: #F5949D */
--colour-cooling: #70BAD2;     /* Cyan/sky blue — silent infrastructure. Official: #70BAD2 */
--colour-talent: #F786C6;      /* Magenta/fuchsia — sticky, political. Official: #F786C6 */
--colour-data: #90D79F;        /* Soft green — quality-sensitive. Official: #90D79F */
--colour-clearance: #6DD0A9;   /* Teal/mint — political capital. Official: #6DD0A9 */
--colour-rate: #ECE8E8;        /* Moon White — premium currency, neutral */

/* Unused official pastel (available for UI accents): */
/* --megaeth-pink: #FF8AA8;    /* Bright pink — reserve for highlights, links, or CTA accents */

/* === Status/Notification Colours (derived from brand pastels) === */
--status-critical: #F5949D;    /* Tier 1 — uses CHIPS rose, intensified */
--status-warning: #F5AF94;     /* Tier 2 — uses ENERGY peach */
--status-info: #6B6868;        /* Tier 3 — neutral grey, below Moon White */
--status-success: #90D79F;     /* Uses DATA green */

/* === Interactive === */
--border-default: #333334;     /* Panel borders, dividers */
--border-focus: #7EAAD4;       /* Focus rings (uses COMPUTE blue) */
--border-active: #ECE8E8;      /* Active tab/selection indicators */
```

**Implementation notes:**
- Do NOT use pure black (#000000) anywhere.
- Do NOT use pure white (#FFFFFF) anywhere.
- Surface elevation uses lighter shades of Night Sky, not box-shadows.
- Resource accent colours should be desaturated ~10-15% when used as status indicators or background tints (to prevent optical vibration against the dark background). Apply at roughly 15% opacity over Night Sky for subtle background tints.
- All colour values should be CSS custom properties in a `:root` block AND Tailwind theme tokens so they're accessible both ways.

**Resource-to-colour mapping rationale:**
- COMPUTE → `#7EAAD4` (soft blue): coolest, most "digital" colour. COMPUTE is the universal medium — blue reads as neutral/professional.
- ENERGY → `#F5AF94` (warm peach): warmth = energy. Visually distinct from all other resources.
- CHIPS → `#F5949D` (soft rose): close to ENERGY peach but pinker — reflects the geopolitical sensitivity. The supply-chain scarcity reads as "heated."
- COOLING → `#70BAD2` (cyan/sky): cooler than COMPUTE blue. The contrast between COOLING cyan and ENERGY peach creates an intuitive hot/cold visual axis.
- TALENT → `#F786C6` (magenta/fuchsia): the most "human" colour in the palette. Stands out, which matches TALENT's late-game scarcity and political nature.
- DATA → `#90D79F` (soft green): green = growth, quality, organic. Fits DATA's integrity dimension — green means clean, desaturated green means potentially poisoned.
- CLEARANCE → `#6DD0A9` (teal/mint): between the blue of authority and the green of approval. Institutional, regulatory.
- The unused official pink (`#FF8AA8`) is reserved for UI accents — links, CTAs, or highlight states where you need something that pops against all seven resource colours.

**Full Moon (`#DFD9D9`)** is the brand kit's secondary light colour, sitting between Moon White and the pastels. Use it for: subdued borders on light-tinted elements, secondary text that needs to be warmer than `--text-secondary`, and divider lines within panels where `--border-default` is too dark.

### 1.2 Typography

Two font families. No exceptions.

| Register | Font | Usage | CSS class |
|----------|------|-------|-----------|
| Dashboard (human layer) | Helvetica Neue | All UI chrome, headings, labels, portfolio views, market data, resource counts, P&L, navigation | `.font-dashboard` |
| Terminal (machine layer) | Wudoo Mono | Agent communications, mandate input/editor, event feed entries, command palette input, terminal outputs, raw data, timestamps in feeds | `.font-terminal` |

**Font loading:**
- Helvetica Neue: system font stack fallback (`'Helvetica Neue', Helvetica, Arial, sans-serif`). If custom hosting is needed, use `@font-face` with `font-display: swap`.
- Wudoo Mono: confirmed in MegaETH brand kit (https://www.megaeth.com/brand-kit). Download the brand kit zip from `https://static.megaeth.com/brand-kit/megaeth-brand-kit.zip` — font files should be included. If Wudoo Mono is not in the zip as a web font, flag it and use `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace` as fallback until the font file is sourced separately.

**Type scale (rem-based, 16px root):**

```
--text-xs: 0.75rem;     /* 12px — timestamps, micro-labels */
--text-sm: 0.8125rem;   /* 13px — secondary data, feed entries */
--text-base: 0.875rem;  /* 14px — primary body text, data values */
--text-lg: 1rem;         /* 16px — section headers, important values */
--text-xl: 1.25rem;      /* 20px — panel titles */
--text-2xl: 1.5rem;      /* 24px — page headers (rare) */
```

Note the scale is deliberately dense — 14px is base, not 16px. This is a data-dense professional interface, not a content site.

**Numerical display rules:**
- ALL numbers in columns MUST use `font-variant-numeric: tabular-nums;` — this is non-negotiable for column alignment.
- Price data uses Helvetica Neue with tabular nums when in the dashboard context.
- Agent-reported numbers in the activity feed use Wudoo Mono (because they're in the terminal context).
- Positive changes: `--status-success` colour. Negative changes: `--status-critical` colour. Zero/neutral: `--text-secondary`.

### 1.3 Spacing and Layout

```
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

- Panel internal padding: `--space-4` (16px)
- Gap between panels: 1px solid `--border-default` (no gap — panels are contiguous, separated by 1px borders)
- Border radius: 0px on panels (sharp corners — this is a control room, not a consumer app). 4px on buttons and inputs. 2px on badges and tags.

### 1.4 Base Components to Build

Build these as standalone React components with props. Each should have a Storybook-style demo page (a simple `/components` route that renders all of them).

**Data display:**
- `ResourceBadge` — resource icon + name + value + change indicator. Used everywhere. Colour-coded by resource type.
- `PriceCell` — single price value with positive/negative/neutral colouring. Tabular nums.
- `Sparkline` — tiny inline chart (last N values). 60px wide, 20px tall. SVG or canvas.
- `StatusDot` — coloured dot (critical/warning/info/success) with optional pulse animation for active alerts.
- `Tooltip` — CK3-style nested tooltip. This is the most important component. Must support: hover to reveal, hoverable content within tooltips (nested), keyboard accessible, dismissible, positioned dynamically to stay on screen. Content is rich (can contain ResourceBadges, PriceCells, links). Rendered in Helvetica Neue by default; switches to Wudoo Mono if content is agent/terminal data.
- `DataTable` — sortable, filterable table with fixed headers. Tabular nums throughout. Helvetica Neue. Column resize via drag.

**Interactive:**
- `Button` — primary (Moon White text on surface-hover bg), secondary (ghost, text-secondary), destructive (status-critical tint). Compact sizing (28px height default).
- `Input` — text input with Night Sky background, Moon White text. Border only on focus. Wudoo Mono for the command palette; Helvetica Neue for form inputs.
- `Select` — dropdown select. Surface-2 dropdown bg. No native select styling.
- `Slider` — horizontal slider for mandate builder parameters. Thin track, small thumb.
- `Toggle` — on/off switch. Small (20px wide).

**Layout:**
- `Panel` — the fundamental container. Night Sky background, 1px border-default border, optional title bar with Helvetica Neue label. Supports: collapsible (with smooth animation), resizable (drag handle on edges), status indicator strip (row of StatusDots when collapsed).
- `PanelLayout` — the tiling layout manager. Handles: preset layouts (see section 2.2), panel drag-to-resize, panel collapse/expand.
- `TopBar` — persistent top bar. Contains: epoch timer, alert banner, resource summary (7 ResourceBadges), player name/role.
- `Sidebar` — collapsible right sidebar. Agent activity feed lives here.
- `StatusBar` — persistent bottom bar. Building production heartbeat, system status.

**Navigation:**
- `CommandPalette` — Cmd+K triggered. Full-screen overlay on surface-2. Wudoo Mono input. Fuzzy search (use `cmdk` library). Categories: Navigation, Actions, Resources, Buildings, Intelligence. Shows keyboard shortcuts next to each command. Context-aware — available commands change based on active view.
- `ViewSwitcher` — top tab bar or breadcrumb showing active view. Views: Overview, Map, Market, Buildings, Intelligence, Mandate.

**Feed/Stream:**
- `FeedEntry` — single entry in the agent activity feed. Wudoo Mono. Timestamp + agent name + action + details. Colour-coded by notification tier. Compact (single line when possible, expandable for detail).
- `ActivityFeed` — scrolling feed of FeedEntries. Auto-scrolls to bottom. Pause-on-hover. Batching: group entries from same agent within 5-second windows.
- `NewsTicker` — horizontal scrolling ticker for world events (free tier). Helvetica Neue. Terse headlines.

---

## 2. Static UI Shell — The Layout

### 2.1 Overall Architecture

The app is a single-page application with a fixed layout:

```
┌──────────────────────────────────────────────────────────┐
│ TopBar (epoch timer | alerts | resource summary | role)   │
├────────────────────────────────────┬─────────────────────┤
│                                    │                     │
│                                    │   Sidebar           │
│         Main View Area             │   (Agent Feed)      │
│         (swappable panels)         │   Wudoo Mono        │
│                                    │   collapsible       │
│                                    │                     │
│                                    │                     │
├────────────────────────────────────┴─────────────────────┤
│ StatusBar (building production | system status)           │
└──────────────────────────────────────────────────────────┘
```

- TopBar: fixed, always visible. 48px height.
- Sidebar: collapsible, default 320px width. Drag to resize. Collapse to 48px strip of StatusDots.
- Main View Area: takes remaining space. Contains the active view(s) in a tiling layout.
- StatusBar: fixed, always visible. 32px height.
- CommandPalette: overlay, triggered by Cmd+K. Not part of the layout grid.

### 2.2 Preset Panel Layouts

Build four preset configurations for the Main View Area. Players select via CommandPalette or ViewSwitcher.

**Overview** (default):
```
┌──────────────────────┬──────────────┐
│                      │ Order Book   │
│   World Map          │ (DOM ladder) │
│   (hex grid)         │              │
│                      ├──────────────┤
│                      │ News Feed    │
│                      │ (headlines)  │
└──────────────────────┴──────────────┘
```
Map takes ~65% width. Order book + news stack on the right.

**Market**:
```
┌──────────────────────────────────────┐
│   Order Book (full width DOM ladder) │
├──────────────┬───────────────────────┤
│ Trade        │  Price History        │
│ History      │  (chart)              │
└──────────────┴───────────────────────┘
```

**Buildings**:
```
┌──────────────────────┬──────────────┐
│                      │ Building     │
│   World Map          │ Detail       │
│   (building overlay) │ (selected)   │
│                      │              │
│                      ├──────────────┤
│                      │ Production   │
│                      │ Summary      │
└──────────────────────┴──────────────┘
```

**Intelligence**:
```
┌──────────────────────┬──────────────┐
│ Echo Oracle          │ Reputation   │
│ (reliability scores) │ Scores       │
├──────────────────────┤              │
│ Data Lineage         ├──────────────┤
│ (purity scores)      │ Guard Clause │
│                      │ Marketplace  │
└──────────────────────┴──────────────┘
```

### 2.3 Views to Build (with mock data)

Each view is a React component that receives mock data as props. The data shapes match the smart contract return types documented in Phase 2.

#### 2.3.1 World Map View

**What it displays:**
- Hex-tile grid (placeholder — see "flag for review" note below)
- Terrain types: High-density urban, Industrial zone, Research corridor, Coastal/port, Regulatory district, Flat/mixed. Each has a distinct subtle colour tint.
- Buildings on tiles (ERC-721 NFTs): icon + tier indicator
- Territory ownership: border colour = owner's accent colour
- Claimed vs unclaimed tiles

**For Step 2, use a simplified placeholder.** Render a CSS grid or SVG-based hex grid with ~50 tiles showing terrain types and a few buildings. Do NOT choose a rendering library for the production map — flag the options (Pixi.js, raw Canvas, SVG, react-hexgrid) with a short pros/cons note for review.

**Map modes** (EU4-style — buttons toggle which data layer is visualised):
- Terrain (default)
- Buildings
- Territory
- Resource Production (heatmap by output)
- Intelligence Coverage (which tiles have info market subscriptions)

Each mode changes both the tile colouring AND the tooltip content when hovering a tile.

#### 2.3.2 Order Book View (DOM Ladder)

**What it displays:**
- Vertical price ladder centred on current price
- Bids below (tinted with `--status-success` at ~10% opacity)
- Asks above (tinted with `--status-critical` at ~10% opacity)
- Volume bars at each price level (horizontal bars, width proportional to volume)
- Current spread highlighted
- Resource pair selector (dropdown: COMPUTE/RATE, ENERGY/RATE, CHIPS/RATE, etc.)
- Last trade price + 24h change

**Font:** Helvetica Neue with tabular nums. Prices right-aligned. Volume left-aligned.

**Mock data:** Generate 20 bid levels and 20 ask levels around a mid price for each of the 7 resource pairs.

#### 2.3.3 Resource Summary (TopBar)

**What it displays:**
- 7 resource badges in a row: icon + name abbreviation + balance + 1h change sparkline
- RATE balance (separate, slightly more prominent)
- Each badge colour-coded by resource
- Hover on any badge: CK3-style tooltip showing production rate, consumption rate, net flow, buildings producing/consuming

**Font:** Helvetica Neue, tabular nums.

#### 2.3.4 Agent Activity Feed (Sidebar)

**What it displays:**
- Scrolling feed of agent actions
- Each entry: `[HH:MM:SS] Agent_Name action_description`
- Colour-coded left border by notification tier (critical/warning/info)
- Expandable entries — click to see detail (which mandate clause triggered the action, what conditions were evaluated)
- Batch grouping: "Agent Alpha completed 3 COMPUTE trades" instead of three separate entries
- Pause on hover, resume on mouse leave

**Font:** Wudoo Mono throughout. Terse, log-style entries.

**Mock data:** Generate ~100 feed entries across a simulated 30-minute window. Mix of trades, negotiations, building actions, and system alerts. Include 2-3 Tier 1 (critical) entries, ~10 Tier 2 (warning), rest Tier 3 (info).

#### 2.3.5 Epoch Timer (TopBar)

**What it displays:**
- Days:Hours:Minutes:Seconds remaining in epoch
- Epoch number (e.g. "Epoch 3")
- Progress bar (subtle, thin, under the timer)

**Font:** Helvetica Neue, tabular nums. Monospaced digits so the timer doesn't jitter.

#### 2.3.6 News Ticker / World Events (Panel)

**What it displays:**
- Scrolling horizontal ticker of free-tier headlines
- Expandable to a vertical list view
- Each headline: timestamp + category tag + text
- Category tags: "SUPPLY CHAIN", "REGULATORY", "TALENT", "ENERGY", etc.

**Font:** Helvetica Neue for headlines. Wudoo Mono for timestamps and category tags.

**Tone of headlines (mock data):** Short, direct, technically specific, slightly dry. Examples:
- "Compute availability under pressure. Fabrication corridor delays reported."
- "Talent flows accelerating. Three major operators report migration losses."
- "Regulatory pressure increasing. CLEARANCE costs trending upward in industrial zones."
- "CHIPS supply disruption. East Asian corridor. Estimated recovery: unknown."

Do NOT use exclamation marks, gamified language, or dramatic framing. Bloomberg terminal register, not CNN Breaking News.

#### 2.3.7 Building Detail Panel

**What it displays (when a building is selected on the map):**
- Building name + type + tier (1/2/3) with visual tier indicator
- Production output per hour (current, accounting for efficiency)
- Resource inputs required (for processing buildings)
- TALENT allocation + worker efficiency percentage
- ENERGY consumption rate
- Upgrade path: current tier → next tier, cost, cooldown remaining
- Tile rent cost (RATE per day)

**Font:** Helvetica Neue for the panel. Wudoo Mono for raw production numbers if shown in a "details" expandable.

#### 2.3.8 Intelligence View Panels

Build as four sub-panels, each with mock data:

**Echo Oracle panel:** Table of agents with: agent name, echo reliability score (0-100%), last echo timestamp, published repositioning direction (buy/sell indicator). Sortable by reliability score.

**Data Lineage panel:** Tree/graph visualisation of DATA nodes. Each node shows: source hash (truncated), purity score, parent hash. Poisoned nodes highlighted with `--status-critical` tint. Simplified graph for Step 2 (10-15 nodes).

**Reputation Scores panel:** Table of agents with: agent name, composite reputation score, deal completion rate, disinformation score, anomaly count, activity score. Sortable by any column.

**Guard Clause Marketplace panel:** Card grid of templates. Each card: template name, seller reputation, price (COMPUTE), verified/unverified badge, activation success rate. Filter: verified only / all. Sort: price, reputation, success rate.

---

## 3. Mock Data Specification

Create a `/src/mock/` directory with TypeScript files exporting typed mock data. Each file should have a clear type definition that matches the smart contract interface.

```typescript
// /src/mock/types.ts — central type definitions

export type ResourceType = 
  | 'COMPUTE' | 'ENERGY' | 'CHIPS' | 'COOLING' 
  | 'TALENT' | 'DATA' | 'CLEARANCE';

export interface ResourceBalance {
  resource: ResourceType;
  balance: bigint;        // current balance (wei-scale)
  production: number;     // per hour rate
  consumption: number;    // per hour rate
  priceInRate: number;    // current market price
  change1h: number;       // percentage change last hour
  sparkline: number[];    // last 12 data points for mini chart
}

export interface OrderBookLevel {
  price: number;
  volume: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  pair: `${ResourceType}/RATE`;
  bids: OrderBookLevel[];     // sorted descending by price
  asks: OrderBookLevel[];     // sorted ascending by price
  lastTradePrice: number;
  change24h: number;
}

export interface AgentFeedEntry {
  id: string;
  timestamp: number;          // unix ms
  agentName: string;
  action: string;             // terse description
  detail: string;             // expanded description
  tier: 'critical' | 'warning' | 'info';
  mandateClause?: string;     // which mandate clause triggered this
  resourceType?: ResourceType;
}

export interface HexTile {
  q: number;                  // axial coordinate
  r: number;                  // axial coordinate
  terrain: 'urban' | 'industrial' | 'research' | 'coastal' | 'regulatory' | 'flat';
  owner?: string;             // agent address or name
  building?: {
    type: string;
    tier: 1 | 2 | 3;
    producing: ResourceType;
  };
}

export interface EpochState {
  epochNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  timeRemaining: number;      // seconds
}

export interface WorldEvent {
  id: string;
  timestamp: number;
  category: string;           // SUPPLY_CHAIN, REGULATORY, TALENT, etc.
  headline: string;           // free-tier text (vague)
  tier: 'free' | 'analyst' | 'premium';
}

export interface AgentReputation {
  agentName: string;
  compositeScore: number;     // 0-10000 basis points
  dealCompletionRate: number;  // 0-10000
  disinformationScore: number; // 0-10000
  anomalyCount: number;
  activityScore: number;      // 0-10000
}

export interface EchoOracleEntry {
  agentName: string;
  reliabilityScore: number;   // 0-100 percentage
  lastEchoTimestamp: number;
  direction: 'BUY' | 'SELL' | 'HOLD';
  resource: ResourceType;
}

export interface GuardClauseTemplate {
  id: string;
  name: string;
  seller: string;
  sellerReputation: number;
  priceCompute: number;
  verified: boolean;
  activationSuccessRate: number; // percentage
  description: string;
}

export interface PlayerState {
  name: string;
  role: 'Compute Superpower' | 'Data-Rich State' | 'Chip Power' | 'Talent Hub' | 'Regulatory Power';
  agentName: string;
  rateBalance: bigint;
  resources: ResourceBalance[];
}
```

Generate realistic mock data for all types. The mock data should tell a coherent story — a mid-epoch game state where Player 1 (Compute Superpower) is leading in COMPUTE production but short on CHIPS, with visible market tension and a recent world event disrupting fabrication. Make the data interesting enough that the UI feels alive when populated.

---

## 4. Command Palette Specification

Implement using the `cmdk` library. Trigger: Cmd+K (Mac) / Ctrl+K (Windows).

**Visual design:**
- Centred overlay, 640px max width, max 480px height
- Background: `--surface-2` with 1px `--border-default` border
- Input field: Wudoo Mono, `--text-primary`, no border, bottom 1px separator
- Results: Helvetica Neue for labels, `--text-secondary` for keyboard shortcuts (right-aligned)
- Categories: uppercase, `--text-tertiary`, `--text-xs`
- Selected item: `--surface-hover` background
- Backdrop: `--night-sky` at 80% opacity

**Command categories and items:**

```
NAVIGATION
  Overview          ⌘1
  Map               ⌘2
  Market            ⌘3
  Buildings         ⌘4
  Intelligence      ⌘5
  Mandate           ⌘6

RESOURCES
  COMPUTE           (shows current balance + price)
  ENERGY            (shows current balance + price)
  CHIPS             ...
  COOLING           ...
  TALENT            ...
  DATA              ...
  CLEARANCE         ...

ACTIONS
  Place Order       ⌘O
  View Agent Log    ⌘L
  Toggle Sidebar    ⌘\
  
VIEWS
  Toggle Map Mode   M
  Cycle Resource    Tab (in Market view)
```

Keyboard shortcuts should work globally (not just when palette is open). Register them at the app level.

---

## 5. Interaction Patterns

### 5.1 CK3-Style Nested Tooltips

This is the most important interaction pattern in the entire UI. Implementation requirements:

- Hover over any data element → tooltip appears after 300ms delay
- Tooltip content can contain elements that are themselves hoverable
- Hovering into the tooltip keeps it open; hovering onto a nested trigger opens a second tooltip
- Support arbitrary nesting depth (practically, 3-4 levels is the max players will use)
- Position tooltips dynamically: prefer right, fall back to left, then above, then below
- Dismiss: mouse leaves all tooltip layers for >200ms
- Keyboard: Tab into tooltip content, Escape to dismiss
- Tooltip renders on a portal (z-index above all panels)
- Tooltip content is React components, not strings — it can contain ResourceBadges, PriceCells, links, etc.

### 5.2 Panel Interactions

- **Collapse**: Click panel title bar collapse button → panel animates to a 32px status strip (shows StatusDots for key metrics). Click strip → re-expand.
- **Resize**: Drag the border between adjacent panels. Minimum panel width: 240px. Minimum height: 160px.
- **Preset switch**: Via CommandPalette or ViewSwitcher. Animates panel rearrangement (200ms ease-out).

### 5.3 Notification Tiers

Three tiers, each with distinct visual treatment:

| Tier | Colour | Feed border | TopBar behaviour | Audio |
|------|--------|-------------|------------------|-------|
| Critical | `--status-critical` | 3px left border | Alert banner appears, screen-edge glow (subtle red pulse on Night Sky) | Short beep (optional, user-configurable) |
| Warning | `--status-warning` | 2px left border | Counter badge on alert icon | None by default |
| Info | `--text-tertiary` | 1px left border | None — feed only | None |

The TopBar alert banner for critical notifications: a thin (32px) bar that slides down below the TopBar, `--status-critical` at 15% opacity background, Moon White text, auto-dismisses after 10 seconds or on click. Shows most recent critical event headline.

---

## 6. Figma MCP Workflow

You have access to the Figma MCP. Use this workflow:

1. **Before coding any view**, generate the layout in Figma first using `generate_diagram` for layout wireframes and the design tools for component exploration.
2. Get the visual structure right in Figma — panel proportions, typography hierarchy, data density.
3. Then implement in React/Tailwind matching the Figma output.
4. For the component library, create a Figma page with all base components (ResourceBadge, PriceCell, Tooltip, etc.) at their various states (default, hover, active, disabled, loading).

This is faster than iterating in code and produces better results. Figma is for design exploration; code is for implementation of validated designs.

---

## 7. File Structure

```
mandate-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with TopBar, Sidebar, StatusBar
│   │   ├── page.tsx            # Default view (Overview)
│   │   └── components/         # Component demo/storybook page
│   ├── components/
│   │   ├── data-display/       # ResourceBadge, PriceCell, Sparkline, StatusDot, DataTable
│   │   ├── interactive/        # Button, Input, Select, Slider, Toggle
│   │   ├── layout/             # Panel, PanelLayout, TopBar, Sidebar, StatusBar
│   │   ├── navigation/         # CommandPalette, ViewSwitcher
│   │   ├── feed/               # FeedEntry, ActivityFeed, NewsTicker
│   │   ├── tooltip/            # Tooltip (CK3-style nested)
│   │   ├── views/              # WorldMap, OrderBook, BuildingDetail, Intelligence/*
│   │   └── index.ts            # Barrel exports
│   ├── mock/
│   │   ├── types.ts            # All TypeScript interfaces
│   │   ├── resources.ts        # ResourceBalance mock data
│   │   ├── orderbook.ts        # OrderBookSnapshot mock data (7 pairs)
│   │   ├── feed.ts             # AgentFeedEntry mock data (~100 entries)
│   │   ├── map.ts              # HexTile mock data (~50 tiles)
│   │   ├── epoch.ts            # EpochState mock data
│   │   ├── events.ts           # WorldEvent mock data
│   │   ├── intelligence.ts     # Reputation, Echo, Lineage, GuardClause mock data
│   │   └── player.ts           # PlayerState mock data
│   ├── hooks/
│   │   ├── useCommandPalette.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── usePanelLayout.ts
│   │   └── useTooltip.ts
│   ├── styles/
│   │   ├── globals.css         # CSS custom properties, font-face declarations
│   │   └── fonts/              # Wudoo Mono files (if self-hosted)
│   └── lib/
│       ├── constants.ts        # Resource names, colours, terrain types
│       └── format.ts           # Number formatting, time formatting utilities
├── tailwind.config.ts          # MegaETH theme tokens
├── tsconfig.json
├── package.json
└── README.md
```

---

## 8. Acceptance Criteria

Step 1 is complete when:
- [ ] All CSS custom properties defined and accessible
- [ ] Tailwind theme configured with MegaETH tokens
- [ ] All base components (section 1.4) render correctly with mock props
- [ ] Component demo page at `/components` shows every component in all states
- [ ] Typography dual-register is visually correct (dashboard vs terminal feel)
- [ ] Tabular nums working on all numerical displays
- [ ] CK3-style nested tooltip working with at least 3 levels of nesting

Step 2 is complete when:
- [ ] Full layout renders with TopBar, Main View, Sidebar, StatusBar
- [ ] All four preset panel layouts switch correctly via CommandPalette
- [ ] Command palette opens on Cmd+K with all commands listed
- [ ] Keyboard shortcuts work globally (⌘1-6 for view switching, ⌘\ for sidebar toggle)
- [ ] Agent activity feed scrolls with mock data, pauses on hover, batches entries
- [ ] Order book DOM ladder renders with mock bid/ask data
- [ ] World map placeholder renders hex grid with terrain types and buildings
- [ ] All five map modes toggle and change tile colours + tooltip content
- [ ] Resource summary in TopBar shows all 7 resources with sparklines
- [ ] Epoch timer counts down (using mock end timestamp)
- [ ] News ticker scrolls world event headlines
- [ ] Notification tiers visually distinguish critical/warning/info in the feed
- [ ] TopBar alert banner appears for critical mock events
- [ ] Panel collapse/expand animation works
- [ ] Panel resize via drag works
- [ ] All text follows the dual typography register (Helvetica Neue dashboard / Wudoo Mono terminal)
- [ ] No blockchain-related terms visible anywhere in the UI (no "gas", "mint", "wallet", "transaction hash")
- [ ] No AI jargon visible anywhere in the UI (no "prompt", "token limit", "context window", "temperature")
- [ ] Tone of all visible text matches GDD: short, direct, technically specific, no gamified enthusiasm

---

## 9. What Comes Next (Do Not Build Yet)

**Step 3 — Contract Integration Layer**: wagmi + viem hooks against MegaETH RPC. WebSocket subscriptions for real-time order book and event feeds. Replace mock data outlets with live chain reads. Waiting on: outstanding contract fixes (H-01, M-01-M-03 from security audit), InsurancePool `triggerClaim()` fix, LineageLedger redesign.

**Step 4 — Mandate Editor & Onboarding**: The structured mandate builder (dropdowns, sliders, constraints), template gallery, intent preview, Round Zero demonstration, and the three-axis onboarding flow. Waiting on: Phase 4 mandate schema finalisation.
