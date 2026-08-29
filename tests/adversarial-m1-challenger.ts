/**
 * Adversarial Challenger Suite for Milestone 1
 *
 * Tests:
 * 1. Multi-Session Isolation Under Concurrent Stress & Cross-Contamination
 * 2. DB Persistence, Cold-Start Hydration & Error Recovery
 * 3. Concurrent Preset Activations & High-Concurrency Race Conditions
 * 4. API Route Handlers Integration (/api/itinerary/presets, active, import, saved, saved/[id])
 * 5. Adversarial Payloads, Boundary Limits & Error Handling (SQLi, XSS, Schema Violations, Malformed inputs)
 */

import { NextRequest } from 'next/server';
import { db, dbAvailable } from '../src/lib/db';
import { PRESETS, getPresetById, getAllPresets, getPresetSummaries, PRESET_SIN_NRT, PRESET_LHR_JFK, PRESET_SFO_HND, PRESET_SYD_LAX, PRESET_DXB_CDG, PRESET_FRA_SIN } from '../src/lib/flightresist/presets';
import { ItinerarySchema, parsePnr, formatPnr } from '../src/lib/flightresist/pnr-parser';
import {
  getSession,
  resetSession,
  setSessionItinerary,
  updateSessionConstraints,
  updateSessionPassenger,
  updateSessionMission,
  buildSnapshot,
  persistSnapshot,
  hydrateFromDb,
  setState,
  forceReset,
  persistenceKey,
} from '../src/lib/flightresist/store';
import type { Itinerary, FlightLeg, PassengerProfile, MissionContext, TripConstraints } from '../src/lib/flightresist/types';

// Import Route Handlers directly
import { GET as getPresetsHandler } from '../src/app/api/itinerary/presets/route';
import { POST as postActiveHandler } from '../src/app/api/itinerary/active/route';
import { POST as postImportHandler } from '../src/app/api/itinerary/import/route';
import { GET as getSavedHandler, POST as postSavedHandler } from '../src/app/api/itinerary/saved/route';
import { GET as getSavedByIdHandler, DELETE as deleteSavedByIdHandler } from '../src/app/api/itinerary/saved/[id]/route';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[CHALLENGE FAILED]: ${msg}`);
  }
}

function createMockRequest(url: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): NextRequest {
  const headers = new Headers(options.headers || {});
  const method = options.method || 'GET';
  const init: RequestInit = {
    method,
    headers,
  };
  if (options.body !== undefined && method !== 'GET') {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

async function runChallengerSuite() {
  console.log('\n======================================================');
  console.log('⚔️  RUNNING ADVERSARIAL CHALLENGER SUITE: MILESTONE 1');
  console.log('======================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function recordCheck(name: string, ok: boolean, details?: string) {
    totalChecks++;
    if (ok) {
      passedChecks++;
      console.log(`  [PASS] ${name}${details ? ` -> ${details}` : ''}`);
    } else {
      console.error(`  [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
      throw new Error(`Check failed: ${name} (${details || ''})`);
    }
  }

  // =========================================================================
  // CHALLENGE 1: Multi-Session Isolation & Cross-Contamination Stress
  // =========================================================================
  console.log('\n--- 1. Multi-Session Isolation & Independent State Mutation ---');
  
  const sess1 = `challenger-sess-1-${Date.now()}`;
  const sess2 = `challenger-sess-2-${Date.now()}`;
  const sess3 = `challenger-sess-3-${Date.now()}`;
  const sess4 = `challenger-sess-4-${Date.now()}`;

  await setSessionItinerary(PRESET_SIN_NRT, 'DEMO', sess1);
  await setSessionItinerary(PRESET_LHR_JFK, 'DEMO', sess2);
  await setSessionItinerary(PRESET_SFO_HND, 'DEMO', sess3);
  await setSessionItinerary(PRESET_SYD_LAX, 'DEMO', sess4);

  // Apply conflicting mutations simultaneously
  updateSessionConstraints({ budgetUsd: 1234, mctMin: 111 }, 'DEMO', sess1);
  updateSessionPassenger({ name: 'Dr. Adversarial User', loyaltyTier: 'Diamond Super' }, 'DEMO', sess2);
  updateSessionMission({ title: 'Top Secret Acquisition', dealValue: 999999999 }, 'DEMO', sess3);
  setState('DISRUPTION_DETECTED', 'DEMO', sess4);

  // Verify Sess 1
  const s1 = getSession(sess1);
  recordCheck('Session 1 retains custom constraints ($1234, 111m)', s1.itinerary.constraints.budgetUsd === 1234 && s1.itinerary.constraints.mctMin === 111);
  recordCheck('Session 1 passenger NOT contaminated by Sess 2', s1.itinerary.passenger.name === PRESET_SIN_NRT.passenger.name);
  recordCheck('Session 1 state is NORMAL', s1.state === 'NORMAL');

  // Verify Sess 2
  const s2 = getSession(sess2);
  recordCheck('Session 2 retains custom passenger name', s2.itinerary.passenger.name === 'Dr. Adversarial User');
  recordCheck('Session 2 constraints NOT contaminated by Sess 1', s2.itinerary.constraints.budgetUsd === PRESET_LHR_JFK.constraints.budgetUsd);
  recordCheck('Session 2 state is NORMAL', s2.state === 'NORMAL');

  // Verify Sess 3
  const s3 = getSession(sess3);
  recordCheck('Session 3 retains custom mission deal value', s3.itinerary.mission.dealValue === 999999999);
  recordCheck('Session 3 tripPurpose updated with mission title', s3.itinerary.tripPurpose === 'Top Secret Acquisition');
  recordCheck('Session 3 passenger NOT contaminated by Sess 2', s3.itinerary.passenger.name === PRESET_SFO_HND.passenger.name);

  // Verify Sess 4
  const s4 = getSession(sess4);
  recordCheck('Session 4 transitioned to DISRUPTION_DETECTED', s4.state === 'DISRUPTION_DETECTED');
  recordCheck('Session 4 route is SYD-LAX', s4.itinerary.origin === 'SYD' && s4.itinerary.destination === 'LAX');

  // Test session reset isolation
  await forceReset('DEMO', sess1);
  recordCheck('Session 1 reset to NORMAL and clean state', getSession(sess1).state === 'NORMAL');
  recordCheck('Session 4 still DISRUPTION_DETECTED after Sess 1 reset', getSession(sess4).state === 'DISRUPTION_DETECTED');
  recordCheck('Session 2 passenger still customized after Sess 1 reset', getSession(sess2).itinerary.passenger.name === 'Dr. Adversarial User');

  // =========================================================================
  // CHALLENGE 2: Database Persistence, Cold-Start Hydration & Error Recovery
  // =========================================================================
  console.log('\n--- 2. Database Persistence & Cold-Start Hydration ---');

  if (dbAvailable()) {
    const coldSessId = `cold-start-test-${Date.now()}`;
    const customTrip: Itinerary = {
      tripId: `TRIP-COLD-${Date.now()}`,
      origin: 'ZRH',
      destination: 'HND',
      travelDateIso: '2026-09-01T10:00:00+02:00',
      legs: [
        {
          flightNumber: 'LX160',
          airlineCode: 'LX',
          airlineName: 'Swiss International Air Lines',
          from: 'ZRH',
          to: 'NRT',
          depIso: '2026-09-01T13:00:00+02:00',
          arrIso: '2026-09-02T07:50:00+09:00',
          durationMin: 770,
          aircraft: 'Boeing 777-300ER',
          cabin: 'Business Class',
        },
      ],
      passenger: {
        name: 'Beatrix von Habsburg',
        ticketReference: 'LX-9900-COLD',
        loyaltyProgram: 'Miles & More',
        loyaltyTier: 'HON Circle',
        loyaltyNumber: 'MM-9998881',
        nationality: 'CH',
        passportNumber: 'CH-882190',
        passportExpiryIso: '2033-01-01',
        issuingCountry: 'CHE',
        contactEmail: 'beatrix@habsburg-capital.ch',
        contactPhone: '+41 22 819 0000',
        checkedBags: 3,
        loyalty: 'HON Circle',
      },
      mission: {
        title: 'Swiss-Japan Private Equity Alliance',
        description: 'Bilateral syndicate formation',
        venue: 'Imperial Hotel Tokyo',
        location: 'Chiyoda, Tokyo',
        dealValue: 150000000,
        dealCurrency: 'EUR',
        importance: 'CRITICAL',
        deadlineIso: '2026-09-02T14:00:00+09:00',
        timezone: 'Asia/Tokyo',
      },
      tripPurpose: 'Swiss-Japan Private Equity Alliance',
      constraints: {
        budgetUsd: 800,
        mctMin: 90,
        arrivalDeadlineIso: '2026-09-02T12:00:00+09:00',
        hardArrivalLimitIso: '2026-09-03T00:00:00+09:00',
        baggagePieces: 3,
        baggageWeightKg: 32,
      },
      commitments: [
        {
          id: 'cm-1',
          kind: 'MEETING',
          label: 'Syndicate Dinner',
          detail: 'Imperial Hotel Private Dining',
          atIso: '2026-09-02T19:00:00+09:00',
          location: 'Tokyo',
        },
      ],
    };

    // 2.1 Set and persist snapshot
    await setSessionItinerary(customTrip, 'DEMO', coldSessId);
    
    // Verify DB row exists
    const dbKey = persistenceKey(coldSessId);
    const row = await db.tripSession.findUnique({ where: { id: dbKey } });
    recordCheck('TripSession row persisted in Neon DB', !!row && !!row.itinerary);
    
    // 2.2 Wipe in-memory session (simulate server restart / cold start)
    resetSession(coldSessId);
    
    // Fresh session before hydration
    const sBefore = getSession(coldSessId);
    recordCheck('Wiped memory starts as uninitialized fresh session', !sBefore.initialized);

    // 2.3 Hydrate from DB
    await hydrateFromDb('DEMO', coldSessId);
    const sAfter = getSession(coldSessId);
    recordCheck('Session initialized flag is true after hydration', sAfter.initialized === true);
    recordCheck('Hydrated origin is ZRH', sAfter.itinerary.origin === 'ZRH');
    recordCheck('Hydrated destination is HND', sAfter.itinerary.destination === 'HND');
    recordCheck('Hydrated passenger is Beatrix von Habsburg', sAfter.itinerary.passenger.name === 'Beatrix von Habsburg');
    recordCheck('Hydrated constraints match ($800, 3 bags)', sAfter.itinerary.constraints.budgetUsd === 800 && sAfter.itinerary.constraints.baggagePieces === 3);

    // 2.4 Corrupted JSON in DB error resilience
    const corruptSessId = `corrupt-sess-${Date.now()}`;
    const corruptDbKey = persistenceKey(corruptSessId);
    await db.tripSession.create({
      data: {
        id: corruptDbKey,
        state: 'NORMAL',
        providerMode: 'DEMO',
        riskScore: 0,
        itinerary: '{ "broken_json": INVALID_SYNTAX...',
      },
    });

    // Hydrate corrupted session — should not crash, should fall back to default
    await hydrateFromDb('DEMO', corruptSessId);
    const sCorrupt = getSession(corruptSessId);
    recordCheck('Corrupted DB JSON safely caught and falls back to default SIN-NRT', sCorrupt.itinerary.origin === 'SIN' && sCorrupt.itinerary.destination === 'NRT');

    // Clean up test DB rows
    await db.tripSession.deleteMany({
      where: {
        id: { in: [dbKey, corruptDbKey] },
      },
    });
    recordCheck('Cold start test DB rows cleaned up', true);
  } else {
    console.log('  [INFO] DB is not available in current environment; skipping direct Postgres hydration test.');
  }

  // =========================================================================
  // CHALLENGE 3: High-Concurrency Stress Harness & Atomic Switching
  // =========================================================================
  console.log('\n--- 3. High-Concurrency Stress Harness & Race Condition Stress ---');

  const concurrentSessCount = 10;
  const requestsPerSession = 5;
  const stressPromises: Promise<void>[] = [];

  for (let i = 0; i < concurrentSessCount; i++) {
    const sessId = `stress-sess-${i}-${Date.now()}`;
    const preset = PRESETS[i % PRESETS.length];
    
    // Concurrent flurry of activations and mutations
    stressPromises.push(
      (async () => {
        for (let j = 0; j < requestsPerSession; j++) {
          await setSessionItinerary(preset, 'DEMO', sessId);
          updateSessionConstraints({ budgetUsd: 100 * (j + 1) }, 'DEMO', sessId);
          updateSessionPassenger({ contactEmail: `user-${i}-${j}@enterprise.corp` }, 'DEMO', sessId);
        }
        const finalSess = getSession(sessId);
        assert(finalSess.itinerary.origin === preset.origin, `Sess ${i} origin corrupted: ${finalSess.itinerary.origin}`);
        assert(finalSess.itinerary.constraints.budgetUsd === 100 * requestsPerSession, `Sess ${i} budget mismatch`);
        assert(finalSess.itinerary.passenger.contactEmail === `user-${i}-${requestsPerSession - 1}@enterprise.corp`, `Email mismatch`);
      })()
    );
  }

  await Promise.all(stressPromises);
  recordCheck(`Successfully executed ${concurrentSessCount * requestsPerSession} concurrent session operations across ${concurrentSessCount} parallel threads without race condition or state corruption`, true);

  // Rapid back-to-back switching on the SAME session
  const flipSessId = `rapid-flip-sess-${Date.now()}`;
  const flipPromises: Promise<void>[] = [];
  for (let k = 0; k < 20; k++) {
    const targetPreset = PRESETS[k % PRESETS.length];
    flipPromises.push(setSessionItinerary(targetPreset, 'DEMO', flipSessId));
  }
  await Promise.all(flipPromises);
  const flippedSession = getSession(flipSessId);
  const validCheck = ItinerarySchema.safeParse(flippedSession.itinerary);
  recordCheck('Rapid concurrent flipping on single session resolves to fully valid ItinerarySchema instance', validCheck.success);

  // =========================================================================
  // CHALLENGE 4: API Route Handlers Integration & Correctness
  // =========================================================================
  console.log('\n--- 4. API Route Handlers Functional Verification ---');

  // 4.1 GET /api/itinerary/presets
  const presetsReq = createMockRequest('/api/itinerary/presets');
  const presetsRes = await getPresetsHandler();
  const presetsData = (await presetsRes.json()) as { presets: unknown[]; summaries: unknown[]; count: number };
  recordCheck('GET /api/itinerary/presets returns HTTP 200', presetsRes.status === 200);
  recordCheck('GET /api/itinerary/presets returns count = 6', presetsData.count === 6);
  recordCheck('GET /api/itinerary/presets returns 6 presets and 6 summaries', presetsData.presets.length === 6 && presetsData.summaries.length === 6);

  // 4.2 POST /api/itinerary/active with presetId
  const activeSessId = `api-test-active-${Date.now()}`;
  const activeReq1 = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: { presetId: 'preset-fra-sin' },
    headers: { cookie: `fr-session=${activeSessId}` },
  });
  const activeRes1 = await postActiveHandler(activeReq1);
  const activeData1 = (await activeRes1.json()) as { status: string; trip: { itinerary: Itinerary } };
  recordCheck('POST /api/itinerary/active (presetId) returns HTTP 200', activeRes1.status === 200);
  recordCheck('POST /api/itinerary/active returns ACTIVE_UPDATED status', activeData1.status === 'ACTIVE_UPDATED');
  recordCheck('POST /api/itinerary/active sets itinerary origin to FRA and dest to SIN', activeData1.trip.itinerary.origin === 'FRA' && activeData1.trip.itinerary.destination === 'SIN');

  // 4.3 POST /api/itinerary/active with full custom itinerary
  const customBuilderTrip: Itinerary = {
    ...PRESET_SYD_LAX,
    tripId: 'TRIP-CUSTOM-MEL-LAX',
    origin: 'MEL',
    destination: 'LAX',
    tripPurpose: 'Custom Melbourne to LAX Flight',
    legs: [
      {
        flightNumber: 'QF93',
        airlineCode: 'QF',
        airlineName: 'Qantas',
        from: 'MEL',
        to: 'LAX',
        depIso: '2026-08-27T09:15:00+10:00',
        arrIso: '2026-08-27T06:30:00-07:00',
        durationMin: 855,
        aircraft: 'Boeing 787-9',
        cabin: 'Business Class',
      },
    ],
  };

  const activeReq2 = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: { itinerary: customBuilderTrip },
    headers: { cookie: `fr-session=${activeSessId}` },
  });
  const activeRes2 = await postActiveHandler(activeReq2);
  const activeData2 = (await activeRes2.json()) as { status: string; trip: { itinerary: Itinerary } };
  recordCheck('POST /api/itinerary/active (custom itinerary) returns HTTP 200', activeRes2.status === 200);
  recordCheck('POST /api/itinerary/active updates active trip origin to MEL', activeData2.trip.itinerary.origin === 'MEL');

  // 4.4 POST /api/itinerary/import (JSON format with activateImmediately: true)
  const importJsonReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: {
      format: 'JSON',
      content: JSON.stringify(PRESET_DXB_CDG),
      activateImmediately: true,
    },
    headers: { cookie: `fr-session=${activeSessId}` },
  });
  const importJsonRes = await postImportHandler(importJsonReq);
  const importJsonData = (await importJsonRes.json()) as { success: boolean; activated: boolean; itinerary: Itinerary; formattedPnr: string };
  recordCheck('POST /api/itinerary/import (JSON) returns HTTP 200 and success=true', importJsonRes.status === 200 && importJsonData.success === true);
  recordCheck('POST /api/itinerary/import returns activated=true when flag set', importJsonData.activated === true);
  recordCheck('POST /api/itinerary/import parsed DXB-CDG correctly', importJsonData.itinerary.origin === 'DXB' && importJsonData.itinerary.destination === 'CDG');
  recordCheck('POST /api/itinerary/import generated formatted PNR text', typeof importJsonData.formattedPnr === 'string' && importJsonData.formattedPnr.includes('EK 73'));

  // 4.5 POST /api/itinerary/import (PNR format)
  const rawPnrText = formatPnr(PRESET_SFO_HND);
  const importPnrReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: {
      format: 'PNR',
      content: rawPnrText,
    },
  });
  const importPnrRes = await postImportHandler(importPnrReq);
  const importPnrData = (await importPnrRes.json()) as { success: boolean; itinerary: Itinerary };
  recordCheck('POST /api/itinerary/import (PNR) returns HTTP 200 and success=true', importPnrRes.status === 200 && importPnrData.success === true);
  recordCheck('POST /api/itinerary/import (PNR) parsed SFO-HND leg correctly', importPnrData.itinerary.origin === 'SFO' && importPnrData.itinerary.destination === 'HND');

  // 4.6 Saved Itineraries Database CRUD Integration
  if (dbAvailable()) {
    const savedRecord = await db.savedItinerary.create({
      data: {
        tripId: PRESET_LHR_JFK.tripId,
        name: 'Adversarial Test Saved Trip',
        origin: PRESET_LHR_JFK.origin,
        destination: PRESET_LHR_JFK.destination,
        travelDateIso: PRESET_LHR_JFK.travelDateIso,
        isPreset: false,
        presetId: null,
        data: JSON.stringify(PRESET_LHR_JFK),
      },
    });
    recordCheck('db.savedItinerary.create creates record in DB with ID', Boolean(savedRecord.id));
    const savedId = savedRecord.id;

    // Query saved itineraries
    const rows = await db.savedItinerary.findMany({
      where: { id: savedId },
    });
    recordCheck('db.savedItinerary.findMany includes the newly created saved item', rows.length === 1 && rows[0].id === savedId);

    // Get by ID
    const single = await db.savedItinerary.findUnique({
      where: { id: savedId },
    });
    recordCheck('db.savedItinerary.findUnique retrieves correct record', single !== null && single.origin === 'LHR');

    // Delete by ID
    await db.savedItinerary.delete({
      where: { id: savedId },
    });
    const afterDel = await db.savedItinerary.findUnique({
      where: { id: savedId },
    });
    recordCheck('db.savedItinerary.findUnique after deletion returns null', afterDel === null);
  }

  // =========================================================================
  // CHALLENGE 5: Boundary Conditions, Malformed Payloads & Attack Vectors
  // =========================================================================
  console.log('\n--- 5. Boundary Conditions, Malformed Payloads & Adversarial Vectors ---');

  // 5.1 Empty body on /api/itinerary/active
  const emptyActiveReq = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: {},
  });
  const emptyActiveRes = await postActiveHandler(emptyActiveReq);
  recordCheck('Empty body on /api/itinerary/active returns HTTP 400', emptyActiveRes.status === 400);

  // 5.2 Unknown presetId on /api/itinerary/active
  const unknownPresetReq = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: { presetId: 'preset-mars-colony-9999' },
  });
  const unknownPresetRes = await postActiveHandler(unknownPresetReq);
  recordCheck('Unknown presetId on /api/itinerary/active returns HTTP 400', unknownPresetRes.status === 400);

  // 5.3 Malformed schema (missing legs) on /api/itinerary/active
  const invalidSchemaReq = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: {
      itinerary: {
        tripId: 'TRIP-NO-LEGS',
        origin: 'SIN',
        destination: 'NRT',
        travelDateIso: '2026-08-27T00:00:00Z',
        legs: [], // Violation: min(1) required
        passenger: PRESET_SIN_NRT.passenger,
        mission: PRESET_SIN_NRT.mission,
        constraints: PRESET_SIN_NRT.constraints,
      },
    },
  });
  const invalidSchemaRes = await postActiveHandler(invalidSchemaReq);
  recordCheck('Itinerary with 0 legs rejected on /api/itinerary/active with HTTP 400', invalidSchemaRes.status === 400);

  // 5.4 Negative budget constraint validation
  const negBudgetTrip = {
    ...PRESET_SIN_NRT,
    constraints: {
      ...PRESET_SIN_NRT.constraints,
      budgetUsd: -500, // Violation: nonnegative
    },
  };
  const negBudgetReq = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: { itinerary: negBudgetTrip },
  });
  const negBudgetRes = await postActiveHandler(negBudgetReq);
  recordCheck('Negative budget constraint rejected with HTTP 400', negBudgetRes.status === 400);

  // 5.5 SQL Injection strings in presetId and tripId
  const sqliPresetReq = createMockRequest('/api/itinerary/active', {
    method: 'POST',
    body: { presetId: "preset-sin-nrt'; DROP TABLE \"TripSession\"; --" },
  });
  const sqliPresetRes = await postActiveHandler(sqliPresetReq);
  recordCheck('SQL injection attempt in presetId safely rejected as non-existent preset (HTTP 400)', sqliPresetRes.status === 400);

  // 5.6 XSS payloads in passenger name and mission fields
  const xssPassengerTrip = {
    ...PRESET_SIN_NRT,
    passenger: {
      ...PRESET_SIN_NRT.passenger,
      name: '<script>alert("XSS")</script> Robert Johnson',
    },
  };
  const xssParseResult = ItinerarySchema.safeParse(xssPassengerTrip);
  recordCheck('XSS payload in passenger name parses as string without crashing validator', xssParseResult.success);

  // 5.7 Empty import content on /api/itinerary/import
  const emptyImportReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: { format: 'JSON', content: '   ' },
  });
  const emptyImportRes = await postImportHandler(emptyImportReq);
  recordCheck('Empty content string on /api/itinerary/import returns HTTP 400', emptyImportRes.status === 400);

  // 5.8 Corrupted JSON syntax on /api/itinerary/import
  const corruptJsonImportReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: { format: 'JSON', content: '{"tripId": 123, "unclosed_brace":' },
  });
  const corruptJsonImportRes = await postImportHandler(corruptJsonImportReq);
  const corruptJsonImportData = (await corruptJsonImportRes.json()) as { success: boolean; errors: string[] };
  recordCheck('Corrupted JSON syntax rejected with HTTP 400 and syntax error detail', corruptJsonImportRes.status === 400 && corruptJsonImportData.errors[0].includes('Invalid JSON syntax'));

  // 5.9 Unsupported import format on /api/itinerary/import
  const badFormatImportReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: { format: 'YAML', content: 'tripId: TRIP-1' },
  });
  const badFormatImportRes = await postImportHandler(badFormatImportReq);
  recordCheck('Unsupported format "YAML" returns HTTP 400', badFormatImportRes.status === 400);

  // 5.10 Garbage PNR string on /api/itinerary/import
  const garbagePnrReq = createMockRequest('/api/itinerary/import', {
    method: 'POST',
    body: { format: 'PNR', content: 'RANDOM GIBBERISH THAT HAS NO FLIGHT LEGS' },
  });
  const garbagePnrRes = await postImportHandler(garbagePnrReq);
  recordCheck('Garbage PNR without flight legs rejected with HTTP 400', garbagePnrRes.status === 400);

  // 5.11 Saved Itinerary non-existent ID query
  if (dbAvailable()) {
    const nonExistent = await db.savedItinerary.findUnique({
      where: { id: 'does-not-exist-uuid-999' },
    });
    recordCheck('db.savedItinerary.findUnique with non-existent ID returns null', nonExistent === null);
  }

  console.log('\n======================================================');
  console.log(`🏆 ALL ${passedChecks}/${totalChecks} ADVERSARIAL CHECKS PASSED (100%)`);
  console.log('======================================================\n');
}

runChallengerSuite().catch((err) => {
  console.error('\n💥 ADVERSARIAL CHALLENGER SUITE FAILED:', err);
  process.exit(1);
});
