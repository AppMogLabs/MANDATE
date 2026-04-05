# MANDATE Frontend — Fix Pass #2: Onboarding + Editor Issues

**Priority: Fix before next review**

---

## Bug 1: Submit Mandate button appears disabled with no explanation

**What's broken:** In Round One of the onboarding, the "Submit Mandate" button shows a "no entry" cursor, indicating it's disabled. The player has no idea why. The spec requires at least one edit before submission, but this constraint is invisible.

**Fix — two parts:**

### Part A: Visual feedback when button is disabled
When the Submit button is disabled (because the player hasn't edited yet), show text below or beside the button explaining why:

`Edit the mandate above to continue` — in `--text-tertiary`, `font-terminal` (Wudoo Mono), `--text-xs`. This text disappears once the player makes any edit and the button enables.

The button itself should use a clearly disabled visual state: `--text-tertiary` text colour, `--surface-1` background, `cursor: not-allowed`. NOT the same visual treatment as an active button — the current implementation apparently looks close enough to active that the player tries to click it.

### Part B: Lower the edit threshold
The current implementation likely checks for text difference from the original template. This is correct but the threshold should be generous — any single character change (including adding a space) should count. Don't require a meaningful edit, just any edit. The point is to get the player interacting with the text, not to validate quality.

---

## Bug 2: Onboarding rounds render as simple modals instead of using the editor

**What's broken:** Round One shows a plain textarea inside a modal card overlay. The Step 4 spec requires the onboarding rounds to use the actual mandate editor components — the same text area with line numbers, resource name highlighting, and the full editor chrome. The modal approach means:
- No resource name highlighting (COMPUTE, ENERGY, CHIPS should be coloured in the text)
- No line numbers
- No Clarity Score feedback
- The player doesn't learn the actual editor interface during onboarding

**Fix:** Refactor the onboarding rounds that involve editing (Rounds 1, 2, 3) to use the real `MandateEditor` component instead of a plain textarea in a modal. The approach:

### For Rounds 1, 2, 3:
Instead of rendering a modal overlay with a textarea, the onboarding should:

1. Dismiss the overlay/modal
2. Switch the main view to the Mandate tab (as if the player clicked it)
3. Load the MandateEditor component with the appropriate state:
   - **Round 1**: Pre-filled template text, Layer 2 hidden, "Edit the mandate above to continue" prompt
   - **Round 2**: Empty editor, Layer 2 visible and expanded, Clarity Score visible
   - **Round 3**: Pre-filled with previous mandate, suggestion chips shown above the editor
4. Show a slim instruction bar across the top of the editor panel (not a modal — a 40px bar inside the panel):
   - Round 1: "Round 1 of 5 — Edit this mandate to match your strategy"
   - Round 2: "Round 2 of 5 — Write your own mandate. Use the controls if you're not sure what to write"
   - Round 3: "Round 3 of 5 — Refine your mandate based on what happened"
   - Background: `--surface-2`, text in Helvetica Neue `--text-secondary`, "Skip to game →" link on the right
5. The Submit button in the editor triggers the round's outcome sequence (mock feed playback + results)

### For Round Zero and Round Four:
These are demonstrations (no editing), so they CAN remain as centred overlay panels — the player is watching, not interacting. But style them to match the game's aesthetic:
- Background: `--surface-2` (not the current white/light card style)
- Text: `--text-primary` (Moon White)
- The activity feed playback in Round Zero should use the real `FeedEntry` components with colour-coded action badges, not plain text

### For Round Five:
This is just a 3-second transition message before the full game loads. Can remain as a brief centred overlay that fades out.

### The self-declaration screen:
This can remain as a centred modal overlay — it's a one-time pre-game screen. But ensure it uses:
- `--surface-2` background (not white)
- `--text-primary` for text
- Custom Toggle components (not native radio buttons — the screenshot shows what look like basic radio inputs)
- The three toggles should be checkboxes (multi-select), not radio buttons. The spec says "three independent toggles" — a player could be familiar with crypto AND strategy but not AI. Radio buttons imply single selection.

---

## Bug 3: Self-declaration uses radio buttons instead of checkboxes

**What's broken:** Screenshot 1 shows what appear to be radio button circles next to each option. The spec explicitly states "three independent toggles" — each is a separate yes/no choice. A player might check two out of three, or all three, or none.

**Fix:** Replace radio buttons with the Toggle component from the component library (or checkboxes styled to match the design system). Each toggle is independent. The current radio button appearance implies the player can only select one option.

---

## Bug 4: "1 Issue" error badge in bottom-left

**What's visible:** Both screenshots show a red "N 1 Issue ✕" badge in the bottom-left corner. This looks like a Next.js development error overlay.

**Fix:** Investigate and fix whatever error is being reported. If it's a React hydration mismatch or a missing key warning, resolve it. The error badge shouldn't be visible during testing — it distracts from the actual UI review.

---

## Acceptance Criteria

- [ ] Submit Mandate button in Round One shows explanatory text when disabled ("Edit the mandate above to continue")
- [ ] Button enables after any single character edit to the template text
- [ ] Disabled button has a clearly different visual state from the active button
- [ ] Rounds 1, 2, 3 use the real MandateEditor component, not a plain textarea in a modal
- [ ] Round 1 editor shows pre-filled template with resource name highlighting and line numbers
- [ ] Round 2 editor shows empty editor with Layer 2 expanded
- [ ] Round 3 editor shows previous mandate with suggestion chips
- [ ] Instruction bar appears at top of editor during onboarding rounds (not a modal overlay)
- [ ] Round Zero and Round Four remain as overlay panels but styled with `--surface-2` background and Moon White text
- [ ] Round Zero's feed playback uses real FeedEntry components with colour-coded badges
- [ ] Self-declaration screen uses independent checkboxes/toggles, not radio buttons
- [ ] Next.js error badge resolved (no "1 Issue" visible)
- [ ] All onboarding text uses correct typography register (Helvetica Neue for instructions, Wudoo Mono for game content)
