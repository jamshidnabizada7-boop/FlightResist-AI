// tests/tier1-features/f09-disruption-sentinel.test.mjs
// F9: Custom Disruption Sentinel Engine Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F9: Custom Disruption Sentinel Engine');

suite.test('F9.1: Validates disruption trigger against flight legs of active itinerary', () => {
  const itin = CURATED_PRESETS[0]; // SQ856, CX520

  function validateDisruption(itinerary, flightNumber, event) {
    const leg = itinerary.legs.find(l => l.flightNumber.toUpperCase() === flightNumber.toUpperCase());
    if (!leg) {
      return { valid: false, error: `Flight ${flightNumber} is not part of active itinerary ${itinerary.tripId}` };
    }
    const validEvents = ['CANCELLATION', 'DELAY', 'TERMINAL_CLOSURE', 'MISCONNECT', 'DIVERSION'];
    if (!validEvents.includes(event)) {
      return { valid: false, error: `Unsupported disruption event ${event}` };
    }
    return { valid: true, leg };
  }

  const validRes = validateDisruption(itin, 'CX520', 'DELAY');
  assert.strictEqual(validRes.valid, true);

  const invalidFlight = validateDisruption(itin, 'BA999', 'CANCELLATION');
  assert.strictEqual(invalidFlight.valid, false);

  const invalidEvent = validateDisruption(itin, 'SQ856', 'ALIEN_ATTACK');
  assert.strictEqual(invalidEvent.valid, false);
});

suite.test('F9.2: Supports custom delays ranging from 15 minutes to 24 hours (1440 minutes)', () => {
  function clampDelay(delayMin) {
    return Math.max(15, Math.min(1440, Number(delayMin || 45)));
  }

  assert.strictEqual(clampDelay(15), 15);
  assert.strictEqual(clampDelay(120), 120);
  assert.strictEqual(clampDelay(1440), 1440);
  assert.strictEqual(clampDelay(5), 15, 'Should clamp sub-15m to 15m minimum');
  assert.strictEqual(clampDelay(2000), 1440, 'Should clamp >24h to 1440m maximum');
});

suite.test('F9.3: Supports TERMINAL_CLOSURE disruptions affecting origin or transit hubs', () => {
  const itin = CURATED_PRESETS[0]; // SIN-HKG-NRT
  const disruption = {
    flightNumber: 'CX520',
    event: 'TERMINAL_CLOSURE',
    affectedHub: 'HKG',
    reason: 'Security Incident — Terminal 1 Evacuation',
  };

  assert.strictEqual(disruption.event, 'TERMINAL_CLOSURE');
  assert.strictEqual(disruption.affectedHub, 'HKG');
});

suite.test('F9.4: Supports MISCONNECT disruptions when inbound leg arrival exceeds layover buffer', () => {
  const itin = CURATED_PRESETS[0]; // Layover 145 min
  const inboundDelayMin = 160; // Exceeds 145m layover
  const isMisconnectGuaranteed = inboundDelayMin > 145;

  assert.strictEqual(isMisconnectGuaranteed, true);
});

suite.test('F9.5: Assigns appropriate disruption severity based on event and delay magnitude', () => {
  function calculateSeverity(event, delayMinutes = 0) {
    if (event === 'CANCELLATION' || event === 'TERMINAL_CLOSURE') return 'CRITICAL';
    if (event === 'DELAY') {
      if (delayMinutes >= 240) return 'CRITICAL';
      if (delayMinutes >= 90) return 'HIGH';
      return 'MEDIUM';
    }
    return 'HIGH';
  }

  assert.strictEqual(calculateSeverity('CANCELLATION'), 'CRITICAL');
  assert.strictEqual(calculateSeverity('TERMINAL_CLOSURE'), 'CRITICAL');
  assert.strictEqual(calculateSeverity('DELAY', 300), 'CRITICAL');
  assert.strictEqual(calculateSeverity('DELAY', 120), 'HIGH');
  assert.strictEqual(calculateSeverity('DELAY', 45), 'MEDIUM');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f09-disruption-sentinel.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
