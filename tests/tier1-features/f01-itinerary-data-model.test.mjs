// tests/tier1-features/f01-itinerary-data-model.test.mjs
// F1: Multi-Leg Custom Itinerary Data Model Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('F1: Multi-Leg Custom Itinerary Data Model');

suite.test('F1.1: Custom Itinerary structure includes required root fields', () => {
  const itin = CURATED_PRESETS[0];
  assert.ok(itin.tripId, 'Trip ID must be defined');
  assert.ok(itin.origin, 'Origin must be defined');
  assert.ok(itin.destination, 'Destination must be defined');
  assert.ok(itin.travelDateIso, 'Travel date ISO must be defined');
  assert.ok(Array.isArray(itin.legs), 'Legs must be an array');
  assert.ok(itin.legs.length >= 1, 'Must have at least 1 leg');
  assert.ok(itin.passenger, 'Passenger profile must be defined');
  assert.ok(itin.constraints, 'Trip constraints must be defined');
});

suite.test('F1.2: Multi-leg flight segments enforce timeline sequence & connectivity', () => {
  const sinNrt = CURATED_PRESETS.find(p => p.tripId === 'TRIP-SIN-NRT-2026');
  assert.strictEqual(sinNrt.legs.length, 2, 'SIN-NRT should have 2 legs');
  
  const [leg1, leg2] = sinNrt.legs;
  assert.strictEqual(leg1.from, 'SIN');
  assert.strictEqual(leg1.to, 'HKG');
  assert.strictEqual(leg2.from, 'HKG');
  assert.strictEqual(leg2.to, 'NRT');
  
  const leg1Arr = new Date(leg1.arrIso).getTime();
  const leg2Dep = new Date(leg2.depIso).getTime();
  assert.ok(leg2Dep > leg1Arr, 'Leg 2 departure must be strictly after Leg 1 arrival');
  
  const layoverMin = (leg2Dep - leg1Arr) / 60000;
  assert.strictEqual(layoverMin, 145, 'Layover in HKG should be 145 minutes');
});

suite.test('F1.3: PassengerProfile contains rich enterprise travel fields', () => {
  for (const preset of CURATED_PRESETS) {
    const p = preset.passenger;
    assert.ok(p.name && p.name.length > 0, 'Passenger name is required');
    assert.ok(p.ticketReference && p.ticketReference.length > 0, 'Ticket reference is required');
    assert.ok(p.loyaltyProgram, 'Loyalty program is required');
    assert.ok(p.loyaltyTier, 'Loyalty tier is required');
    assert.ok(p.nationality, 'Nationality is required');
    assert.ok(p.contactEmail && p.contactEmail.includes('@'), 'Valid email is required');
    assert.ok(p.contactPhone, 'Contact phone is required');
    assert.ok(typeof p.checkedBags === 'number' && p.checkedBags >= 0, 'Checked bags count is valid');
  }
});

suite.test('F1.4: MissionContext represents deal value, importance, and deadlines', () => {
  const lhrJfk = CURATED_PRESETS.find(p => p.tripId === 'TRIP-LHR-JFK-2026');
  assert.ok(lhrJfk.mission, 'MissionContext must exist');
  assert.strictEqual(lhrJfk.mission.importance, 'CRITICAL');
  assert.strictEqual(lhrJfk.mission.dealValue, 180000000);
  assert.strictEqual(lhrJfk.mission.dealCurrency, 'USD');
  assert.ok(lhrJfk.mission.venue.includes('Manhattan'));
  assert.ok(new Date(lhrJfk.mission.deadlineIso).getTime() > new Date(lhrJfk.legs[0].arrIso).getTime(), 'Mission deadline must be after planned arrival');
});

suite.test('F1.5: TripConstraints enforces hard limits for budget, MCT, and baggage', () => {
  const preset = CURATED_PRESETS[1];
  const c = preset.constraints;
  assert.ok(typeof c.budgetUsd === 'number' && c.budgetUsd > 0, 'Budget ceiling must be positive');
  assert.ok(typeof c.mctMin === 'number' && c.mctMin >= 30, 'MCT floor must be at least 30m');
  assert.ok(c.arrivalDeadlineIso, 'Arrival deadline must be set');
  assert.ok(c.hardArrivalLimitIso, 'Hard arrival limit must be set');
  assert.ok(new Date(c.hardArrivalLimitIso).getTime() >= new Date(c.arrivalDeadlineIso).getTime(), 'Hard limit must be >= soft deadline');
  assert.ok(c.baggagePieces >= 0 && c.baggageWeightKg >= 0, 'Baggage allowances must be non-negative');
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('f01-itinerary-data-model.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
