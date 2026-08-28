/**
 * FlightResist AI — browser-local time + timezone display helpers.
 *
 * NOTE: unlike `format.ts` (deterministic airport-local clock rendering),
 * these helpers intentionally use the *browser's* timezone so travelers can
 * read every flight time in their own local clock. The components that use
 * them only render after the client-side session fetch completes, so they
 * never run during SSR/prerender (no hydration mismatch).
 */

/**
 * Convert an ISO time string to the user's local timezone display
 */
export function toLocalTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Get full timezone name from abbreviation.
 * Accepts common timezone abbreviations (JST, SGT, …) as well as the IATA
 * airport codes used by the demo routing (SIN, NRT, HKG, …).
 */
export function timezoneFullName(abbr: string): string {
  const names: Record<string, string> = {
    'JST': 'Japan Standard Time (UTC+9)',
    'SGT': 'Singapore Time (UTC+8)',
    'SIN': 'Singapore Time (UTC+8)',
    'NRT': 'Japan Standard Time (UTC+9)',
    'ICT': 'Indochina Time (UTC+7)',
    'CST': 'China Standard Time (UTC+8)',
    'EST': 'Eastern Standard Time (UTC-5)',
    'PST': 'Pacific Standard Time (UTC-8)',
    'GMT': 'Greenwich Mean Time (UTC+0)',
    'UTC': 'Coordinated Universal Time (UTC+0)',
    // Hub airports on the SIN → NRT demo routing + their abbreviations
    'HKG': 'Hong Kong Time (UTC+8)',
    'HKT': 'Hong Kong Time (UTC+8)',
    'TPE': 'Taipei Time (UTC+8)',
    'KUL': 'Malaysia Time (UTC+8)',
    'MYT': 'Malaysia Time (UTC+8)',
    'ICN': 'Korea Standard Time (UTC+9)',
    'KST': 'Korea Standard Time (UTC+9)',
    'BKK': 'Indochina Time (UTC+7)',
    'SGN': 'Indochina Time (UTC+7)',
    'MNL': 'Philippine Time (UTC+8)',
    'PHT': 'Philippine Time (UTC+8)',
  };
  return names[abbr] ?? abbr;
}

/** IATA airport code → common timezone abbreviation (demo routing scope). */
const AIRPORT_TZ: Record<string, string> = {
  SIN: 'SGT',
  NRT: 'JST',
  HKG: 'HKT',
  TPE: 'CST',
  KUL: 'MYT',
  BKK: 'ICT',
  SGN: 'ICT',
  MNL: 'PHT',
  ICN: 'KST',
};

/**
 * Common timezone abbreviation for an airport IATA code (e.g. SIN → SGT).
 * Returns '' for unmapped airports so callers can skip rendering.
 */
export function airportTz(iata: string): string {
  return AIRPORT_TZ[iata] ?? '';
}
