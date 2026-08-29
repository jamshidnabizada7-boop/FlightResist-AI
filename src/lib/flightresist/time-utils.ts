/**
 * FlightResist AI — browser-local time + timezone display helpers.
 *
 * NOTE: unlike `format.ts` (deterministic airport-local clock rendering),
 * these helpers intentionally use the *browser's* timezone so travelers can
 * read every flight time in their own local clock. The components that use
 * them only render after the client-side session fetch completes, so they
 * never run during SSR/prerender (no hydration mismatch).
 */

import { getAirport, GLOBAL_AIRPORTS } from './airports-data';

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

/** Global airport IATA code → common timezone abbreviation mapping */
const AIRPORT_TZ: Record<string, string> = {
  // Asia
  SIN: 'SGT', NRT: 'JST', HND: 'JST', KIX: 'JST', FUK: 'JST', CTS: 'JST', NGO: 'JST',
  HKG: 'HKT', TPE: 'CST', TSA: 'CST', KHH: 'CST', KUL: 'MYT', PEN: 'MYT',
  BKK: 'ICT', DMK: 'ICT', HKT: 'ICT', CNX: 'ICT', SGN: 'ICT', HAN: 'ICT', DAD: 'ICT',
  MNL: 'PHT', CEB: 'PHT', ICN: 'KST', GMP: 'KST', PUS: 'KST',
  PVG: 'CST', SHA: 'CST', PEK: 'CST', PKX: 'CST', CAN: 'CST', SZX: 'CST', CTU: 'CST', TFU: 'CST',
  DEL: 'IST', BOM: 'IST', BLR: 'IST', CGK: 'WIB', DPS: 'WITA',
  // Europe
  LHR: 'BST', LGW: 'BST', CDG: 'CEST', ORY: 'CEST', FRA: 'CEST', MUC: 'CEST',
  AMS: 'CEST', MAD: 'CEST', BCN: 'CEST', FCO: 'CEST', MXP: 'CEST', ZRH: 'CEST',
  VIE: 'CEST', BRU: 'CEST', CPH: 'CEST', ARN: 'CEST', OSL: 'CEST', HEL: 'EEST',
  IST: 'TRT', SAW: 'TRT', ATH: 'EEST', DUB: 'IST', LIS: 'WEST',
  // North America
  JFK: 'EDT', EWR: 'EDT', LGA: 'EDT', BOS: 'EDT', IAD: 'EDT', DCA: 'EDT',
  ORD: 'CDT', MDW: 'CDT', ATL: 'EDT', MIA: 'EDT', DFW: 'CDT', IAH: 'CDT',
  DEN: 'MDT', SFO: 'PDT', LAX: 'PDT', SEA: 'PDT', LAS: 'PDT', PHX: 'MST',
  YVR: 'PDT', YYZ: 'EDT', YUL: 'EDT', MEX: 'CST', CUN: 'EST',
  // South America
  GRU: 'BRT', GIG: 'BRT', BOG: 'COT', EZE: 'ART', SCL: 'CLT', LIM: 'PET',
  // Oceania
  SYD: 'AEST', MEL: 'AEST', BNE: 'AEST', PER: 'AWST', AKL: 'NZST', CHC: 'NZST', NAN: 'FJT',
  // Middle East & Africa
  DXB: 'GST', DOH: 'AST', AUH: 'GST', RUH: 'AST', JED: 'AST', CAI: 'EET',
  JNB: 'SAST', CPT: 'SAST', NBO: 'EAT', ADD: 'EAT', CMN: 'WEST',
};

/**
 * Common timezone abbreviation for an airport IATA code (e.g. SIN → SGT, LHR → BST, JFK → EDT).
 * Falls back to dynamic UTC offset string or '' for unknown codes.
 */
export function airportTz(iata: string): string {
  if (!iata) return '';
  const code = iata.trim().toUpperCase();
  if (AIRPORT_TZ[code]) return AIRPORT_TZ[code];
  const airport = getAirport(code);
  if (airport) {
    const sign = airport.tzOffset >= 0 ? '+' : '-';
    return `UTC${sign}${Math.abs(airport.tzOffset)}`;
  }
  return '';
}

/**
 * Get full timezone name from abbreviation or airport IATA code.
 */
export function timezoneFullName(abbr: string): string {
  if (!abbr) return '';
  const code = abbr.trim().toUpperCase();

  // If it's a registered airport code, return formatted airport city time
  const airport = getAirport(code);
  if (airport) {
    const sign = airport.tzOffset >= 0 ? '+' : '-';
    const tzStr = `UTC${sign}${Math.abs(airport.tzOffset)}`;
    return `${airport.city} Time (${tzStr})`;
  }

  const names: Record<string, string> = {
    'JST': 'Japan Standard Time (UTC+9)',
    'SGT': 'Singapore Time (UTC+8)',
    'ICT': 'Indochina Time (UTC+7)',
    'CST': 'China Standard Time (UTC+8)',
    'EDT': 'Eastern Daylight Time (UTC-4)',
    'EST': 'Eastern Standard Time (UTC-5)',
    'CDT': 'Central Daylight Time (UTC-5)',
    'MDT': 'Mountain Daylight Time (UTC-6)',
    'MST': 'Mountain Standard Time (UTC-7)',
    'PDT': 'Pacific Daylight Time (UTC-7)',
    'PST': 'Pacific Standard Time (UTC-8)',
    'BST': 'British Summer Time (UTC+1)',
    'GMT': 'Greenwich Mean Time (UTC+0)',
    'UTC': 'Coordinated Universal Time (UTC+0)',
    'CEST': 'Central European Summer Time (UTC+2)',
    'CET': 'Central European Time (UTC+1)',
    'EEST': 'Eastern European Summer Time (UTC+3)',
    'EET': 'Eastern European Time (UTC+2)',
    'TRT': 'Turkey Time (UTC+3)',
    'GST': 'Gulf Standard Time (UTC+4)',
    'AST': 'Arabia Standard Time (UTC+3)',
    'SAST': 'South Africa Standard Time (UTC+2)',
    'EAT': 'East Africa Time (UTC+3)',
    'WEST': 'Western European Summer Time (UTC+1)',
    'AEST': 'Australian Eastern Standard Time (UTC+10)',
    'AEDT': 'Australian Eastern Daylight Time (UTC+11)',
    'AWST': 'Australian Western Standard Time (UTC+8)',
    'NZST': 'New Zealand Standard Time (UTC+12)',
    'NZDT': 'New Zealand Daylight Time (UTC+13)',
    'BRT': 'Brasilia Time (UTC-3)',
    'ART': 'Argentina Time (UTC-3)',
    'COT': 'Colombia Time (UTC-5)',
    'PET': 'Peru Time (UTC-5)',
    'CLT': 'Chile Standard Time (UTC-4)',
    'WIB': 'Western Indonesia Time (UTC+7)',
    'WITA': 'Central Indonesia Time (UTC+8)',
    'HKT': 'Hong Kong Time (UTC+8)',
    'MYT': 'Malaysia Time (UTC+8)',
    'KST': 'Korea Standard Time (UTC+9)',
    'PHT': 'Philippine Time (UTC+8)',
  };

  return names[code] ?? abbr;
}
