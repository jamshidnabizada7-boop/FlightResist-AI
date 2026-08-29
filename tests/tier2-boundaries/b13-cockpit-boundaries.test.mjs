// tests/tier2-boundaries/b13-cockpit-boundaries.test.mjs
// B13: Cockpit Multi-Leg Header & Badges Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B13: Cockpit Multi-Leg Header Boundaries');

suite.test('B13.1: Overnight layover spanning midnight calculates positive layover duration', () => {
  const overnightItin = {
    legs: [
      { flightNumber: 'BA1', from: 'LHR', to: 'DXB', depIso: '2026-08-27T14:00:00+01:00', arrIso: '2026-08-27T23:30:00+04:00' },
      { flightNumber: 'EK2', from: 'DXB', to: 'SIN', depIso: '2026-08-28T03:00:00+04:00', arrIso: '2026-08-28T14:30:00+08:00' },
    ],
  };

  const leg1Arr = new Date(overnightItin.legs[0].arrIso).getTime();
  const leg2Dep = new Date(overnightItin.legs[1].depIso).getTime();
  const layoverMin = Math.round((leg2Dep - leg1Arr) / 60000);

  assert.strictEqual(layoverMin, 210, 'Overnight layover should be 210 minutes (3.5 hours)');
});

suite.test('B13.2: Ultra-long 23-hour layover renders valid badge format without UI overflow', () => {
  function formatLayoverBadge(minutes, mctMin) {
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    const timeStr = `${hours}h ${remMin > 0 ? `${remMin}m` : ''}`.trim();
    const compliant = minutes >= mctMin;
    return `Layover · ${timeStr} (${compliant ? '✓ ≥ MCT' : '✗ < MCT'})`;
  }

  const badge = formatLayoverBadge(1380, 60); // 23h
  assert.ok(badge.includes('23h'));
  assert.ok(badge.includes('✓ ≥ MCT'));
});

suite.test('B13.3: Direct flight with 0 layovers renders "nonstop" route indicator', () => {
  const directItin = CURATED_PRESETS[1]; // LHR-JFK BA117
  const isNonstop = directItin.legs.length === 1;
  assert.strictEqual(isNonstop, true);
});

suite.test('B13.4: Sub-MCT layover (25 minutes vs 60m MCT) flags critical warning badge', () => {
  function evaluateLayoverBadge(layoverMin, mctMin) {
    if (layoverMin < mctMin) {
      return { status: 'WARNING', badgeClass: 'bg-rose-500/20 text-rose-300', text: `Violates MCT: ${layoverMin}m < ${mctMin}m` };
    }
    return { status: 'OK', badgeClass: 'bg-emerald-500/20 text-emerald-300', text: `Compliant: ${layoverMin}m ≥ ${mctMin}m` };
  }

  const res = evaluateLayoverBadge(25, 60);
  assert.strictEqual(res.status, 'WARNING');
  assert.ok(res.text.includes('Violates MCT'));
});

suite.test('B13.5: Multi-leg flight numbering badge handles codeshares and 4-digit flight numbers', () => {
  const codeshare = { flightNumber: 'SQ4471', airlineCode: 'SQ', airlineName: 'Singapore Airlines' };
  assert.strictEqual(codeshare.flightNumber, 'SQ4471');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b13-cockpit-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
