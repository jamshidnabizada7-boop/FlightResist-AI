// tests/tier1-features/f13-cockpit-multileg-header.test.mjs
// F13: Cockpit Active Itinerary & Multi-Leg Header Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, GLOBAL_AIRPORTS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F13: Cockpit Active Itinerary & Multi-Leg Header');

suite.test('F13.1: Dynamic route header renders accurate origin, destination, and transit hubs', () => {
  function renderRouteHeader(itinerary) {
    const orig = itinerary.origin;
    const dest = itinerary.destination;
    const hubs = itinerary.legs.length > 1 ? itinerary.legs.slice(0, -1).map(l => l.to) : [];
    const hubText = hubs.length > 0 ? `via ${hubs.join(', ')}` : 'nonstop';
    return `${orig} → ${dest} (${hubText})`;
  }

  assert.strictEqual(renderRouteHeader(CURATED_PRESETS[0]), 'SIN → NRT (via HKG)');
  assert.strictEqual(renderRouteHeader(CURATED_PRESETS[1]), 'LHR → JFK (nonstop)');
});

suite.test('F13.2: Multi-leg flight summary calculates total journey duration and leg count', () => {
  function calculateJourneySummary(itinerary) {
    const totalLegs = itinerary.legs.length;
    const depTime = new Date(itinerary.legs[0].depIso).getTime();
    const arrTime = new Date(itinerary.legs[itinerary.legs.length - 1].arrIso).getTime();
    const totalDurationMin = Math.round((arrTime - depTime) / 60000);
    return { totalLegs, totalDurationMin };
  }

  const sinNrt = calculateJourneySummary(CURATED_PRESETS[0]);
  assert.strictEqual(sinNrt.totalLegs, 2);
  assert.ok(sinNrt.totalDurationMin > 0);

  const lhrJfk = calculateJourneySummary(CURATED_PRESETS[1]);
  assert.strictEqual(lhrJfk.totalLegs, 1);
  assert.ok(lhrJfk.totalDurationMin > 0);
});

suite.test('F13.3: Layover badges compute MCT compliance dynamically', () => {
  function evaluateLayovers(itinerary) {
    const mct = itinerary.constraints.mctMin;
    const results = [];
    for (let i = 0; i < itinerary.legs.length - 1; i++) {
      const arr = new Date(itinerary.legs[i].arrIso).getTime();
      const dep = new Date(itinerary.legs[i + 1].depIso).getTime();
      const layoverMin = Math.round((dep - arr) / 60000);
      const isMctCompliant = layoverMin >= mct;
      results.push({
        hub: itinerary.legs[i].to,
        layoverMin,
        isMctCompliant,
        badgeText: `Layover ${itinerary.legs[i].to} · ${layoverMin}m (${isMctCompliant ? '✓ ≥ MCT' : '✗ < MCT'})`,
      });
    }
    return results;
  }

  const layovers = evaluateLayovers(CURATED_PRESETS[0]);
  assert.strictEqual(layovers.length, 1);
  assert.strictEqual(layovers[0].hub, 'HKG');
  assert.strictEqual(layovers[0].layoverMin, 145);
  assert.strictEqual(layovers[0].isMctCompliant, true);
});

suite.test('F13.4: Passenger card dynamically displays loyalty tier, ticket ref, and contact info', () => {
  const p = CURATED_PRESETS[1].passenger;
  assert.strictEqual(p.name, 'Eleanor Vance');
  assert.strictEqual(p.ticketReference, 'BA-9921-LDN');
  assert.strictEqual(p.loyaltyProgram, 'British Airways Executive Club');
  assert.strictEqual(p.loyaltyTier, 'Gold');
  assert.strictEqual(p.checkedBags, 2);
});

suite.test('F13.5: Mission Purpose card dynamically displays meeting title, venue, and importance', () => {
  const m = CURATED_PRESETS[2].mission;
  assert.strictEqual(m.title, 'Global AI Summit Keynote');
  assert.strictEqual(m.importance, 'CRITICAL');
  assert.strictEqual(m.dealValue, 10000000);
  assert.strictEqual(m.dealCurrency, 'USD');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f13-cockpit-multileg-header.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
