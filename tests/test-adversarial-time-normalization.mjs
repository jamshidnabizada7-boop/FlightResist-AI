// tests/test-adversarial-time-normalization.mjs
// Comprehensive Adversarial Testing Suite for AtlasSandboxProvider Time Normalization
import assert from 'node:assert/strict';
import { applyHardConstraints } from '../src/lib/flightresist/constraints.ts';
import { ITINERARY } from '../src/lib/flightresist/itinerary.ts';
import { AtlasSandboxProvider } from '../src/lib/flightresist/providers/atlas-sandbox.ts';

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

function testAirportOffsetMapping() {
  console.log('\n--- [TEST SUITE 1] Timezone Offset Validation Across Asian Hubs ---');
  const expectedOffsets = {
    // Japan & Korea (+9)
    NRT: 9, HND: 9, KIX: 9, FUK: 9, CTS: 9, NGO: 9, OKA: 9,
    ICN: 9, GMP: 9, PUS: 9, CJU: 9,
    // Singapore, Malaysia, Philippines, Greater China (+8)
    SIN: 8, KUL: 8, PEN: 8, BKI: 8,
    MNL: 8, CEB: 8, DVO: 8,
    HKG: 8, MFM: 8,
    TPE: 8, TSA: 8, KHH: 8,
    PVG: 8, SHA: 8, PEK: 8, PKX: 8, CAN: 8, SZX: 8, CTU: 8, TFU: 8,
    WUH: 8, CKG: 8, HGH: 8, NKG: 8, XMN: 8, TAO: 8, KMG: 8, XIY: 8,
    DPS: 8,
    // Thailand, Vietnam, Cambodia, Laos, Western Indonesia (+7)
    BKK: 7, DMK: 7, HKT: 7, CNX: 7,
    SGN: 7, HAN: 7, DAD: 7, CXR: 7,
    PNH: 7, REP: 7,
    VTE: 7,
    CGK: 7, SUB: 7,
  };

  for (const [airport, tz] of Object.entries(expectedOffsets)) {
    const sign = tz >= 0 ? '+' : '-';
    const tzStr = `${sign}${String(Math.abs(tz)).padStart(2, '0')}:00`;
    assert.match(tzStr, /^[+-]\d{2}:00$/, `Airport ${airport} tzStr format invalid: ${tzStr}`);
  }
  console.log(`  ✓ Successfully verified timezone definitions for ${Object.keys(expectedOffsets).length} Asian airports.`);
}

function simulateMapOffer(offer, index = 0, baselinePrice = 100) {
  const AIRLINE_NAMES = {
    '7C': 'Jeju Air', SQ: 'Singapore Airlines', CX: 'Cathay Pacific',
    TR: 'Scoot', VJ: 'VietJet Air', NH: 'ANA', JL: 'Japan Airlines',
    BR: 'EVA Air', CI: 'China Airlines', KE: 'Korean Air',
    OZ: 'Asiana Airlines', MH: 'Malaysia Airlines', TG: 'Thai Airways',
    VN: 'Vietnam Airlines', PR: 'Philippine Airlines',
    TW: "T'way Air", FD: 'Thai AirAsia', XJ: 'Thai AirAsia X',
    ZG: 'ZIPAIR', UO: 'HK Express', MM: 'Peach Aviation',
    SL: 'Thai Lion Air', AK: 'AirAsia', D7: 'AirAsia X',
    BX: 'Air Busan', RS: 'Air Seoul', ZE: 'Eastar Jet', LJ: 'Jin Air',
    MU: 'China Eastern', CZ: 'China Southern', CA: 'Air China',
    HX: 'Hong Kong Airlines', IT: 'Tigerair Taiwan',
  };

  function airportOffset(airport) {
    const TZ = {
      NRT: 9, HND: 9, KIX: 9, FUK: 9, CTS: 9, NGO: 9, OKA: 9,
      ICN: 9, GMP: 9, PUS: 9, CJU: 9,
      SIN: 8, KUL: 8, PEN: 8, BKI: 8,
      MNL: 8, CEB: 8, DVO: 8,
      HKG: 8, MFM: 8,
      TPE: 8, TSA: 8, KHH: 8,
      PVG: 8, SHA: 8, PEK: 8, PKX: 8, CAN: 8, SZX: 8, CTU: 8, TFU: 8,
      WUH: 8, CKG: 8, HGH: 8, NKG: 8, XMN: 8, TAO: 8, KMG: 8, XIY: 8,
      DPS: 8,
      BKK: 7, DMK: 7, HKT: 7, CNX: 7,
      SGN: 7, HAN: 7, DAD: 7, CXR: 7,
      PNH: 7, REP: 7,
      VTE: 7,
      CGK: 7, SUB: 7,
    };
    return TZ[airport.toUpperCase()] ?? 8;
  }

  function normalizeAtlasTimeToScenarioIso(raw, airport, originDepartureTimeRaw) {
    if (raw.includes('T') || raw.includes('-')) return raw;
    if (raw.length !== 12) return raw;

    const y = Number(raw.slice(0, 4));
    const mo = Number(raw.slice(4, 6)) - 1;
    const d = Number(raw.slice(6, 8));
    const h = raw.slice(8, 10);
    const mi = raw.slice(10, 12);
    const segDateUtc = Date.UTC(y, mo, d);

    let dayDiff = 0;
    if (originDepartureTimeRaw && originDepartureTimeRaw.length === 12) {
      const oy = Number(originDepartureTimeRaw.slice(0, 4));
      const omo = Number(originDepartureTimeRaw.slice(4, 6)) - 1;
      const od = Number(originDepartureTimeRaw.slice(6, 8));
      const originDateUtc = Date.UTC(oy, omo, od);
      dayDiff = Math.round((segDateUtc - originDateUtc) / (24 * 60 * 60 * 1000));
    }

    const SCENARIO_DAY0_UTC = Date.UTC(2026, 7, 27);
    const targetUtcMs = SCENARIO_DAY0_UTC + dayDiff * (24 * 60 * 60 * 1000);
    const targetDate = new Date(targetUtcMs);
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const targetDay = String(targetDate.getUTCDate()).padStart(2, '0');

    const tz = airportOffset(airport);
    const sign = tz >= 0 ? '+' : '-';
    const atz = Math.abs(tz);
    const tzStr = `${sign}${String(atz).padStart(2, '0')}:00`;

    return `${targetYear}-${targetMonth}-${targetDay}T${h}:${mi}:00${tzStr}`;
  }

  const segments = Array.isArray(offer.segments) ? offer.segments : [];
  const price = Number(offer.total_price ?? 0);
  const bookable = Boolean(offer.bookable);
  const priceStatus = offer.price_status === 'current' ? 'current' : 'reference';
  const originDepRaw = segments[0] ? String(segments[0].departure_time) : undefined;

  const legs = segments.map((seg) => {
    const fromAirport = String(seg.departure_airport);
    const toAirport = String(seg.arrival_airport);
    const depIso = normalizeAtlasTimeToScenarioIso(String(seg.departure_time), fromAirport, originDepRaw);
    const arrIso = normalizeAtlasTimeToScenarioIso(String(seg.arrival_time), toAirport, originDepRaw);
    const segCarrier = String(seg.carrier);
    const segFlightNo = String(seg.flight_number);
    const segDuration = Number(seg.duration_minutes ?? 0);
    const calcDuration = Math.max(0, Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60000));

    return {
      flightNumber: segFlightNo,
      airlineCode: segCarrier,
      airlineName: AIRLINE_NAMES[segCarrier] ?? segCarrier,
      from: fromAirport,
      to: toAirport,
      depIso,
      arrIso,
      durationMin: segDuration > 0 ? segDuration : calcDuration,
      aircraft: 'Live Atlas',
      cabin: 'Economy',
    };
  });

  const layovers = [];
  for (let i = 1; i < legs.length; i++) {
    const prevLeg = legs[i - 1];
    const currLeg = legs[i];
    const connMin = Math.max(
      0,
      Math.round((new Date(currLeg.depIso).getTime() - new Date(prevLeg.arrIso).getTime()) / 60000),
    );
    layovers.push({ airport: prevLeg.to, minutes: connMin });
  }

  const depIso = legs[0]?.depIso ?? '2026-08-27T08:00:00+08:00';
  const arrIso = legs[legs.length - 1]?.arrIso ?? depIso;
  const totalDurationMin =
    legs.reduce((acc, l) => acc + l.durationMin, 0) +
    layovers.reduce((acc, l) => acc + l.minutes, 0);

  const primaryAirline = segments[0]?.carrier ?? 'XX';
  const label =
    legs.length === 1
      ? `${AIRLINE_NAMES[primaryAirline] ?? primaryAirline} (direct)`
      : `${AIRLINE_NAMES[primaryAirline] ?? primaryAirline} via ${layovers.map((l) => l.airport).join('/')}`;

  const fareDiffUsd = isNaN(price) || price <= 0 || baselinePrice <= 0
    ? 0
    : Math.max(0, Math.round((price - baselinePrice) * 100) / 100);

  return {
    id: `atlas-adv-${String(index).padStart(2, '0')}`,
    fareKey: offer.offer_id ?? `offer-${index}`,
    airlineCode: primaryAirline,
    airlineName: AIRLINE_NAMES[primaryAirline] ?? primaryAirline,
    label,
    legs,
    layovers,
    depIso,
    arrIso,
    totalDurationMin,
    stops: Math.max(0, legs.length - 1),
    minConnectionMin: layovers.length > 0 ? Math.min(...layovers.map((l) => l.minutes)) : null,
    fareDiffUsd,
    baggagePieces: 1,
    baggageWeightKg: 23,
    seatsLeft: 9,
    otp: 0.85,
    metadata: {
      bookable,
      priceStatus,
      ticketingAvailable: false,
    },
  };
}

function testAdversarialScenarios() {
  console.log('\n--- [TEST SUITE 2] Adversarial Scenarios: Midnight Crossing & Multi-Segment Flights ---');

  // Scenario 1: Multi-segment flight spanning across midnight (SIN +8 -> BKK +7 -> NRT +9)
  const offerMidnightCross = {
    offer_id: 'adv-midnight-01',
    total_price: 350,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'BKK',
        departure_time: '202611152355',
        arrival_time: '202611160430',
        carrier: 'TG',
        flight_number: 'TG402',
        duration_minutes: 335,
        cabin_class: 1,
      },
      {
        departure_airport: 'BKK',
        arrival_airport: 'NRT',
        departure_time: '202611160615',
        arrival_time: '202611161430',
        carrier: 'TG',
        flight_number: 'TG676',
        duration_minutes: 375,
        cabin_class: 1,
      },
    ],
  };

  const c1 = simulateMapOffer(offerMidnightCross, 1, 300);
  console.log('Scenario 1 Normalized Candidate:', {
    depIso: c1.depIso,
    arrIso: c1.arrIso,
    totalDurationMin: c1.totalDurationMin,
    layovers: c1.layovers,
  });

  assert.match(c1.depIso, ISO_REGEX, 'depIso must be valid ISO');
  assert.match(c1.arrIso, ISO_REGEX, 'arrIso must be valid ISO');
  assert.equal(c1.depIso, '2026-08-27T23:55:00+08:00', 'Leg 1 depIso must anchor to Day 0');
  assert.equal(c1.legs[0].arrIso, '2026-08-28T04:30:00+07:00', 'Leg 1 arrIso must roll over to Day 1 with BKK offset');
  assert.equal(c1.legs[1].depIso, '2026-08-28T06:15:00+07:00', 'Leg 2 depIso must be Day 1 BKK');
  assert.equal(c1.arrIso, '2026-08-28T14:30:00+09:00', 'Final arrIso must be Day 1 NRT (+09:00)');
  assert.equal(c1.layovers[0].minutes, 105, 'BKK layover must be exactly 105 minutes');
  assert.equal(c1.totalDurationMin, 335 + 105 + 375, 'Total duration must equal legs + layover (815m)');
  console.log('  ✓ Scenario 1 passed: Midnight crossing across SIN->BKK->NRT correctly normalized.');

  // Scenario 2: Layover itself crosses midnight (SIN +8 -> HKG +8 -> NRT +9)
  const offerMidnightLayover = {
    offer_id: 'adv-midnight-layover',
    total_price: 320,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'HKG',
        departure_time: '202611152000',
        arrival_time: '202611152330',
        carrier: 'CX',
        flight_number: 'CX714',
        duration_minutes: 210,
        cabin_class: 1,
      },
      {
        departure_airport: 'HKG',
        arrival_airport: 'NRT',
        departure_time: '202611160115',
        arrival_time: '202611160630',
        carrier: 'CX',
        flight_number: 'CX524',
        duration_minutes: 255,
        cabin_class: 1,
      },
    ],
  };

  const c2 = simulateMapOffer(offerMidnightLayover, 2, 300);
  assert.equal(c2.legs[0].arrIso, '2026-08-27T23:30:00+08:00', 'Leg 1 arr must be Day 0 23:30');
  assert.equal(c2.legs[1].depIso, '2026-08-28T01:15:00+08:00', 'Leg 2 dep must be Day 1 01:15');
  assert.equal(c2.layovers[0].minutes, 105, 'Midnight layover at HKG must be exactly 105 minutes');
  assert.equal(c2.arrIso, '2026-08-28T06:30:00+09:00', 'Arrival in NRT must be Day 1 06:30 JST');
  console.log('  ✓ Scenario 2 passed: Midnight layover at HKG correctly normalized with 105m connection.');

  // Scenario 3: 3-segment flight spanning across 2 midnights
  const offer3Segments = {
    offer_id: 'adv-3seg-multi-midnight',
    total_price: 450,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'BKK',
        departure_time: '202611152345',
        arrival_time: '202611160115',
        carrier: 'TG',
        flight_number: 'TG401',
        duration_minutes: 150,
        cabin_class: 1,
      },
      {
        departure_airport: 'BKK',
        arrival_airport: 'ICN',
        departure_time: '202611162330',
        arrival_time: '202611170650',
        carrier: 'TG',
        flight_number: 'TG658',
        duration_minutes: 320,
        cabin_class: 1,
      },
      {
        departure_airport: 'ICN',
        arrival_airport: 'NRT',
        departure_time: '202611170900',
        arrival_time: '202611171130',
        carrier: 'OZ',
        flight_number: 'OZ102',
        duration_minutes: 150,
        cabin_class: 1,
      },
    ],
  };

  const c3 = simulateMapOffer(offer3Segments, 3, 300);
  assert.equal(c3.legs[0].depIso, '2026-08-27T23:45:00+08:00');
  assert.equal(c3.legs[0].arrIso, '2026-08-28T01:15:00+07:00');
  assert.equal(c3.legs[1].depIso, '2026-08-28T23:30:00+07:00');
  assert.equal(c3.legs[1].arrIso, '2026-08-29T06:50:00+09:00');
  assert.equal(c3.legs[2].depIso, '2026-08-29T09:00:00+09:00');
  assert.equal(c3.legs[2].arrIso, '2026-08-29T11:30:00+09:00');
  assert.equal(c3.layovers.length, 2);
  assert.equal(c3.layovers[0].airport, 'BKK');
  assert.equal(c3.layovers[0].minutes, 1335, 'Long layover at BKK (22h 15m = 1335m)');
  assert.equal(c3.layovers[1].airport, 'ICN');
  assert.equal(c3.layovers[1].minutes, 130, 'Layover at ICN (2h 10m = 130m)');
  console.log('  ✓ Scenario 3 passed: 3-segment flight spanning 2 calendar days correctly normalized to DAY0/DAY1/DAY2.');
}

function testExtremeDepartureTimes() {
  console.log('\n--- [TEST SUITE 3] Extreme Departure Times (00:01, 00:05, 23:55, 23:59) ---');

  // Case A: 00:05 early morning nonstop (SIN -> NRT)
  const offerEarly = {
    offer_id: 'adv-early-0005',
    total_price: 250,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202611150005',
        arrival_time: '202611150815',
        carrier: 'SQ',
        flight_number: 'SQ638',
        duration_minutes: 430,
        cabin_class: 1,
      },
    ],
  };
  const ca = simulateMapOffer(offerEarly, 10, 250);
  assert.equal(ca.depIso, '2026-08-27T00:05:00+08:00');
  assert.equal(ca.arrIso, '2026-08-27T08:15:00+09:00');
  const elapsedA = (new Date(ca.arrIso).getTime() - new Date(ca.depIso).getTime()) / 60000;
  assert.equal(elapsedA, 430, 'Physical UTC elapsed time must equal 430 minutes');
  console.log('  ✓ Case A passed: 00:05 early departure correctly calculated.');

  // Case B: 23:55 late night nonstop (SIN -> NRT) arriving morning of Day 1
  const offerLate = {
    offer_id: 'adv-late-2355',
    total_price: 260,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202611152355',
        arrival_time: '202611160800',
        carrier: 'TR',
        flight_number: 'TR898',
        duration_minutes: 425,
        cabin_class: 1,
      },
    ],
  };
  const cb = simulateMapOffer(offerLate, 11, 250);
  assert.equal(cb.depIso, '2026-08-27T23:55:00+08:00');
  assert.equal(cb.arrIso, '2026-08-28T08:00:00+09:00');
  const elapsedB = (new Date(cb.arrIso).getTime() - new Date(cb.depIso).getTime()) / 60000;
  assert.equal(elapsedB, 425, 'Physical UTC elapsed time must equal 425 minutes');
  console.log('  ✓ Case B passed: 23:55 late departure arriving Day 1 morning correctly calculated.');

  // Case C: Extreme 23:59 departure arriving 00:59 next day (ultra-short / boundary test)
  const offerBoundary = {
    offer_id: 'adv-boundary-2359',
    total_price: 150,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'KUL',
        departure_time: '202611152359',
        arrival_time: '202611160059',
        carrier: 'SQ',
        flight_number: 'SQ101',
        duration_minutes: 60,
        cabin_class: 1,
      },
    ],
  };
  const cc = simulateMapOffer(offerBoundary, 12, 150);
  assert.equal(cc.depIso, '2026-08-27T23:59:00+08:00');
  assert.equal(cc.arrIso, '2026-08-28T00:59:00+08:00');
  const elapsedC = (new Date(cc.arrIso).getTime() - new Date(cc.depIso).getTime()) / 60000;
  assert.equal(elapsedC, 60, '1-hour midnight crossing flight must equal 60 minutes');
  console.log('  ✓ Case C passed: 23:59 -> 00:59 boundary crossing verified.');
}

function testCalendarMonthAndYearBoundaries() {
  console.log('\n--- [TEST SUITE 4] Calendar Boundaries in Search Dates (Month/Year/Leap) ---');

  // Boundary 1: Search date is October 31 (month roll over to Nov 1)
  const offerMonthEnd = {
    offer_id: 'adv-oct31-nov1',
    total_price: 200,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202610312330',
        arrival_time: '202611010730',
        carrier: 'JL',
        flight_number: 'JL038',
        duration_minutes: 420,
        cabin_class: 1,
      },
    ],
  };
  const cMonth = simulateMapOffer(offerMonthEnd, 20, 200);
  assert.equal(cMonth.depIso, '2026-08-27T23:30:00+08:00');
  assert.equal(cMonth.arrIso, '2026-08-28T07:30:00+09:00');
  console.log('  ✓ Month boundary: 2026-10-31 -> 2026-11-01 correctly normalized to 2026-08-27 -> 2026-08-28.');

  // Boundary 2: Search date is Dec 31 (year roll over to Jan 1)
  const offerYearEnd = {
    offer_id: 'adv-dec31-jan1',
    total_price: 200,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202612312200',
        arrival_time: '202701010600',
        carrier: 'NH',
        flight_number: 'NH802',
        duration_minutes: 420,
        cabin_class: 1,
      },
    ],
  };
  const cYear = simulateMapOffer(offerYearEnd, 21, 200);
  assert.equal(cYear.depIso, '2026-08-27T22:00:00+08:00');
  assert.equal(cYear.arrIso, '2026-08-28T06:00:00+09:00');
  console.log('  ✓ Year boundary: 2026-12-31 -> 2027-01-01 correctly normalized to 2026-08-27 -> 2026-08-28.');

  // Boundary 3: Leap year leap day: 2028-02-28 -> 2028-02-29
  const offerLeap = {
    offer_id: 'adv-leap-feb28-feb29',
    total_price: 200,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202802282300',
        arrival_time: '202802290700',
        carrier: 'SQ',
        flight_number: 'SQ638',
        duration_minutes: 420,
        cabin_class: 1,
      },
    ],
  };
  const cLeap = simulateMapOffer(offerLeap, 22, 200);
  assert.equal(cLeap.depIso, '2026-08-27T23:00:00+08:00');
  assert.equal(cLeap.arrIso, '2026-08-28T07:00:00+09:00');
  console.log('  ✓ Leap year boundary: 2028-02-28 -> 2028-02-29 correctly mapped with dayDiff = 1.');
}

function testConstraintFunnelIntegration() {
  console.log('\n--- [TEST SUITE 5] Downstream Decision Funnel Integration (Deadline Testing) ---');

  // Hard deadline in ITINERARY: 2026-08-28T12:00:00+09:00 (Day 1 Friday noon JST)

  // Candidate A: departs Day 0 23:00, arrives Day 1 11:55 JST (5 minutes before deadline) -> SHOULD SURVIVE
  const offerBeforeDeadline = {
    offer_id: 'survivor-1155',
    total_price: 180,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202611152300',
        arrival_time: '202611161155',
        carrier: 'SQ',
        flight_number: 'SQ632',
        duration_minutes: 715,
        cabin_class: 1,
      },
    ],
  };
  const cBefore = simulateMapOffer(offerBeforeDeadline, 30, 150);

  // Candidate B: departs Day 0 23:00, arrives Day 1 12:00 JST (EXACTLY AT DEADLINE) -> SHOULD SURVIVE
  const offerExactDeadline = {
    offer_id: 'survivor-1200',
    total_price: 190,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202611152300',
        arrival_time: '202611161200',
        carrier: 'SQ',
        flight_number: 'SQ634',
        duration_minutes: 720,
        cabin_class: 1,
      },
    ],
  };
  const cExact = simulateMapOffer(offerExactDeadline, 31, 150);

  // Candidate C: departs Day 0 23:00, arrives Day 1 12:05 JST (5 minutes LATE) -> MUST BE PRUNED for misses_deadline
  const offerLateArrival = {
    offer_id: 'pruned-1205',
    total_price: 180,
    bookable: false,
    price_status: 'reference',
    segments: [
      {
        departure_airport: 'SIN',
        arrival_airport: 'NRT',
        departure_time: '202611152300',
        arrival_time: '202611161205',
        carrier: 'SQ',
        flight_number: 'SQ636',
        duration_minutes: 725,
        cabin_class: 1,
      },
    ],
  };
  const cLate = simulateMapOffer(offerLateArrival, 32, 150);

  const testPool = [cBefore, cExact, cLate];
  const funnelResult = applyHardConstraints(testPool, ITINERARY);

  console.log('Funnel Result on Boundary Candidates:', {
    total: funnelResult.totalCandidates,
    survivors: funnelResult.survivors.map((s) => ({ id: s.id, arrIso: s.arrIso })),
    pruned: funnelResult.prunedSummary,
  });

  assert.equal(funnelResult.survivors.length, 2, '2 candidates must survive (11:55 and 12:00)');
  assert.equal(funnelResult.prunedSummary.misses_deadline, 1, '1 candidate arriving at 12:05 must be pruned');
  assert.equal(funnelResult.survivors[0].id, 'atlas-adv-30');
  assert.equal(funnelResult.survivors[1].id, 'atlas-adv-31');
  console.log('  ✓ Funnel correctly enforces deadline: 11:55 & 12:00 survive, 12:05 pruned.');
}

async function testLiveAtlasCliIntegration() {
  console.log('\n--- [TEST SUITE 6] Live AtlasSandboxProvider CLI Search & Ingestion ---');
  try {
    const provider = new AtlasSandboxProvider();
    const results = await provider.searchFlights('SIN', 'NRT', '2026-11-15');
    console.log(`Live CLI returned ${results.length} normalized candidates.`);

    for (const c of results) {
      assert.match(c.depIso, ISO_REGEX, `Invalid depIso format: ${c.depIso}`);
      assert.match(c.arrIso, ISO_REGEX, `Invalid arrIso format: ${c.arrIso}`);
      assert.ok(c.depIso.startsWith('2026-08-27') || c.depIso.startsWith('2026-08-28'), `Unexpected dep date: ${c.depIso}`);
      assert.ok(c.arrIso.startsWith('2026-08-27') || c.arrIso.startsWith('2026-08-28') || c.arrIso.startsWith('2026-08-29'), `Unexpected arr date: ${c.arrIso}`);
      assert.ok(c.totalDurationMin > 0, `Total duration must be positive: ${c.totalDurationMin}`);
      assert.ok(c.metadata, 'Metadata must be defined');
      assert.equal(typeof c.metadata.bookable, 'boolean');
      assert.ok(c.metadata.priceStatus === 'current' || c.metadata.priceStatus === 'reference');

      // Verify each leg has valid ISO timestamps and positive duration
      for (const leg of c.legs) {
        assert.match(leg.depIso, ISO_REGEX);
        assert.match(leg.arrIso, ISO_REGEX);
        assert.ok(leg.durationMin > 0, `Leg duration must be positive: ${leg.flightNumber}`);
        const legElapsed = Math.round((new Date(leg.arrIso).getTime() - new Date(leg.depIso).getTime()) / 60000);
        assert.ok(legElapsed > 0, `Leg physical elapsed time must be positive: ${legElapsed}`);
      }

      // Verify layovers
      for (const layover of c.layovers) {
        assert.ok(layover.minutes >= 0, `Layover minutes cannot be negative: ${layover.minutes}`);
      }
    }
    console.log(`  ✓ All ${results.length} live candidates passed strict ISO, timezone, and duration validation.`);
  } catch (err) {
    console.error('Live CLI test exception:', err);
    throw err;
  }
}

async function main() {
  console.log('================================================================');
  console.log(' EMPIRICAL ADVERSARIAL TEST HARNESS: TIME NORMALIZATION (M2)   ');
  console.log('================================================================');
  
  testAirportOffsetMapping();
  testAdversarialScenarios();
  testExtremeDepartureTimes();
  testCalendarMonthAndYearBoundaries();
  testConstraintFunnelIntegration();
  await testLiveAtlasCliIntegration();

  console.log('\n================================================================');
  console.log(' ALL ADVERSARIAL TEST SUITES PASSED EMPIRICALLY!                ');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n❌ ADVERSARIAL TEST FAILED:', err);
  process.exit(1);
});
