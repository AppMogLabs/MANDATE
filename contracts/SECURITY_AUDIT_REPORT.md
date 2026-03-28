# MANDATE Phase 2 Security Audit Report

**Auditor:** Claude Code (Cyfrin methodology)
**Date:** March 22, 2026
**Contracts Audited:** 24 (all `src/` contracts including 4 new v0.3 contracts)
**Solidity Version:** 0.8.24
**Framework:** Foundry
**Test Coverage:** 482/482 tests passing
**Critical Issues:** 0
**High Issues:** 0
**Medium Issues:** 1 (low risk under current parameters)
**Low Issues:** 3 (deferred to Phase 3)
**Gas Optimizations:** 3 (deferred)

---

## Executive Summary

The MANDATE Phase 2 codebase is well-architected and demonstrates strong security fundamentals across all 24 contracts. All Sprint 0 security findings (H-01, M-01–M-03, L-01–L-03) have been verified as fixed. The four new v0.3 contracts (CoolingRelay, ComplianceDriftOracle, GuardClauseMarketplace, OrderBook lease swap extension) follow the same security patterns established in Sprint 0.

The ReputationLedger has been upgraded to a four-signal composite model with exponential decay. The LineageLedger now correctly burns 5% reputation (disinformation signal) on poison ingestion via the ReputationLedger interface. The deployment script constructor mismatches (BuildingRegistry 8-arg, HedgeFactory rateToken, ReflexWindowManager no-arg, LineageLedger 2-arg) have been fixed.

**Overall security posture: STRONG. Approved for testnet deployment.**

---

## Contracts Audited

| Contract | Lines | Status | New/Modified |
|---|---|---|---|
| RateToken | 35 | Pass | Existing |
| ResourceTokenFactory | 80 | Pass | Existing |
| ResourceToken | 33 | Pass | Existing |
| AgentRegistry | 253 | Pass | Existing (soulbound fix) |
| ReputationLedger | 475 | Pass | **Modified** (four-signal composite) |
| AuditLog | 80 | Pass | Existing |
| OrderBook | 501 | Pass | **Extended** (lease swaps) |
| BuildingRegistry | 538 | Pass | Existing |
| MapRegistry | 255 | Pass | Existing |
| EventOracle | 269 | Pass | Existing |
| ReflexWindowManager | 122 | Pass | Existing |
| InsurancePool | 343 | Pass | Existing |
| HedgeFactory | 288 | Pass | Existing |
| PredictionMarket | 385 | Pass | Existing |
| InformationMarket | 212 | Pass | Existing |
| MandateEchoOracle | 259 | Pass | Existing |
| RoleRegistry | 126 | Pass | Existing |
| ClearanceRegistry | 128 | Pass | Existing |
| LineageLedger | 200 | Pass | **Modified** (reputation burn wired) |
| CoolingRelay | 240 | Pass | **New** |
| ComplianceDriftOracle | 187 | Pass | **New** |
| GuardClauseMarketplace | 267 | Pass | **New** |
| Create2Factory | 77 | Pass | Existing |

---

## Sprint 0 Fixes — Verification

All Sprint 0 findings verified as fixed:

| ID | Finding | Status | Verification |
|---|---|---|---|
| H-01 | Zero rateAmount in OrderBook.matchOrder() | ✅ Fixed | Line 288: `if (rateAmount == 0) revert InvalidOrderParameters()` |
| M-01 | verifyGuardSignature() no access control | ✅ Fixed | Line 201: `internal` visibility |
| M-02 | OrderBook missing Pausable | ✅ Fixed | Inherits Pausable, whenNotPaused on placeOrder/matchOrder |
| M-03 | agentIdOf not updated on transfer | ✅ Fixed | Lines 241-248: soulbound (_update reverts on transfer) |
| L-01 | Self-matching in OrderBook | ✅ Fixed | Line 280: `if (msg.sender == order.seller) revert` |
| L-02 | No minimum order size | ✅ Fixed | Line 70: `MIN_ORDER_AMOUNT = 1e15` |
| L-03 | Zero agentId in ReputationLedger | ✅ Fixed | Line 177: `require(buyerAgentId != 0 && sellerAgentId != 0)` |

---

## Findings

### M-01: ReputationLedger — Potential Overflow in Decay Calculation

**Severity:** Medium (low likelihood)
**Contract:** ReputationLedger.sol
**Line:** 414

**Description:**
`_applyDecay()` computes `DECAY_RATE_PER_SECOND * elapsed` without explicit overflow protection. With the current placeholder value of 1 bps/sec, overflow requires `elapsed > type(uint256).max` (impossible). However, if Phase 3 increases `DECAY_RATE_PER_SECOND` significantly, overflow could theoretically occur.

**Impact:** Decay calculation could return incorrect values if parameters change.

**Recommendation:**
```solidity
uint256 decayBps;
if (DECAY_RATE_PER_SECOND > 0 && elapsed > MAX_BPS / DECAY_RATE_PER_SECOND) {
    decayBps = MAX_BPS;
} else {
    decayBps = DECAY_RATE_PER_SECOND * elapsed;
}
```

**Status:** Accepted for testnet (PHASE_3_PLACEHOLDER value = 1 makes this safe).

---

### L-01: CoolingRelay — No Duplicate Neighbour Validation

**Severity:** Low
**Contract:** CoolingRelay.sol
**Lines:** 122-126

**Description:** `joinGraph()` does not check for duplicate addresses in the neighbours array. An agent could register the same neighbour twice.

**Impact:** Duplicate propagation events during failure propagation. No security or financial impact.

**Recommendation:** Add duplicate check or document as intended.

**Status:** Deferred to Phase 3.

---

### L-02: ReputationLedger — Unbounded feedbackHistory Growth

**Severity:** Low
**Contract:** ReputationLedger.sol
**Line:** 96

**Description:** The `feedbackHistory` array is append-only and unbounded. Gas costs for iteration functions will increase over time.

**Impact:** Long-term gas cost increase for history queries. Does not affect critical operations.

**Status:** Deferred to Phase 3 (pagination).

---

### L-03: ReputationLedger — Permissionless Feedback Spam

**Severity:** Low
**Contract:** ReputationLedger.sol
**Line:** 143

**Description:** `postFeedback()` is permissionless. Any address can spam feedback. Reputation quality degrades with noise but system continues.

**Status:** Deferred to Phase 3 (rate limiting).

---

## Audit Checklist

| Area | Status | Notes |
|---|---|---|
| Access Control | ✅ | All privileged functions properly gated with AccessControl roles |
| Reentrancy | ✅ | ReentrancyGuard on all token-transferring functions |
| Integer Overflow/Underflow | ✅ | Solidity 0.8.24 built-in checks; one minor decay concern (M-01) |
| Token Transfer Safety | ✅ | All transfers use SafeERC20 |
| Allowlist Enforcement | ✅ | validateAction() called on all OrderBook write paths |
| Economic Logic | ✅ | No zero-amount exploits, self-dealing blocked, cartel prevention |
| MegaETH Compatibility | ✅ | All time logic uses block.timestamp, never block.number |
| Pausability | ✅ | OrderBook pausable; cancel remains callable when paused |
| Oracle Manipulation | ✅ | ComplianceDriftOracle ±10% delta cap enforced |
| P0 Mitigations | ✅ | CoolingRelay checks ReflexWindowManager, queues with 150ms delay |
| ERC-8004 Conformance | ✅ | AgentRegistry + ReputationLedger interfaces compatible |
| Cross-Contract Interactions | ✅ | Correct parameters, reverts handled |
| Storage Efficiency | ✅ | All contracts within 24KB EVM / 512KB MegaETH limits |

---

## Contract Size Report

| Contract | Runtime Size | Margin (24KB) |
|---|---|---|
| OrderBook | 10,458 B | 14,118 B |
| AgentRegistry | 7,717 B | 16,859 B |
| BuildingRegistry | 14,623 B | 9,953 B |
| CoolingRelay | 5,718 B | 18,858 B |
| GuardClauseMarketplace | 5,644 B | 18,932 B |
| ComplianceDriftOracle | 3,920 B | 20,656 B |
| ReputationLedger | ~4,500 B | ~20,076 B |
| LineageLedger | 3,256 B | 21,320 B |

---

## Test Results

```
482 tests passed, 0 failed, 0 skipped

Test Suites: 26
  - Unit tests: 19 suites
  - Security tests: 3 suites (AgentRegistrySecurity, OrderBookSecurity, ReputationLedgerSecurity)
  - New contract tests: 4 suites (CoolingRelay, ComplianceDriftOracle, GuardClauseMarketplace, LeaseSwap)
```

---

## PHASE_3_PLACEHOLDER Audit

All economic parameters verified as placeholders — none have been changed:

- `MIN_ORDER_AMOUNT = 1e15` (OrderBook)
- `DECAY_RATE_PER_SECOND = 1` (ReputationLedger)
- `WEIGHT_DEAL_RATE/DISINFO/ANOMALY/ACTIVITY = 2500` (ReputationLedger)
- `POISON_BURN_BPS = 500` (LineageLedger)
- `JOIN_LOCKUP_MS = 500` (CoolingRelay)
- `EXIT_DELAY_MS = 2000` (CoolingRelay)
- `PROPAGATION_CHANCE_BPS = 2000` (CoolingRelay)
- `REFLEX_QUEUE_DELAY_MS = 150` (CoolingRelay)
- `MIN_PUBLISH_INTERVAL_MS = 200` (ComplianceDriftOracle)
- `RECALIBRATION_BURN_BPS = 200` (ComplianceDriftOracle)
- `COMPUTE_PRICE_FLOOR = 500` (GuardClauseMarketplace)
- `MIN_LEASE_EPOCHS = 5` (OrderBook)
- `MIN_REP_PENALTY_BPS = 2000` (OrderBook)

---

## Conclusion

The MANDATE Phase 2 codebase is secure and ready for MegaETH testnet deployment. No critical or high-severity issues found. The four new contracts follow established security patterns and are well-tested. All Sprint 0 findings have been fixed and verified.

**Confidence Level:** High confidence for testnet deployment. 482/482 tests passing.

*MANDATE Phase 2 Security Audit | App Mog Labs | March 22, 2026*
