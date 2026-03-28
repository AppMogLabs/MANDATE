# MANDATE Phase 2 — Completion & Security Audit

## Your Mission

You are completing **Phase 2 implementation** for the MANDATE smart contracts, then conducting a full security audit before testnet deployment.

**Read this for scope of work:** `/Users/user01/.openclaw/workspace/projects/active/MANDATE/PHASE2_COMPLETION_HANDOFF.md`

This document provides:

Your role
Resources available to you
Deliverables. If deliverables are inconsistent with those descibed in PHASE2_COMPLETION_HANDOFF.md then use those in PHASE2_COMPLETION_HANDOFF.md


You are working in a Foundry codebase targeting MegaETH (Chain ID 4326).

---

## ⚠️ NEW INSTRUCTIONS (Updated 2026-03-22)

**Phase 2 is NOT complete.** You have remaining work scoped in the handoff document.

**Read this file for scope of work:**  
📄 `/Users/user01/.openclaw/workspace/projects/active/MANDATE/PHASE2_COMPLETION_HANDOFF.md`

It contains:
- Four missing contracts from v0.3 spec
- One contract upgrade (MapRegistry)
- TWAP oracle stub wiring
- Open security fixes (FIXES.md)
- Deployment script bug
- Full security audit requirements
- Strategic document reading order (GDD v0.3, Phase 2 Architecture, Annex)

**Do not use the old Sprint 0 instructions below.** Follow the handoff document's scope.

---

## Project Context

**MANDATE** is an AI-native strategy game where human owners write strategic mandates and autonomous AI agents execute them entirely on-chain. The blockchain is the world state. These smart contracts are the foundation layer.

**Hackathon:** The Synthesis (https://synthesis.md)  (Completed, no longer required)
**Target Chain:** MegaETH testnet (Chain ID 4326)  
**Phase 2 Complete:** March 22, 2026

**Key Innovation:** Allowlist bitmap enforcement — agents can only execute actions explicitly permitted by their human owner. This is deterministic contract-level enforcement, not LLM prompt guidance.

---

## Contracts to Audit are detailed in PHASE2_COMPLETION_HANDOFF.md

---

## Phase 1: Document Review

Read all the files in /Users/user01/.openclaw/workspace/projects/active/MANDATE/Strategic_Docs in order to understand the architecture:

**Key questions while reading:**
- What are the trust boundaries?
- Where does user input enter the system?
- What are the economic parameters? (All should have `PHASE_3_PLACEHOLDER` comments)
- What roles exist? Who can mint, burn, pause?
- How does the allowlist bitmap work?

---

## Phase 2: Static Analysis

Run Foundry's built-in analysis:

```bash
forge build --sizes              # Check contract sizes (MegaETH has 512KB limit)
forge test --gas-report          # Identify gas-intensive operations
forge coverage                   # Verify test coverage (should be 80%+)
```

---

## Phase 3: Security Audit (Use Cyfrin Methodology)

### Critical Areas to Audit

#### 1. **Access Control**
- Are all privileged functions properly gated? (onlyRole, onlyOwner)
- Can DEFAULT_ADMIN_ROLE be renounced accidentally?
- Are role grants in Deploy.s.sol correct?
- Can an unauthorized address mint RATE or resource tokens?

#### 2. **Reentrancy**
- All functions that transfer tokens should have `nonReentrant`
- Check OrderBook settlement path — any reentrancy vectors?
- CEI pattern (Checks-Effects-Interactions) enforced everywhere?

#### 3. **Integer Overflow/Underflow**
- Solidity 0.8.24+ has built-in checks, but watch for unchecked blocks
- Order matching math — can it overflow?
- Reputation score calculations — can they underflow?

#### 4. **Token Transfer Safety**
- ALL token transfers use SafeERC20? (No raw `transfer()` or `transferFrom()`?)
- Are return values checked?
- Can tokens be locked in contracts?

#### 5. **AgentRegistry Allowlist Enforcement**
- Is `validateAction()` called on EVERY state-changing function across all contracts?
- Can an agent bypass allowlist checks?
- What happens if allowlist is empty (0x0)?
- Can an agent modify its own allowlist?

#### 6. **Economic Logic**
- OrderBook partial fills — do balances update correctly?
- Can orders be front-run?
- Are there dust/rounding issues?
- Can reputation scores be gamed?

#### 7. **ERC Compliance**
- RateToken: Does it fully implement ERC-20, ERC-20Permit?
- AgentRegistry: Does it fully implement ERC-721?
- Are ERC-8004 interfaces correctly implemented?

#### 8. **MegaETH-Specific Issues**
- No `block.number` for time logic? (10ms blocks make this unreliable)
- All time-based logic uses `block.timestamp`?
- Gas optimization for 10ms block times?

#### 9. **Pausability**
- Can OrderBook be paused? Who can unpause?
- What happens to in-flight orders when paused?
- Can pause be abused?

#### 10. **Denial of Service**
- Can OrderBook be DoS'd with dust orders?
- Can ReputationLedger be spammed?
- Are there unbounded loops?

---

## Phase 4: Test Execution

Run the full test suite and verify all tests pass:

```bash
forge test -vvv                  # Run all tests with verbose output
forge test --match-test testFuzz # Fuzz tests (if any)
forge snapshot                   # Gas snapshot
```

**Expected:**
- 80/80 tests passing
- No reverts in demo script
- No compiler warnings

---

## Phase 5: Adversarial Testing

Write additional tests for edge cases:

### Suggested Test Cases

1. **AgentRegistry:**
   - Agent with allowlist 0x0 attempts any action → reverts
   - Unregistered agent attempts action → reverts
   - Agent attempts to set its own allowlist → reverts
   - Owner sets allowlist for non-existent agent → reverts

2. **OrderBook:**
   - Place order with zero amount → reverts
   - Place order without RATE approval → reverts
   - Cancel someone else's order → reverts
   - Match order with insufficient balance → reverts
   - Partial fill with dust amounts → handles correctly

3. **ReputationLedger:**
   - Post feedback for self → reverts (if not allowed)
   - Post feedback from unregistered agent → reverts
   - Overflow reputation score → handled safely

4. **ResourceToken:**
   - Mint without MINTER_ROLE → reverts
   - Burn more than balance → reverts

5. **RateToken:**
   - Permit with invalid signature → reverts
   - Double-spend permit → reverts

---

## Phase 6: Gas Optimization Review

Identify expensive operations:

- Can storage be packed?
- Are there redundant SLOAD/SSTORE?
- Can view functions be made pure?
- Are events emitted efficiently?

**MegaETH context:** Gas is sub-cent, but optimization still matters for UX.

---

## Phase 7: Documentation Review

Check that:
- All external functions have NatSpec comments
- README accurately describes security model
- SUBMISSION_CHECKLIST includes security verification
- `PHASE_3_PLACEHOLDER` tags on all economic parameters

---

## Skills You Must Use

You have been equipped with these skills for this audit:

1. **eth-development** — Ethereum/Solidity security patterns
2. **megaeth-development** — MegaETH-specific constraints
3. **https://ethskills.com/testing/SKILL.md** — Comprehensive Solidity testing patterns
4. **https://ethskills.com/security/SKILL.md** — Smart contract security best practices (reentrancy, access control, integer issues, etc.)
5. **https://github.com/pashov/skills** — Pashov's security audit methodology and checklists (industry-standard audit patterns)

**Read these skills BEFORE starting the audit.** They contain Cyfrin-grade security patterns and professional audit frameworks.

---

## Deliverables

When you complete the audit, create:

### 1. **SECURITY_AUDIT_REPORT.md**

Structure:
```markdown
# MANDATE Sprint 0 Security Audit Report

**Auditor:** Claude Code (Cyfrin methodology)  
**Date:** [Today's date]  
**Contracts Audited:** 7 (RateToken, ResourceTokenFactory, ResourceToken, AgentRegistry, ReputationLedger, AuditLog, OrderBook)  
**Test Coverage:** [X]%  
**Critical Issues:** [Number]  
**High Issues:** [Number]  
**Medium Issues:** [Number]  
**Low Issues:** [Number]  
**Gas Optimizations:** [Number]  

## Executive Summary
[2-3 paragraphs on overall security posture]

## Findings

### Critical: [Title]
**Severity:** Critical  
**Contract:** [Name]  
**Description:** [What is the vulnerability?]  
**Impact:** [What can an attacker do?]  
**Proof of Concept:** [Code or steps to reproduce]  
**Recommendation:** [How to fix]  
**Status:** [Open/Fixed]

[Repeat for each finding]

## Test Results
[forge test output]

## Gas Report
[forge test --gas-report output]

## Conclusion
[Final assessment and recommendations]
```

### 2. **FIXES.md** (if issues found)

List of required fixes with priority:
```markdown
# Security Fixes Required

## Priority 1 (Critical - Must fix before testnet)
- [ ] [Issue description + file + line]

## Priority 2 (High - Should fix before testnet)
- [ ] [Issue description + file + line]

## Priority 3 (Medium - Fix before mainnet)
- [ ] [Issue description + file + line]

## Priority 4 (Low/Gas - Nice to have)
- [ ] [Issue description + file + line]
```

### 3. **Updated Tests** (if gaps found)

Write new test files in `test/security/` for any edge cases not covered.

---

## Success Criteria

The audit is complete when:

1. ✅ All contracts reviewed for the 10 critical areas above
2. ✅ All existing tests pass
3. ✅ Test coverage verified (80%+ branch coverage on critical paths)
4. ✅ SECURITY_AUDIT_REPORT.md written
5. ✅ Any critical/high issues flagged with fixes proposed
6. ✅ Gas report generated
7. ✅ Operator (HellB) has confidence to deploy to testnet

**Timeline:** Complete audit before testnet deployment (today/tomorrow).

---

## Reference Material

- **Cyfrin Security Standards:** https://github.com/Cyfrin
- **Solidity Security Best Practices:** https://ethskills.com/security/SKILL.md
- **Foundry Testing Patterns:** https://ethskills.com/testing/SKILL.md
- **ERC-8004 Spec:** (referenced in Phase2 doc)
- **MegaETH Docs:** (referenced in README)

---

## Notes on MANDATE's Security Model

**Core Trust Assumption:** The AgentRegistry allowlist bitmap is the security perimeter. If `validateAction()` can be bypassed, the entire system fails.

**Economic Security:** All economic parameters are placeholders (`PHASE_3_PLACEHOLDER`). Do not audit for economic exploits (e.g., "initial supply too low") — focus on logic and access control.

**Scope Limitation:** This is Sprint 0 (7 contracts). Phase 2 has 26 contracts total. Do not audit for missing functionality (e.g., "no building registry") — that's Sprint 1.

---

## Final Instruction

You are the last line of defense before testnet deployment. Be thorough. If you find a critical issue, it's better to delay deployment than ship a vulnerable contract.

**Start with the skills** (ethskills.com/testing and ethskills.com/security), then proceed with the audit.

Go.
