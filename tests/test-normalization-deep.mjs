// tests/test-normalization-deep.mjs
// Unit-level deep stress test of timezone mappings, date normalization, and layover math

// Recreate the normalization logic to test pure unit math on all permutations
function airportOffset(airport) {
  const TZ = {
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

const tests = [
  {
    name: 'Same day direct flight SIN -> NRT',
    originRaw: '202611150810',
    segDepRaw: '202611150810',
    segArrRaw: '202611151630',
    from: 'SIN',
    to: 'NRT',
    expectedDep: '2026-08-27T08:10:00+08:00',
    expectedArr: '2026-08-27T16:30:00+09:00',
  },
  {
    name: 'Overnight direct flight SIN -> NRT',
    originRaw: '202611152330',
    segDepRaw: '202611152330',
    segArrRaw: '202611160710',
    from: 'SIN',
    to: 'NRT',
    expectedDep: '2026-08-27T23:30:00+08:00',
    expectedArr: '2026-08-28T07:10:00+09:00',
  },
  {
    name: 'Multi-segment month-boundary crossing Nov 30 to Dec 1',
    originRaw: '202611301800',
    segDepRaw: '202612010100',
    segArrRaw: '202612010830',
    from: 'ICN',
    to: 'NRT',
    expectedDep: '2026-08-28T01:00:00+09:00',
    expectedArr: '2026-08-28T08:30:00+09:00',
  },
  {
    name: 'Multi-segment year-boundary crossing Dec 31 to Jan 1',
    originRaw: '202612312000',
    segDepRaw: '202701010600',
    segArrRaw: '202701011100',
    from: 'BKK',
    to: 'NRT',
    expectedDep: '2026-08-28T06:00:00+07:00',
    expectedArr: '2026-08-28T11:00:00+09:00',
  },
  {
    name: 'Leap year boundary Feb 28 to Mar 1',
    originRaw: '202802282200',
    segDepRaw: '202802290400',
    segArrRaw: '202802291000',
    from: 'SGN',
    to: 'NRT',
    expectedDep: '2026-08-28T04:00:00+07:00',
    expectedArr: '2026-08-28T10:00:00+09:00',
  },
];

console.log('Running deep normalization unit tests...');
let failed = 0;
for (const t of tests) {
  const actualDep = normalizeAtlasTimeToScenarioIso(t.segDepRaw, t.from, t.originRaw);
  const actualArr = normalizeAtlasTimeToScenarioIso(t.segArrRaw, t.to, t.originRaw);
  const depOk = actualDep === t.expectedDep;
  const arrOk = actualArr === t.expectedArr;
  if (depOk && arrOk) {
    console.log(`[PASS] ${t.name}`);
  } else {
    console.error(`[FAIL] ${t.name}`);
    if (!depOk) console.error(`  Expected dep: ${t.expectedDep}, got: ${actualDep}`);
    if (!arrOk) console.error(`  Expected arr: ${t.expectedArr}, got: ${actualArr}`);
    failed++;
  }
}

// Layover connection time cross-timezone test
console.log('\nTesting layover calculation across timezones:');
// Leg 1: SIN (+8) -> DMK (+7), arr 2026-08-27T16:30:00+07:00
// Leg 2: DMK (+7) -> NRT (+9), dep 2026-08-27T23:55:00+07:00
const leg1Arr = '2026-08-27T16:30:00+07:00';
const leg2Dep = '2026-08-27T23:55:00+07:00';
const connMin = Math.max(0, Math.round((new Date(leg2Dep).getTime() - new Date(leg1Arr).getTime()) / 60000));
console.log(`Layover at DMK: ${connMin} minutes (expected: 445 min = 7h 25m)`);
if (connMin !== 445) {
  console.error(`[FAIL] Layover connection calculation failed: expected 445, got ${connMin}`);
  failed++;
} else {
  console.log('[PASS] Layover connection calculation is exact.');
}

if (failed === 0) {
  console.log('\nALL DEEP NORMALIZATION UNIT TESTS PASSED.');
} else {
  process.exit(1);
}
