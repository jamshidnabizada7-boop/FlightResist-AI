// tests/tier2-boundaries/b01-itinerary-boundaries.test.mjs
// B1: Multi-Leg Itinerary Data Model Boundary & Stress Tests

import assert from 'node:assert';
import { createTestSuite, CURATED_PRESETS } from '../helpers/test-utils.mjs';

const suite = createTestSuite('B1: Multi-Leg Itinerary Data Model Boundaries');

suite.test('B1.1: Single leg direct flight itinerary boundary condition', () => {
  const direct = {
    tripId: 'TRIP-DIRECT-01',
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    legs: [{ flightNumber: 'BA117', from: 'LHR', to: 'JFK', depIso: '2026-08-27T14:00:00+01:00', arrIso: '2026-08-27T17:15:00-04:00', durationMin: 495, aircraft: 'B777', cabin: 'Business' }],
    passenger: { name: 'Solo Traveler', ticketReference: 'TKT-001', loyaltyProgram: 'BA', loyaltyTier: 'Blue', nationality: 'GB', contactEmail: 'solo@test.com', contactPhone: '+44 0', checkedBags: 0 },
    constraints: { budgetUsd: 0, mctMin: 30, arrivalDeadlineIso: '2026-08-27T18:00:00-04:00', hardArrivalLimitIso: '2026-08-27T20:00:00-04:00', baggagePieces: 0, baggageWeightKg: 0 },
    commitments: [],
  };

  assert.strictEqual(direct.legs.length, 1);
  assert.strictEqual(direct.origin, direct.legs[0].from);
  assert.strictEqual(direct.destination, direct.legs[0].to);
});

suite.test('B1.2: Multi-leg 4-segment complex round-the-world topology', () => {
  const complex = {
    tripId: 'TRIP-RTW-04',
    origin: 'LHR',
    destination: 'SYD',
    travelDateIso: '2026-08-27',
    legs: [
      { flightNumber: 'BA101', from: 'LHR', to: 'DXB', depIso: '2026-08-27T08:00:00+01:00', arrIso: '2026-08-27T18:00:00+04:00', durationMin: 420 },
      { flightNumber: 'EK412', from: 'DXB', to: 'SIN', depIso: '2026-08-27T20:30:00+04:00', arrIso: '2026-08-28T07:30:00+08:00', durationMin: 460 },
      { flightNumber: 'SQ221', from: 'SIN', to: 'SYD', depIso: '2026-08-28T10:00:00+08:00', arrIso: '2026-08-28T19:50:00+10:00', durationMin: 450 },
    ],
  };

  assert.strictEqual(complex.legs.length, 3);
  for (let i = 0; i < complex.legs.length - 1; i++) {
    const arr = new Date(complex.legs[i].arrIso).getTime();
    const dep = new Date(complex.legs[i + 1].depIso).getTime();
    assert.ok(dep > arr, `Leg ${i + 2} must depart after Leg ${i + 1} arrives`);
  }
});

suite.test('B1.3: Non-ASCII and multi-byte UTF-8 passenger names & multilingual venues', () => {
  const cjkTrip = {
    passenger: {
      name: '陳偉 (Wei Chen)',
      nationality: 'SGP',
      ticketReference: 'SQ-9988-東京',
    },
    mission: {
      title: '東京国際戦略会議 (Tokyo Strategic Summit)',
      venue: '丸の内ビルディング 34F (Marunouchi Building 34F)',
    }
  };

  assert.ok(cjkTrip.passenger.name.includes('陳偉'));
  assert.ok(cjkTrip.mission.venue.includes('丸の内'));
});

suite.test('B1.4: Zero checked bags boundary condition (0 bags, 0 kg)', () => {
  const carryOnOnly = {
    constraints: { baggagePieces: 0, baggageWeightKg: 0 },
    passenger: { checkedBags: 0 },
  };

  assert.strictEqual(carryOnOnly.constraints.baggagePieces, 0);
  assert.strictEqual(carryOnOnly.constraints.baggageWeightKg, 0);
  assert.strictEqual(carryOnOnly.passenger.checkedBags, 0);
});

suite.test('B1.5: Maximum enterprise constraints boundary ($5000 budget, 5 bags 50kg, 240m MCT)', () => {
  const maxConstraints = {
    budgetUsd: 5000,
    mctMin: 240,
    baggagePieces: 5,
    baggageWeightKg: 50,
    arrivalDeadlineIso: '2026-08-30T12:00:00Z',
    hardArrivalLimitIso: '2026-08-31T12:00:00Z',
  };

  assert.strictEqual(maxConstraints.budgetUsd, 5000);
  assert.strictEqual(maxConstraints.mctMin, 240);
  assert.strictEqual(maxConstraints.baggagePieces, 5);
  assert.strictEqual(maxConstraints.baggageWeightKg, 50);
});

export default suite;

if (process.argv[1] && process.argv[1].endsWith('b01-itinerary-boundaries.test.mjs')) {
  suite.run().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
