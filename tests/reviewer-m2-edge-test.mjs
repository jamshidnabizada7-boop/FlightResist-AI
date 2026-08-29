// tests/reviewer-m2-edge-test.mjs
// Edge case and adversarial stress testing for Reviewer M2-1
import { generateRouteCandidates } from '../src/lib/flightresist/route-generator.ts';
import { DemoProvider } from '../src/lib/flightresist/providers/demo.ts';
import { calculateDistanceKm, calculateFlightDurationMin, getAirport } from '../src/lib/flightresist/airports-data.ts';
import { getAirline, getAirlinesForRoute } from '../src/lib/flightresist/airlines-data.ts';
import assert from 'node:assert';

console.log('=== REVIEWER M2-1 ADVERSARIAL STRESS SUITE ===');

// 1. Geodesic & Duration Tests
const dist1 = calculateDistanceKm(51.47, -0.4543, 40.6413, -73.7781); // LHR - JFK
assert.ok(dist1 >= 5400 && dist1 <= 5700, `LHR-JFK distance out of range: ${dist1}`);
console.log(`✓ LHR-JFK Distance: ${dist1} km`);

const distObject = calculateDistanceKm({ lat: 51.47, lon: -0.4543 }, { lat: 40.6413, lon: -73.7781 });
assert.strictEqual(distObject, dist1, 'Object overload produces identical distance');
console.log(`✓ Object overload matches numeric overload`);

const dur = calculateFlightDurationMin(dist1);
assert.ok(dur >= 420 && dur <= 480, `LHR-JFK duration out of range: ${dur}`);
console.log(`✓ LHR-JFK Flight duration: ${dur} min (${(dur/60).toFixed(1)}h)`);

// 2. Transpacific and Intercontinental Hub Topological Routing
const pairs = [
  { from: 'LHR', to: 'JFK', date: '2026-09-15' },
  { from: 'SFO', to: 'HND', date: '2026-10-01' },
  { from: 'SYD', to: 'LAX', date: '2026-11-20' },
  { from: 'DXB', to: 'CDG', date: '2026-12-05' },
  { from: 'FRA', to: 'SIN', date: '2027-01-15' },
  { from: 'PER', to: 'LHR', date: '2026-08-30' },
];

for (const pair of pairs) {
  const cands = generateRouteCandidates({ origin: pair.from, destination: pair.to, travelDateIso: pair.date });
  assert.ok(cands.length >= 35 && cands.length <= 45, `Candidates count for ${pair.from}-${pair.to} is ${cands.length} (expected 35-45)`);
  
  // Verify all timestamps
  for (const c of cands) {
    assert.ok(c.depIso.startsWith(pair.date), `depIso should start with ${pair.date}, got ${c.depIso}`);
    const depT = new Date(c.depIso).getTime();
    const arrT = new Date(c.arrIso).getTime();
    assert.ok(arrT > depT, `arrIso (${c.arrIso}) must be after depIso (${c.depIso})`);
    
    // Check layover consistency
    if (c.stops > 0) {
      assert.strictEqual(c.legs.length, 2, '1-stop flight must have 2 legs');
      const leg1Arr = new Date(c.legs[0].arrIso).getTime();
      const leg2Dep = new Date(c.legs[1].depIso).getTime();
      assert.ok(leg2Dep >= leg1Arr, `Leg 2 departure must be >= Leg 1 arrival: ${c.legs[1].depIso} vs ${c.legs[0].arrIso}`);
      assert.strictEqual(c.layovers.length, 1, 'Must have 1 layover');
      assert.ok(c.layovers[0].minutes >= 0, 'Layover minutes >= 0');
    }
  }

  // Check bucket distribution
  const overBudget = cands.filter(c => c.fixtureClass === 'over_budget').length;
  const unsafeConn = cands.filter(c => c.fixtureClass === 'unsafe_connection').length;
  const bagIncompat = cands.filter(c => c.fixtureClass === 'baggage_incompatible').length;
  const finalists = cands.filter(c => c.fixtureClass === 'finalist').length;

  console.log(`✓ ${pair.from} → ${pair.to} (${pair.date}): ${cands.length} cands [Budget=${overBudget}, MCT=${unsafeConn}, Bag=${bagIncompat}, Final=${finalists}]`);
}

// 3. Boundary & Extreme Cases
const sameOriginDest = generateRouteCandidates({ origin: 'SIN', destination: 'SIN' });
assert.strictEqual(sameOriginDest.length, 0, 'Same origin and destination yields 0 candidates');
console.log('✓ Same origin-destination gracefully returns []');

const emptyOrigin = generateRouteCandidates({ origin: '', destination: 'NRT' });
assert.strictEqual(emptyOrigin.length, 0, 'Empty origin yields 0 candidates');
console.log('✓ Empty origin gracefully returns []');

const unknownAirports = generateRouteCandidates({ origin: 'XYZ', destination: 'ABC', travelDateIso: '2026-09-01' });
assert.ok(unknownAirports.length >= 35, `Unknown airports synthesizes candidates: got ${unknownAirports.length}`);
console.log(`✓ Unknown airport pair XYZ → ABC synthesizes ${unknownAirports.length} candidates with fallback metadata`);

// 4. DemoProvider Lifecycle Simulation for Non-SIN-NRT
const demo = new DemoProvider();
const results = await demo.searchFlights('DXB', 'CDG', '2026-10-15');
assert.ok(results.length >= 35, `DemoProvider search returned ${results.length} candidates for DXB-CDG`);

const sampleFare = results[0].fareKey;
const verifiedFare = await demo.verifyFare(sampleFare);
assert.strictEqual(verifiedFare.valid, true, 'Verified fare valid is true');
assert.strictEqual(verifiedFare.currency, 'USD', 'Currency is USD');

const order = await demo.createAndPayOrder(sampleFare, { name: 'Dr. Jane Doe', email: 'jane@example.com' });
assert.ok(order.orderId.startsWith('ORD-DEMO-'), `OrderId format: ${order.orderId}`);
assert.ok(order.demoReference.startsWith('SIM-REV-'), `DemoReference format: ${order.demoReference}`);
assert.strictEqual(order.pnr, null, 'Demo order PNR is strictly null (never fabricates PNR)');
assert.strictEqual(order.status, 'SIMULATED', 'Order status is SIMULATED');
console.log(`✓ DemoProvider end-to-end booking simulation verified: ${order.orderId} (${order.demoReference})`);

console.log('\n=== ALL REVIEWER M2-1 ADVERSARIAL CHECKS PASSED (100%) ===');
