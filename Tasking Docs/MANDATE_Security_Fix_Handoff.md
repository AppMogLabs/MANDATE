# MANDATE Contracts — Security Fix Handoff

**App Mog Labs | March 2026**
**Scope: Apply all fixes from SECURITY_AUDIT_REPORT.md**
**Estimated time: 15-20 minutes**

---

## Read This First

The security audit (run by Claude Code using Cyfrin methodology) found 1 high, 3 medium, 4 low, and 3 gas optimisation issues. All are Status: Open. The FIXES.md file in the repo has the full checklist. This handoff specifies the exact code changes.

Apply all Priority 1, 2, and 3 fixes. Skip Priority 4 (gas optimisations and documentation — defer to Phase 2). Fix the demo script bugs.

After applying all fixes, run `forge test -vv` and confirm all 107 existing tests still pass. Then write new tests for each fix to confirm the vulnerability is resolved.

---

## Priority 1: Critical

### H-01: Zero rateAmount via Integer Truncation

**File:** `src/OrderBook.sol`, line 263
**Fix:** Add a check after the rateAmount calculation:

```solidity
uint256 rateAmount = (fillAmount * order.pricePerUnit) / 1e18;
require(rateAmount > 0, "OrderBook: rateAmount too small");
```

**New test required:** Verify that `matchOrder()` with a `fillAmount` that would produce `rateAmount = 0` now reverts. The existing PoC tests (`test_ZeroRateAmount_FreeTokenExtraction` and `test_RepeatedDustFills_DrainOrder`) should now pass with the expected revert.

---

## Priority 2: High

### M-02: Add Pausable to OrderBook

**File:** `src/OrderBook.sol`
**Fix:**

1. Add import:
```solidity
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
```

2. Add to contract inheritance:
```solidity
contract OrderBook is ReentrancyGuard, AccessControl, Pausable {
```

3. Add `whenNotPaused` modifier to `placeOrder()` and `matchOrder()`. Do NOT add it to `cancelOrder()` — users must be able to cancel orders and withdraw funds even when paused.

4. Add pause/unpause functions:
```solidity
function pause() external onlyRole(OPERATOR_ROLE) {
    _pause();
}

function unpause() external onlyRole(OPERATOR_ROLE) {
    _unpause();
}
```

**New tests required:**
- `test_PausedOrderBook_PlaceOrderReverts()` — placeOrder reverts when paused
- `test_PausedOrderBook_MatchOrderReverts()` — matchOrder reverts when paused
- `test_PausedOrderBook_CancelOrderWorks()` — cancelOrder succeeds when paused (critical — users must exit)
- `test_PauseUnpause_OnlyOperator()` — non-operator cannot pause/unpause

### M-03: Update agentIdOf on ERC-721 Transfer

**File:** `src/AgentRegistry.sol`
**Fix:** Override the `_update()` hook (OZ v5 transfer hook):

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address from)
{
    from = super._update(to, tokenId, auth);
    if (from != address(0)) {
        delete agentIdOf[from];
    }
    if (to != address(0)) {
        agentIdOf[to] = tokenId;
    }
}
```

**Alternative (simpler, recommended for v1):** Make agent NFTs soulbound — prevent transfers entirely:

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address from)
{
    from = super._update(to, tokenId, auth);
    // Allow minting (from == address(0)) and burning (to == address(0))
    // Block transfers between non-zero addresses
    if (from != address(0) && to != address(0)) {
        revert("AgentRegistry: agent NFTs are non-transferable");
    }
}
```

**Decision:** Use the soulbound approach. Agent identity in MANDATE is tied to an address, not a tradeable asset. The GDD doesn't describe agent identity transfer as a mechanic. Making them soulbound eliminates the entire class of stale-identity bugs. If transferability is needed later, it can be added in a contract upgrade.

**New tests required:**
- `test_AgentNFT_TransferReverts()` — transferFrom between two non-zero addresses reverts
- `test_AgentNFT_MintWorks()` — minting (registerAgent) still works
- Update existing test `test_NFTTransfer_AllowlistPersists()` — should now revert instead of leaving stale state

---

## Priority 3: Medium

### M-01: Add Access Control to verifyGuardSignature()

**File:** `src/AgentRegistry.sol`, line 197
**Fix:** Mark the function as `internal` until Phase 4 integration. It's currently unused by any other contract.

```solidity
// Change from:
function verifyGuardSignature(...) external returns (bool) {
// To:
function verifyGuardSignature(...) internal returns (bool) {
```

When Phase 4 integrates guard agents, this will be changed to `external` with proper role validation (the guard agent's address must hold a GUARD_ROLE). But for now, making it internal prevents any external misuse.

**New test:** Update any test that calls `verifyGuardSignature()` externally — it should now be tested via an internal call or a test harness contract that exposes it.

### L-01: Block Self-Matching in OrderBook

**File:** `src/OrderBook.sol`, line 243 (inside `matchOrder()`)
**Fix:** Add at the start of matchOrder:

```solidity
require(msg.sender != order.seller, "OrderBook: self-match not allowed");
```

**New test:**
- `test_SelfMatch_Reverts()` — seller calling matchOrder on their own order reverts

### L-03: Validate Non-Zero AgentIds in ReputationLedger

**File:** `src/ReputationLedger.sol`, line 57
**Fix:** Add at the start of `recordTransaction()`:

```solidity
require(buyerAgentId != 0 && sellerAgentId != 0, "ReputationLedger: zero agentId");
```

**New test:**
- `test_ZeroAgentId_Reverts()` — recordTransaction with agentId 0 reverts

---

## Demo Script Fixes

### Demo.s.sol Step 5 — Agent Beta needs ORDER_MATCH

**File:** `script/Demo.s.sol`, in `step3_allowlisting()`
**Fix:** Add ORDER_MATCH to Beta's allowlist:

```solidity
// Beta needs ORDER_MATCH to call matchOrder()
agentRegistry.setAllowlist(betaAgentId, ACTION_ORDER_PLACE | ACTION_ORDER_MATCH);
```

### Demo.s.sol Step 4 — Deployer needs MINTER_ROLE

**File:** `script/Demo.s.sol`, in `step4_mint()`
**Fix:** Add before minting:

```solidity
factory.setMintAuthority(address(computeToken), deployer, true);
factory.setMintAuthority(address(chipsToken), deployer, true);
```

---

## Verification

After all fixes, run:

```bash
forge test -vv
```

All 107 existing tests should pass. The security PoC tests that previously demonstrated the vulnerabilities should now revert as expected. New tests should bring the total to approximately 120+.

Also run:
```bash
forge test --match-path test/security/ -vv
```

To confirm all security-specific tests pass with the new behaviour.

Update FIXES.md — check off every item that's been fixed. Update SECURITY_AUDIT_REPORT.md — change Status from "Open" to "Fixed" on each resolved finding.

---

## What NOT to Fix (Deferred)

- **L-02 (minimum order size):** The MIN_ORDER_AMOUNT constant is tagged as PHASE_3_PLACEHOLDER in the codebase. Phase 3 tokenomics has been completed but this specific value hasn't been set. Defer.
- **L-04 (admin renounce risk):** Acknowledged as acceptable for testnet. Document in README for mainnet.
- **G-01, G-02, G-03 (gas optimisations):** Cosmetic. Defer to Phase 2.
