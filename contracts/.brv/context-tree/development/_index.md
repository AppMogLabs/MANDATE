---
children_hash: b577b82c7b7e5806545359c043303a7bdf5294cb91ea6bdb19596b5398b3abfe
compression_ratio: 0.6439393939393939
condensation_order: 2
covers: [context.md, deployment/_index.md, sprints/_index.md]
covers_token_total: 1188
summary_level: d2
token_count: 765
type: summary
---
# Domain: Development (Level d2 Summary)

This domain tracks the technical execution, architectural patterns, and implementation milestones for the MANDATE project, specifically focusing on deterministic deployment strategies and core protocol development.

## 1. Deployment Architecture & Strategy
The project utilizes a multi-phase deterministic deployment framework to ensure address consistency across various blockchain environments.

*   **Methodology:** Leverages **CREATE2** opcode with salt logic derived from `keccak256(concat("MANDATE", name, version))`.
*   **Tooling:** Managed via `Create2Factory` and executed through `script/DeployCreate2.s.sol` (4-phase logic) and `script/DeployTestnet.s.sol`.
*   **Execution Status:** Phases 1-2 (Core Registries and Resource Tokens like **COMPUTE** and **CHIPS**) are verified. Phase 3 is currently blocked due to missing resource tokens (**ENERGY**, **COOLING**, **TALENT**, **DATA**, **CLEARANCE**).
*   **Reference:** [deployment/_index.md](deployment/_index.md), [s6_3_create2_deployment.md](deployment/s6_3_create2_deployment.md)

## 2. Core Protocol Implementations
Development is organized into structured sprints focusing on EIP-compliant security and reputation systems.

*   **EventOracle (Sprint 3):** An EIP-712 compliant signing oracle deployed on **MegaETH (Chain ID 4326)**. Built on **OpenZeppelin 5.x**, it features signature replay prevention and cumulative resource modifier aggregation. 
    *   *Security:* Requires **2-of-3 multi-sig** for high-severity events (severity ≥ 7).
*   **ReputationLedger (Sprint 5):** An **ERC-8004** feedback system using address-based identifiers and basis point calculations (0-10000 bps). 
    *   *Integration:* Direct coupling with `LineageLedger` for automated penalty enforcement (burning reputation).
*   **Reference:** [sprints/_index.md](sprints/_index.md), [sprint_3_eventoracle.md](sprints/sprint_3_eventoracle.md), [sprint_5_reputationledger.md](sprints/sprint_5_reputationledger.md)

## 3. Security & Governance Patterns
Standardized security practices are applied across all development modules.

*   **Access Control:** Strict adherence to **OpenZeppelin 5.x** `AccessControl`. Key roles include `SENIOR_PUBLISHER_ROLE` (multi-sig) and `BURNER_ROLE` (penalty execution).
*   **Validation Standards:** High testing benchmarks are maintained, typically requiring 100% line/statement coverage for core protocol contracts.
*   **Logic Patterns:** Consistent use of the Checks-Effects-Interactions (CEI) pattern to prevent reentrancy and ensure state integrity.

## 4. Key Relationships & Dependencies
*   **Infrastructure:** All components are optimized for the **MegaETH Network**.
*   **Interoperability:** The `BuildingRegistry` (Phase 3 deployment) serves as a central dependency for resource management, currently awaiting the completion of the full resource token suite.
*   **Documentation:** Operational procedures are maintained in `docs/deployment/DEPLOYMENT_GUIDE.md` and audit trails in `docs/deployment/S6.3_COMPLETION_REPORT.md`.