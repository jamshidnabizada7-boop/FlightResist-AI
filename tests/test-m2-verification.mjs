// tests/test-m2-verification.mjs
// Verifies Atlas candidate generation, metadata enrichment, and date normalization
import { AtlasSandboxProvider } from '../src/lib/flightresist/providers/atlas-sandbox.ts';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { ITINERARY } from '../src/lib/flightresist/itinerary.ts';
import { getDynamicSearchDate } from '../src/lib/utils.ts';

async function run() {
  console.log('Testing AtlasSandboxProvider candidate generation & normalization...');
  const provider = new AtlasSandboxProvider();
  const searchDate = getDynamicSearchDate();
  console.log(`Using search date: ${searchDate}`);
  
  const candidates = await provider.searchFlights('SIN', 'NRT', searchDate);
  console.log(`Retrieved ${candidates.length} candidates.`);

  if (candidates.length === 0) {
    throw new Error('Atlas search returned 0 candidates!');
  }

  // Check candidate structure and normalization
  for (const c of candidates) {
    console.log(`Candidate ${c.id}: ${c.label} (${c.depIso} -> ${c.arrIso}) fareDiff=$${c.fareDiffUsd} bookable=${c.metadata?.bookable} priceStatus=${c.metadata?.priceStatus}`);
    
    // Verify ISO dates start with 2026-08-27 or 2026-08-28
    if (!c.depIso.startsWith('2026-08-27') && !c.depIso.startsWith('2026-08-28')) {
      throw new Error(`Candidate depIso not normalized to DAY0/DAY1: ${c.depIso}`);
    }
    if (!c.arrIso.startsWith('2026-08-27') && !c.arrIso.startsWith('2026-08-28') && !c.arrIso.startsWith('2026-08-29')) {
      throw new Error(`Candidate arrIso not normalized: ${c.arrIso}`);
    }
    if (!c.metadata) {
      throw new Error(`Candidate missing metadata: ${c.id}`);
    }
  }

  // Run through hard constraints funnel
  const constraintResult = applyHardConstraints(candidates, ITINERARY);
  console.log('Constraint Funnel Results:');
  console.log(`  Total: ${constraintResult.totalCandidates}`);
  console.log(`  Survivors: ${constraintResult.survivors.length}`);
  console.log('  Pruned Summary:', constraintResult.prunedSummary);

  console.log('M2 candidate generation & normalization verified successfully!');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
