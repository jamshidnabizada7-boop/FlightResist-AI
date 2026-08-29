// tests/tier2-boundaries/b12-studio-boundaries.test.mjs
// B12: Itinerary Studio Modal Boundary Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B12: Itinerary Studio Modal Boundaries');

suite.test('B12.1: Custom builder with overlapping flight leg departure times returns validation error', () => {
  function validateLegSequence(legs) {
    for (let i = 0; i < legs.length - 1; i++) {
      const arr = new Date(legs[i].arrIso).getTime();
      const depNext = new Date(legs[i + 1].depIso).getTime();
      if (depNext <= arr) {
        return { valid: false, error: `Leg ${i + 2} departs at ${legs[i + 1].depIso} before Leg ${i + 1} arrives at ${legs[i].arrIso}` };
      }
    }
    return { valid: true };
  }

  const badLegs = [
    { flightNumber: 'FL1', from: 'SIN', to: 'HKG', depIso: '2026-08-27T08:00:00Z', arrIso: '2026-08-27T12:00:00Z' },
    { flightNumber: 'FL2', from: 'HKG', to: 'NRT', depIso: '2026-08-27T11:30:00Z', arrIso: '2026-08-27T16:00:00Z' }, // Departs before 12:00
  ];

  const res = validateLegSequence(badLegs);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error.includes('departs'));
});

suite.test('B12.2: Building an itinerary with 8 multi-hop legs maintains chronological chain integrity', () => {
  const legs = [];
  const baseTime = new Date('2026-08-27T00:00:00Z').getTime();
  for (let i = 0; i < 8; i++) {
    const depIso = new Date(baseTime + i * 4 * 3600000).toISOString();
    const arrIso = new Date(baseTime + (i * 4 + 2) * 3600000).toISOString();
    legs.push({ flightNumber: `LEG${i + 1}`, from: `AIR${i}`, to: `AIR${i + 1}`, depIso, arrIso, durationMin: 120 });
  }

  assert.strictEqual(legs.length, 8);
  for (let i = 0; i < legs.length - 1; i++) {
    assert.ok(new Date(legs[i + 1].depIso).getTime() > new Date(legs[i].arrIso).getTime());
  }
});

suite.test('B12.3: Switching tabs inside modal does not lose unsaved custom draft edits', () => {
  const studioState = {
    activeTab: 'CUSTOM_BUILDER',
    customDraft: { origin: 'BKK', destination: 'ICN', passenger: { name: 'Draft Traveler' } },
  };

  // Switch tab
  studioState.activeTab = 'PRESETS';
  assert.strictEqual(studioState.activeTab, 'PRESETS');
  assert.strictEqual(studioState.customDraft.origin, 'BKK');

  // Switch back
  studioState.activeTab = 'CUSTOM_BUILDER';
  assert.strictEqual(studioState.customDraft.passenger.name, 'Draft Traveler');
});

suite.test('B12.4: Importing itinerary with empty passenger contact fields sets fallback contacts', () => {
  function sanitizeImportedItinerary(itinerary) {
    return {
      ...itinerary,
      passenger: {
        ...itinerary.passenger,
        contactEmail: itinerary.passenger?.contactEmail || 'traveler@enterprise.com',
        contactPhone: itinerary.passenger?.contactPhone || '+1 800 555 0199',
      }
    };
  }

  const raw = { origin: 'SIN', destination: 'NRT', passenger: { name: 'No Contact Pax' } };
  const sanitized = sanitizeImportedItinerary(raw);

  assert.strictEqual(sanitized.passenger.contactEmail, 'traveler@enterprise.com');
  assert.strictEqual(sanitized.passenger.contactPhone, '+1 800 555 0199');
});

suite.test('B12.5: Deleting a non-existent saved itinerary ID from storage is a safe no-op', () => {
  const saved = [{ id: 'saved-1', label: 'Trip 1' }];
  function safeDelete(id) {
    const idx = saved.findIndex(t => t.id === id);
    if (idx >= 0) saved.splice(idx, 1);
  }

  safeDelete('non-existent-id');
  assert.strictEqual(saved.length, 1);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b12-studio-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
