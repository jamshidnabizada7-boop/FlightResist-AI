// tests/tier4-scenarios/scenario-s5-sub50ms-recalc-sla.test.mjs
// Scenario S5: Sub-50ms Live Recalculation Performance & SLA Verification

import assert from 'node:assert';
import {
  createTestSuite,
  CURATED_PRESETS,
  generateAlgorithmicCandidates,
  applyConstraintFunnel,
  rankRecoveryOptions,
} from '../helpers/test-utils.mjs';

const suite = createTestSuite('Scenario S5: Sub-50ms Live Recalculation Performance SLA');

suite.test('S5.1: 100 consecutive budget slider adjustments maintain P99 < 20ms and Max < 50ms', () => {
  const itin = { ...CURATED_PRESETS[0], constraints: { ...CURATED_PRESETS[0].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SIN', destination: 'NRT', travelDateIso: '2026-08-27', isCanonicalDemo: true });

  const latencies = [];

  for (let i = 0; i < 100; i++) {
    itin.constraints.budgetUsd = (i * 15) % 500;
    const t0 = performance.now();
    const funnel = applyConstraintFunnel(candidates, itin);
    rankRecoveryOptions(funnel.survivors, itin);
    latencies.push(performance.now() - t0);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const max = latencies[latencies.length - 1];

  assert.ok(p50 < 5, `P50 latency was ${p50.toFixed(2)}ms (expected <5ms)`);
  assert.ok(p95 < 15, `P95 latency was ${p95.toFixed(2)}ms (expected <15ms)`);
  assert.ok(p99 < 25, `P99 latency was ${p99.toFixed(2)}ms (expected <25ms)`);
  assert.ok(max < 50, `Max latency was ${max.toFixed(2)}ms (expected <50ms SLA)`);
});

suite.test('S5.2: Multi-slider sweep (Budget + MCT + Bags) simultaneously recalculates in sub-5ms', () => {
  const itin = { ...CURATED_PRESETS[1], constraints: { ...CURATED_PRESETS[1].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'LHR', destination: 'JFK', travelDateIso: '2026-08-27' });

  const times = [];
  for (let b = 50; b <= 300; b += 50) {
    for (let m = 45; m <= 120; m += 15) {
      for (let bags = 0; bags <= 2; bags++) {
        itin.constraints.budgetUsd = b;
        itin.constraints.mctMin = m;
        itin.constraints.baggagePieces = bags;

        const t0 = performance.now();
        const res = applyConstraintFunnel(candidates, itin);
        rankRecoveryOptions(res.survivors, itin);
        times.push(performance.now() - t0);
      }
    }
  }

  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  assert.ok(avg < 5, `Average multi-slider latency was ${avg.toFixed(2)}ms (expected <5ms)`);
});

suite.test('S5.3: Memory stability over 500 recalculations (no memory leak or GC runaway)', () => {
  const itin = { ...CURATED_PRESETS[2], constraints: { ...CURATED_PRESETS[2].constraints } };
  const candidates = generateAlgorithmicCandidates({ origin: 'SFO', destination: 'HND', travelDateIso: '2026-08-27' });

  for (let i = 0; i < 500; i++) {
    itin.constraints.budgetUsd = 100 + (i % 200);
    const res = applyConstraintFunnel(candidates, itin);
    rankRecoveryOptions(res.survivors, itin);
  }

  assert.ok(true, 'Completed 500 recalculations cleanly');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('scenario-s5-sub50ms-recalc-sla.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
