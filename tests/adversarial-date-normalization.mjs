// tests/adversarial-date-normalization.mjs
// Unit tests for timestamp and clock normalization algorithms

import assert from 'node:assert';

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

  // Anchor to DAY0: 2026-08-27
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

// ---------------------------------------------------------------------------
// Run Unit Checks
// ---------------------------------------------------------------------------

console.log('Testing normalization edge cases...');

// Case 1: Same day departure & arrival
const c1Dep = normalizeAtlasTimeToScenarioIso('202611150040', 'SIN', '202611150040');
const c1Arr = normalizeAtlasTimeToScenarioIso('202611150830', 'NRT', '202611150040');
assert.strictEqual(c1Dep, '2026-08-27T00:40:00+08:00');
assert.strictEqual(c1Arr, '2026-08-27T08:30:00+09:00');
const c1Duration = Math.round((new Date(c1Arr).getTime() - new Date(c1Dep).getTime()) / 60000);
// 00:40+8 (16:40Z prev day) to 08:30+9 (23:30Z prev day) = 7h - 1h tz + 50m = 6h 50m = 410m
assert.strictEqual(c1Duration, 410);

// Case 2: Overnight direct flight
const c2Dep = normalizeAtlasTimeToScenarioIso('202611152330', 'SIN', '202611152330');
const c2Arr = normalizeAtlasTimeToScenarioIso('202611160710', 'NRT', '202611152330');
assert.strictEqual(c2Dep, '2026-08-27T23:30:00+08:00');
assert.strictEqual(c2Arr, '2026-08-28T07:10:00+09:00');
const c2Duration = Math.round((new Date(c2Arr).getTime() - new Date(c2Dep).getTime()) / 60000);
// 23:30+8 (15:30Z) to 07:10+9 (22:10Z) = 6h 40m = 400m
assert.strictEqual(c2Duration, 400);

// Case 3: Connecting flight with layover
const c3Seg1Dep = normalizeAtlasTimeToScenarioIso('202611151500', 'SIN', '202611151500');
const c3Seg1Arr = normalizeAtlasTimeToScenarioIso('202611151630', 'DMK', '202611151500');
const c3Seg2Dep = normalizeAtlasTimeToScenarioIso('202611152355', 'DMK', '202611151500');
const c3Seg2Arr = normalizeAtlasTimeToScenarioIso('202611160800', 'NRT', '202611151500');

assert.strictEqual(c3Seg1Dep, '2026-08-27T15:00:00+08:00');
assert.strictEqual(c3Seg1Arr, '2026-08-27T16:30:00+07:00');
assert.strictEqual(c3Seg2Dep, '2026-08-27T23:55:00+07:00');
assert.strictEqual(c3Seg2Arr, '2026-08-28T08:00:00+09:00');

const layoverMin = Math.round((new Date(c3Seg2Dep).getTime() - new Date(c3Seg1Arr).getTime()) / 60000);
// 16:30+7 to 23:55+7 = 7h 25m = 445m
assert.strictEqual(layoverMin, 445);

// Case 4: Month boundary jump (Oct 31 -> Nov 01)
const c4Dep = normalizeAtlasTimeToScenarioIso('202610312300', 'SIN', '202610312300');
const c4Arr = normalizeAtlasTimeToScenarioIso('202611010700', 'NRT', '202610312300');
assert.strictEqual(c4Dep, '2026-08-27T23:00:00+08:00');
assert.strictEqual(c4Arr, '2026-08-28T07:00:00+09:00');

// Case 5: Year boundary jump (Dec 31 -> Jan 01)
const c5Dep = normalizeAtlasTimeToScenarioIso('202612312300', 'SIN', '202612312300');
const c5Arr = normalizeAtlasTimeToScenarioIso('202701010700', 'NRT', '202612312300');
assert.strictEqual(c5Dep, '2026-08-27T23:00:00+08:00');
assert.strictEqual(c5Arr, '2026-08-28T07:00:00+09:00');

// Case 6: Fallback for unknown airport
const c6Unknown = normalizeAtlasTimeToScenarioIso('202611151200', 'ZZZ', '202611151200');
assert.strictEqual(c6Unknown, '2026-08-27T12:00:00+08:00');

// Case 7: Invalid string / length
const c7Bad = normalizeAtlasTimeToScenarioIso('INVALID', 'SIN');
assert.strictEqual(c7Bad, 'INVALID');

console.log('All normalization edge cases verified successfully!');
