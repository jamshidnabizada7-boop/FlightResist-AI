# Project: FlightResist AI 2.0 — Enterprise Dynamic Itinerary & Policy Platform

## Architecture
FlightResist AI 2.0 is an enterprise-grade autonomous flight disruption recovery and policy management platform. The platform operates on a dual-track architecture consisting of:
1. **Deterministic Core Engine**: Zod-validated data schemas, session-isolated state management, multi-criteria optimization, dynamic topological route synthesis, and causal trip impact graph reasoning.
2. **Interactive Operations Cockpit**: Modern Next.js application with real-time SSE streaming, interactive Itinerary Studio, live constraint slider recalculation (<50ms), and multi-format evidence exports.

### Core Data Flow
```
[ User / PNR / Preset ] ──► [ Itinerary Studio Modal ] ──► [ Store / DB Session ]
                                                                   │
                                                                   ▼
[ Disruption Sentinel ] ◄── [ Trigger: Delay/Cancel/Closure ] ◄────┤
          │                                                        │
          ▼                                                        ▼
[ Trip Impact Graph ] ──────────────────────────────────► [ Global Route Generator ]
(Buffer compression, risk 0-100)                         (35-45 candidates, 4 buckets)
          │                                                        │
          └────────────────────────┬───────────────────────────────┘
                                   ▼
                       [ Decision Funnel Engine ]
                       (Deadline, Budget, MCT, Baggage)
                                   │
                                   ▼
                    [ Multi-Criteria Optimizer ]
                    (R = .35Arr + .25Conn + .20Price + .10Bag + .10Risk)
                                   │
                                   ▼
                    [ Recovery Cockpit / SSE Stream ]
                    (Live recalculation on constraint edit)
                                   │
                                   ▼
                    [ 1-Tap Execution & Ledger DB ]
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Multi-Leg Custom Itinerary Data Model | Rich `Itinerary`, `FlightLeg`, `PassengerProfile`, `MissionContext`, `TripConstraints` types | M1 | ORIGINAL_REQUEST §R1.1 |
| F2 | Curated Business Presets Catalog | 6 enterprise presets: `SIN-NRT`, `LHR-JFK`, `SFO-HND`, `SYD-LAX`, `DXB-CDG`, `FRA-SIN` | M1 | ORIGINAL_REQUEST §R1.2 |
| F3 | PNR & JSON Bi-directional Import/Export | Raw GDS/PNR text parser & formatter and Zod JSON validator | M1 | ORIGINAL_REQUEST §R1.3 |
| F4 | Session & Database Persistence | Prisma `TripSession.itinerary` & `SavedItinerary` model, in-memory `LiveSession` hydration | M1 | ORIGINAL_REQUEST §R1.4 |
| F5 | Global Airport & Airline Knowledge Base | 60+ global airports with Lat/Lon/TZ and 40+ airlines with alliances & OTP | M2 | ORIGINAL_REQUEST §R3.1 |
| F6 | Algorithmic Route & Candidate Generator | Haversine block times, hub detour routing, 35-45 candidates across 4 funnel buckets | M2 | ORIGINAL_REQUEST §R3.1, R3.2 |
| F7 | Universal Demo & Live Atlas Search Support | Seamless candidate generation for arbitrary city pairs and global timezone normalization | M2 | ORIGINAL_REQUEST §R3.3 |
| F8 | Dynamic Weighted Trip Impact Graph | Dynamic leg/commitment extraction, buffer compression, risk score 0-100 calculation | M3 | ORIGINAL_REQUEST §R4.1, R4.2 |
| F9 | Custom Disruption Sentinel Engine | Custom delays 15m–24h, cancellations, terminal closures, misconnects on any leg | M3 | ORIGINAL_REQUEST §R4.1 |
| F10 | Dynamic Decision Funnel & Optimizer | Decoupled constraint filtering, multi-criteria ranking, and why-engine causal facts | M3 | ORIGINAL_REQUEST §R2.3, R2.4 |
| F11 | Sub-50ms Live Recalculation API | `PATCH /api/trip/constraints` and `PATCH /api/trip/profile` for instantaneous re-filtering | M3 | ORIGINAL_REQUEST §R2.4 |
| F12 | Itinerary Studio Modal | Interactive modal with Presets, Custom Builder, PNR/JSON Import-Export, Saved Trips | M4 | ORIGINAL_REQUEST §R1.1, R5.1 |
| F13 | Cockpit Active Itinerary & Multi-Leg Header | Dynamic route summary, dynamic layover MCT badges, quick-edit modal triggers | M4 | ORIGINAL_REQUEST §R5.1, R5.2 |
| F14 | Interactive Traveler Constraints Controls | Sliders/inputs for Budget, MCT, Arrival Deadline, Baggage with live UI update | M4 | ORIGINAL_REQUEST §R2.4, R5.2 |
| F15 | Decision Funnel Visual Feedback & Inspector | Dynamic route labels, live animated bars, and pruned candidates breakdown drawer | M4 | ORIGINAL_REQUEST §R5.3 |
| F16 | Multi-Format Reporting & Export Suite | Dynamic PDF Print Summary, Evidence CSV with profile/funnel/ledger, and JSON Run Report | M4 | ORIGINAL_REQUEST §R5.4 |
| F17 | End-to-End Verification & Adversarial Hardening | 100% passing E2E test suite (Tiers 1-4), Tier 5 adversarial tests, Next.js build & TS check | M5 | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema, Core Types, Session Persistence & Presets | `schema.prisma`, `types.ts`, `store.ts`, `presets.ts`, `pnr-parser.ts`, API routes | none | DONE |
| M2 | Algorithmic Global Route & Candidate Generator | `airports-data.ts`, `airlines-data.ts`, `route-generator.ts`, `demo.ts`, `atlas-sandbox.ts`, `time-utils.ts` | M1 | DONE |
| M3 | Dynamic Impact Graph, Disruption Sentinel & Recalculation | `impact-graph.ts`, `constraints.ts`, `optimizer.ts`, `why-engine.ts`, `pipeline.ts`, `disrupt/trigger`, `trip/constraints` | M1, M2 | PLANNED |
| M4 | Itinerary Studio Modal & Cockpit Enhancements | `itinerary-studio-modal.tsx`, `trip-overview.tsx`, `decision-funnel.tsx`, `disruption-panel.tsx`, `header-bar.tsx`, `print-summary.tsx`, `cockpit.tsx`, hooks | M1, M2, M3 | PLANNED |
| M5 | E2E Test Suite Pass (Tiers 1-4) & Tier 5 Adversarial Hardening | Full E2E suite execution, adversarial edge tests, Next.js production build, TypeScript zero error verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1 ↔ M2 / M3 / M4 (`src/lib/flightresist/types.ts`)
- `PassengerProfile`: `{ name, ticketReference, loyaltyProgram, loyaltyTier, loyaltyNumber, nationality, passportNumber?, passportExpiryIso?, issuingCountry?, contactEmail, contactPhone, checkedBags }`
- `MissionContext`: `{ title, description, venue, location, dealValue?, dealCurrency?, importance, deadlineIso, timezone }`
- `TripConstraints`: `{ budgetUsd, mctMin, arrivalDeadlineIso, hardArrivalLimitIso, baggagePieces, baggageWeightKg }`
- `Itinerary`: `{ tripId, origin, destination, travelDateIso, legs: FlightLeg[], passenger: PassengerProfile, mission: MissionContext, tripPurpose: string, constraints: TripConstraints, commitments: TripCommitment[] }`

### M2 ↔ M3 / Pipeline (`src/lib/flightresist/route-generator.ts`)
- `generateRouteCandidates(options: RouteGeneratorOptions): FlightCandidate[]`
- Always returns 35–45 valid candidates sorted into standard categories (`over_budget`, `unsafe_connection`, `baggage_incompatible`, `finalists`).
- For `SIN → NRT` with base date `2026-08-27`, guarantees deterministic compatibility with canonical tests.

### M3 ↔ M4 / Cockpit (`src/lib/flightresist/impact-graph.ts` & API)
- `buildDisruptionImpactGraph(itinerary: Itinerary, disruption: DisruptionEvent): TripImpactGraph`
- `PATCH /api/trip/constraints`: `{ budgetUsd?, mctMin?, hardArrivalLimitIso?, baggagePieces?, baggageWeightKg? }` $\rightarrow$ `{ status: 'UPDATED', itinerary, analysis }`
- `POST /api/disrupt/trigger`: `{ flight_number, event, delay_minutes?, reason?, affected_hub? }` $\rightarrow$ `{ status: 'DISRUPTED', analysis }`

## Code Layout
- `prisma/schema.prisma` — Prisma schema definitions
- `src/lib/flightresist/types.ts` — TypeScript type contracts
- `src/lib/flightresist/store.ts` — Session storage and persistence bridge
- `src/lib/flightresist/presets.ts` — Curated enterprise business presets catalog
- `src/lib/flightresist/pnr-parser.ts` — PNR and JSON import/export parser & formatter
- `src/lib/flightresist/airports-data.ts` — Global airport geographical and timezone database
- `src/lib/flightresist/airlines-data.ts` — Global airline alliances, hubs, and OTP database
- `src/lib/flightresist/route-generator.ts` — Algorithmic topological route and candidate generator
- `src/lib/flightresist/impact-graph.ts` — Dynamic weighted trip impact graph and buffer compressor
- `src/lib/flightresist/constraints.ts` — Deterministic constraint evaluation engine
- `src/lib/flightresist/optimizer.ts` — Multi-criteria decision engine and ranking optimizer
- `src/lib/flightresist/why-engine.ts` — Explainable AI facts payload and causal reasoning
- `src/lib/flightresist/pipeline.ts` — End-to-end recovery pipeline coordinator
- `src/app/api/itinerary/` — Itinerary management API endpoints
- `src/app/api/trip/` — Trip session, constraints, and profile endpoints
- `src/app/api/disrupt/` — Disruption sentinel trigger endpoints
- `src/app/api/recovery/` — Recovery options, streaming, and execution endpoints
- `src/components/flightresist/itinerary-studio-modal.tsx` — Itinerary Studio modal
- `src/components/flightresist/trip-overview.tsx` — Active itinerary summary and quick-edit triggers
- `src/components/flightresist/decision-funnel.tsx` — Interactive decision funnel and candidate inspector
- `src/components/flightresist/disruption-panel.tsx` — Custom disruption sentinel control panel
- `src/components/flightresist/header-bar.tsx` — Cockpit header bar and export triggers
- `src/components/flightresist/print-summary.tsx` — Printable 1-page summary component
- `src/components/flightresist/cockpit.tsx` — Main cockpit orchestrator
- `tests/` — Automated test suite (Tiers 1-4 and Tier 5)
