# E2E Test Infra: FlightResist AI 2.0 Enterprise Dynamic Itinerary & Policy Platform

## Test Philosophy
- Opaque-box, requirement-driven testing directly derived from `ORIGINAL_REQUEST.md`.
- No dependencies on internal module internals — tests evaluate through external API endpoints, CLI, and end-to-end user flows.
- Multi-tier coverage: Category-Partition (Tier 1), Boundary Value Analysis (Tier 2), Pairwise Combinatorial (Tier 3), Real-World Scenarios (Tier 4), and Adversarial Stress Testing (Tier 5).

## Feature Inventory
| # | Feature | Source | Tier 1 (Min) | Tier 2 (Min) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|--------|:------------:|:------------:|:-----------------:|:-----------------:|
| F1 | Multi-Leg Custom Itinerary Data Model | ORIGINAL_REQUEST §R1.1 | 5 | 5 | ✓ | ✓ |
| F2 | Curated Business Presets Catalog | ORIGINAL_REQUEST §R1.2 | 6 | 5 | ✓ | ✓ |
| F3 | PNR & JSON Bi-directional Import/Export | ORIGINAL_REQUEST §R1.3 | 5 | 5 | ✓ | ✓ |
| F4 | Session & Database Persistence | ORIGINAL_REQUEST §R1.4 | 5 | 5 | ✓ | ✓ |
| F5 | Global Airport & Airline Knowledge Base | ORIGINAL_REQUEST §R3.1 | 5 | 5 | ✓ | ✓ |
| F6 | Algorithmic Route & Candidate Generator | ORIGINAL_REQUEST §R3.1, R3.2 | 5 | 5 | ✓ | ✓ |
| F7 | Universal Demo & Live Atlas Search Support | ORIGINAL_REQUEST §R3.3 | 5 | 5 | ✓ | ✓ |
| F8 | Dynamic Weighted Trip Impact Graph | ORIGINAL_REQUEST §R4.1, R4.2 | 5 | 5 | ✓ | ✓ |
| F9 | Custom Disruption Sentinel Engine | ORIGINAL_REQUEST §R4.1 | 5 | 5 | ✓ | ✓ |
| F10 | Dynamic Decision Funnel & Optimizer | ORIGINAL_REQUEST §R2.3, R2.4 | 5 | 5 | ✓ | ✓ |
| F11 | Sub-50ms Live Recalculation API | ORIGINAL_REQUEST §R2.4 | 5 | 5 | ✓ | ✓ |
| F12 | Itinerary Studio Modal Integration | ORIGINAL_REQUEST §R1.1, R5.1 | 5 | 5 | ✓ | ✓ |
| F13 | Cockpit Active Itinerary & Multi-Leg Header | ORIGINAL_REQUEST §R5.1, R5.2 | 5 | 5 | ✓ | ✓ |
| F14 | Interactive Traveler Constraints Controls | ORIGINAL_REQUEST §R2.4, R5.2 | 5 | 5 | ✓ | ✓ |
| F15 | Decision Funnel Visual Feedback & Inspector | ORIGINAL_REQUEST §R5.3 | 5 | 5 | ✓ | ✓ |
| F16 | Multi-Format Reporting & Export Suite | ORIGINAL_REQUEST §R5.4 | 5 | 5 | ✓ | ✓ |
| F17 | End-to-End Verification & 1-Tap Execution | ORIGINAL_REQUEST §Acceptance | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner Location:** `tests/e2e-runner.mjs`
- **Invocation:** `node tests/e2e-runner.mjs` or `npm test`
- **Output Format:** Structured TAP / JSON output with zero external test framework dependencies (node native).
- **Directory Layout:**
  - `tests/tier1-features/` (Unit & API feature coverage across all 17 features)
  - `tests/tier2-boundaries/` (Boundary conditions, extreme inputs, negative tests)
  - `tests/tier3-pairwise/` (Combinatorial interactions: presets × disruptions × constraints)
  - `tests/tier4-scenarios/` (Complete real-world corporate travel & disruption recovery workflows)
  - `tests/tier5-adversarial/` (Adversarial stress harness, property-based invariants, fuzz testing)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| S1 | London to New York (LHR → JFK BA117) 4h ATC Delay with $200 Budget & 90m MCT | F1, F2, F6, F8, F9, F10, F11, F16, F17 | High |
| S2 | San Francisco to Tokyo (SFO → HND UA875) Cancellation with Critical $10M Deal Context | F1, F2, F6, F8, F9, F10, F17 | High |
| S3 | Sydney to Los Angeles (SYD → LAX QF11) 2-Leg Custom Itinerary PNR Import & Execution | F1, F3, F4, F6, F9, F10, F17 | High |
| S4 | Multi-User Concurrent Session Isolation with Different Global Presets | F2, F4, F9, F10, F11, F17 | High |
| S5 | Live Slider Constraint Drag Recalculation under 50ms Latency SLA | F10, F11, F14, F15 | Medium |
| S6 | Complete 1-Tap Recovery Execution with Database Ledger & Evidence Export | F4, F10, F16, F17 | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage):** $\ge 5 \times 17 = 85$ tests
- **Tier 2 (Boundary & Corner Cases):** $\ge 5 \times 17 = 85$ tests
- **Tier 3 (Cross-Feature Combinations):** $\ge 17$ tests
- **Tier 4 (Real-World Application Scenarios):** $\ge \max(5, 17/2) = 9$ tests
- **Tier 5 (Adversarial Hardening):** Property-based and fuzz test suites
- **Total Minimum Target:** $\ge 196$ test cases
