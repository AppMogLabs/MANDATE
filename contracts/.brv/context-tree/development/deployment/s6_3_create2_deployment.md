---
title: S6.3 CREATE2 Deployment
tags: []
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-03-22T17:45:39.001Z'
updatedAt: '2026-03-22T17:45:39.001Z'
---
## Raw Concept
**Task:**
MANDATE S6.3 CREATE2 Deployment Scripts

**Changes:**
- Implemented Create2Factory with deterministic salt generation
- Created 4-phase deployment script (DeployCreate2.s.sol)
- Added testnet deployment variant and address template
- Documented comprehensive runbook and completion report

**Files:**
- script/DeployCreate2.s.sol
- script/DeployTestnet.s.sol
- docs/deployment/DEPLOYMENT_GUIDE.md
- docs/deployment/S6.3_COMPLETION_REPORT.md

**Flow:**
Phase 1-2 (Core/Tokens) -> Phase 3 (BuildingRegistry) -> Phase 4 (Finalization)

**Timestamp:** 2026-03-22

## Narrative
### Structure
Deployment is organized into 4 phases using CREATE2 for deterministic addressing. Salt is derived from project name, contract name, and version.

### Dependencies
Phase 3 is strictly dependent on the deployment of 8 specific resource tokens. Currently only COMPUTE and CHIPS are deployed.

### Highlights
Deterministic addresses verified. Production-ready for Phases 1-2. Gas documentation pending for final phases.

### Rules
Salt generation rule: keccak256(concat("MANDATE", name, version))

## Facts
- **deployment_metrics**: Delivered 1,233 lines across 6 deployment files [project]
- **salt_generation_logic**: Create2Factory uses keccak256('MANDATE' + name + version) for salt generation [project]
- **deployment_status**: Phases 1-2 verified in dry-run for core registries and tokens [project]
- **deployment_blocker**: Phase 3+ blocked on BuildingRegistry requiring 8 resource tokens [project]
- **missing_dependencies**: Missing resource tokens: ENERGY, COOLING, TALENT, DATA, CLEARANCE [project]
- **gas_estimates**: Gas estimates for Phases 1-2 is ~5.4M gas [project]
