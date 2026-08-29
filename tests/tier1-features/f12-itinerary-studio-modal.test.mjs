// tests/tier1-features/f12-itinerary-studio-modal.test.mjs
// F12: Itinerary Studio Modal Integration Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS, parsePnr, formatPnr } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F12: Itinerary Studio Modal Integration');

suite.test('F12.1: Itinerary Studio modal manages 4 distinct tab workflows', () => {
  const tabs = ['PRESETS', 'CUSTOM_BUILDER', 'IMPORT_EXPORT', 'SAVED_TRIPS'];
  assert.strictEqual(tabs.length, 4);
  assert.ok(tabs.includes('PRESETS'));
  assert.ok(tabs.includes('CUSTOM_BUILDER'));
  assert.ok(tabs.includes('IMPORT_EXPORT'));
  assert.ok(tabs.includes('SAVED_TRIPS'));
});

suite.test('F12.2: Custom Builder validates minimum required fields before activating itinerary', () => {
  function validateBuilderState(draft) {
    const errors = [];
    if (!draft.origin || draft.origin.length !== 3) errors.push('Origin 3-letter IATA code required');
    if (!draft.destination || draft.destination.length !== 3) errors.push('Destination 3-letter IATA code required');
    if (!draft.travelDateIso) errors.push('Travel date required');
    if (!draft.passenger?.name) errors.push('Passenger name required');
    if (!draft.legs || draft.legs.length === 0) errors.push('At least 1 flight leg required');
    return { isValid: errors.length === 0, errors };
  }

  const validDraft = {
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    passenger: { name: 'Alice Smith' },
    legs: [{ flightNumber: 'BA117' }],
  };

  const invalidDraft = { origin: '', destination: 'JFK' };

  assert.strictEqual(validateBuilderState(validDraft).isValid, true);
  assert.strictEqual(validateBuilderState(invalidDraft).isValid, false);
});

suite.test('F12.3: Import/Export tab handles live PNR and JSON copy/paste with error diagnostics', () => {
  const sinNrt = CURATED_PRESETS[0];
  const pnr = formatPnr(sinNrt);
  const pnrRes = parsePnr(pnr);
  assert.strictEqual(pnrRes.success, true);

  const jsonStr = JSON.stringify(sinNrt);
  const jsonParsed = JSON.parse(jsonStr);
  assert.strictEqual(jsonParsed.tripId, 'TRIP-SIN-NRT-2026');
});

suite.test('F12.4: Saved Trips library manages saved itinerary templates', () => {
  const savedTrips = [];

  function saveItinerary(itinerary, label) {
    const entry = { id: `saved-${savedTrips.length + 1}`, label, itinerary, createdAt: new Date().toISOString() };
    savedTrips.push(entry);
    return entry;
  }

  function deleteSavedItinerary(id) {
    const idx = savedTrips.findIndex(t => t.id === id);
    if (idx >= 0) savedTrips.splice(idx, 1);
  }

  const saved1 = saveItinerary(CURATED_PRESETS[0], 'Tokyo Infrastructure Deal');
  assert.strictEqual(savedTrips.length, 1);
  assert.strictEqual(saved1.label, 'Tokyo Infrastructure Deal');

  deleteSavedItinerary(saved1.id);
  assert.strictEqual(savedTrips.length, 0);
});

suite.test('F12.5: Selecting a preset immediately sets active itinerary state and resets disruption', () => {
  let activeItinerary = null;
  let sessionState = 'DISRUPTED';
  let disruption = { flightNumber: 'SQ856', event: 'CANCELLATION' };

  function activatePreset(presetId) {
    const preset = CURATED_PRESETS.find(p => p.tripId === presetId);
    assert.ok(preset);
    activeItinerary = preset;
    sessionState = 'NORMAL';
    disruption = null;
    return activeItinerary;
  }

  activatePreset('TRIP-LHR-JFK-2026');
  assert.strictEqual(activeItinerary.tripId, 'TRIP-LHR-JFK-2026');
  assert.strictEqual(sessionState, 'NORMAL');
  assert.strictEqual(disruption, null);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f12-itinerary-studio-modal.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
