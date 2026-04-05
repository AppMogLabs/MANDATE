# MANDATE Map UI — Claude Code Handoff

**Author:** App Mog Labs  
**Date:** April 2026  
**Scope:** Frontend hex map component wired to deployed MapRegistry contract  
**Priority:** Blocking testnet playtesting

---

## What This Is

Build the world map UI for MANDATE. This is the core gameplay surface — a persistent hex-tile grid where players claim territory, place buildings, and compete for resources. Without this, we can't playtest.

The MapRegistry contract is already deployed to MegaETH testnet (Chain ID 6343). Contract addresses are in `mandate-frontend/src/lib/addresses.ts`. The frontend is React. This component needs to read on-chain state and let the connected wallet interact with tiles.

---

## What To Build

A full-screen interactive hex-tile grid rendered in SVG within a React component.

### Phase A — Static Grid (get something on screen first)

1. Render a hex grid. Start with a sensible testnet size — suggest 20×20 (400 tiles). Hex orientation: flat-top. Use axial coordinates (q, r).
2. Color-code tiles by terrain type. Six terrain types, mapped to MegaETH brand kit pastel accents:

| Terrain Type | Enum Value | Suggested Colour | Accent From Brand Kit |
|---|---|---|---|
| High-density urban | 0 | Warm coral/salmon | `#FF877C` (Coral) |
| Industrial zone | 1 | Amber/orange | `#FFB347` (Amber) |
| Research corridor | 2 | Teal/cyan | `#7CD8D5` (Teal) |
| Coastal/port | 3 | Blue/aqua | `#7CB9E8` (Sky) |
| Regulatory district | 4 | Purple/lavender | `#C3B1E1` (Lavender) |
| Flat/mixed | 5 | Muted grey | `#B0B0B0` (Neutral) |

3. Background: Night Sky `#19191A`. Text: Moon White `#ECE8E8`. Fonts: Helvetica Neue for UI, Wudoo Mono for data/coordinates.
4. Each hex shows its coordinate on hover.

### Phase B — Contract Integration (read on-chain state)

1. Read tile data from the deployed MapRegistry contract. Each tile has: terrain type, owner (address or zero), building (token ID or zero), rent status.
2. Visual states per tile:
   - **Unclaimed**: terrain colour at ~40% opacity, dashed border
   - **Claimed (other player)**: terrain colour at full opacity, solid border, owner address truncated on hover
   - **Claimed (connected wallet)**: terrain colour at full opacity, bright border glow, "YOURS" indicator
   - **Has building**: building icon or symbol overlaid on tile (see building types below)
   - **Rent overdue**: red pulsing border (grace period is 3 days / 259,200 seconds)
3. Tile hover tooltip shows: coordinates, terrain type name, owner (if claimed), building name (if built), rent status, eligible buildings for this terrain.
4. Read the connected wallet's agent data from AgentRegistry to determine which tiles belong to the current player's agent.

### Phase C — Interactions (write to chain)

1. **Claim tile**: Click unclaimed tile → confirmation modal → call MapRegistry.claimTile(). Show pending TX state.
2. **Place building**: Click owned empty tile → building selection panel (filtered by terrain eligibility) → call BuildingRegistry.construct(buildingType, tileId, agentAddress). Show pending TX state.
3. **View building**: Click tile with building → building info panel showing type, tier, production rate, TALENT allocation, upgrade status.
4. **Release tile**: Right-click or long-press owned tile → confirmation → call MapRegistry.releaseTile().

### Phase D — Navigation & Polish

1. Pan (click-drag) and zoom (scroll wheel / pinch) on the grid.
2. Minimap in corner showing full grid with player's territory highlighted.
3. Legend panel showing terrain type colour key.
4. Resource bar across top showing connected wallet's agent balances (read from resource token contracts).
5. Smooth transitions when tile state changes (claim animation, building construction animation).

---

## Terrain → Building Eligibility Rules

These are hard rules from the GDD. The UI must enforce them in the building selection panel (grey out ineligible buildings). The contract also enforces them, but the UI should prevent wasted transactions.

| Terrain | Eligible Buildings |
|---|---|
| High-density urban | Data Centre, Recruiting Pipeline, Lobbying Office |
| Industrial zone | Power Plant, Fabrication Contract, Cooling Infrastructure |
| Research corridor | University, Alignment Lab, Training Cluster |
| Coastal/port | Data Acquisition Hub, Media Arm, Open Source Front |
| Regulatory district | Lobbying Office, Regulatory Moat, Intelligence Network |
| Flat/mixed | Housing, Trading Post, Infrastructure (general purpose) |

---

## Building Types Reference

For the building icons/symbols on tiles. These don't need to be elaborate — a distinct glyph or abbreviation per type is fine for testnet.

**Production:** Data Centre (DC), Power Plant (PP), Solar Array (SA), Fabrication Contract (FC), Recruiting Pipeline (RP), Data Acquisition Hub (DAH), Cooling Infrastructure (CI)

**Processing:** Training Cluster (TC), Alignment Lab (AL)

**Influence:** Lobbying Office (LO), Intelligence Network (IN), Media Arm (MA), Open Source Front (OSF)

**Yield:** Deployed Model (DM), Patent Portfolio (PAT), Regulatory Moat (RM)

**Infrastructure:** Road (RD), Security Perimeter (SP)

---

## Design Direction

**Westworld control room aesthetic.** This is not a colourful cartoon map. It's a dark, data-dense strategic command interface.

- Dark background (`#19191A`), terrain colours are the only colour on the grid
- Clean geometric hexagons with thin borders
- Data overlays feel like a military/intelligence dashboard
- Hover states reveal information layers — the map is readable at a glance but information-rich on inspection
- No decorative flourishes. Every pixel is functional.
- Animations are subtle and purposeful — state transitions, not eye candy

Reference mood: the Delos control room in Westworld, or the tactical displays in Ender's Game. Strategic, clean, slightly ominous.

---

## Contract Interfaces (What You Need To Call)

Check the actual deployed contract ABIs in the codebase. But based on the spec, here's what the map component needs:

```
// MapRegistry
getTile(uint32 tileId) → (uint8 terrain, address owner, uint256 buildingId, uint256 lastRentPaid)
claimTile(uint32 tileId) → void
releaseTile(uint32 tileId) → void
getMapSize() → uint32  // or however the grid dimensions are stored

// BuildingRegistry
construct(uint8 buildingType, uint32 tileId, address agent) → uint256 tokenId
getBuildingInfo(uint256 tokenId) → BuildingStruct

// AgentRegistry
agentIdOf(address owner) → uint256
validateAction(address agent, uint8 actionType) → bool

// Resource tokens (for the resource bar)
balanceOf(address) → uint256  // for each of the 7 resource tokens + RATE
```

**Important:** Check `addresses.ts` for actual deployed addresses. Check the contract ABIs — the function signatures above are from the spec docs and may differ slightly from what was actually implemented. Trust the deployed code over this document.

---

## Rent Parameters

| Parameter | Value |
|---|---|
| BASE_TILE_RENT_DAILY | 100 RATE |
| RENT_GRACE_PERIOD | 259,200 seconds (3 days) |
| Escalation | Per-tile cost increases with total tiles held by the agent |

The UI should show: days until rent due, whether grace period is active, and total daily rent burden for the connected player.

---

## What NOT To Build

- No off-chain map server. All state reads come from the chain.
- No fog of war (yet — that's an information economy feature for later).
- No real-time animation of other players' moves (just poll/refresh).
- No mobile-optimised layout (desktop-first for testnet).
- No token approval flows in the map itself — assume approvals are handled elsewhere in the UI or prompt if needed.

---

## Build Order

1. Phase A first. Get hexagons on screen with terrain colours. This is the "does it look right" checkpoint.
2. Phase B next. Wire up contract reads. This is the "does it show real state" checkpoint.
3. Phase C next. Add click-to-claim and building placement. This is the "can I play" checkpoint.
4. Phase D last. Navigation, minimap, polish. This is the "does it feel good" checkpoint.

**Checkpoint after each phase. Do not proceed to the next phase without confirming the previous one works on localhost.**

---

## Questions Claude Code Should Resolve Itself

- Exact MapRegistry ABI and function signatures (read from the deployed contract / existing frontend code)
- How terrain is stored (check if it's a seed script that initialised terrain, or if it's configurable)
- Grid dimensions (check Seed.s.sol for what was actually seeded)
- Whether the frontend already has a wagmi/viem setup or ethers.js — use whatever's already there
- Hex math library: use an existing one (e.g., `honeycomb-grid`) or write from scratch — your call based on what fits the stack

---

## Hard Boundaries

- **DO NOT** modify any smart contracts. This is frontend only.
- **DO NOT** add new npm dependencies without checking they're compatible with the existing React setup.
- **DO NOT** build a separate page/route — this should be a component that fits into the existing frontend shell.
- **DO NOT** make design decisions about gameplay mechanics. If something in the contract doesn't match this doc, the contract is correct.
