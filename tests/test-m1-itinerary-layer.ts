/**
 * Milestone 1 Comprehensive Verification Suite
 *
 * Tests:
 *  1. Presets Catalog (6 enterprise presets integrity & schemas)
 *  2. PNR Formatter and Bi-directional PNR Parser
 *  3. Round-trip serialization & deserialization fidelity
 *  4. Malformed PNR & JSON error reporting
 *  5. Session Store dynamic itinerary activation and mutation
 *  6. Database model & Prisma schema integration
 */

import { PRESETS, getPresetById, getPresetSummaries, PRESET_SIN_NRT, PRESET_LHR_JFK, PRESET_SFO_HND, PRESET_SYD_LAX, PRESET_DXB_CDG, PRESET_FRA_SIN } from '../src/lib/flightresist/presets';
import { ItinerarySchema, parsePnr, formatPnr } from '../src/lib/flightresist/pnr-parser';
import { getSession, setSessionItinerary, updateSessionConstraints, updateSessionPassenger, updateSessionMission, buildSnapshot } from '../src/lib/flightresist/store';
import { db, dbAvailable } from '../src/lib/db';
import type { Itinerary, ProviderInfo } from '../src/lib/flightresist/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

async function runM1Suite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MILESTONE 1 VERIFICATION SUITE');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Presets Catalog Completeness & Integrity
  // -------------------------------------------------------------------------
  console.log('--- Test 1: Presets Catalog Completeness & Integrity ---');
  assert(PRESETS.length === 6, `Expected 6 presets, got ${PRESETS.length}`);
  
  const expectedPresetIds = [
    'preset-sin-nrt',
    'preset-lhr-jfk',
    'preset-sfo-hnd',
    'preset-syd-lax',
    'preset-dxb-cdg',
    'preset-fra-sin',
  ];

  for (const pid of expectedPresetIds) {
    const preset = getPresetById(pid);
    assert(!!preset, `Preset '${pid}' must be retrievable by ID`);
    assert(preset!.legs.length >= 1, `Preset '${pid}' must have at least 1 leg`);
    assert(!!preset!.passenger.name, `Preset '${pid}' must have a passenger name`);
    assert(!!preset!.mission.title, `Preset '${pid}' must have a mission title`);
    assert(preset!.constraints.budgetUsd > 0, `Preset '${pid}' must have a budget > 0`);
    assert(preset!.constraints.mctMin >= 30, `Preset '${pid}' must have a valid MCT`);

    // Validate against strict Zod ItinerarySchema
    const parseResult = ItinerarySchema.safeParse(preset);
    assert(parseResult.success, `Preset '${pid}' failed Zod validation: ${parseResult.error?.message}`);
    console.log(` ✓ Preset '${pid}' (${preset!.origin} → ${preset!.destination}, ${preset!.passenger.name}) passes Zod schema`);
  }

  const summaries = getPresetSummaries();
  assert(summaries.length === 6, `Expected 6 preset summaries, got ${summaries.length}`);
  assert(summaries[0].legsCount === 2, `SIN-NRT summary should have 2 legs`);
  assert(summaries[1].legsCount === 1, `LHR-JFK summary should have 1 leg`);
  console.log(' ✓ Preset summaries metadata generated correctly');

  // -------------------------------------------------------------------------
  // Test 2: PNR Formatter Formatting Fidelity
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: PNR Formatter Formatting Fidelity ---');
  const sinNrtPnr = formatPnr(PRESET_SIN_NRT);
  assert(sinNrtPnr.includes('SQ 856') || sinNrtPnr.includes('SQ856'), 'SIN-NRT PNR must contain SQ856');
  assert(sinNrtPnr.includes('CX 520') || sinNrtPnr.includes('CX520'), 'SIN-NRT PNR must contain CX520');
  assert(sinNrtPnr.includes('CHEN/WEI'), 'SIN-NRT PNR must format passenger name as CHEN/WEI');
  assert(sinNrtPnr.includes('RM TKT NBR SQ-4471-XK2'), 'SIN-NRT PNR must contain ticket number remark');
  assert(sinNrtPnr.includes('RM BUDGET USD 150'), 'SIN-NRT PNR must contain budget remark');
  assert(sinNrtPnr.includes('RM MISSION TITLE:'), 'SIN-NRT PNR must contain mission remark');
  assert(sinNrtPnr.includes('RM CMT MEETING'), 'SIN-NRT PNR must contain commitment remarks');
  console.log(' ✓ SIN-NRT PNR formatted cleanly with all standard GDS segments and remarks');

  const lhrJfkPnr = formatPnr(PRESET_LHR_JFK);
  assert(lhrJfkPnr.includes('BA 117') || lhrJfkPnr.includes('BA117'), 'LHR-JFK PNR must contain BA117');
  assert(lhrJfkPnr.includes('STERLING/VICTORIA'), 'LHR-JFK PNR must format passenger name as STERLING/VICTORIA');
  assert(lhrJfkPnr.includes('RM BUDGET USD 350'), 'LHR-JFK PNR must contain budget remark 350');
  console.log(' ✓ LHR-JFK Direct PNR formatted cleanly');

  // -------------------------------------------------------------------------
  // Test 3: Bi-directional PNR Parsing & Round-trip Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Bi-directional PNR Parsing & Round-trip Preservation ---');
  for (const preset of PRESETS) {
    const formatted = formatPnr(preset);
    const parsed = parsePnr(formatted);
    assert(parsed.success, `parsePnr failed for preset '${preset.id}': ${parsed.errors?.join(', ')}`);
    assert(!!parsed.itinerary, `parsePnr must return itinerary for preset '${preset.id}'`);

    const roundtrip = parsed.itinerary!;
    assert(roundtrip.origin === preset.origin, `Origin mismatch: expected ${preset.origin}, got ${roundtrip.origin}`);
    assert(roundtrip.destination === preset.destination, `Destination mismatch: expected ${preset.destination}, got ${roundtrip.destination}`);
    assert(roundtrip.legs.length === preset.legs.length, `Legs count mismatch for ${preset.id}`);
    assert(roundtrip.legs[0].flightNumber === preset.legs[0].flightNumber, `First flight number mismatch for ${preset.id}`);
    assert(roundtrip.passenger.name.toLowerCase() === preset.passenger.name.toLowerCase(), `Passenger name mismatch: ${roundtrip.passenger.name} vs ${preset.passenger.name}`);
    assert(roundtrip.constraints.budgetUsd === preset.constraints.budgetUsd, `Budget mismatch: ${roundtrip.constraints.budgetUsd} vs ${preset.constraints.budgetUsd}`);
    assert(roundtrip.constraints.mctMin === preset.constraints.mctMin, `MCT mismatch: ${roundtrip.constraints.mctMin} vs ${preset.constraints.mctMin}`);

    // Re-verify round-tripped itinerary against schema
    const val = ItinerarySchema.safeParse(roundtrip);
    assert(val.success, `Round-tripped itinerary for '${preset.id}' failed Zod validation: ${val.error?.message}`);
    console.log(` ✓ Round-trip fidelity verified for ${preset.id} (${preset.origin} → ${preset.destination})`);
  }

  // -------------------------------------------------------------------------
  // Test 4: Error Handling on Corrupted PNR / JSON
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Error Handling on Corrupted PNR / JSON ---');
  const emptyPnrResult = parsePnr('');
  assert(!emptyPnrResult.success, 'Empty PNR must fail');
  assert(emptyPnrResult.errors!.length > 0, 'Empty PNR must return error message');

  const nonsensePnrResult = parsePnr('THIS IS NOT A VALID PNR STRING AT ALL\nJUST SOME RANDOM TEXT');
  assert(!nonsensePnrResult.success, 'Nonsense PNR without segments must fail');
  console.log(' ✓ Malformed PNR text correctly rejected with descriptive error');

  const invalidJson = { tripId: 'TRIP-1', origin: 'INVALID_LONG_CODE' };
  const invalidJsonResult = ItinerarySchema.safeParse(invalidJson);
  assert(!invalidJsonResult.success, 'Invalid schema JSON must fail safeParse');
  console.log(' ✓ Invalid JSON structure rejected by ItinerarySchema');

  // -------------------------------------------------------------------------
  // Test 5: Dynamic Session Store & State Mutations
  // -------------------------------------------------------------------------
  console.log('\n--- Test 5: Dynamic Session Store & State Mutations ---');
  const testSessionId = 'test-m1-session-' + Date.now();
  
  // Activate LHR-JFK on test session
  await setSessionItinerary(PRESET_LHR_JFK, 'DEMO', testSessionId);
  const session = getSession(testSessionId);
  assert(session.itinerary.tripId === PRESET_LHR_JFK.tripId, `Session itinerary tripId mismatch: expected ${PRESET_LHR_JFK.tripId}, got ${session.itinerary.tripId}`);
  assert(session.itinerary.origin === 'LHR', `Expected origin LHR, got ${session.itinerary.origin}`);
  assert(session.state === 'NORMAL', 'Session state must reset to NORMAL after itinerary change');
  console.log(' ✓ Session itinerary successfully set to LHR-JFK');

  // Mutate constraints
  updateSessionConstraints({ budgetUsd: 600, mctMin: 95 }, 'DEMO', testSessionId);
  assert(session.itinerary.constraints.budgetUsd === 600, `Expected updated budget 600, got ${session.itinerary.constraints.budgetUsd}`);
  assert(session.itinerary.constraints.mctMin === 95, `Expected updated MCT 95, got ${session.itinerary.constraints.mctMin}`);
  console.log(' ✓ Dynamic constraints updated to $600 budget and 95m MCT');

  // Mutate passenger profile
  updateSessionPassenger({ name: 'Lady Victoria Sterling-Cross', loyaltyTier: 'Premier Executive' }, 'DEMO', testSessionId);
  assert(session.itinerary.passenger.name === 'Lady Victoria Sterling-Cross', 'Passenger name should be updated');
  console.log(' ✓ Dynamic passenger profile updated');

  // Mutate mission context
  updateSessionMission({ dealValue: 55000000, title: '$55M Expanded Transatlantic Buyout' }, 'DEMO', testSessionId);
  assert(session.itinerary.mission.dealValue === 55000000, 'Deal value should be updated');
  assert(session.itinerary.tripPurpose === '$55M Expanded Transatlantic Buyout', 'Trip purpose should be updated');
  console.log(' ✓ Dynamic mission context updated');

  // Verify buildSnapshot reflects the dynamic itinerary
  const mockProvider: ProviderInfo = { mode: 'DEMO', badge: '[DEMO]', label: 'Demo', probeDetail: 'ok' };
  const snapshot = buildSnapshot(mockProvider, testSessionId);
  assert(snapshot.itinerary.origin === 'LHR', `Snapshot origin mismatch`);
  assert(snapshot.itinerary.constraints.budgetUsd === 600, `Snapshot budget mismatch`);
  console.log(' ✓ buildSnapshot() accurately outputs dynamic session itinerary and constraints');

  // -------------------------------------------------------------------------
  // Test 6: Database Persistence Integration
  // -------------------------------------------------------------------------
  console.log('\n--- Test 6: Database Persistence Integration ---');
  if (dbAvailable()) {
    const dbTestKey = `TEST-PERSIST-${Date.now()}`;
    await db.tripSession.create({
      data: {
        id: dbTestKey,
        state: 'NORMAL',
        providerMode: 'DEMO',
        riskScore: 0,
        itinerary: JSON.stringify(PRESET_SFO_HND),
      },
    });

    const queried = await db.tripSession.findUnique({ where: { id: dbTestKey } });
    assert(!!queried, 'TripSession row must exist in DB');
    assert(!!queried!.itinerary, 'TripSession.itinerary column must not be null');
    const parsedDbItinerary = JSON.parse(queried!.itinerary!) as Itinerary;
    assert(parsedDbItinerary.origin === 'SFO', `DB origin mismatch: expected SFO, got ${parsedDbItinerary.origin}`);
    assert(parsedDbItinerary.destination === 'HND', `DB destination mismatch: expected HND, got ${parsedDbItinerary.destination}`);
    console.log(' ✓ TripSession.itinerary persisted and queried from database successfully');

    // Test SavedItinerary model
    const savedRec = await db.savedItinerary.create({
      data: {
        tripId: PRESET_DXB_CDG.tripId,
        name: 'Dubai Luxury JV Trip',
        origin: PRESET_DXB_CDG.origin,
        destination: PRESET_DXB_CDG.destination,
        travelDateIso: PRESET_DXB_CDG.travelDateIso,
        isPreset: true,
        presetId: PRESET_DXB_CDG.id,
        data: JSON.stringify(PRESET_DXB_CDG),
      },
    });

    assert(!!savedRec.id, 'SavedItinerary record must have an ID');
    const queriedSaved = await db.savedItinerary.findUnique({ where: { id: savedRec.id } });
    assert(!!queriedSaved, 'SavedItinerary record must be queryable');
    assert(queriedSaved!.name === 'Dubai Luxury JV Trip', 'SavedItinerary name mismatch');
    console.log(' ✓ SavedItinerary model created and verified in database');

    // Clean up test rows
    await db.tripSession.delete({ where: { id: dbTestKey } });
    await db.savedItinerary.delete({ where: { id: savedRec.id } });
    console.log(' ✓ Test DB rows cleaned up');
  } else {
    console.log(' ℹ DB unavailable (serverless / no write access), skipping DB query test');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL MILESTONE 1 VERIFICATION TESTS PASSED (100%)');
  console.log('======================================================\n');
}

runM1Suite().catch((err) => {
  console.error('\n❌ Milestone 1 Suite Failed:', err);
  process.exit(1);
});
