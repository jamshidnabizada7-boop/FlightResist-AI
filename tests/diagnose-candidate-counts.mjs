// tests/diagnose-candidate-counts.mjs
// Exhaustive diagnosis script for Candidate Generation Invariant across all global airports

import { generateRouteCandidates } from '../src/lib/flightresist/route-generator.ts';
import { GLOBAL_AIRPORTS } from '../src/lib/flightresist/airports-data.ts';

const airports = Object.keys(GLOBAL_AIRPORTS);
console.log(`Analyzing candidate generator across ${airports.length} airports (${airports.length * (airports.length - 1)} pairs)...`);

const failedPairs = [];
const countDistribution = {};

for (let i = 0; i < airports.length; i++) {
  for (let j = 0; j < airports.length; j++) {
    if (i === j) continue;
    const origin = airports[i];
    const destination = airports[j];

    const cands = generateRouteCandidates({
      origin,
      destination,
      travelDateIso: '2026-08-27',
    });

    const count = cands.length;
    countDistribution[count] = (countDistribution[count] || 0) + 1;

    if (count < 35 || count > 45) {
      failedPairs.push({ origin, destination, count });
    }
  }
}

console.log('Count Distribution:', countDistribution);
console.log(`Total pairs tested: ${airports.length * (airports.length - 1)}`);
console.log(`Total failing pairs: ${failedPairs.length}`);

if (failedPairs.length > 0) {
  console.log('\nSample Failing Pairs:');
  failedPairs.slice(0, 20).forEach(p => {
    console.log(`  ${p.origin} -> ${p.destination}: ${p.count} candidates`);
  });
}
