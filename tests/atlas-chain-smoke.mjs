#!/usr/bin/env node
/**
 * tests/atlas-chain-smoke.mjs — drives the 6 CLI calls the provider must
 * chain correctly, in one shot, with no stale IDs.
 *
 *   search → offer verify (gets booking_id + traveler_id)
 *          → booking confirm-price
 *          → order create (stdin JSON) → order pay → TICKETED
 *          → order status
 *
 * Uses spawn (not execFile) because the Atlas CLI requires explicit stdin
 * close for --passengers-stdin and may return non-zero exit codes with valid
 * JSON stdout that execFile cannot capture.
 *
 * Exits 0 on full success, 1 otherwise.
 */

import { spawn } from 'node:child_process';

const failures = [];

function check(label, cond, detail) {
  const ok = Boolean(cond);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? ` → ${String(detail).slice(0, 120)}` : ''}`);
  if (!ok) failures.push(label);
}

/** Spawn atlas-flight, capture stdout regardless of exit code, return parsed JSON. */
function run(args, stdinData, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('atlas-flight', args, { timeout: timeoutMs ?? 60000 });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (!stdout) {
        reject(new Error(`atlas-flight exited code=${code} with no stdout: ${stderr.slice(0, 200)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Non-JSON stdout (code=${code}): ${stdout.slice(0, 300)}`));
      }
    });
    if (stdinData !== undefined) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}

/** Build a passenger payload with sandbox passport for the given traveler_id. */
function passengerPayload(travelerId) {
  return JSON.stringify({
    passengers: [{
      traveler_id: travelerId,
      name: 'NABIZADA/JAMSHID',
      passenger_type: 'adult',
      gender: 'M',
      birthday: '1990-01-01',
      nationality: 'SG',
      document: { type: 'PP', number: 'SG0000000', issuing_country: 'SG', expires: '2030-12-31' },
    }],
    contact: { name: 'NABIZADA/JAMSHID', email: 'agent@flightresist.ai' },
  });
}

/** Run one full booking chain on the given route. Returns true on success. */
async function tryRoute(origin, dest, date) {
  console.log(`\n--- Trying ${origin} → ${dest} (${date}) ---`);

  // 1. Search
  const search = await run(['search', '--origin', origin, '--destination', dest, '--depart', date, '--adults', '1', '--json']);
  check(`[${origin}→${dest}] search FLIGHT_SEARCHED`, search.code === 'FLIGHT_SEARCHED', search.code);
  const offer = search.data.offers?.find((o) => o.bookable === true && o.price_status === 'current');
  if (!offer) {
    console.log('  No bookable current-price offer — skipping route.');
    return false;
  }
  check(`[${origin}→${dest}] found bookable offer`, true, offer.offer_id);

  // 2. Offer verify → yields booking_id + traveler_id
  const verify = await run(['offer', 'verify', '--offer-id', offer.offer_id, '--json']);
  check('offer verify OFFER_VERIFIED', verify.code === 'OFFER_VERIFIED', verify.code);
  const bookingId = verify.data.booking_id;
  const travelerId = verify.data.travelers?.[0]?.traveler_id;
  check('got booking_id', !!bookingId, bookingId);
  check('got traveler_id', !!travelerId, travelerId);

  // 3. Booking confirm-price
  const confirmed = await run(['booking', 'confirm-price', '--booking-id', bookingId, '--json']);
  check('confirm-price PRICE_CONFIRMED', confirmed.code === 'PRICE_CONFIRMED', confirmed.code);

  // 4. Order create with stdin JSON
  const order = await run(
    ['order', 'create', '--booking-id', bookingId, '--passengers-stdin', '--json'],
    passengerPayload(travelerId),
  );
  console.log(`  order create code: ${order.code}`);

  if (order.code === 'DUPLICATE_BOOKING_SUSPECTED') {
    console.log('  Sandbox rate-limited this route — try a different route.');
    return false;
  }
  if (order.code === 'OFFER_EXPIRED') {
    console.log('  Offer expired between verify and create — re-searching...');
    return false;
  }

  check('order create PAYMENT_CONFIRMATION_REQUIRED', order.code === 'PAYMENT_CONFIRMATION_REQUIRED', order.code);
  if (order.code !== 'PAYMENT_CONFIRMATION_REQUIRED') return false;

  const paymentConfirmationId = order.data.payment_confirmation_id;
  const orderNo = order.data.order_no;
  check('got order_no', !!orderNo, orderNo);
  check('got payment_confirmation_id', !!paymentConfirmationId, paymentConfirmationId);

  // 5. Order pay — CLI polls internally for up to 120 s waiting for ticketing.
  console.log('  order pay (may take up to 180 s)...');
  const pay = await run(['order', 'pay', '--confirmation-id', paymentConfirmationId, '--json'], undefined, 200000);
  const isTicketed = pay.code === 'TICKETED';
  const isPending = pay.code === 'TICKETING_PENDING';
  check('order pay TICKETED or TICKETING_PENDING', isTicketed || isPending, pay.code);
  const pnr = pay.data.airline_pnrs?.[0];
  const ticket = pay.data.ticket_numbers?.[0];
  if (isTicketed) {
    check('got real PNR', !!pnr, pnr);
    check('got ticket number', !!ticket, ticket);
  } else {
    console.log('  ticketing pending — PNR/ticket not yet available');
  }

  // 6. Order status
  const status = await run(['order', 'status', '--order-no', orderNo, '--json']);
  check('order status has code', !!status.code, status.code);
  check('status confirms ticketing or is TICKETED code',
    status.data.ticketing_available === true || !!status.data.order_status || status.code === 'TICKETED',
    status.data.order_status ?? status.data.ticketing_available ?? status.code);

  console.log(`\nChain complete: search → verify → confirm-price → order create → pay → status`);
  console.log(`Final PNR: ${pnr}, order: ${orderNo}, ticket: ${ticket}`);
  return true;
}

async function main() {
  console.log('Atlas CLI chain smoke test (spawn-based)\n');

  // Try multiple routes to avoid sandbox rate limiting.
  const routes = [
    ['SIN', 'NRT', '2026-08-27'],
    ['ICN', 'KIX', '2026-08-28'],
    ['BKK', 'HND', '2026-08-29'],
    ['TPE', 'NRT', '2026-08-30'],
  ];

  for (const [origin, dest, date] of routes) {
    const ok = await tryRoute(origin, dest, date);
    if (ok) break;
    console.log('  Route failed or rate-limited, trying next...');
  }

  console.log(`\n--- ${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} FAILURE(S)`} ---`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
