// tests/empirical-m2-stress-challenge.mjs
// Comprehensive Empirical Challenger Test Suite for Milestone 2
// Tests candidate generation across 35+ global airport pairs, invariant assertions,
// positive block times, realistic layovers, carrier validation, edge cases, and performance.

import assert from 'node:assert';
import { generateRouteCandidates } from '../src/lib/flightresist/route-generator.ts';
import { GLOBAL_AIRPORTS, getAirport, calculateDistanceKm, calculateFlightDurationMin } from '../src/lib/flightresist/airports-data.ts';
import { GLOBAL_AIRLINES, getAirline } from '../src/lib/flightresist/airlines-data.ts';
import { DemoProvider } from '../src/lib/flightresist/providers/demo.ts';
import { AtlasSandboxProvider } from '../src/lib/flightresist/providers/atlas-sandbox.ts';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { rankOptions } from '../src/lib/flightresist/optimizer.ts';

const ISO_WITH_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

// 35+ Global Airport Pairs spanning all 6 continents and intercontinental topologies
const GLOBAL_TEST_PAIRS = [
  { origin: 'LHR', destination: 'JFK', desc: 'London to New York (Europe -> NAMER)' },
  { origin: 'SFO', destination: 'HND', desc: 'San Francisco to Tokyo Haneda (NAMER -> ASIA)' },
  { origin: 'SYD', destination: 'LAX', desc: 'Sydney to Los Angeles (OCEANIA -> NAMER cross-dateline)' },
  { origin: 'DXB', destination: 'CDG', desc: 'Dubai to Paris CDG (ME_AFRICA -> Europe)' },
  { origin: 'FRA', destination: 'SIN', desc: 'Frankfurt to Singapore (Europe -> ASIA)' },
  { origin: 'EWR', destination: 'LHR', desc: 'Newark to London Heathrow (NAMER -> Europe)' },
  { origin: 'ORD', destination: 'NRT', desc: 'Chicago to Tokyo Narita (NAMER -> ASIA)' },
  { origin: 'HND', destination: 'CDG', desc: 'Tokyo Haneda to Paris CDG (ASIA -> Europe)' },
  { origin: 'GRU', destination: 'MIA', desc: 'Sao Paulo to Miami (SAMER -> NAMER trans-equatorial)' },
  { origin: 'JNB', destination: 'LHR', desc: 'Johannesburg to London (ME_AFRICA -> Europe)' },
  { origin: 'SYD', destination: 'SIN', desc: 'Sydney to Singapore (OCEANIA -> ASIA)' },
  { origin: 'AKL', destination: 'SFO', desc: 'Auckland to San Francisco (OCEANIA -> NAMER)' },
  { origin: 'HKG', destination: 'LHR', desc: 'Hong Kong to London (ASIA -> Europe)' },
  { origin: 'ICN', destination: 'LAX', desc: 'Seoul Incheon to Los Angeles (ASIA -> NAMER)' },
  { origin: 'CDG', destination: 'JFK', desc: 'Paris to New York (Europe -> NAMER)' },
  { origin: 'MIA', destination: 'EZE', desc: 'Miami to Buenos Aires (NAMER -> SAMER)' },
  { origin: 'BKK', destination: 'FRA', desc: 'Bangkok to Frankfurt (ASIA -> Europe)' },
  { origin: 'DOH', destination: 'SYD', desc: 'Doha to Sydney (ME_AFRICA -> OCEANIA)' },
  { origin: 'BOG', destination: 'MAD', desc: 'Bogota to Madrid (SAMER -> Europe)' },
  { origin: 'MEL', destination: 'DXB', desc: 'Melbourne to Dubai (OCEANIA -> ME_AFRICA)' },
  { origin: 'NBO', destination: 'LHR', desc: 'Nairobi to London (ME_AFRICA -> Europe)' },
  { origin: 'CPT', destination: 'DXB', desc: 'Cape Town to Dubai (ME_AFRICA -> ME_AFRICA)' },
  { origin: 'YVR', destination: 'HKG', desc: 'Vancouver to Hong Kong (NAMER -> ASIA)' },
  { origin: 'MEX', destination: 'MAD', desc: 'Mexico City to Madrid (NAMER -> Europe)' },
  { origin: 'SIN', destination: 'LHR', desc: 'Singapore to London (ASIA -> Europe)' },
  { origin: 'ZRH', destination: 'SIN', desc: 'Zurich to Singapore (Europe -> ASIA)' },
  { origin: 'JFK', destination: 'HND', desc: 'New York to Tokyo Haneda (NAMER -> ASIA)' },
  { origin: 'PER', destination: 'LHR', desc: 'Perth to London (OCEANIA -> Europe ultra-long-haul)' },
  { origin: 'SCL', destination: 'MIA', desc: 'Santiago to Miami (SAMER -> NAMER)' },
  { origin: 'ADD', destination: 'DXB', desc: 'Addis Ababa to Dubai (ME_AFRICA -> ME_AFRICA)' },
  { origin: 'DEL', destination: 'LHR', desc: 'Delhi to London (ASIA -> Europe)' },
  { origin: 'BOM', destination: 'FRA', desc: 'Mumbai to Frankfurt (ASIA -> Europe)' },
  { origin: 'YYZ', destination: 'CDG', desc: 'Toronto to Paris (NAMER -> Europe)' },
  { origin: 'MNL', destination: 'SFO', desc: 'Manila to San Francisco (ASIA -> NAMER)' },
  { origin: 'KUL', destination: 'LHR', desc: 'Kuala Lumpur to London (ASIA -> Europe)' },
];

let totalAssertions = 0;
let passedAssertions = 0;
const failureLog = [];

function check(desc, condition, detail = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    const msg = `FAILED: ${desc} ${detail ? `(${detail})` : ''}`;
    console.error(`  ✗ ${msg}`);
    failureLog.push(msg);
  }
}

async function runEmpiricalChallenge() {
  console.log('======================================================================');
  console.log('  FLIGHTRESIST AI 2.0 — EMPIRICAL CHALLENGER STRESS SUITE (MILESTONE 2)');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: Candidate Generation Invariants Across 35 Global Airport Pairs
  // =========================================================================
  console.log(`--- SUITE 1: Testing Invariants Across ${GLOBAL_TEST_PAIRS.length} Global Airport Pairs ---`);

  for (let pIdx = 0; pIdx < GLOBAL_TEST_PAIRS.length; pIdx++) {
    const pair = GLOBAL_TEST_PAIRS[pIdx];
    const { origin, destination, desc } = pair;

    const candidates = generateRouteCandidates({
      origin,
      destination,
      travelDateIso: '2026-08-27',
      baseFareUsd: 850,
      budgetCeilingUsd: 200,
      mctMin: 60,
      baggagePieces: 1,
      baggageWeightKg: 23,
    });

    // 1. Candidate count invariant (35 - 45)
    check(
      `[${pIdx + 1}/${GLOBAL_TEST_PAIRS.length}] ${origin}->${destination} (${desc}): Count in [35, 45]`,
      candidates.length >= 35 && candidates.length <= 45,
      `got ${candidates.length}`
    );

    // 2. Direct vs Connecting Topology Split
    const direct = candidates.filter((c) => c.stops === 0);
    const connecting = candidates.filter((c) => c.stops === 1);

    check(
      `${origin}->${destination}: Has at least 4 direct candidates`,
      direct.length >= 4,
      `got ${direct.length}`
    );
    check(
      `${origin}->${destination}: Has at least 25 connecting candidates`,
      connecting.length >= 25,
      `got ${connecting.length}`
    );

    // 3. Decision Funnel Distribution (4 classes)
    const classes = new Set(candidates.map((c) => c.fixtureClass));
    check(
      `${origin}->${destination}: Contains 'finalist' candidates`,
      classes.has('finalist')
    );
    check(
      `${origin}->${destination}: Contains 'over_budget' candidates`,
      classes.has('over_budget')
    );
    check(
      `${origin}->${destination}: Contains 'unsafe_connection' candidates`,
      classes.has('unsafe_connection')
    );
    check(
      `${origin}->${destination}: Contains 'baggage_incompatible' candidates`,
      classes.has('baggage_incompatible')
    );

    // 4. Per-Candidate Structural & Temporal Invariants
    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const c = candidates[cIdx];

      // ID and Key
      check(`${origin}->${destination} cand[${cIdx}]: Valid ID`, typeof c.id === 'string' && c.id.startsWith('cand-'));
      check(`${origin}->${destination} cand[${cIdx}]: Valid fareKey`, typeof c.fareKey === 'string' && c.fareKey.length > 5);

      // Airline validity
      check(
        `${origin}->${destination} cand[${cIdx}]: Carrier ${c.airlineCode} registered in airlines DB`,
        getAirline(c.airlineCode) !== undefined,
        `code=${c.airlineCode}`
      );
      check(
        `${origin}->${destination} cand[${cIdx}]: Carrier name matches airline DB`,
        c.airlineName === getAirline(c.airlineCode)?.name,
        `name=${c.airlineName}`
      );

      // Timestamps format
      check(
        `${origin}->${destination} cand[${cIdx}]: depIso has timezone offset format`,
        ISO_WITH_TZ_REGEX.test(c.depIso),
        `depIso=${c.depIso}`
      );
      check(
        `${origin}->${destination} cand[${cIdx}]: arrIso has timezone offset format`,
        ISO_WITH_TZ_REGEX.test(c.arrIso),
        `arrIso=${c.arrIso}`
      );

      // Positive total duration
      const depUtc = new Date(c.depIso).getTime();
      const arrUtc = new Date(c.arrIso).getTime();
      check(`${origin}->${destination} cand[${cIdx}]: Positive total duration`, c.totalDurationMin > 0);
      check(
        `${origin}->${destination} cand[${cIdx}]: Departure strictly before arrival in UTC time`,
        arrUtc > depUtc,
        `dep=${c.depIso}, arr=${c.arrIso}`
      );

      const elapsedMin = Math.round((arrUtc - depUtc) / 60000);
      check(
        `${origin}->${destination} cand[${cIdx}]: totalDurationMin matches UTC elapsed difference`,
        c.totalDurationMin === elapsedMin,
        `totalDurationMin=${c.totalDurationMin}, elapsedMin=${elapsedMin}`
      );

      // Legs validation
      check(`${origin}->${destination} cand[${cIdx}]: Legs match stops + 1`, c.legs.length === c.stops + 1);

      for (let legIdx = 0; legIdx < c.legs.length; legIdx++) {
        const leg = c.legs[legIdx];
        check(`${origin}->${destination} cand[${cIdx}] leg[${legIdx}]: Positive durationMin`, leg.durationMin > 0);
        check(
          `${origin}->${destination} cand[${cIdx}] leg[${legIdx}]: Carrier ${leg.airlineCode} registered in DB`,
          getAirline(leg.airlineCode) !== undefined
        );
        check(
          `${origin}->${destination} cand[${cIdx}] leg[${legIdx}]: Flight number starts with carrier code`,
          leg.flightNumber.startsWith(leg.airlineCode),
          `fn=${leg.flightNumber}, carrier=${leg.airlineCode}`
        );

        const legDepUtc = new Date(leg.depIso).getTime();
        const legArrUtc = new Date(leg.arrIso).getTime();
        check(
          `${origin}->${destination} cand[${cIdx}] leg[${legIdx}]: Leg arr after leg dep in UTC`,
          legArrUtc > legDepUtc
        );
        const legElapsedMin = Math.round((legArrUtc - legDepUtc) / 60000);
        check(
          `${origin}->${destination} cand[${cIdx}] leg[${legIdx}]: leg.durationMin matches UTC elapsed time`,
          leg.durationMin === legElapsedMin,
          `durationMin=${leg.durationMin}, legElapsed=${legElapsedMin}`
        );
      }

      // Layover validation for 1-stop flights
      if (c.stops === 1) {
        check(`${origin}->${destination} cand[${cIdx}]: Has exactly 1 layover object`, c.layovers.length === 1);
        const layover = c.layovers[0];
        check(`${origin}->${destination} cand[${cIdx}]: Layover airport is registered hub`, getAirport(layover.airport) !== undefined);
        check(`${origin}->${destination} cand[${cIdx}]: Layover airport is not origin or destination`, layover.airport !== origin && layover.airport !== destination);
        check(`${origin}->${destination} cand[${cIdx}]: Layover minutes >= 25`, layover.minutes >= 25, `minutes=${layover.minutes}`);
        check(`${origin}->${destination} cand[${cIdx}]: minConnectionMin equals layover minutes`, c.minConnectionMin === layover.minutes);

        // Verify chronological gap between leg 1 arrival and leg 2 departure
        const leg1ArrUtc = new Date(c.legs[0].arrIso).getTime();
        const leg2DepUtc = new Date(c.legs[1].depIso).getTime();
        check(
          `${origin}->${destination} cand[${cIdx}]: Leg 2 departs after Leg 1 arrives in UTC`,
          leg2DepUtc > leg1ArrUtc
        );
        const gapMin = Math.round((leg2DepUtc - leg1ArrUtc) / 60000);
        check(
          `${origin}->${destination} cand[${cIdx}]: Layover minutes matches leg gap`,
          layover.minutes === gapMin,
          `layover=${layover.minutes}, gap=${gapMin}`
        );
      } else {
        check(`${origin}->${destination} cand[${cIdx}]: Direct flight has 0 layovers`, c.layovers.length === 0);
        check(`${origin}->${destination} cand[${cIdx}]: Direct flight minConnectionMin is null`, c.minConnectionMin === null);
      }

      // Metadata validation
      check(`${origin}->${destination} cand[${cIdx}]: Metadata exists`, c.metadata !== undefined && typeof c.metadata.bookable === 'boolean');
      check(`${origin}->${destination} cand[${cIdx}]: Metadata ticketing available`, c.metadata?.ticketingAvailable === true);
    }
  }

  console.log(`\n--- SUITE 1 COMPLETE: ${passedAssertions}/${totalAssertions} assertions passed ---\n`);

  // =========================================================================
  // SUITE 2: Boundary & Edge Case Stress Testing
  // =========================================================================
  console.log('--- SUITE 2: Boundary & Edge Cases ---');

  // B2.1: Identical origin and destination returns empty array
  const samePairCands = generateRouteCandidates({ origin: 'SIN', destination: 'SIN' });
  check('B2.1: Same origin and destination returns []', samePairCands.length === 0, `got ${samePairCands.length}`);

  const samePairCase = generateRouteCandidates({ origin: 'jfk', destination: 'JFK' });
  check('B2.1b: Case-insensitive same origin and destination returns []', samePairCase.length === 0);

  // B2.2: Empty / invalid parameters
  check('B2.2a: Empty origin returns []', generateRouteCandidates({ origin: '', destination: 'NRT' }).length === 0);
  check('B2.2b: Empty destination returns []', generateRouteCandidates({ origin: 'SIN', destination: '' }).length === 0);

  // B2.3: Unknown / non-existent airport codes (fallback behavior)
  const unknownCands = generateRouteCandidates({
    origin: 'XYZ',
    destination: 'ABC',
    travelDateIso: '2026-08-27',
  });
  check('B2.3: Unknown airport codes handled gracefully without throwing', unknownCands.length >= 35, `got ${unknownCands.length}`);
  check('B2.3b: Unknown airport candidates have valid IDs', unknownCands[0]?.id === 'cand-01');

  // B2.4: Extreme Budget Limits ($0 and $100,000)
  const zeroBudgetCands = generateRouteCandidates({
    origin: 'LHR',
    destination: 'JFK',
    budgetCeilingUsd: 0,
  });
  check('B2.4a: Zero budget ceiling generates 35-45 candidates', zeroBudgetCands.length >= 35 && zeroBudgetCands.length <= 45);
  check('B2.4b: Non-negative fareDiffUsd under zero budget', zeroBudgetCands.every((c) => c.fareDiffUsd >= 0));

  const highBudgetCands = generateRouteCandidates({
    origin: 'LHR',
    destination: 'JFK',
    budgetCeilingUsd: 100000,
  });
  check('B2.4c: $100k budget ceiling generates 35-45 candidates', highBudgetCands.length >= 35 && highBudgetCands.length <= 45);
  check('B2.4d: No NaN or Infinity in fareDiffUsd under large budget', highBudgetCands.every((c) => Number.isFinite(c.fareDiffUsd)));

  // B2.5: Extreme MCT Limits (30m to 300m)
  const strictMctCands = generateRouteCandidates({
    origin: 'SFO',
    destination: 'HND',
    mctMin: 180,
  });
  check('B2.5a: 180m MCT generates 35-45 candidates', strictMctCands.length >= 35 && strictMctCands.length <= 45);
  const strictFinalists = strictMctCands.filter((c) => c.stops === 1 && c.fixtureClass === 'finalist');
  check('B2.5b: Finalist 1-stop connecting flights have layover >= 180m under strict MCT', strictFinalists.every((c) => (c.minConnectionMin ?? 0) >= 180));

  // B2.6: Far-Future and Leap-Year Travel Dates
  const futureDates = ['2026-12-31', '2028-02-29', '2030-07-15', '2035-01-01'];
  for (const fDate of futureDates) {
    const fCands = generateRouteCandidates({ origin: 'DXB', destination: 'CDG', travelDateIso: fDate });
    check(`B2.6: Future date ${fDate} generates 35-45 candidates`, fCands.length >= 35 && fCands.length <= 45);
    check(`B2.6b: Future date ${fDate} departure matches date`, fCands[0].depIso.startsWith(fDate), `dep=${fCands[0].depIso}`);
  }

  // B2.7: Cross-Dateline & Timezone Normalization Stress Test
  const crossDatelinePairs = [
    { origin: 'SYD', destination: 'LAX', depOffset: 10, arrOffset: -7 },
    { origin: 'AKL', destination: 'SFO', depOffset: 12, arrOffset: -7 },
    { origin: 'HND', destination: 'LAX', depOffset: 9, arrOffset: -7 },
    { origin: 'LAX', destination: 'SYD', depOffset: -7, arrOffset: 10 },
  ];

  for (const cdp of crossDatelinePairs) {
    const cdCands = generateRouteCandidates({
      origin: cdp.origin,
      destination: cdp.destination,
      travelDateIso: '2026-08-27',
    });
    for (const c of cdCands) {
      const depIso = c.depIso;
      const arrIso = c.arrIso;
      const depTzMatch = depIso.match(/([+-]\d{2}:\d{2})$/);
      const arrTzMatch = arrIso.match(/([+-]\d{2}:\d{2})$/);
      check(
        `Cross-dateline ${cdp.origin}->${cdp.destination}: depIso has correct timezone sign & value`,
        depTzMatch !== null && Math.abs(parseFloat(depTzMatch[1].replace(':', '.')) - cdp.depOffset) < 0.1,
        `expected ${cdp.depOffset}, got ${depTzMatch?.[1]}`
      );
      check(
        `Cross-dateline ${cdp.origin}->${cdp.destination}: arrIso has correct timezone sign & value`,
        arrTzMatch !== null && Math.abs(parseFloat(arrTzMatch[1].replace(':', '.')) - cdp.arrOffset) < 0.1,
        `expected ${cdp.arrOffset}, got ${arrTzMatch?.[1]}`
      );
    }
  }

  // =========================================================================
  // SUITE 3: Canonical Demo Regression Fidelity
  // =========================================================================
  console.log('\n--- SUITE 3: Canonical Demo Regression Fidelity ---');
  const canonicalCandidates = generateRouteCandidates({
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    isCanonicalDemo: true,
  });

  check('SUITE 3.1: Canonical SIN->NRT produces exactly 42 candidates', canonicalCandidates.length === 42, `got ${canonicalCandidates.length}`);

  const { ITINERARY } = await import('../src/lib/flightresist/itinerary.ts');
  const funnelRes = applyHardConstraints(canonicalCandidates, ITINERARY);
  check('SUITE 3.2: Canonical funnel produces exactly 3 survivors', funnelRes.survivors.length === 3, `got ${funnelRes.survivors.length}`);
  check('SUITE 3.3: Canonical pruned over_budget count is 12', funnelRes.prunedSummary.over_budget === 12, `got ${funnelRes.prunedSummary.over_budget}`);
  check('SUITE 3.4: Canonical pruned unsafe_connection count is 18', funnelRes.prunedSummary.unsafe_connection === 18, `got ${funnelRes.prunedSummary.unsafe_connection}`);
  check('SUITE 3.5: Canonical pruned baggage_incompatible count is 9', funnelRes.prunedSummary.baggage_incompatible === 9, `got ${funnelRes.prunedSummary.baggage_incompatible}`);

  const rankedOptions = rankOptions(funnelRes.survivors, ITINERARY);
  check('SUITE 3.6: Ranked option 1 is Option B (score 82.0)', rankedOptions[0].label === 'B' && Math.abs(rankedOptions[0].recoveryScore - 82.0) < 0.1, `label=${rankedOptions[0].label}, score=${rankedOptions[0].recoveryScore}`);
  check('SUITE 3.7: Ranked option 2 is Option C (score 77.7)', rankedOptions[1].label === 'C' && Math.abs(rankedOptions[1].recoveryScore - 77.7) < 0.1, `label=${rankedOptions[1].label}, score=${rankedOptions[1].recoveryScore}`);
  check('SUITE 3.8: Ranked option 3 is Option A (score 49.5)', rankedOptions[2].label === 'A' && Math.abs(rankedOptions[2].recoveryScore - 49.5) < 0.1, `label=${rankedOptions[2].label}, score=${rankedOptions[2].recoveryScore}`);

  // =========================================================================
  // SUITE 4: Provider Integration & Fare Verification
  // =========================================================================
  console.log('\n--- SUITE 4: Provider Integration & Fare Verification ---');
  const demoProvider = new DemoProvider();

  // Test search on arbitrary route
  const demoSearchResults = await demoProvider.searchFlights('FRA', 'SIN', '2026-08-27');
  check('SUITE 4.1: DemoProvider.searchFlights produces 35-45 candidates for FRA->SIN', demoSearchResults.length >= 35 && demoSearchResults.length <= 45);

  // Verify fare for every candidate in search results
  let fareVerificationPasses = 0;
  for (const c of demoSearchResults.slice(0, 10)) {
    const verified = await demoProvider.verifyFare(c.fareKey);
    if (verified.valid && verified.fareKey === c.fareKey && verified.fareDiffUsd === c.fareDiffUsd) {
      fareVerificationPasses++;
    }
  }
  check('SUITE 4.2: DemoProvider.verifyFare successfully verifies generated candidates', fareVerificationPasses === 10, `verified ${fareVerificationPasses}/10`);

  // =========================================================================
  // SUITE 5: High-Volume Concurrency & Performance Benchmark
  // =========================================================================
  console.log('\n--- SUITE 5: High-Volume Concurrency & Performance Benchmark ---');

  const startBench = performance.now();
  const ITERATIONS = 500;
  const latencies = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const pair = GLOBAL_TEST_PAIRS[i % GLOBAL_TEST_PAIRS.length];
    const t0 = performance.now();
    const cands = generateRouteCandidates({
      origin: pair.origin,
      destination: pair.destination,
      travelDateIso: '2026-08-27',
      baseFareUsd: 900,
      budgetCeilingUsd: 200,
    });
    const dt = performance.now() - t0;
    latencies.push(dt);
    if (cands.length < 35 || cands.length > 45) {
      check(`Benchmark iteration ${i}: count in [35, 45]`, false, `got ${cands.length}`);
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(ITERATIONS * 0.5)];
  const p95 = latencies[Math.floor(ITERATIONS * 0.95)];
  const p99 = latencies[Math.floor(ITERATIONS * 0.99)];
  const totalBenchTime = performance.now() - startBench;

  console.log(`Benchmark Results across ${ITERATIONS} full candidate generations:`);
  console.log(`  Total time: ${totalBenchTime.toFixed(1)} ms (avg ${(totalBenchTime / ITERATIONS).toFixed(3)} ms/generation)`);
  console.log(`  P50 latency: ${p50.toFixed(3)} ms`);
  console.log(`  P95 latency: ${p95.toFixed(3)} ms`);
  console.log(`  P99 latency: ${p99.toFixed(3)} ms`);

  check('SUITE 5.1: P99 generation latency < 5.0 ms', p99 < 5.0, `p99=${p99.toFixed(3)}ms`);
  check('SUITE 5.2: Average generation latency < 1.0 ms', (totalBenchTime / ITERATIONS) < 1.0, `avg=${(totalBenchTime / ITERATIONS).toFixed(3)}ms`);

  // Concurrent stress test
  const concurrentPromises = Array.from({ length: 50 }, (_, i) => {
    const pair = GLOBAL_TEST_PAIRS[i % GLOBAL_TEST_PAIRS.length];
    return generateRouteCandidates({
      origin: pair.origin,
      destination: pair.destination,
      travelDateIso: '2026-08-27',
    });
  });

  const concurrentResults = await Promise.all(concurrentPromises);
  check('SUITE 5.3: 50 concurrent generations succeed without race conditions', concurrentResults.length === 50 && concurrentResults.every((c) => c.length >= 35 && c.length <= 45));

  // =========================================================================
  // SUMMARY & VERDICT
  // =========================================================================
  console.log('\n======================================================================');
  console.log(`  TOTAL ASSERTIONS EXECUTED: ${totalAssertions}`);
  console.log(`  PASSED: ${passedAssertions}`);
  console.log(`  FAILED: ${failureLog.length}`);
  console.log('======================================================================\n');

  if (failureLog.length > 0) {
    console.error('FAILURES DETECTED:');
    failureLog.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 EMPIRICAL CHALLENGE PASSED CLEANLY: 100% INVARIANTS SATISFIED.\n');
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal crash during empirical challenge run:', err);
  process.exit(1);
});
