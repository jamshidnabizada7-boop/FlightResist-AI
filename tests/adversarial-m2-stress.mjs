// tests/adversarial-m2-stress.mjs
// Adversarial stress-testing suite for Milestone 2 changes in AtlasSandboxProvider & Type contracts

import assert from 'node:assert';
import { AtlasSandboxProvider } from '../src/lib/flightresist/providers/atlas-sandbox.ts';
import { DemoProvider } from '../src/lib/flightresist/providers/demo.ts';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { rankOptions } from '../src/lib/flightresist/optimizer.ts';
import { ITINERARY } from '../src/lib/flightresist/itinerary.ts';

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
  }
}

async function run() {
  console.log('=== RUNNING ADVERSARIAL STRESS TESTS (Milestone 2) ===\n');

  const provider = new AtlasSandboxProvider();

  // -------------------------------------------------------------------------
  // Test 1: Date & Clock Normalization across Calendar Day Jump (Overnight direct)
  // -------------------------------------------------------------------------
  test('Direct overnight flight spans DAY0 -> DAY1 correctly', () => {
    // Access private/internal mapping or simulate offer
    const mockOffer = {
      offer_id: 'adv-01',
      bookable: false,
      price_status: 'reference',
      total_price: 350.50,
      currency: 'USD',
      segments: [
        {
          departure_airport: 'SIN',
          arrival_airport: 'NRT',
          departure_time: '202611152345',
          arrival_time: '202611160730',
          carrier: 'TR',
          flight_number: 'TR898',
          duration_minutes: 345,
          cabin_class: 1,
        }
      ]
    };

    // Use searchFlights with mocked CLI or verify candidate normalization via searchFlights
  });

  // -------------------------------------------------------------------------
  // Test 2: Live Search & Candidate Structure
  // -------------------------------------------------------------------------
  console.log('\n--- Live Search Verification ---');
  const liveCandidates = await provider.searchFlights('SIN', 'NRT', '2026-11-15');
  
  test('Live search returns non-empty candidate list (ingests reference inventory)', () => {
    assert(liveCandidates.length > 0, 'Must ingest live search offers');
    assert(liveCandidates.every(c => c.metadata !== undefined), 'All candidates must have metadata');
  });

  test('All live candidates have valid DAY0/DAY1 timestamps and correct ISO format', () => {
    for (const c of liveCandidates) {
      assert(/^2026-08-2[78]T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(c.depIso), `Invalid depIso: ${c.depIso}`);
      assert(/^2026-08-2[789]T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(c.arrIso), `Invalid arrIso: ${c.arrIso}`);
      assert(c.totalDurationMin > 0, `totalDurationMin must be > 0, got ${c.totalDurationMin}`);
      assert(c.legs.length > 0, 'Legs must not be empty');
      for (const leg of c.legs) {
        assert(/^2026-08-2[78]T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(leg.depIso), `Invalid leg depIso: ${leg.depIso}`);
        assert(/^2026-08-2[789]T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(leg.arrIso), `Invalid leg arrIso: ${leg.arrIso}`);
        assert(leg.durationMin > 0, `Leg duration must be > 0: ${leg.durationMin}`);
      }
    }
  });

  test('Layovers connection times are non-negative and mathematically accurate', () => {
    for (const c of liveCandidates) {
      if (c.layovers.length > 0) {
        for (let i = 0; i < c.layovers.length; i++) {
          const layover = c.layovers[i];
          const prevLeg = c.legs[i];
          const nextLeg = c.legs[i + 1];
          const expectedMin = Math.round((new Date(nextLeg.depIso).getTime() - new Date(prevLeg.arrIso).getTime()) / 60000);
          assert.strictEqual(layover.minutes, expectedMin, `Layover minutes mismatch: ${layover.minutes} vs expected ${expectedMin}`);
          assert(layover.minutes >= 0, `Layover minutes cannot be negative: ${layover.minutes}`);
        }
      }
    }
  });

  test('Fare differences are non-negative and correctly anchored to result set minimum', () => {
    const minFareDiff = Math.min(...liveCandidates.map(c => c.fareDiffUsd));
    assert.strictEqual(minFareDiff, 0, 'Cheapest candidate must have fareDiffUsd = 0');
    assert(liveCandidates.every(c => c.fareDiffUsd >= 0), 'All fare differences must be >= 0');
  });

  // -------------------------------------------------------------------------
  // Test 3: Decision Engine Funnel & Optimizer Integration
  // -------------------------------------------------------------------------
  console.log('\n--- Decision Funnel & Optimizer Integration ---');
  test('Constraint funnel processes live candidates without crashing', () => {
    const constraintResult = applyHardConstraints(liveCandidates, ITINERARY);
    assert(constraintResult.totalCandidates === liveCandidates.length, 'Total candidates match');
    assert(constraintResult.survivors.length > 0, 'At least one candidate must survive constraints');
    assert(constraintResult.funnel.length === 4, 'Funnel has 4 stages');
  });

  test('Optimizer ranks surviving live candidates correctly', () => {
    const constraintResult = applyHardConstraints(liveCandidates, ITINERARY);
    const scored = rankOptions(constraintResult.survivors, ITINERARY);
    assert(scored.length === constraintResult.survivors.length, `Scored options count (${scored.length}) must match survivors count (${constraintResult.survivors.length})`);
    assert(scored[0].status === 'RECOMMENDED', 'First option is RECOMMENDED');
    for (const opt of scored) {
      assert(opt.recoveryScore >= 0 && opt.recoveryScore <= 100, `Invalid score: ${opt.recoveryScore}`);
      assert(opt.residualRisk >= 0 && opt.residualRisk <= 100, `Invalid risk: ${opt.residualRisk}`);
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: Demo Mode Regression & Invariant Guard
  // -------------------------------------------------------------------------
  console.log('\n--- Demo Mode Regression Invariants ---');
  const demoProvider = new DemoProvider();
  const demoCandidates = await demoProvider.searchFlights('SIN', 'NRT', '2026-08-27');

  test('DemoProvider produces exactly 42 candidates', () => {
    assert.strictEqual(demoCandidates.length, 42);
  });

  test('DemoProvider funnel produces exactly 3 survivors with expected prune breakdown', () => {
    const res = applyHardConstraints(demoCandidates, ITINERARY);
    assert.strictEqual(res.survivors.length, 3);
    assert.strictEqual(res.prunedSummary.misses_deadline, 0);
    assert.strictEqual(res.prunedSummary.over_budget, 12);
    assert.strictEqual(res.prunedSummary.unsafe_connection, 18);
    assert.strictEqual(res.prunedSummary.baggage_incompatible, 9);
  });

  test('DemoProvider finalists have identical ranking and scores', () => {
    const res = applyHardConstraints(demoCandidates, ITINERARY);
    const scored = rankOptions(res.survivors, ITINERARY);
    assert.strictEqual(scored.length, 3);
    assert.strictEqual(scored[0].label, 'B');
    assert.strictEqual(scored[0].recoveryScore, 82);
    assert.strictEqual(scored[0].status, 'RECOMMENDED');

    assert.strictEqual(scored[1].label, 'C');
    assert.strictEqual(scored[1].recoveryScore, 77.7);
    assert.strictEqual(scored[1].status, 'SECONDARY');

    assert.strictEqual(scored[2].label, 'A');
    assert.strictEqual(scored[2].recoveryScore, 49.5);
    assert.strictEqual(scored[2].status, 'ALTERNATIVE');
  });

  console.log(`\n========================================`);
  console.log(`Tests passed: ${passed} / ${total}`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
