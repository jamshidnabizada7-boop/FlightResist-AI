/**
 * FlightResist AI 2.0 — Global Airline Database & Fleet Intelligence
 *
 * Comprehensive global airline directory covering Star Alliance, oneworld,
 * SkyTeam, Independent global flag carriers, and Low-Cost Carriers (LCCs).
 * Provides on-time performance (OTP) ratings, default widebody/narrowbody aircraft,
 * hub assignments, and baggage allowances.
 */

export type AirlineAlliance = 'STAR_ALLIANCE' | 'ONEWORLD' | 'SKYTEAM' | 'INDEPENDENT' | 'LCC';

export interface BaggagePolicy {
  pieces: number;
  weightKg: number;
}

export interface AirlineData {
  code: string;
  name: string;
  alliance: AirlineAlliance;
  primaryHubs: string[];
  otp: number; // 0.65 - 1.0 (on-time performance)
  defaultAircraft: string;
  baggagePolicy: BaggagePolicy;
}

export const GLOBAL_AIRLINES: Record<string, AirlineData> = {
  // -------------------------------------------------------------------------
  // STAR ALLIANCE
  // -------------------------------------------------------------------------
  SQ: { code: 'SQ', name: 'Singapore Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['SIN'], otp: 0.89, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 32 } },
  NH: { code: 'NH', name: 'All Nippon Airways', alliance: 'STAR_ALLIANCE', primaryHubs: ['HND', 'NRT'], otp: 0.91, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  LH: { code: 'LH', name: 'Lufthansa', alliance: 'STAR_ALLIANCE', primaryHubs: ['FRA', 'MUC'], otp: 0.82, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 23 } },
  UA: { code: 'UA', name: 'United Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ORD', 'SFO', 'EWR', 'DEN', 'IAH', 'IAD', 'LAX'], otp: 0.78, defaultAircraft: 'B777-200ER', baggagePolicy: { pieces: 1, weightKg: 23 } },
  BR: { code: 'BR', name: 'EVA Air', alliance: 'STAR_ALLIANCE', primaryHubs: ['TPE'], otp: 0.88, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TG: { code: 'TG', name: 'Thai Airways', alliance: 'STAR_ALLIANCE', primaryHubs: ['BKK'], otp: 0.81, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  OZ: { code: 'OZ', name: 'Asiana Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ICN'], otp: 0.85, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TK: { code: 'TK', name: 'Turkish Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['IST'], otp: 0.84, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  NZ: { code: 'NZ', name: 'Air New Zealand', alliance: 'STAR_ALLIANCE', primaryHubs: ['AKL'], otp: 0.87, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  AC: { code: 'AC', name: 'Air Canada', alliance: 'STAR_ALLIANCE', primaryHubs: ['YYZ', 'YVR', 'YUL'], otp: 0.76, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 1, weightKg: 23 } },
  LX: { code: 'LX', name: 'Swiss International Air Lines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ZRH'], otp: 0.83, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 1, weightKg: 23 } },
  OS: { code: 'OS', name: 'Austrian Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['VIE'], otp: 0.84, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 1, weightKg: 23 } },
  SK: { code: 'SK', name: 'SAS Scandinavian Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['CPH', 'ARN', 'OSL'], otp: 0.81, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 23 } },
  SN: { code: 'SN', name: 'Brussels Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['BRU'], otp: 0.79, defaultAircraft: 'A330-300', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AI: { code: 'AI', name: 'Air India', alliance: 'STAR_ALLIANCE', primaryHubs: ['DEL', 'BOM'], otp: 0.72, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 2, weightKg: 23 } },
  ET: { code: 'ET', name: 'Ethiopian Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ADD'], otp: 0.80, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TP: { code: 'TP', name: 'TAP Air Portugal', alliance: 'STAR_ALLIANCE', primaryHubs: ['LIS'], otp: 0.74, defaultAircraft: 'A330-900neo', baggagePolicy: { pieces: 1, weightKg: 23 } },

  // -------------------------------------------------------------------------
  // ONEWORLD
  // -------------------------------------------------------------------------
  CX: { code: 'CX', name: 'Cathay Pacific', alliance: 'ONEWORLD', primaryHubs: ['HKG'], otp: 0.84, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  JL: { code: 'JL', name: 'Japan Airlines', alliance: 'ONEWORLD', primaryHubs: ['HND', 'NRT'], otp: 0.92, defaultAircraft: 'A350-1000', baggagePolicy: { pieces: 2, weightKg: 23 } },
  BA: { code: 'BA', name: 'British Airways', alliance: 'ONEWORLD', primaryHubs: ['LHR', 'LGW'], otp: 0.79, defaultAircraft: 'B777-200', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AA: { code: 'AA', name: 'American Airlines', alliance: 'ONEWORLD', primaryHubs: ['DFW', 'MIA', 'ORD', 'JFK', 'CLT', 'PHX', 'LAX'], otp: 0.76, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 1, weightKg: 23 } },
  QF: { code: 'QF', name: 'Qantas', alliance: 'ONEWORLD', primaryHubs: ['SYD', 'MEL', 'BNE', 'PER'], otp: 0.83, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 30 } },
  QR: { code: 'QR', name: 'Qatar Airways', alliance: 'ONEWORLD', primaryHubs: ['DOH'], otp: 0.90, defaultAircraft: 'A350-1000', baggagePolicy: { pieces: 2, weightKg: 30 } },
  MH: { code: 'MH', name: 'Malaysia Airlines', alliance: 'ONEWORLD', primaryHubs: ['KUL'], otp: 0.80, defaultAircraft: 'A330-300', baggagePolicy: { pieces: 2, weightKg: 23 } },
  IB: { code: 'IB', name: 'Iberia', alliance: 'ONEWORLD', primaryHubs: ['MAD'], otp: 0.86, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AY: { code: 'AY', name: 'Finnair', alliance: 'ONEWORLD', primaryHubs: ['HEL'], otp: 0.85, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AT: { code: 'AT', name: 'Royal Air Maroc', alliance: 'ONEWORLD', primaryHubs: ['CMN'], otp: 0.78, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 2, weightKg: 23 } },
  FJ: { code: 'FJ', name: 'Fiji Airways', alliance: 'ONEWORLD', primaryHubs: ['NAN'], otp: 0.82, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 30 } },

  // -------------------------------------------------------------------------
  // SKYTEAM
  // -------------------------------------------------------------------------
  AF: { code: 'AF', name: 'Air France', alliance: 'SKYTEAM', primaryHubs: ['CDG', 'ORY'], otp: 0.81, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 1, weightKg: 23 } },
  KL: { code: 'KL', name: 'KLM Royal Dutch Airlines', alliance: 'SKYTEAM', primaryHubs: ['AMS'], otp: 0.83, defaultAircraft: 'B787-10', baggagePolicy: { pieces: 1, weightKg: 23 } },
  DL: { code: 'DL', name: 'Delta Air Lines', alliance: 'SKYTEAM', primaryHubs: ['ATL', 'MSP', 'DTW', 'JFK', 'SEA', 'BOS', 'LAX', 'SLC'], otp: 0.85, defaultAircraft: 'A330-900neo', baggagePolicy: { pieces: 1, weightKg: 23 } },
  KE: { code: 'KE', name: 'Korean Air', alliance: 'SKYTEAM', primaryHubs: ['ICN', 'GMP'], otp: 0.86, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  CI: { code: 'CI', name: 'China Airlines', alliance: 'SKYTEAM', primaryHubs: ['TPE'], otp: 0.84, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  VN: { code: 'VN', name: 'Vietnam Airlines', alliance: 'SKYTEAM', primaryHubs: ['HAN', 'SGN'], otp: 0.80, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  GA: { code: 'GA', name: 'Garuda Indonesia', alliance: 'SKYTEAM', primaryHubs: ['CGK', 'DPS'], otp: 0.88, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  AM: { code: 'AM', name: 'Aeromexico', alliance: 'SKYTEAM', primaryHubs: ['MEX'], otp: 0.82, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 1, weightKg: 23 } },
  SV: { code: 'SV', name: 'Saudia', alliance: 'SKYTEAM', primaryHubs: ['JED', 'RUH'], otp: 0.83, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },

  // -------------------------------------------------------------------------
  // INDEPENDENT GLOBAL CARRIERS
  // -------------------------------------------------------------------------
  EK: { code: 'EK', name: 'Emirates', alliance: 'INDEPENDENT', primaryHubs: ['DXB'], otp: 0.88, defaultAircraft: 'A380-800', baggagePolicy: { pieces: 2, weightKg: 30 } },
  EY: { code: 'EY', name: 'Etihad Airways', alliance: 'INDEPENDENT', primaryHubs: ['AUH'], otp: 0.86, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  PR: { code: 'PR', name: 'Philippine Airlines', alliance: 'INDEPENDENT', primaryHubs: ['MNL', 'CEB'], otp: 0.76, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  LA: { code: 'LA', name: 'LATAM Airlines', alliance: 'INDEPENDENT', primaryHubs: ['GRU', 'SCL', 'LIM', 'BOG'], otp: 0.85, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 1, weightKg: 23 } },

  // -------------------------------------------------------------------------
  // LOW-COST CARRIERS (LCC)
  // -------------------------------------------------------------------------
  TR: { code: 'TR', name: 'Scoot', alliance: 'LCC', primaryHubs: ['SIN'], otp: 0.77, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 0, weightKg: 0 } },
  UO: { code: 'UO', name: 'HK Express', alliance: 'LCC', primaryHubs: ['HKG'], otp: 0.79, defaultAircraft: 'A321neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  WN: { code: 'WN', name: 'Southwest Airlines', alliance: 'LCC', primaryHubs: ['DAL', 'MDW', 'HOU', 'DEN', 'PHX', 'LAS'], otp: 0.77, defaultAircraft: 'B737-800', baggagePolicy: { pieces: 2, weightKg: 23 } },
  FR: { code: 'FR', name: 'Ryanair', alliance: 'LCC', primaryHubs: ['DUB', 'STN', 'BGY'], otp: 0.82, defaultAircraft: 'B737-8200', baggagePolicy: { pieces: 0, weightKg: 0 } },
  U2: { code: 'U2', name: 'easyJet', alliance: 'LCC', primaryHubs: ['LGW', 'LTN', 'GVA'], otp: 0.78, defaultAircraft: 'A320neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  MM: { code: 'MM', name: 'Peach Aviation', alliance: 'LCC', primaryHubs: ['KIX', 'NRT'], otp: 0.79, defaultAircraft: 'A320neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  VJ: { code: 'VJ', name: 'VietJet Air', alliance: 'LCC', primaryHubs: ['SGN', 'HAN'], otp: 0.73, defaultAircraft: 'A321neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  FD: { code: 'FD', name: 'Thai AirAsia', alliance: 'LCC', primaryHubs: ['DMK'], otp: 0.75, defaultAircraft: 'A320neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  TW: { code: 'TW', name: "T'way Air", alliance: 'LCC', primaryHubs: ['ICN', 'GMP'], otp: 0.78, defaultAircraft: 'A330-300', baggagePolicy: { pieces: 1, weightKg: 15 } },
  ZG: { code: 'ZG', name: 'ZIPAIR Tokyo', alliance: 'LCC', primaryHubs: ['NRT'], otp: 0.87, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 0, weightKg: 0 } },
};

/**
 * Retrieve airline details by 2-letter IATA carrier code.
 */
export function getAirline(code: string): AirlineData | undefined {
  if (!code || typeof code !== 'string') return undefined;
  return GLOBAL_AIRLINES[code.trim().toUpperCase()];
}

/**
 * Retrieve all registered airlines.
 */
export function getAllAirlines(): AirlineData[] {
  return Object.values(GLOBAL_AIRLINES);
}

/**
 * Identify relevant airlines for a given origin/destination route.
 * Prioritizes carriers with primary hubs at origin or destination, followed by global alliance members.
 */
export function getAirlinesForRoute(from: string, to: string): AirlineData[] {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  const all = Object.values(GLOBAL_AIRLINES);

  const homeCarriers = all.filter(
    (a) => a.primaryHubs.includes(fromUpper) || a.primaryHubs.includes(toUpper),
  );

  const otherCarriers = all.filter(
    (a) => !a.primaryHubs.includes(fromUpper) && !a.primaryHubs.includes(toUpper),
  );

  return [...homeCarriers, ...otherCarriers];
}

export function getAirlineName(code: string): string {
  return GLOBAL_AIRLINES[code.toUpperCase()]?.name || code;
}

