---
title: Sprint 5 ReputationLedger
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-22T17:19:00.778Z'
updatedAt: '2026-03-22T17:19:00.778Z'
---
## Raw Concept
**Task:**
Sprint 5 ReputationLedger Implementation

**Changes:**
- Implemented ERC-8004 feedback-based reputation system
- Switched agent IDs from uint256 to address-based (Breaking Change)
- Removed RECORDER_ROLE from feedback system
- Added burnReputation for BURNER_ROLE holders
- Added getTopAgents for percentile ranking

**Flow:**
postFeedback -> average calculation (0-10000 bps) -> getTopAgents (epoch carry-over)

**Timestamp:** 2026-03-22

## Narrative
### Structure
Reputation system centered around ReputationLedger.sol using address-based IDs.

### Dependencies
Integrates with LineageLedger for penalty enforcement via BURNER_ROLE.

### Highlights
100% line coverage with 44 passing tests. Introduces percentile-based ranking for epoch transitions.

### Rules
Rule 1: Feedback values must be between 0 and 10000 bps
Rule 2: burnReputation requires BURNER_ROLE permissions

### Examples
LineageLedger uses burnReputation to penalize poison nodes identified in the network.

## Facts
- **reputation_system**: ReputationLedger uses ERC-8004 feedback-based reputation system [project]
- **reputation_calculation**: Reputation average is calculated in basis points (0-10000 bps) [project]
- **agent_id_format**: Breaking change: Agent IDs are now address-based instead of uint256 [convention]
- **feedback_access**: RECORDER_ROLE was removed; feedback is now open to all agents [convention]
- **integration_permissions**: LineageLedger is granted BURNER_ROLE for poison node penalties [project]
