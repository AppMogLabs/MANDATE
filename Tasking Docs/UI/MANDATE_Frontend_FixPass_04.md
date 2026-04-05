# MANDATE Frontend — Fix Pass #4: Onboarding v2 Bugs

**Priority: Fix immediately — onboarding is broken for some paths**

---

## Bug 1: Role selection cards have no hover interaction

**What's broken:** The role selection cards are static rectangles. Hovering over them produces no visual feedback. They should feel interactive — a subtle expansion that signals "this is clickable."

**Fix:** Add a hover transform to the role cards:

```css
.role-card {
  transition: transform 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out;
}

.role-card:hover {
  transform: scale(1.04);
  border-color: var(--border-focus);
  box-shadow: 0 0 20px rgba(var(--role-colour-rgb), 0.12);
  z-index: 1; /* Ensure hovered card renders above siblings */
}
```

The scale is subtle (1.04, not 1.1) — this is a professional interface, not a game menu. The border colour shifts to `--border-focus` and the box shadow uses the role's resource colour at low opacity (the mapping from the spec: Compute → `#7EAAD4`, Data-Rich → `#90D79F`, Chip → `#F5949D`, Talent → `#F786C6`, Regulatory → `#6DD0A9`).

Also add `cursor: pointer` to the cards if not already set.

Reference the hover style used on appmoglabs.com and the Claude Architect course site — the cards should "lift" slightly toward the user on hover, similar to those implementations.

---

## Bug 2: Terminal boot text disappears after ~1 second — impossible to read

**What's broken:** The green terminal text types out the full briefing but only stays visible for about 1 second after completing, then transitions away to the dashboard. The player cannot read the content. The spec says the cursor should blink for 2 seconds on the final line AFTER all typing completes, THEN fade out over 500ms.

**Fix:** The transition timing is wrong. The sequence should be:

1. All text finishes typing (takes ~50-60 seconds at full speed, or instant if skipped)
2. Final line `AWAITING MANDATE_` — cursor blinks on this line
3. **Wait 4 seconds** (increased from the spec's 2 seconds — the player needs time to absorb the final message and the role reveal above it)
4. Green text fades out over 500ms
5. Dashboard fades in over 500ms
6. Recommendation bar appears

The likely bug: the fade-out timer is starting when typing BEGINS rather than when typing COMPLETES. Or the total duration is calculated incorrectly. Check that the transition timeout is set in the callback that fires AFTER the last line finishes typing, not at component mount.

```typescript
// WRONG — timer starts at mount
useEffect(() => {
  setTimeout(() => fadeOut(), 1000);
}, []);

// RIGHT — timer starts after typing completes  
const onTypingComplete = () => {
  setTimeout(() => fadeOut(), 4000); // 4 seconds to read after last line
};
```

Also: if the player skips (presses any key), all text should appear instantly and the 4-second hold should still apply — don't skip the hold. The player pressed skip to see the text faster, not to skip past it entirely. If they want to skip EVERYTHING, they should press a key a second time during the hold period. So:

- First keypress during typing: reveals all remaining text instantly, starts the 4-second hold
- Second keypress during the hold period: immediately triggers the fade transition
- This two-press pattern ensures no one accidentally skips past the briefing

---

## Bug 3: Dashboard Tour breaks when "I've used AI" is checked (but strategy is unchecked)

**What's broken:** When the player checks "I've used AI tools" but NOT "I'm familiar with strategy games":
- The tour starts (correct — strategy-unfamiliar players should get the tour)
- Step 1 highlights the CMP resource badge and says "hover over Compute to learn more"
- But the interactive prompt doesn't work — the component is already in a hover/highlight state from the spotlight, so the hover detection doesn't trigger
- There's no "Next" button visible
- The player is stuck

**Root cause:** The spotlight overlay is interfering with the hover event detection on the resource badge. When the spotlight dims everything except the highlighted panel, the overlay element (likely a semi-transparent div covering the screen) is sitting between the cursor and the actual ResourceBadge component, eating the hover/mouse events. The spotlight needs to have `pointer-events: none` on the dimming overlay while keeping `pointer-events: auto` on the highlighted area.

**Fix — three parts:**

### Part A: Fix pointer events on the spotlight overlay

The spotlight effect should work like this:
- Full-screen overlay div: `pointer-events: none` (mouse events pass through)
- SVG mask or CSS clip-path creates the "hole" around the highlighted element
- The highlighted element itself needs NO overlay on top of it — it should receive mouse events normally

If using an SVG mask approach, the mask should cut out the exact bounding box of the highlighted element. If using a CSS approach with four overlay panels (top, bottom, left, right of the highlighted area), ensure no panel covers the highlighted element.

### Part B: Fix the interactive prompt detection

The tour step's interactive prompt ("hover over Compute to learn more") needs to detect when the player actually hovers the ResourceBadge and the tooltip appears. Currently this detection is probably looking for a hover event that never fires because of Part A.

The detection should:
1. Listen for the ResourceBadge's tooltip becoming visible (check for the tooltip portal element appearing in the DOM, or use a callback prop)
2. Once the tooltip appears AND the player has seen it for at least 1 second, show the "Next" button
3. If the tooltip detection is too complex, fall back to: show the "Next" button after 3 seconds regardless, with the instruction text changing to "Try hovering any resource badge — or continue to the next step"

### Part C: Always provide a Next button as fallback

This is a general rule for ALL tour steps, not just Step 1:

Every tour step should show a "Next →" button after a maximum of 5 seconds, regardless of whether the interactive prompt has been completed. Interactive prompts are suggestions, not gates. If the player can't figure out the interaction or it's bugged, they should never be stuck.

```
Step 1 renders → 
  Interactive prompt visible: "Hover over a resource for detail" →
  After 5 seconds OR after interaction detected: 
    Show "Next →" button
    Change prompt text to "Got it? →" (if interaction completed) 
    or keep original text (if timed out)
```

The "End tour" link should ALSO always be visible as a last-resort escape (per the spec).

---

## Bug 4: Tour "End tour" escape may not be visible

**Potentially broken (verify):** The spec says "End tour" link should always be visible during the tour. Confirm this is actually rendering on every step. If it's missing on Step 1 (the broken step), that's why the player gets completely stuck with no way out.

**Fix if missing:** Add "End tour" link to the explanation card on every step:

```
┌──────────────────────────────────────────────┐
│ Step 1 of 6                                  │
│                                              │
│ Your resources. Seven types plus RATE.        │
│ Hover over a resource for detail.            │
│                                              │
│             [Next →]     End tour            │
└──────────────────────────────────────────────┘
```

"End tour" is `--text-tertiary`, no border, right-aligned. Clicking it dismisses the spotlight and returns to normal gameplay. Also wire Escape key to end the tour at any step.

---

## Acceptance Criteria

- [ ] Role cards scale up subtly on hover (1.04x) with border colour shift and resource-coloured shadow
- [ ] Role cards show `cursor: pointer` on hover
- [ ] Terminal boot text stays visible for 4 seconds after final line finishes typing
- [ ] First keypress during typing reveals all text instantly, starts 4-second hold
- [ ] Second keypress during hold skips to dashboard transition immediately
- [ ] Dashboard tour Step 1 interactive prompt (hover resource) works — tooltip appears when player hovers the badge
- [ ] If tooltip detection fails or times out after 5 seconds, "Next" button appears anyway
- [ ] Every tour step has both a "Next" button (visible immediately or after timeout) and an "End tour" link
- [ ] Escape key ends the tour at any step
- [ ] Tour works correctly for all four toggle combinations: both checked, both unchecked, only strategy, only AI
- [ ] No step in the tour can leave the player stuck with no way to proceed or exit
