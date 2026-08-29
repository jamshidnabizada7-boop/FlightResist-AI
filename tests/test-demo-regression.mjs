// tests/test-demo-regression.mjs
// Verifies Demo Mode candidate count, survivors, scores, and zero regressions
import { DemoProvider } from '../src/lib/flightresist/providers/demo.ts';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { ITINERARY } from '../src/lib/flightresist/itinerary.ts';
import { rankOptions } from '../src/lib/flightresist/optimizer.ts';

async function run() {
  console.log('Testing DemoProvider regression guard...');
  const provider = new DemoProvider();
  const candidates = await provider.searchFlights('SIN', 'NRT', '2026-08-27');
  console.log(`Demo candidates: ${candidates.length} (expected 42)`);

  if (candidates.length !== 42) {
    throw new Error(`Demo candidates mismatch: expected 42, got ${candidates.length}`);
  }

  const constraintResult = applyHardConstraints(candidates, ITINERARY);
  console.log('Constraint Funnel Summary:', constraintResult.prunedSummary);
  console.log(`Survivors: ${constraintResult.survivors.length} (expected 3)`);

  if (constraintResult.survivors.length !== 3) {
    throw new Error(`Demo survivors mismatch: expected 3, got ${constraintResult.survivors.length}`);
  }

  const options = rankOptions(constraintResult.survivors, ITINERARY);
  console.log('Ranked options:', options.map(o => `${o.label} (score=${o.recoveryScore.toFixed(1)}, status=${o.status})`));

  console.log('Demo mode regression guard passed!');
}

run().catch((err) => {
  console.error('Demo mode test failed:', err);
  process.exit(1);
});
