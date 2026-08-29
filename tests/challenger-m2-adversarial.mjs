// tests/challenger-m2-adversarial.mjs
// Adversarial Stress & Verification Test Suite for Milestone 2
// Author: challenger_m2_2 (EMPIRICAL CHALLENGER)

import { AtlasSandboxProvider, probeAtlas } from '../src/lib/flightresist/providers/atlas-sandbox.ts';
import { DemoProvider } from '../src/lib/flightresist/providers/demo.ts';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { computeSubScores, recoveryScore, rankOptions } from '../src/lib/flightresist/optimizer.ts';
import { ITINERARY, ORIGINAL_ARRIVAL_ISO, NRT_TO_MEETING_MIN } from '../src/lib/flightresist/itinerary.ts';
import { getDynamicSearchDate } from '../src/lib/utils.ts';
import { getFixtureCandidates } from '../src/lib/flightresist/fixture.ts';

let passedChecks = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  passedChecks++;
  console.log(`  ✓ ${message}`);
}

async function testAtlasProbe() {
  console.log('\n========================================');
  console.log('TEST 1: Atlas CLI Probe & Environment Diagnosis');
  console.log('========================================');

  const probe = await probeAtlas();
  console.log('Probe result:', probe);
  assert(typeof probe.available === 'boolean', 'probe.available is boolean');
  assert(typeof probe.detail === 'string', 'probe.detail is string');
  assert(probe.available === true, 'probe reports Atlas CLI is available in environment');
  assert(probe.authenticated === true, 'probe reports Atlas CLI is authenticated');
  assert(probe.ticketingAvailable !== undefined, 'probe reports ticketingAvailable status');
  console.log(`Atlas Probe OK: CLI available=${probe.available}, auth=${probe.authenticated}, ticketing=${probe.ticketingAvailable} (${probe.ticketingBlocker})`);
}

async function testAtlasCandidateGenerationAndNormalization() {
  console.log('\n========================================');
  console.log('TEST 2: Atlas Sandbox Candidate Generation & Timestamp Normalization');
  console.log('========================================');

  const provider = new AtlasSandboxProvider();
  const searchDate = getDynamicSearchDate();
  console.log(`Invoking live Atlas search with origin=SIN, destination=NRT, date=${searchDate}...`);

  const candidates = await provider.searchFlights('SIN', 'NRT', searchDate);
  console.log(`Retrieved ${candidates.length} live candidates from Atlas.`);
  assert(candidates.length > 0, `Live search returned ${candidates.length} candidates (> 0)`);

  let baselineOfferFound = false;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    
    // 1. Structural integrity
    assert(c.id === `atlas-${String(i).padStart(2, '0')}`, `Candidate ID follows atlas-XX format: ${c.id}`);
    assert(typeof c.fareKey === 'string' && c.fareKey.length > 0, `Candidate fareKey is populated: ${c.fareKey}`);
    assert(typeof c.airlineCode === 'string' && c.airlineCode.length > 0, `Candidate airlineCode: ${c.airlineCode}`);
    assert(typeof c.airlineName === 'string' && c.airlineName.length > 0, `Candidate airlineName: ${c.airlineName}`);
    assert(Array.isArray(c.legs) && c.legs.length > 0, `Candidate has at least 1 leg`);
    assert(Array.isArray(c.layovers), `Candidate layovers is array`);
    assert(c.stops === c.legs.length - 1, `Stops count matches legs.length - 1: ${c.stops}`);

    // 2. Timestamp ISO normalization onto DAY0 (2026-08-27) or DAY1 (2026-08-28)
    const depMatch = /^2026-08-(27|28)T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(c.depIso);
    assert(depMatch, `Candidate ${c.id} depIso is valid scenario ISO: ${c.depIso}`);
    
    const arrMatch = /^2026-08-(27|28|29)T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/.test(c.arrIso);
    assert(arrMatch, `Candidate ${c.id} arrIso is valid scenario ISO: ${c.arrIso}`);

    const depTime = new Date(c.depIso).getTime();
    const arrTime = new Date(c.arrIso).getTime();
    assert(!isNaN(depTime) && !isNaN(arrTime), `depIso and arrIso are parseable dates`);
    assert(arrTime > depTime, `arrTime is chronologically after depTime: dep=${c.depIso}, arr=${c.arrIso}`);

    // 3. Durations & Layovers
    let expectedTotalDur = 0;
    for (let legIdx = 0; legIdx < c.legs.length; legIdx++) {
      const leg = c.legs[legIdx];
      assert(leg.durationMin > 0, `Leg ${leg.flightNumber} durationMin > 0 (${leg.durationMin})`);
      expectedTotalDur += leg.durationMin;
    }
    for (const lay of c.layovers) {
      assert(lay.minutes >= 0, `Layover at ${lay.airport} is non-negative (${lay.minutes} min)`);
      expectedTotalDur += lay.minutes;
    }
    assert(c.totalDurationMin === expectedTotalDur, `totalDurationMin (${c.totalDurationMin}) matches sum of legs+layovers (${expectedTotalDur})`);

    if (c.stops === 0) {
      assert(c.minConnectionMin === null, `Direct flight minConnectionMin is null`);
    } else {
      const actualMinConn = Math.min(...c.layovers.map(l => l.minutes));
      assert(c.minConnectionMin === actualMinConn, `minConnectionMin (${c.minConnectionMin}) matches min layover (${actualMinConn})`);
    }

    // 4. Metadata enrichment
    assert(c.metadata !== undefined, `Candidate ${c.id} has metadata`);
    assert(typeof c.metadata.bookable === 'boolean', `metadata.bookable is boolean (${c.metadata.bookable})`);
    assert(c.metadata.priceStatus === 'current' || c.metadata.priceStatus === 'reference', `metadata.priceStatus is current or reference (${c.metadata.priceStatus})`);
    assert(typeof c.metadata.ticketingAvailable === 'boolean', `metadata.ticketingAvailable is boolean`);

    // 5. Pricing delta
    assert(c.fareDiffUsd >= 0, `fareDiffUsd is non-negative: ${c.fareDiffUsd}`);
    if (c.fareDiffUsd === 0) {
      baselineOfferFound = true;
    }
  }

  assert(baselineOfferFound, 'At least one candidate is the baseline price (fareDiffUsd = $0)');
  console.log('Atlas Candidate Generation & Timestamp Normalization tests PASSED.');
  return candidates;
}

function testHardConstraintsFunnelEdgeCases(liveCandidates) {
  console.log('\n========================================');
  console.log('TEST 3: Hard Constraints Funnel Filtering Edge Cases & Boundary Conditions');
  console.log('========================================');

  const baseCandidate = {
    id: 'test-cand',
    fareKey: 'test-key',
    airlineCode: 'SQ',
    airlineName: 'Singapore Airlines',
    label: 'Test Airline',
    legs: [{
      flightNumber: 'SQ101',
      airlineCode: 'SQ',
      airlineName: 'Singapore Airlines',
      from: 'SIN',
      to: 'NRT',
      depIso: '2026-08-27T08:00:00+08:00',
      arrIso: '2026-08-27T16:00:00+09:00',
      durationMin: 420,
      aircraft: 'A350',
      cabin: 'Economy',
    }],
    layovers: [],
    depIso: '2026-08-27T08:00:00+08:00',
    arrIso: '2026-08-27T16:00:00+09:00',
    totalDurationMin: 420,
    stops: 0,
    minConnectionMin: null,
    fareDiffUsd: 50,
    baggagePieces: 1,
    baggageWeightKg: 23,
    seatsLeft: 5,
    otp: 0.9,
  };

  // Case 1: Deadline Boundary
  const onDeadline = { ...baseCandidate, id: 'c-deadline-exact', arrIso: '2026-08-28T12:00:00+09:00' };
  const afterDeadline = { ...baseCandidate, id: 'c-deadline-plus1s', arrIso: '2026-08-28T12:00:01+09:00' };
  const invalidDate = { ...baseCandidate, id: 'c-deadline-invalid', arrIso: 'not-a-date' };

  const resDeadline = applyHardConstraints([onDeadline, afterDeadline, invalidDate], ITINERARY);
  assert(resDeadline.survivors.length === 1, 'Exact deadline survives, +1s and invalid date pruned');
  assert(resDeadline.survivors[0].id === 'c-deadline-exact', 'Survivor is exact deadline');
  assert(resDeadline.prunedSummary.misses_deadline === 2, 'misses_deadline pruned exactly 2');

  // Case 2: Budget Boundary
  const onBudget = { ...baseCandidate, id: 'c-budget-exact', fareDiffUsd: 150.00 };
  const overBudget = { ...baseCandidate, id: 'c-budget-over', fareDiffUsd: 150.01 };

  const resBudget = applyHardConstraints([onBudget, overBudget], ITINERARY);
  assert(resBudget.survivors.length === 1, 'Exact budget ($150) survives, $150.01 pruned');
  assert(resBudget.survivors[0].id === 'c-budget-exact', 'Survivor is exact budget');
  assert(resBudget.prunedSummary.over_budget === 1, 'over_budget pruned exactly 1');

  // Case 3: Connection Time (MCT) Boundary
  const directNonstop = { ...baseCandidate, id: 'c-direct', stops: 0, minConnectionMin: null };
  const mctExact = {
    ...baseCandidate,
    id: 'c-mct-exact',
    stops: 1,
    minConnectionMin: 60,
    layovers: [{ airport: 'HKG', minutes: 60 }],
  };
  const mctShort = {
    ...baseCandidate,
    id: 'c-mct-short',
    stops: 1,
    minConnectionMin: 59,
    layovers: [{ airport: 'HKG', minutes: 59 }],
  };
  const mctConnectingNull = {
    ...baseCandidate,
    id: 'c-mct-null-connecting',
    stops: 1,
    minConnectionMin: null,
  };

  const resConn = applyHardConstraints([directNonstop, mctExact, mctShort, mctConnectingNull], ITINERARY);
  assert(resConn.survivors.length === 2, 'Direct nonstop and MCT 60 min survive; 59 min and null connecting pruned');
  assert(resConn.survivors.some(s => s.id === 'c-direct'), 'Direct flight survived');
  assert(resConn.survivors.some(s => s.id === 'c-mct-exact'), 'MCT 60m survived');
  assert(resConn.prunedSummary.unsafe_connection === 2, 'unsafe_connection pruned exactly 2');

  // Case 4: Baggage Boundary
  const baggageExact = { ...baseCandidate, id: 'c-bag-exact', baggagePieces: 1, baggageWeightKg: 23 };
  const baggageExtra = { ...baseCandidate, id: 'c-bag-extra', baggagePieces: 2, baggageWeightKg: 32 };
  const baggageNoPieces = { ...baseCandidate, id: 'c-bag-0pieces', baggagePieces: 0, baggageWeightKg: 23 };
  const baggageLowWeight = { ...baseCandidate, id: 'c-bag-low-weight', baggagePieces: 1, baggageWeightKg: 22 };

  const resBag = applyHardConstraints([baggageExact, baggageExtra, baggageNoPieces, baggageLowWeight], ITINERARY);
  assert(resBag.survivors.length === 2, 'Exact and extra baggage survive; 0 pieces and 22kg pruned');
  assert(resBag.prunedSummary.baggage_incompatible === 2, 'baggage_incompatible pruned exactly 2');

  // Case 5: Priority Order Attribution (First rule violated wins)
  const violatesAll = {
    ...baseCandidate,
    id: 'c-violates-all',
    arrIso: '2026-08-28T15:00:00+09:00', // violates deadline (rule 1)
    fareDiffUsd: 300,                     // violates budget (rule 2)
    stops: 1,
    minConnectionMin: 30,                 // violates connection (rule 3)
    baggagePieces: 0,                     // violates baggage (rule 4)
  };
  const resPriority = applyHardConstraints([violatesAll], ITINERARY);
  assert(resPriority.survivors.length === 0, 'Violates-all is pruned');
  assert(resPriority.prunedSummary.misses_deadline === 1, 'Violates-all attributed to misses_deadline (rule 1)');
  assert(resPriority.prunedSummary.over_budget === 0, 'No double-counting for over_budget');
  assert(resPriority.prunedSummary.unsafe_connection === 0, 'No double-counting for unsafe_connection');
  assert(resPriority.prunedSummary.baggage_incompatible === 0, 'No double-counting for baggage_incompatible');

  // Case 6: Live candidates through funnel
  const liveFunnelRes = applyHardConstraints(liveCandidates, ITINERARY);
  console.log('Live Atlas funnel results:', liveFunnelRes.prunedSummary);
  assert(liveFunnelRes.totalCandidates === liveCandidates.length, 'Total candidates match');
  assert(
    liveFunnelRes.survivors.length +
    liveFunnelRes.prunedSummary.misses_deadline +
    liveFunnelRes.prunedSummary.over_budget +
    liveFunnelRes.prunedSummary.unsafe_connection +
    liveFunnelRes.prunedSummary.baggage_incompatible === liveCandidates.length,
    'Funnel conservation law holds (survivors + pruned == total)',
  );
  assert(liveFunnelRes.survivors.length > 0, `At least 1 live candidate survived the funnel (${liveFunnelRes.survivors.length} survivors)`);

  console.log('Hard Constraints Funnel tests PASSED.');
  return liveFunnelRes.survivors;
}

function testOptimizerFormulasAndRanking(liveSurvivors) {
  console.log('\n========================================');
  console.log('TEST 4: Optimizer Mathematical Formulas & Ranking Verification');
  console.log('========================================');

  // Test recoveryScore mathematical formula directly with custom subscores:
  // R = 0.35*S_arr + 0.25*S_conn + 0.20*S_price + 0.10*S_bag + 0.10*S_risk
  const sampleSubScores = {
    arrival: 80.0,
    connection: 80.0,
    price: 80.0,
    baggage: 80.0,
    risk: 80.0,
  };
  const expectedR = 80.0;
  const actualR = recoveryScore(sampleSubScores);
  assert(actualR === expectedR, `recoveryScore formula linear combination matches: expected ${expectedR}, got ${actualR}`);

  const testWeights = {
    arrival: 100,
    connection: 0,
    price: 0,
    baggage: 0,
    risk: 0,
  };
  assert(recoveryScore(testWeights) === 35.0, 'Weight of arrival is 0.35');

  // Test live survivors ranked through optimizer
  const rankedLive = rankOptions(liveSurvivors, ITINERARY);
  console.log(`Ranked ${rankedLive.length} live survivor options:`);
  for (let i = 0; i < rankedLive.length; i++) {
    const opt = rankedLive[i];
    console.log(`  [Rank ${i + 1}] Label ${opt.label} (${opt.id}): ${opt.candidate.airlineName} | Score=${opt.recoveryScore} | Status=${opt.status}`);
    console.log(`      Subscores: arr=${opt.scores.arrival}, conn=${opt.scores.connection}, price=${opt.scores.price}, bag=${opt.scores.baggage}, risk=${opt.scores.risk}`);
    assert(typeof opt.recoveryScore === 'number' && !isNaN(opt.recoveryScore), `recoveryScore is valid number: ${opt.recoveryScore}`);
    assert(opt.recoveryScore >= 0 && opt.recoveryScore <= 100, `recoveryScore is within [0, 100]: ${opt.recoveryScore}`);
    assert(typeof opt.reason === 'string' && opt.reason.length > 0, `Option has non-empty reason string`);
    
    if (i > 0) {
      assert(rankedLive[i - 1].recoveryScore >= opt.recoveryScore, `Options are strictly sorted by recoveryScore descending (${rankedLive[i - 1].recoveryScore} >= ${opt.recoveryScore})`);
    }
  }

  if (rankedLive.length >= 1) {
    assert(rankedLive[0].label === 'B', `Rank 1 has label B`);
    assert(rankedLive[0].status === 'RECOMMENDED', `Rank 1 has status RECOMMENDED`);
    assert(rankedLive[0].id === 'opt_b', `Rank 1 has id opt_b`);
  }
  if (rankedLive.length >= 2) {
    assert(rankedLive[1].label === 'C', `Rank 2 has label C`);
    assert(rankedLive[1].status === 'SECONDARY', `Rank 2 has status SECONDARY`);
    assert(rankedLive[1].id === 'opt_c', `Rank 2 has id opt_c`);
  }
  if (rankedLive.length >= 3) {
    assert(rankedLive[2].label === 'A', `Rank 3 has label A`);
    assert(rankedLive[2].status === 'ALTERNATIVE', `Rank 3 has status ALTERNATIVE`);
    assert(rankedLive[2].id === 'opt_a', `Rank 3 has id opt_a`);
  }

  console.log('Optimizer Formulas & Ranking tests PASSED.');
}

async function testDemoModeRegressionResistance() {
  console.log('\n========================================');
  console.log('TEST 5: Demo Mode Regression Resistance & Invariant Verification');
  console.log('========================================');

  const demoProvider = new DemoProvider();
  
  const nonTargetCandidates = await demoProvider.searchFlights('JFK', 'LHR', '2026-08-27');
  assert(nonTargetCandidates.length === 0, 'Demo provider returns [] for non-SIN/NRT searches');

  const demoCandidates = await demoProvider.searchFlights('SIN', 'NRT', '2026-08-27');
  assert(demoCandidates.length === 42, `Demo provider returns exactly 42 candidates (got ${demoCandidates.length})`);

  for (let i = 0; i < 42; i++) {
    const idExpected = `cand-${String(i + 1).padStart(2, '0')}`;
    assert(demoCandidates[i].id === idExpected, `Demo candidate ${i + 1} ID is ${idExpected}`);
  }

  const funnelResult = applyHardConstraints(demoCandidates, ITINERARY);
  console.log('Demo funnel prune summary:', funnelResult.prunedSummary);
  assert(funnelResult.totalCandidates === 42, 'Demo total candidates is 42');
  assert(funnelResult.prunedSummary.misses_deadline === 0, 'Demo misses_deadline pruned = 0');
  assert(funnelResult.prunedSummary.over_budget === 12, 'Demo over_budget pruned = 12');
  assert(funnelResult.prunedSummary.unsafe_connection === 18, 'Demo unsafe_connection pruned = 18');
  assert(funnelResult.prunedSummary.baggage_incompatible === 9, 'Demo baggage_incompatible pruned = 9');
  assert(funnelResult.survivors.length === 3, `Demo survivors count is exactly 3 (got ${funnelResult.survivors.length})`);

  const rankedOptions = rankOptions(funnelResult.survivors, ITINERARY);
  assert(rankedOptions.length === 3, 'Ranked demo options count is 3');

  const [optB, optC, optA] = rankedOptions;

  console.log('Option B:', { score: optB.recoveryScore, scores: optB.scores, residualRisk: optB.residualRisk });
  console.log('Option C:', { score: optC.recoveryScore, scores: optC.scores, residualRisk: optC.residualRisk });
  console.log('Option A:', { score: optA.recoveryScore, scores: optA.scores, residualRisk: optA.residualRisk });

  // Finalist B check
  assert(optB.label === 'B', 'Rank 1 is Option B');
  assert(optB.id === 'opt_b', 'Rank 1 ID is opt_b');
  assert(optB.status === 'RECOMMENDED', 'Rank 1 status is RECOMMENDED');
  assert(optB.recoveryScore === 82.0, `Option B recoveryScore is exactly 82.0 (got ${optB.recoveryScore})`);

  // Finalist C check
  assert(optC.label === 'C', 'Rank 2 is Option C');
  assert(optC.id === 'opt_c', 'Rank 2 ID is opt_c');
  assert(optC.status === 'SECONDARY', 'Rank 2 status is SECONDARY');
  assert(optC.recoveryScore === 77.7, `Option C recoveryScore is exactly 77.7 (got ${optC.recoveryScore})`);

  // Finalist A check
  assert(optA.label === 'A', 'Rank 3 is Option A');
  assert(optA.id === 'opt_a', 'Rank 3 ID is opt_a');
  assert(optA.status === 'ALTERNATIVE', 'Rank 3 status is ALTERNATIVE');
  assert(optA.recoveryScore === 49.5, `Option A recoveryScore is exactly 49.5 (got ${optA.recoveryScore})`);

  for (let iter = 1; iter <= 5; iter++) {
    const iterCandidates = await demoProvider.searchFlights('SIN', 'NRT', '2026-08-27');
    const iterFunnel = applyHardConstraints(iterCandidates, ITINERARY);
    const iterRanked = rankOptions(iterFunnel.survivors, ITINERARY);
    assert(iterRanked[0].recoveryScore === 82.0, `Iteration ${iter} Option B score is 82.0`);
    assert(iterRanked[1].recoveryScore === 77.7, `Iteration ${iter} Option C score is 77.7`);
    assert(iterRanked[2].recoveryScore === 49.5, `Iteration ${iter} Option A score is 49.5`);
  }

  console.log('Demo Mode Regression Resistance tests PASSED.');
}

async function runAll() {
  console.log('================================================================');
  console.log('FLIGHTRESIST-AI M2 ADVERSARIAL VERIFICATION SUITE');
  console.log('================================================================');

  await testAtlasProbe();
  const liveCandidates = await testAtlasCandidateGenerationAndNormalization();
  const liveSurvivors = testHardConstraintsFunnelEdgeCases(liveCandidates);
  testOptimizerFormulasAndRanking(liveSurvivors);
  await testDemoModeRegressionResistance();

  console.log('\n================================================================');
  console.log(`ALL CHECKS PASSED: ${passedChecks}/${totalChecks} assertions verified successfully.`);
  console.log('================================================================');
}

runAll().catch((err) => {
  console.error('\n💥 ADVERSARIAL TEST SUITE FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
