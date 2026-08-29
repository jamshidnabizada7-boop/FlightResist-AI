/**
 * Milestone 1 Empirical Challenger & Adversarial Stress Suite
 *
 * Tests:
 *  1. Traveler Names Adversarial Stress (multi-part, hyphens, prefixes, apostrophes, accents/diacritics, titles, single-word names)
 *  2. Flight Topologies & Leg Count Spectrum (1-leg direct, 2-leg 1-stop, 3-leg 2-stop, 4-leg multi-stop, overnight, cross-dateline)
 *  3. Minimal & Missing Optional Remarks Fallbacks (no passenger remark, no RM lines, partial remarks)
 *  4. Boundary & Edge Constraints ($0 budget, 0PC/0KG baggage, 0m MCT, negative invalid values)
 *  5. Fuzzing & Malformed / Injection Inputs (SQL injection in remarks, corrupted segment tokens, massive payload)
 *  6. Multi-Tenant Session Store Concurrency & Isolation Invariants
 *  7. Schema Validation Contract Invariants
 */

import {
  ItinerarySchema,
  FlightLegSchema,
  PassengerProfileSchema,
  MissionContextSchema,
  TripConstraintsSchema,
  TripCommitmentSchema,
  parsePnr,
  formatPnr,
} from '../src/lib/flightresist/pnr-parser';
import {
  PRESETS,
  PRESET_SIN_NRT,
  PRESET_LHR_JFK,
  PRESET_SFO_HND,
  PRESET_SYD_LAX,
  PRESET_DXB_CDG,
  PRESET_FRA_SIN,
  cloneItinerary,
} from '../src/lib/flightresist/presets';
import {
  getSession,
  setSessionItinerary,
  updateSessionConstraints,
  updateSessionPassenger,
  updateSessionMission,
  resetSession,
  buildSnapshot,
  liveSessionCount,
} from '../src/lib/flightresist/store';
import type { Itinerary, FlightLeg, ProviderInfo } from '../src/lib/flightresist/types';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordPass(suite: string, name: string, details?: string) {
  results.push({ suite, name, passed: true, details });
  console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
}

function recordFail(suite: string, name: string, error: string, details?: string) {
  results.push({ suite, name, passed: false, error, details });
  console.error(`  ❌ [FAIL] ${name}: ${error}${details ? ` [${details}]` : ''}`);
}

export async function runAdversarialStressSuite() {
  console.log('\n======================================================================');
  console.log('🔥 RUNNING EMPIRICAL CHALLENGER STRESS SUITE (MILESTONE 1)');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: TRAVELER NAMES ADVERSARIAL STRESS
  // =========================================================================
  console.log('👉 [SUITE 1] Traveler Names Adversarial Stress & PNR Round-Trip');

  const testNames = [
    { name: 'Cher', description: 'Single-word mononym' },
    { name: 'Madonna', description: 'Single-word pop mononym' },
    { name: 'Jean-Luc Picard', description: 'Hyphenated first name' },
    { name: 'Victoria Sterling-Cross', description: 'Hyphenated surname' },
    { name: 'Tariq Al-Mansoor', description: 'Hyphenated Arabic prefix surname' },
    { name: 'Sir Arthur Conan Doyle', description: 'Title + Compound middle/surname' },
    { name: 'Ludwig van Beethoven', description: 'Dutch/German nobiliary particle van' },
    { name: 'Maria de la Cruz', description: 'Multi-word Spanish surname with particles' },
    { name: 'Liam O\'Connor', description: 'Irish surname with apostrophe' },
    { name: 'Shaquille O\'Neal', description: 'Apostrophe in surname' },
    { name: 'Dr. Henrik Schmidt', description: 'Doctor title prefix' },
    { name: 'Prof. Charles Francis Xavier', description: 'Professor title + 4 words' },
    { name: 'Henrik Müller', description: 'German umlaut ü (International Unicode)' },
    { name: 'François Côté', description: 'French cedilla and acute accents' },
    { name: 'José Peña', description: 'Spanish acute and eñe' },
    { name: 'Renée Björk', description: 'Nordic and French diacritics' },
  ];

  for (const tc of testNames) {
    try {
      const base = cloneItinerary(PRESET_LHR_JFK);
      base.passenger.name = tc.name;

      const formatted = formatPnr(base);
      const parsed = parsePnr(formatted);

      if (!parsed.success || !parsed.itinerary) {
        recordFail(
          'Traveler Names',
          `Name: "${tc.name}" (${tc.description})`,
          `parsePnr failed: ${parsed.errors?.join(', ')}`,
          `Formatted PNR: ${formatted.split('\n')[2]}`
        );
        continue;
      }

      const returnedName = parsed.itinerary.passenger.name;

      // Check if it fell back to default because regex dropped non-ASCII or failed matching
      if (returnedName === 'Executive Traveler' && tc.name !== 'Executive Traveler') {
        recordFail(
          'Traveler Names',
          `Name: "${tc.name}" (${tc.description})`,
          `SILENT DATA LOSS: Name containing non-ASCII / Unicode characters was dropped and defaulted to "Executive Traveler"`,
          `Input: "${tc.name}" -> Formatted: "${formatted.split('\n')[2]}" -> Parsed: "${returnedName}"`
        );
        continue;
      }

      // Check mononym synthesis
      if (tc.name === 'Cher' || tc.name === 'Madonna') {
        if (returnedName.includes(tc.name)) {
          recordPass(
            'Traveler Names',
            `Name: "${tc.name}" (${tc.description})`,
            `Mononym parsed as: "${returnedName}"`
          );
        } else {
          recordFail('Traveler Names', `Name: "${tc.name}"`, `Mononym lost: ${returnedName}`);
        }
        continue;
      }

      // Normalizing comparison for case / titles
      const normalizedOriginal = tc.name.toLowerCase().replace(/^(dr\.|prof\.|sir)\s+/i, '');
      const normalizedReturned = returnedName.toLowerCase().replace(/^(dr\.|prof\.|sir)\s+/i, '');

      // Check if essential tokens of the name are preserved
      const originalTokens = normalizedOriginal.split(/[\s'-]+/).filter(Boolean);
      const returnedTokens = normalizedReturned.split(/[\s'-]+/).filter(Boolean);

      const allTokensPresent = originalTokens.every((tok) =>
        normalizedReturned.includes(tok) || returnedTokens.some((r) => r.includes(tok) || tok.includes(r))
      );

      // Verify schema validity of resulting itinerary
      const schemaCheck = ItinerarySchema.safeParse(parsed.itinerary);

      if (!schemaCheck.success) {
        recordFail(
          'Traveler Names',
          `Name: "${tc.name}" Schema Compliance`,
          `Zod error: ${schemaCheck.error?.message}`
        );
      } else if (allTokensPresent) {
        recordPass(
          'Traveler Names',
          `Name: "${tc.name}" (${tc.description})`,
          `Round-trip output: "${returnedName}"`
        );
      } else {
        recordFail(
          'Traveler Names',
          `Name: "${tc.name}" (${tc.description})`,
          `Name corrupted: input "${tc.name}" -> output "${returnedName}"`
        );
      }
    } catch (err) {
      recordFail(
        'Traveler Names',
        `Name: "${tc.name}" (${tc.description})`,
        `Exception thrown: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // =========================================================================
  // SUITE 2: FLIGHT TOPOLOGIES & LEG COUNT SPECTRUM
  // =========================================================================
  console.log('\n👉 [SUITE 2] Flight Topologies & Leg Count Spectrum');

  // Test 2.1: Single-Leg Direct Flight (LHR -> JFK)
  try {
    const singleLeg = cloneItinerary(PRESET_LHR_JFK);
    const formatted = formatPnr(singleLeg);
    const parsed = parsePnr(formatted);
    if (parsed.success && parsed.itinerary && parsed.itinerary.legs.length === 1) {
      recordPass('Flight Topologies', '1-Leg Direct Flight (LHR -> JFK)', `Origin: ${parsed.itinerary.origin}, Dest: ${parsed.itinerary.destination}`);
    } else {
      recordFail('Flight Topologies', '1-Leg Direct Flight', `Parsed legs count: ${parsed.itinerary?.legs.length}`);
    }
  } catch (err) {
    recordFail('Flight Topologies', '1-Leg Direct Flight', String(err));
  }

  // Test 2.2: 2-Leg 1-Stop Transit (SIN -> HKG -> NRT)
  try {
    const twoLeg = cloneItinerary(PRESET_SIN_NRT);
    const formatted = formatPnr(twoLeg);
    const parsed = parsePnr(formatted);
    if (parsed.success && parsed.itinerary && parsed.itinerary.legs.length === 2) {
      const leg1 = parsed.itinerary.legs[0];
      const leg2 = parsed.itinerary.legs[1];
      if (leg1.from === 'SIN' && leg1.to === 'HKG' && leg2.from === 'HKG' && leg2.to === 'NRT' && parsed.itinerary.origin === 'SIN' && parsed.itinerary.destination === 'NRT') {
        recordPass('Flight Topologies', '2-Leg 1-Stop Transit (SIN -> HKG -> NRT)', 'Origin/Dest and intermediate hubs preserved');
      } else {
        recordFail('Flight Topologies', '2-Leg 1-Stop Transit', `Leg routing mismatch`);
      }
    } else {
      recordFail('Flight Topologies', '2-Leg 1-Stop Transit', `Success: ${parsed.success}, Legs: ${parsed.itinerary?.legs.length}`);
    }
  } catch (err) {
    recordFail('Flight Topologies', '2-Leg 1-Stop Transit', String(err));
  }

  // Test 2.3: 3-Leg 2-Stop Intercontinental Journey (JFK -> LHR -> DXB -> SIN)
  try {
    const threeLeg: Itinerary = {
      tripId: 'TRIP-JFK-SIN-3LEG',
      origin: 'JFK',
      destination: 'SIN',
      travelDateIso: '2026-08-27T18:00:00-04:00',
      legs: [
        {
          flightNumber: 'BA178',
          airlineCode: 'BA',
          airlineName: 'British Airways',
          from: 'JFK',
          to: 'LHR',
          depIso: '2026-08-27T18:00:00-04:00',
          arrIso: '2026-08-28T06:00:00+01:00',
          durationMin: 420,
          aircraft: 'Boeing 777-300ER',
          cabin: 'Club World / Business',
        },
        {
          flightNumber: 'EK002',
          airlineCode: 'EK',
          airlineName: 'Emirates',
          from: 'LHR',
          to: 'DXB',
          depIso: '2026-08-28T09:15:00+01:00',
          arrIso: '2026-08-28T19:30:00+04:00',
          durationMin: 435,
          aircraft: 'Airbus A380-800',
          cabin: 'Business Class',
        },
        {
          flightNumber: 'SQ495',
          airlineCode: 'SQ',
          airlineName: 'Singapore Airlines',
          from: 'DXB',
          to: 'SIN',
          depIso: '2026-08-28T21:00:00+04:00',
          arrIso: '2026-08-29T08:30:00+08:00',
          durationMin: 450,
          aircraft: 'Airbus A350-900',
          cabin: 'Business Class',
        },
      ],
      passenger: cloneItinerary(PRESET_LHR_JFK).passenger,
      mission: {
        title: 'Global Multi-Hub Global Supply Summit',
        description: 'Multi-continent leadership briefing',
        venue: 'Marina Bay Sands Convention Centre',
        location: 'Singapore',
        dealValue: 90000000,
        dealCurrency: 'USD',
        importance: 'CRITICAL',
        deadlineIso: '2026-08-29T14:00:00+08:00',
        timezone: 'Asia/Singapore',
      },
      tripPurpose: 'Global Supply Summit',
      constraints: {
        budgetUsd: 850,
        mctMin: 75,
        arrivalDeadlineIso: '2026-08-29T11:00:00+08:00',
        hardArrivalLimitIso: '2026-08-29T18:00:00+08:00',
        baggagePieces: 2,
        baggageWeightKg: 32,
      },
      commitments: [],
    };

    const formatted = formatPnr(threeLeg);
    const parsed = parsePnr(formatted);

    if (
      parsed.success &&
      parsed.itinerary &&
      parsed.itinerary.legs.length === 3 &&
      parsed.itinerary.origin === 'JFK' &&
      parsed.itinerary.destination === 'SIN'
    ) {
      // Check flight numbers (handling leading zero normalization EK002 -> EK2 vs EK002)
      const leg2Num = parsed.itinerary.legs[1].flightNumber;
      if (leg2Num === 'EK002' || leg2Num === 'EK2') {
        recordPass('Flight Topologies', '3-Leg 2-Stop Journey (JFK -> LHR -> DXB -> SIN)', `All 3 legs parsed, flight numbers: BA178, ${leg2Num}, SQ495`);
      } else {
        recordFail('Flight Topologies', '3-Leg 2-Stop Journey', `Flight number mismatch: ${leg2Num}`);
      }
    } else {
      recordFail('Flight Topologies', '3-Leg 2-Stop Journey', `Parsed legs count: ${parsed.itinerary?.legs.length}, errors: ${parsed.errors?.join('; ')}`);
    }
  } catch (err) {
    recordFail('Flight Topologies', '3-Leg 2-Stop Journey', String(err));
  }

  // Test 2.4: 4-Leg Multi-Stop Complex Itinerary (SFO -> ORD -> FRA -> IST -> SIN)
  try {
    const fourLegLegs: FlightLeg[] = [
      {
        flightNumber: 'UA120',
        airlineCode: 'UA',
        airlineName: 'United Airlines',
        from: 'SFO',
        to: 'ORD',
        depIso: '2026-08-27T06:00:00-07:00',
        arrIso: '2026-08-27T12:15:00-05:00',
        durationMin: 255,
        aircraft: 'Boeing 737-900',
        cabin: 'First Class',
      },
      {
        flightNumber: 'LH431',
        airlineCode: 'LH',
        airlineName: 'Lufthansa',
        from: 'ORD',
        to: 'FRA',
        depIso: '2026-08-27T16:00:00-05:00',
        arrIso: '2026-08-28T07:30:00+02:00',
        durationMin: 510,
        aircraft: 'Boeing 747-8',
        cabin: 'Business Class',
      },
      {
        flightNumber: 'TK1592',
        airlineCode: 'TK',
        airlineName: 'Turkish Airlines',
        from: 'FRA',
        to: 'IST',
        depIso: '2026-08-28T10:00:00+02:00',
        arrIso: '2026-08-28T14:10:00+03:00',
        durationMin: 190,
        aircraft: 'Airbus A321neo',
        cabin: 'Business Class',
      },
      {
        flightNumber: 'TK054',
        airlineCode: 'TK',
        airlineName: 'Turkish Airlines',
        from: 'IST',
        to: 'SIN',
        depIso: '2026-08-28T17:00:00+03:00',
        arrIso: '2026-08-29T08:45:00+08:00',
        durationMin: 645,
        aircraft: 'Boeing 787-9',
        cabin: 'Business Class',
      },
    ];

    const fourLeg: Itinerary = {
      tripId: 'TRIP-SFO-SIN-4LEG',
      origin: 'SFO',
      destination: 'SIN',
      travelDateIso: '2026-08-27T06:00:00-07:00',
      legs: fourLegLegs,
      passenger: cloneItinerary(PRESET_SFO_HND).passenger,
      mission: cloneItinerary(PRESET_SFO_HND).mission,
      tripPurpose: '4-Stop Global Exec Tour',
      constraints: cloneItinerary(PRESET_SFO_HND).constraints,
      commitments: [],
    };

    const formatted = formatPnr(fourLeg);
    const parsed = parsePnr(formatted);

    if (
      parsed.success &&
      parsed.itinerary &&
      parsed.itinerary.legs.length === 4 &&
      parsed.itinerary.origin === 'SFO' &&
      parsed.itinerary.destination === 'SIN'
    ) {
      recordPass('Flight Topologies', '4-Leg Complex Route (SFO -> ORD -> FRA -> IST -> SIN)', '4/4 legs preserved with correct terminal airports');
    } else {
      recordFail('Flight Topologies', '4-Leg Complex Route', `Success: ${parsed.success}, Legs: ${parsed.itinerary?.legs.length}`);
    }
  } catch (err) {
    recordFail('Flight Topologies', '4-Leg Complex Route', String(err));
  }

  // =========================================================================
  // SUITE 3: MINIMAL & MISSING OPTIONAL REMARKS FALLBACKS
  // =========================================================================
  console.log('\n👉 [SUITE 3] Minimal & Missing Optional Remarks Fallbacks');

  // Test 3.1: Minimal PNR with ONLY raw flight leg line (no passenger, no remarks)
  try {
    const rawMinimalPnr = `
*** FLIGHTRESIST AI GDS PNR: RAW001 ***
RP/SIN1A0980/1A   27AUG26   RAW001
 1. SQ 856 Y 27AUG SINHKG HK1 0800 1205 /E
*** END OF PNR ***
`;
    const parsed = parsePnr(rawMinimalPnr);
    if (!parsed.success || !parsed.itinerary) {
      recordFail('Missing Remarks', 'Minimal PNR with only 1 leg', `Failed: ${parsed.errors?.join('; ')}`);
    } else {
      const it = parsed.itinerary;
      const schemaCheck = ItinerarySchema.safeParse(it);
      if (schemaCheck.success && it.origin === 'SIN' && it.destination === 'HKG' && it.passenger.name === 'Executive Traveler') {
        recordPass('Missing Remarks', 'Minimal PNR with only 1 leg', 'Fell back to valid Executive Traveler, derived origin/dest, and 100% passed Zod schema');
      } else {
        recordFail('Missing Remarks', 'Minimal PNR with only 1 leg', `Schema valid: ${schemaCheck.success}, Passenger: ${it.passenger.name}`);
      }
    }
  } catch (err) {
    recordFail('Missing Remarks', 'Minimal PNR with only 1 leg', String(err));
  }

  // Test 3.2: PNR with Passenger + Flight Legs but NO remarks (No RM TKT, RM BAG, RM BUDGET, RM MISSION)
  try {
    const noRemarksPnr = `
*** FLIGHTRESIST AI GDS PNR: NOREM1 ***
 1.1ALEXANDER/SARAH MS
 1. BA 117 J 27AUG LHRJFK HK1 0840 1130 /E
 2. AA 299 Y 27AUG JFKSFO HK1 1400 1730 /E
*** END OF PNR ***
`;
    const parsed = parsePnr(noRemarksPnr);
    if (!parsed.success || !parsed.itinerary) {
      recordFail('Missing Remarks', 'PNR with no RM remarks', `Failed: ${parsed.errors?.join('; ')}`);
    } else {
      const it = parsed.itinerary;
      const schemaCheck = ItinerarySchema.safeParse(it);
      if (
        schemaCheck.success &&
        it.origin === 'LHR' &&
        it.destination === 'SFO' &&
        it.passenger.name.toLowerCase().includes('sarah') &&
        it.constraints.budgetUsd > 0 &&
        it.constraints.mctMin > 0
      ) {
        recordPass('Missing Remarks', 'PNR with no RM remarks', `Passenger: "${it.passenger.name}", Budget: $${it.constraints.budgetUsd}, MCT: ${it.constraints.mctMin}m (all defaulted cleanly)`);
      } else {
        recordFail('Missing Remarks', 'PNR with no RM remarks', `Zod schema check failed: ${schemaCheck.error?.message}`);
      }
    }
  } catch (err) {
    recordFail('Missing Remarks', 'PNR with no RM remarks', String(err));
  }

  // Test 3.3: PNR with Partial Mission Remark (Missing DEAL and TZ)
  try {
    const partialMissionPnr = `
*** FLIGHTRESIST AI GDS PNR: PMISS1 ***
 1.1GORDON/JAMES MR
 1. EK 73 J 27AUG DXBCDG HK1 0820 1330 /E
RM MISSION TITLE: Emergency Supply Contract | VENUE: CDG Airport Lounge | IMP: CRITICAL | DEADLINE: 2026-08-27T18:00:00Z
*** END OF PNR ***
`;
    const parsed = parsePnr(partialMissionPnr);
    if (parsed.success && parsed.itinerary) {
      const it = parsed.itinerary;
      if (it.mission.title === 'Emergency Supply Contract' && it.mission.importance === 'CRITICAL' && it.mission.dealValue === undefined) {
        recordPass('Missing Remarks', 'Partial Mission Remark', 'Parsed available fields and safely left optional dealValue undefined');
      } else {
        recordFail('Missing Remarks', 'Partial Mission Remark', `Unexpected mission values: ${JSON.stringify(it.mission)}`);
      }
    } else {
      recordFail('Missing Remarks', 'Partial Mission Remark', `Failed: ${parsed.errors?.join('; ')}`);
    }
  } catch (err) {
    recordFail('Missing Remarks', 'Partial Mission Remark', String(err));
  }

  // =========================================================================
  // SUITE 4: BOUNDARY & EDGE CONSTRAINTS
  // =========================================================================
  console.log('\n👉 [SUITE 4] Boundary & Edge Constraints');

  // Test 4.1: $0 Budget Ceiling (Free ticket / zero policy spend)
  try {
    const zeroBudget = cloneItinerary(PRESET_SIN_NRT);
    zeroBudget.constraints.budgetUsd = 0;

    const schemaCheck = ItinerarySchema.safeParse(zeroBudget);
    if (!schemaCheck.success) {
      recordFail('Edge Constraints', '$0 Budget Ceiling Schema Validation', `Failed: ${schemaCheck.error?.message}`);
    } else {
      const formatted = formatPnr(zeroBudget);
      const parsed = parsePnr(formatted);
      if (parsed.success && parsed.itinerary && parsed.itinerary.constraints.budgetUsd === 0) {
        recordPass('Edge Constraints', '$0 Budget Ceiling Round-Trip', 'Preserved budgetUsd: 0 across format and parse');
      } else {
        recordFail('Edge Constraints', '$0 Budget Ceiling Round-Trip', `Parsed budget: ${parsed.itinerary?.constraints.budgetUsd}`);
      }
    }
  } catch (err) {
    recordFail('Edge Constraints', '$0 Budget Ceiling', String(err));
  }

  // Test 4.2: 0 Bags Allowance (Hand luggage only: 0PC, 0KG)
  try {
    const zeroBags = cloneItinerary(PRESET_LHR_JFK);
    zeroBags.constraints.baggagePieces = 0;
    zeroBags.constraints.baggageWeightKg = 0;
    zeroBags.passenger.checkedBags = 0;

    const schemaCheck = ItinerarySchema.safeParse(zeroBags);
    if (!schemaCheck.success) {
      recordFail('Edge Constraints', '0 Bags Allowance Schema Validation', `Failed: ${schemaCheck.error?.message}`);
    } else {
      const formatted = formatPnr(zeroBags);
      const parsed = parsePnr(formatted);
      if (
        parsed.success &&
        parsed.itinerary &&
        parsed.itinerary.constraints.baggagePieces === 0 &&
        parsed.itinerary.constraints.baggageWeightKg === 0 &&
        parsed.itinerary.passenger.checkedBags === 0
      ) {
        recordPass('Edge Constraints', '0 Bags Allowance (0PC 0KG) Round-Trip', 'Preserved 0PC and 0KG allowance');
      } else {
        recordFail(
          'Edge Constraints',
          '0 Bags Allowance (0PC 0KG) Round-Trip',
          `FALSY COALESCING BUG: formatPnr used '|| 1' / '|| 23' which mutated 0PC 0KG into 1PC 23KG`,
          `Input: 0PC 0KG -> Output: ${parsed.itinerary?.constraints.baggagePieces}PC ${parsed.itinerary?.constraints.baggageWeightKg}KG`
        );
      }
    }
  } catch (err) {
    recordFail('Edge Constraints', '0 Bags Allowance', String(err));
  }

  // Test 4.3: 0 Minute MCT Floor (mctMin: 0)
  try {
    const zeroMct = cloneItinerary(PRESET_SIN_NRT);
    zeroMct.constraints.mctMin = 0;

    const schemaCheck = ItinerarySchema.safeParse(zeroMct);
    if (schemaCheck.success) {
      const formatted = formatPnr(zeroMct);
      const parsed = parsePnr(formatted);
      if (parsed.success && parsed.itinerary && parsed.itinerary.constraints.mctMin === 0) {
        recordPass('Edge Constraints', '0 Minute MCT Floor Round-Trip', 'Preserved mctMin: 0');
      } else {
        recordFail('Edge Constraints', '0 Minute MCT Floor Round-Trip', `Parsed MCT: ${parsed.itinerary?.constraints.mctMin}`);
      }
    } else {
      recordFail('Edge Constraints', '0 Minute MCT Floor', `Schema rejected 0 MCT: ${schemaCheck.error?.message}`);
    }
  } catch (err) {
    recordFail('Edge Constraints', '0 Minute MCT Floor', String(err));
  }

  // Test 4.4: Negative Constraints (Must be rejected by Zod Schema)
  try {
    const negativeBudget = cloneItinerary(PRESET_SIN_NRT);
    negativeBudget.constraints.budgetUsd = -50;
    const check1 = ItinerarySchema.safeParse(negativeBudget);

    const negativeMct = cloneItinerary(PRESET_SIN_NRT);
    negativeMct.constraints.mctMin = -15;
    const check2 = ItinerarySchema.safeParse(negativeMct);

    const negativeBags = cloneItinerary(PRESET_SIN_NRT);
    negativeBags.constraints.baggagePieces = -1;
    const check3 = ItinerarySchema.safeParse(negativeBags);

    if (!check1.success && !check2.success && !check3.success) {
      recordPass('Edge Constraints', 'Negative Constraints Rejection Invariant', 'Zod schema properly rejects negative budget (-50), negative MCT (-15), and negative bags (-1)');
    } else {
      recordFail('Edge Constraints', 'Negative Constraints Rejection', `check1: ${check1.success}, check2: ${check2.success}, check3: ${check3.success}`);
    }
  } catch (err) {
    recordFail('Edge Constraints', 'Negative Constraints Rejection', String(err));
  }

  // =========================================================================
  // SUITE 5: FUZZING & MALFORMED / INJECTION INPUTS
  // =========================================================================
  console.log('\n👉 [SUITE 5] Fuzzing & Malformed / Injection Inputs');

  // Test 5.1: Empty and whitespace strings
  try {
    const resEmpty = parsePnr('');
    const resWhitespace = parsePnr('   \n\t  \n  ');
    if (!resEmpty.success && !resWhitespace.success) {
      recordPass('Fuzzing & Injection', 'Empty / Whitespace Input Rejection', 'Returned structured errors without crashing');
    } else {
      recordFail('Fuzzing & Injection', 'Empty / Whitespace Input Rejection', 'Failed to reject empty input');
    }
  } catch (err) {
    recordFail('Fuzzing & Injection', 'Empty / Whitespace Input Rejection', String(err));
  }

  // Test 5.2: SQL & Script Injection strings inside Remarks
  try {
    const injectionPnr = `
*** FLIGHTRESIST AI GDS PNR: INJ001 ***
 1.1O'CONNOR/LIAM MR
 1. SQ 856 Y 27AUG SINHKG HK1 0800 1205 /E
RM MISSION TITLE: '); DROP TABLE "TripSession"; -- | VENUE: <script>alert("xss")</script> | IMP: CRITICAL
RM BUDGET USD 500
*** END OF PNR ***
`;
    const parsed = parsePnr(injectionPnr);
    if (parsed.success && parsed.itinerary) {
      const it = parsed.itinerary;
      if (it.mission.title.includes('DROP TABLE') && it.mission.venue.includes('<script>')) {
        recordPass('Fuzzing & Injection', 'Injection Strings in Remarks', 'Successfully escaped and safely stored as plain text');
      } else {
        recordFail('Fuzzing & Injection', 'Injection Strings in Remarks', 'Content altered or stripped');
      }
    } else {
      recordFail('Fuzzing & Injection', 'Injection Strings in Remarks', `Failed to parse: ${parsed.errors?.join('; ')}`);
    }
  } catch (err) {
    recordFail('Fuzzing & Injection', 'Injection Strings in Remarks', String(err));
  }

  // Test 5.3: Corrupted Segment Lines (Invalid airport codes, non-numeric time)
  try {
    const corruptPnr1 = `
*** FLIGHTRESIST AI GDS PNR: COR001 ***
 1.1SMITH/JOHN MR
 1. SQ 856 Y 27AUG INVALIDAIRPORT HK1 ABCD EFGH /E
*** END OF PNR ***
`;
    const res1 = parsePnr(corruptPnr1);
    if (!res1.success && res1.errors && res1.errors.length > 0) {
      recordPass('Fuzzing & Injection', 'Corrupted Flight Segment Line Rejection', 'Rejected invalid segment line gracefully');
    } else {
      recordFail('Fuzzing & Injection', 'Corrupted Flight Segment Line Rejection', 'Expected rejection of invalid segment');
    }
  } catch (err) {
    recordFail('Fuzzing & Injection', 'Corrupted Flight Segment Line Rejection', String(err));
  }

  // Test 5.4: Massive Payload (5,000 noise lines)
  try {
    const noiseLines: string[] = [
      '*** FLIGHTRESIST AI GDS PNR: BIG001 ***',
      ' 1.1CHEN/WEI MR',
      ' 1. SQ 856 Y 27AUG SINHKG HK1 0800 1205 /E',
    ];
    for (let i = 0; i < 5000; i++) {
      noiseLines.push(`RM NOISE REMARK LINE NUMBER ${i} WITH RANDOM PADDING DATA`);
    }
    noiseLines.push('RM BUDGET USD 400');
    noiseLines.push('*** END OF PNR ***');

    const t0 = Date.now();
    const parsed = parsePnr(noiseLines.join('\n'));
    const elapsedMs = Date.now() - t0;

    if (parsed.success && parsed.itinerary && elapsedMs < 2000) {
      recordPass('Fuzzing & Injection', 'Massive Payload Stress (5,000 lines)', `Parsed in ${elapsedMs}ms without regex DoS or memory issues`);
    } else {
      recordFail('Fuzzing & Injection', 'Massive Payload Stress', `Elapsed: ${elapsedMs}ms, Success: ${parsed.success}`);
    }
  } catch (err) {
    recordFail('Fuzzing & Injection', 'Massive Payload Stress', String(err));
  }

  // =========================================================================
  // SUITE 6: MULTI-TENANT SESSION STORE CONCURRENCY & ISOLATION
  // =========================================================================
  console.log('\n👉 [SUITE 6] Multi-Tenant Session Store Concurrency & Isolation');

  try {
    const sessionCount = 20;
    const sessionIds: string[] = [];

    // Create 20 concurrent distinct sessions with different presets
    for (let i = 0; i < sessionCount; i++) {
      const sid = `adversarial-sess-${i}-${Date.now()}`;
      sessionIds.push(sid);
      const presetToUse = PRESETS[i % PRESETS.length];
      await setSessionItinerary(presetToUse, 'DEMO', sid);
    }

    // Verify all 20 sessions exist and hold the exact preset they were given
    let allMatches = true;
    for (let i = 0; i < sessionCount; i++) {
      const sid = sessionIds[i];
      const s = getSession(sid);
      const expectedPreset = PRESETS[i % PRESETS.length];
      if (s.itinerary.tripId !== expectedPreset.tripId || s.itinerary.origin !== expectedPreset.origin) {
        allMatches = false;
        recordFail('Session Isolation', `Session ${i} Initial State`, `Expected ${expectedPreset.tripId}, got ${s.itinerary.tripId}`);
        break;
      }
    }

    if (allMatches) {
      recordPass('Session Isolation', '20 Concurrent Sessions Initialization', 'All 20 sessions established with isolated itinerary states');
    }

    // Mutate Session 3 constraints: change budget to $9999
    updateSessionConstraints({ budgetUsd: 9999, mctMin: 120 }, 'DEMO', sessionIds[3]);

    // Mutate Session 7 passenger: change name to "Lord Sovereign"
    updateSessionPassenger({ name: 'Lord Sovereign' }, 'DEMO', sessionIds[7]);

    // Mutate Session 11 mission: change deal value to $777,000,000
    updateSessionMission({ dealValue: 777000000, title: '$777M Sovereign Megadeal' }, 'DEMO', sessionIds[11]);

    // Assert that NO other session got modified
    let isolationHolds = true;
    for (let i = 0; i < sessionCount; i++) {
      const sid = sessionIds[i];
      const s = getSession(sid);

      if (i === 3) {
        if (s.itinerary.constraints.budgetUsd !== 9999 || s.itinerary.constraints.mctMin !== 120) {
          isolationHolds = false;
          recordFail('Session Isolation', 'Session 3 Target Mutation', `Failed to mutate session 3`);
        }
      } else {
        if (s.itinerary.constraints.budgetUsd === 9999) {
          isolationHolds = false;
          recordFail('Session Isolation', `Session ${i} Leakage`, `Session ${i} leaked budget from Session 3!`);
        }
      }

      if (i === 7) {
        if (s.itinerary.passenger.name !== 'Lord Sovereign') {
          isolationHolds = false;
          recordFail('Session Isolation', 'Session 7 Target Mutation', 'Failed to mutate session 7 passenger');
        }
      } else {
        if (s.itinerary.passenger.name === 'Lord Sovereign') {
          isolationHolds = false;
          recordFail('Session Isolation', `Session ${i} Leakage`, `Session ${i} leaked passenger name from Session 7!`);
        }
      }

      if (i === 11) {
        if (s.itinerary.mission.dealValue !== 777000000) {
          isolationHolds = false;
          recordFail('Session Isolation', 'Session 11 Target Mutation', 'Failed to mutate session 11 deal value');
        }
      } else {
        if (s.itinerary.mission.dealValue === 777000000) {
          isolationHolds = false;
          recordFail('Session Isolation', `Session ${i} Leakage`, `Session ${i} leaked mission deal from Session 11!`);
        }
      }
    }

    if (isolationHolds) {
      recordPass('Session Isolation', 'Cross-Session Mutation Isolation', 'Zero cross-contamination across concurrent sessions during interleaved mutations');
    }

    // Verify resetSession drops only the targeted session
    resetSession(sessionIds[0]);
    const recreated = getSession(sessionIds[0]); // Recreates fresh default session
    const sess1 = getSession(sessionIds[1]); // Must remain untouched

    if (sess1.itinerary.tripId === PRESETS[1 % PRESETS.length].tripId && recreated.itinerary.tripId === PRESET_SIN_NRT.tripId) {
      recordPass('Session Isolation', 'Selective Session Reset & Re-creation', 'resetSession only purged targeted session and preserved active neighbor sessions');
    } else {
      recordFail('Session Isolation', 'Selective Session Reset', `sess1 tripId: ${sess1.itinerary.tripId}`);
    }

    // Clean up created test sessions
    for (const sid of sessionIds) {
      resetSession(sid);
    }
  } catch (err) {
    recordFail('Session Isolation', 'Multi-Tenant Concurrency', String(err));
  }

  // =========================================================================
  // SUITE 7: SCHEMA VALIDATION CONTRACT INVARIANTS
  // =========================================================================
  console.log('\n👉 [SUITE 7] Schema Validation Contract Invariants');

  // Test 7.1: Zero legs array
  try {
    const zeroLegs = cloneItinerary(PRESET_SIN_NRT);
    zeroLegs.legs = [];
    const check = ItinerarySchema.safeParse(zeroLegs);
    if (!check.success) {
      recordPass('Schema Invariants', 'Empty Legs Array Rejection', 'Zod rejects itinerary with 0 legs (min(1) rule)');
    } else {
      recordFail('Schema Invariants', 'Empty Legs Array Rejection', 'Allowed 0 legs');
    }
  } catch (err) {
    recordFail('Schema Invariants', 'Empty Legs Array Rejection', String(err));
  }

  // Test 7.2: Invalid Airport Code length (> 4 chars or < 2 chars)
  try {
    const invalidAirport = cloneItinerary(PRESET_SIN_NRT);
    invalidAirport.origin = 'SINGAPORE_TOO_LONG';
    const check = ItinerarySchema.safeParse(invalidAirport);
    if (!check.success) {
      recordPass('Schema Invariants', 'Invalid Airport Code Length Rejection', 'Zod rejects origin length > 4');
    } else {
      recordFail('Schema Invariants', 'Invalid Airport Code Length Rejection', 'Allowed invalid airport length');
    }
  } catch (err) {
    recordFail('Schema Invariants', 'Invalid Airport Code Length Rejection', String(err));
  }

  // Test 7.3: Invalid Mission Importance Enum
  try {
    const invalidImportance = cloneItinerary(PRESET_SIN_NRT);
    // @ts-expect-error invalid enum
    invalidImportance.mission.importance = 'SUPER_URGENT_NOT_IN_ENUM';
    const check = ItinerarySchema.safeParse(invalidImportance);
    if (!check.success) {
      recordPass('Schema Invariants', 'Invalid Mission Importance Enum Rejection', 'Zod strictly enforces MissionImportance enum');
    } else {
      recordFail('Schema Invariants', 'Invalid Mission Importance Enum Rejection', 'Allowed invalid enum');
    }
  } catch (err) {
    recordFail('Schema Invariants', 'Invalid Mission Importance Enum Rejection', String(err));
  }

  // =========================================================================
  // SUMMARY & VERDICT
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 EMPIRICAL STRESS TEST RESULTS SUMMARY');
  console.log('======================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Assertions Executed: ${total}`);
  console.log(`Passed:                   ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed:                   ${failed}`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS DETAIL:');
    for (const f of results.filter((r) => !r.passed)) {
      console.log(` - [${f.suite}] ${f.name}: ${f.error}`);
      if (f.details) console.log(`   Details: ${f.details}`);
    }
  }

  return { total, passed, failed, results };
}

runAdversarialStressSuite().catch((err) => {
  console.error('\nFatal stress runner failure:', err);
  process.exit(1);
});
