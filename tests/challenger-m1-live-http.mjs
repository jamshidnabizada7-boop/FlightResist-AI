#!/usr/bin/env node
/**
 * Challenger M1-2 Live HTTP Adversarial Verification Suite
 *
 * Tests the live Next.js server on http://localhost:3000:
 * 1. Presets Catalog API Route (`GET /api/itinerary/presets`)
 * 2. Active Itinerary API Route (`POST /api/itinerary/active`) with session isolation
 * 3. Import API Route (`POST /api/itinerary/import`) JSON & PNR formats + immediate activation
 * 4. Saved Itineraries API Routes (`GET/POST /api/itinerary/saved`, `GET/DELETE /api/itinerary/saved/[id]`)
 * 5. Boundary & Malformed Payloads (Empty body, unknown presetId, invalid schema, garbage PNR/JSON, 404s)
 * 6. High-concurrency parallel activations across distinct cookie sessions
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

const failures = [];
let passedCount = 0;
let totalCount = 0;

function check(label, condition, detail) {
  totalCount++;
  const ok = Boolean(condition);
  if (ok) {
    passedCount++;
    console.log(`  [PASS] ${label}${detail !== undefined ? ` -> ${String(detail).slice(0, 120)}` : ''}`);
  } else {
    console.error(`  [FAIL] ${label}${detail !== undefined ? ` -> ${String(detail).slice(0, 120)}` : ''}`);
    failures.push(`${label} (${detail || 'no detail'})`);
  }
}

function client(sessionId) {
  const headers = sessionId ? { cookie: `fr-session=${sessionId}` } : {};
  return {
    sessionId,
    get: (path) => fetch(`${BASE}${path}`, { headers: { ...headers } }),
    post: (path, body) =>
      fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      }),
    delete: (path) =>
      fetch(`${BASE}${path}`, {
        method: 'DELETE',
        headers: { ...headers },
      }),
  };
}

async function runLiveHttpSuite() {
  console.log('\n======================================================');
  console.log(`🌐 RUNNING M1 LIVE HTTP ADVERSARIAL SUITE AGAINST ${BASE}`);
  console.log('======================================================\n');

  const A = client(`challenger-live-a-${Date.now()}`);
  const B = client(`challenger-live-b-${Date.now()}`);
  const C = client(`challenger-live-c-${Date.now()}`);
  const ANON = client(null);

  // -------------------------------------------------------------------------
  // 1. Presets Catalog API Route (`GET /api/itinerary/presets`)
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing GET /api/itinerary/presets ---');
  const presetsRes = await A.get('/api/itinerary/presets');
  check('GET /api/itinerary/presets returns HTTP 200', presetsRes.status === 200, `status ${presetsRes.status}`);
  const presetsData = await presetsRes.json();
  check('presetsData has count = 6', presetsData.count === 6, `count: ${presetsData.count}`);
  check('presets array has 6 items', Array.isArray(presetsData.presets) && presetsData.presets.length === 6);
  check('summaries array has 6 items', Array.isArray(presetsData.summaries) && presetsData.summaries.length === 6);
  
  const presetIds = presetsData.presets.map((p) => p.id);
  check('presets catalog includes SIN-NRT, LHR-JFK, SFO-HND, SYD-LAX, DXB-CDG, FRA-SIN',
    presetIds.includes('preset-sin-nrt') &&
    presetIds.includes('preset-lhr-jfk') &&
    presetIds.includes('preset-sfo-hnd') &&
    presetIds.includes('preset-syd-lax') &&
    presetIds.includes('preset-dxb-cdg') &&
    presetIds.includes('preset-fra-sin'),
    presetIds.join(', ')
  );

  // -------------------------------------------------------------------------
  // 2. Active Itinerary API Route (`POST /api/itinerary/active`) & Session Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing POST /api/itinerary/active & Session Isolation ---');
  
  // Activate LHR-JFK on Session A
  const activeResA = await A.post('/api/itinerary/active', { presetId: 'preset-lhr-jfk' });
  check('Session A POST /api/itinerary/active returns HTTP 200', activeResA.status === 200);
  const activeDataA = await activeResA.json();
  check('Session A returns status ACTIVE_UPDATED', activeDataA.status === 'ACTIVE_UPDATED');
  check('Session A active route is LHR -> JFK', activeDataA.trip?.itinerary?.origin === 'LHR' && activeDataA.trip?.itinerary?.destination === 'JFK');

  // Activate SFO-HND on Session B
  const activeResB = await B.post('/api/itinerary/active', { presetId: 'preset-sfo-hnd' });
  check('Session B POST /api/itinerary/active returns HTTP 200', activeResB.status === 200);
  const activeDataB = await activeResB.json();
  check('Session B active route is SFO -> HND', activeDataB.trip?.itinerary?.origin === 'SFO' && activeDataB.trip?.itinerary?.destination === 'HND');

  // Verify Session A is still LHR-JFK (no leak from B)
  const currentTripA = await (await A.get('/api/trip/current')).json();
  check('Session A /api/trip/current is still LHR -> JFK (isolated from B)', currentTripA.itinerary?.origin === 'LHR' && currentTripA.itinerary?.destination === 'JFK');

  // Verify Session B is still SFO-HND
  const currentTripB = await (await B.get('/api/trip/current')).json();
  check('Session B /api/trip/current is still SFO -> HND (isolated from A)', currentTripB.itinerary?.origin === 'SFO' && currentTripB.itinerary?.destination === 'HND');

  // Verify Anonymous / Default session is independent
  const currentAnon = await (await ANON.get('/api/trip/current')).json();
  check('Anonymous session retains default itinerary (isolated from A & B)', currentAnon.itinerary?.origin === 'SIN' && currentAnon.itinerary?.destination === 'NRT');

  // Activate custom builder itinerary on Session C
  const customTrip = {
    ...presetsData.presets[0],
    tripId: 'TRIP-CUSTOM-CDG-HND',
    origin: 'CDG',
    destination: 'HND',
    tripPurpose: 'Custom Paris to Tokyo Flagship',
    legs: [
      {
        flightNumber: 'AF272',
        airlineCode: 'AF',
        airlineName: 'Air France',
        from: 'CDG',
        to: 'HND',
        depIso: '2026-08-27T09:30:00+02:00',
        arrIso: '2026-08-28T05:55:00+09:00',
        durationMin: 745,
        aircraft: 'Boeing 777-300ER',
        cabin: 'Business Class',
      },
    ],
  };

  const activeResC = await C.post('/api/itinerary/active', { itinerary: customTrip });
  check('Session C POST /api/itinerary/active with custom itinerary returns HTTP 200', activeResC.status === 200);
  const activeDataC = await activeResC.json();
  check('Session C active route updated to CDG -> HND', activeDataC.trip?.itinerary?.origin === 'CDG' && activeDataC.trip?.itinerary?.destination === 'HND');

  // -------------------------------------------------------------------------
  // 3. Import API Route (`POST /api/itinerary/import`)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing POST /api/itinerary/import ---');
  
  // 3.1 JSON import with activateImmediately: true
  const importSess = client(`challenger-import-${Date.now()}`);
  const importJsonRes = await importSess.post('/api/itinerary/import', {
    format: 'JSON',
    content: JSON.stringify(presetsData.presets.find((p) => p.id === 'preset-dxb-cdg')),
    activateImmediately: true,
  });
  check('JSON import returns HTTP 200', importJsonRes.status === 200);
  const importJsonData = await importJsonRes.json();
  check('JSON import returns success=true and activated=true', importJsonData.success === true && importJsonData.activated === true);
  check('JSON import parsed DXB -> CDG correctly', importJsonData.itinerary?.origin === 'DXB' && importJsonData.itinerary?.destination === 'CDG');
  check('JSON import returned formatted GDS PNR text', typeof importJsonData.formattedPnr === 'string' && importJsonData.formattedPnr.includes('EK 73'));

  // Verify session actually activated
  const importSessTrip = await (await importSess.get('/api/trip/current')).json();
  check('Session itinerary was immediately activated to DXB -> CDG', importSessTrip.itinerary?.origin === 'DXB' && importSessTrip.itinerary?.destination === 'CDG');

  // 3.2 PNR import
  const rawPnrText = importJsonData.formattedPnr;
  const importPnrRes = await A.post('/api/itinerary/import', {
    format: 'PNR',
    content: rawPnrText,
  });
  check('PNR import returns HTTP 200', importPnrRes.status === 200);
  const importPnrData = await importPnrRes.json();
  check('PNR import returns success=true', importPnrData.success === true);
  check('PNR import parsed DXB -> CDG correctly', importPnrData.itinerary?.origin === 'DXB' && importPnrData.itinerary?.destination === 'CDG');

  // -------------------------------------------------------------------------
  // 4. Saved Itineraries API Routes (`GET/POST /api/itinerary/saved`)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing /api/itinerary/saved CRUD ---');
  
  const saveTripRes = await A.post('/api/itinerary/saved', {
    name: 'Enterprise M&A JFK Trip',
    itinerary: presetsData.presets.find((p) => p.id === 'preset-lhr-jfk'),
    isPreset: true,
    presetId: 'preset-lhr-jfk',
  });
  check('POST /api/itinerary/saved returns HTTP 200', saveTripRes.status === 200);
  const saveTripData = await saveTripRes.json();
  check('POST /api/itinerary/saved returns saved record with id', saveTripData.success === true && Boolean(saveTripData.saved?.id));
  const savedId = saveTripData.saved?.id;

  if (savedId) {
    // List saved itineraries
    const listSavedRes = await A.get('/api/itinerary/saved');
    check('GET /api/itinerary/saved returns HTTP 200', listSavedRes.status === 200);
    const listSavedData = await listSavedRes.json();
    check('GET /api/itinerary/saved includes the newly created saved item',
      Array.isArray(listSavedData.saved) && listSavedData.saved.some((item) => item.id === savedId)
    );

    // Get by ID
    const getByIdRes = await A.get(`/api/itinerary/saved/${savedId}`);
    check('GET /api/itinerary/saved/[id] returns HTTP 200', getByIdRes.status === 200);
    const getByIdData = await getByIdRes.json();
    check('GET /api/itinerary/saved/[id] returns correct origin LHR', getByIdData.saved?.origin === 'LHR');

    // Delete by ID
    const delRes = await A.delete(`/api/itinerary/saved/${savedId}`);
    check('DELETE /api/itinerary/saved/[id] returns HTTP 200', delRes.status === 200);

    // Query after delete returns 404
    const getAfterDelRes = await A.get(`/api/itinerary/saved/${savedId}`);
    check('GET /api/itinerary/saved/[id] after deletion returns HTTP 404', getAfterDelRes.status === 404);
  }

  // -------------------------------------------------------------------------
  // 5. Boundary & Malformed Payloads (Adversarial Error Handling)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Boundary Conditions & Malformed Payloads ---');

  // 5.1 /api/itinerary/active empty body
  const emptyActiveRes = await A.post('/api/itinerary/active', {});
  check('Empty body on /api/itinerary/active returns HTTP 400', emptyActiveRes.status === 400);

  // 5.2 /api/itinerary/active unknown presetId
  const unknownPresetRes = await A.post('/api/itinerary/active', { presetId: 'preset-nonexistent-999' });
  check('Unknown presetId on /api/itinerary/active returns HTTP 400', unknownPresetRes.status === 400);

  // 5.3 /api/itinerary/active malformed schema
  const malformedActiveRes = await A.post('/api/itinerary/active', {
    itinerary: { tripId: 'TRIP-EMPTY', origin: 'SIN' },
  });
  check('Malformed itinerary on /api/itinerary/active returns HTTP 400', malformedActiveRes.status === 400);

  // 5.4 /api/itinerary/import empty body
  const emptyImportRes = await A.post('/api/itinerary/import', {});
  check('Empty body on /api/itinerary/import returns HTTP 400', emptyImportRes.status === 400);

  // 5.5 /api/itinerary/import corrupted JSON syntax
  const corruptJsonRes = await A.post('/api/itinerary/import', {
    format: 'JSON',
    content: '{"unclosed_json": true, ...',
  });
  check('Corrupted JSON on /api/itinerary/import returns HTTP 400', corruptJsonRes.status === 400);

  // 5.6 /api/itinerary/import unsupported format
  const badFormatRes = await A.post('/api/itinerary/import', {
    format: 'XML',
    content: '<itinerary><origin>SIN</origin></itinerary>',
  });
  check('Unsupported format on /api/itinerary/import returns HTTP 400', badFormatRes.status === 400);

  // 5.7 /api/itinerary/import non-PNR text
  const badPnrRes = await A.post('/api/itinerary/import', {
    format: 'PNR',
    content: 'THIS IS JUST A RANDOM COMMENT WITH NO FLIGHT NUMBERS OR SEGMENTS',
  });
  check('Non-PNR text on /api/itinerary/import returns HTTP 400', badPnrRes.status === 400);

  // 5.8 /api/itinerary/saved non-existent ID 404
  const notFoundSavedRes = await A.get('/api/itinerary/saved/non-existent-saved-trip-id-999');
  check('GET /api/itinerary/saved/[id] with non-existent ID returns HTTP 404', notFoundSavedRes.status === 404);

  // 5.9 /api/itinerary/saved DELETE non-existent ID 404
  const notFoundDelRes = await A.delete('/api/itinerary/saved/non-existent-saved-trip-id-999');
  check('DELETE /api/itinerary/saved/[id] with non-existent ID returns HTTP 404', notFoundDelRes.status === 404);

  // -------------------------------------------------------------------------
  // 6. High-Concurrency Stress Test over HTTP
  // -------------------------------------------------------------------------
  console.log('\n--- 6. High-Concurrency Parallel Activations over HTTP ---');

  const concurrencyN = 18;
  const stressPromises = [];
  const testPresets = [
    'preset-sin-nrt',
    'preset-lhr-jfk',
    'preset-sfo-hnd',
    'preset-syd-lax',
    'preset-dxb-cdg',
    'preset-fra-sin',
  ];

  for (let i = 0; i < concurrencyN; i++) {
    const targetPreset = testPresets[i % testPresets.length];
    const sessClient = client(`concurrent-http-sess-${i}-${Date.now()}`);
    stressPromises.push(
      sessClient.post('/api/itinerary/active', { presetId: targetPreset }).then(async (res) => {
        const body = await res.json();
        return {
          idx: i,
          status: res.status,
          expectedPreset: targetPreset,
          actualOrigin: body.trip?.itinerary?.origin,
        };
      })
    );
  }

  const stressResults = await Promise.all(stressPromises);
  const allSucceeded = stressResults.every((r) => r.status === 200 && Boolean(r.actualOrigin));
  check(`Executed ${concurrencyN} parallel HTTP activations with 100% success (HTTP 200)`, allSucceeded);

  // Summary
  console.log('\n======================================================');
  console.log(`🏁 LIVE HTTP VERIFICATION RESULTS: ${passedCount}/${totalCount} CHECKS PASSED (${failures.length} FAILURES)`);
  console.log('======================================================\n');

  if (failures.length > 0) {
    console.error('Failures summary:');
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
  }
}

runLiveHttpSuite().catch((err) => {
  console.error('\n💥 FATAL ERROR IN LIVE HTTP SUITE:', err);
  process.exit(1);
});
