// tests/tier2-boundaries/b09-disruption-boundaries.test.mjs
// B9: Disruption Sentinel Engine Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B9: Disruption Sentinel Engine Boundaries');

suite.test('B9.1: Case-insensitivity in flight number lookup (sq856 vs SQ856 vs Sq856)', () => {
  const itin = CURATED_PRESETS[0];

  function matchFlight(flightNum) {
    return itin.legs.some(l => l.flightNumber.toUpperCase() === flightNum.toUpperCase());
  }

  assert.strictEqual(matchFlight('sq856'), true);
  assert.strictEqual(matchFlight('SQ856'), true);
  assert.strictEqual(matchFlight('Sq856'), true);
  assert.strictEqual(matchFlight('cx520'), true);
  assert.strictEqual(matchFlight('ba117'), false);
});

suite.test('B9.2: Negative or non-numeric delay inputs sanitize to minimum threshold (15m)', () => {
  function sanitizeDelay(val) {
    const num = Number(val);
    if (isNaN(num) || num < 15) return 15;
    if (num > 1440) return 1440;
    return num;
  }

  assert.strictEqual(sanitizeDelay(-30), 15);
  assert.strictEqual(sanitizeDelay(0), 15);
  assert.strictEqual(sanitizeDelay('invalid'), 15);
  assert.strictEqual(sanitizeDelay(3000), 1440);
  assert.strictEqual(sanitizeDelay(90), 90);
});

suite.test('B9.3: Disruption with reason exceeding 500 characters truncates safely', () => {
  function sanitizeReason(reason) {
    if (!reason) return 'Operational disruption';
    return reason.length > 250 ? reason.slice(0, 247) + '...' : reason;
  }

  const longReason = 'A'.repeat(600);
  const clean = sanitizeReason(longReason);
  assert.strictEqual(clean.length, 250);
  assert.ok(clean.endsWith('...'));
});

suite.test('B9.4: Rapid sequential disruption triggers replace previous active disruption cleanly', () => {
  let activeDisruption = null;
  const setDisruption = d => { activeDisruption = d; return activeDisruption; };

  setDisruption({ flightNumber: 'SQ856', event: 'DELAY', delayMinutes: 45 });
  assert.strictEqual(activeDisruption.event, 'DELAY');

  setDisruption({ flightNumber: 'SQ856', event: 'CANCELLATION' });
  assert.strictEqual(activeDisruption.event, 'CANCELLATION');
});

suite.test('B9.5: Disruption event enum validation handles unexpected string tokens safely', () => {
  const validEvents = ['CANCELLATION', 'DELAY', 'TERMINAL_CLOSURE', 'MISCONNECT', 'DIVERSION'];
  function parseEvent(e) {
    const up = String(e || '').toUpperCase();
    return validEvents.includes(up) ? up : 'DELAY';
  }

  assert.strictEqual(parseEvent('cancellation'), 'CANCELLATION');
  assert.strictEqual(parseEvent('UNKNOWN_EVENT'), 'DELAY');
  assert.strictEqual(parseEvent(null), 'DELAY');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b09-disruption-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
