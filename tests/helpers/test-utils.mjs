// tests/helpers/test-utils.mjs
// Unified test harness, oracles, and specification helpers for FlightResist AI 2.0 test suites.

import assert from 'node:assert';

// ---------------------------------------------------------------------------
// 1. Lightweight Test Runner Harness
// ---------------------------------------------------------------------------

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    this.results = [];
    for (const t of this.tests) {
      const start = performance.now();
      try {
        await t.fn();
        const durationMs = performance.now() - start;
        this.results.push({ name: t.name, status: 'pass', durationMs });
      } catch (err) {
        const durationMs = performance.now() - start;
        this.results.push({ name: t.name, status: 'fail', error: err, durationMs });
      }
    }
    return this.results;
  }
}

export function createTestSuite(name) {
  return new TestSuite(name);
}

// ---------------------------------------------------------------------------
// 2. Global Airport & Airline Knowledge Base Reference Data (F5)
// ---------------------------------------------------------------------------

export const GLOBAL_AIRPORTS = {
  SIN: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'SG', lat: 1.3644, lon: 103.9915, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  HKG: { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'HK', lat: 22.3080, lon: 113.9185, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  NRT: { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'JP', lat: 35.7720, lon: 140.3929, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  HND: { iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'JP', lat: 35.5494, lon: 139.7798, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  ICN: { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'KR', lat: 37.4602, lon: 126.4407, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  TPE: { iata: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'TW', lat: 25.0797, lon: 121.2342, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  KUL: { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'MY', lat: 2.7456, lon: 101.7072, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  BKK: { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'TH', lat: 13.6900, lon: 100.7501, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  DMK: { iata: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'TH', lat: 13.9126, lon: 100.6068, tzOffset: 7, isMajorHub: false, region: 'ASIA' },
  SGN: { iata: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'VN', lat: 10.8185, lon: 106.6520, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  HAN: { iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'VN', lat: 21.2212, lon: 105.8072, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  MNL: { iata: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'PH', lat: 14.5086, lon: 121.0194, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  PVG: { iata: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'CN', lat: 31.1443, lon: 121.8083, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  PEK: { iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'CN', lat: 40.0799, lon: 116.6031, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  PKX: { iata: 'PKX', name: 'Beijing Daxing International Airport', city: 'Beijing', country: 'CN', lat: 39.5098, lon: 116.4105, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  CAN: { iata: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'CN', lat: 23.3924, lon: 113.2988, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  DEL: { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'IN', lat: 28.5562, lon: 77.1000, tzOffset: 5.5, isMajorHub: true, region: 'ASIA' },
  BOM: { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj Airport', city: 'Mumbai', country: 'IN', lat: 19.0896, lon: 72.8656, tzOffset: 5.5, isMajorHub: true, region: 'ASIA' },
  DXB: { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'AE', lat: 25.2532, lon: 55.3657, tzOffset: 4, isMajorHub: true, region: 'ME_AFRICA' },
  DOH: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'QA', lat: 25.2731, lon: 51.6081, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  AUH: { iata: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'AE', lat: 24.4330, lon: 54.6511, tzOffset: 4, isMajorHub: true, region: 'ME_AFRICA' },
  IST: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'TR', lat: 41.2753, lon: 28.7519, tzOffset: 3, isMajorHub: true, region: 'EUROPE' },
  LHR: { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'GB', lat: 51.4700, lon: -0.4543, tzOffset: 1, isMajorHub: true, region: 'EUROPE' },
  LGW: { iata: 'LGW', name: 'London Gatwick Airport', city: 'London', country: 'GB', lat: 51.1537, lon: -0.1821, tzOffset: 1, isMajorHub: false, region: 'EUROPE' },
  CDG: { iata: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'FR', lat: 49.0097, lon: 2.5479, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  FRA: { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'DE', lat: 50.0379, lon: 8.5622, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  MUC: { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'DE', lat: 48.3537, lon: 11.7750, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  AMS: { iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'NL', lat: 52.3105, lon: 4.7683, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  MAD: { iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'ES', lat: 40.4839, lon: -3.5680, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  FCO: { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'IT', lat: 41.8003, lon: 12.2389, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  ZRH: { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'CH', lat: 47.4582, lon: 8.5555, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  VIE: { iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'AT', lat: 48.1103, lon: 16.5697, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  JFK: { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'US', lat: 40.6413, lon: -73.7781, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  EWR: { iata: 'EWR', name: 'Newark Liberty International Airport', city: 'New York/Newark', country: 'US', lat: 40.6895, lon: -74.1745, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  BOS: { iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'US', lat: 42.3656, lon: -71.0096, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  ORD: { iata: 'ORD', name: 'O Hare International Airport', city: 'Chicago', country: 'US', lat: 41.9742, lon: -87.9073, tzOffset: -5, isMajorHub: true, region: 'NAMER' },
  ATL: { iata: 'ATL', name: 'Hartsfield–Jackson Atlanta Airport', city: 'Atlanta', country: 'US', lat: 33.6407, lon: -84.4277, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  MIA: { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'US', lat: 25.7959, lon: -80.2870, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  DFW: { iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'US', lat: 32.8998, lon: -97.0403, tzOffset: -5, isMajorHub: true, region: 'NAMER' },
  DEN: { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'US', lat: 39.8561, lon: -104.6737, tzOffset: -6, isMajorHub: true, region: 'NAMER' },
  SFO: { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'US', lat: 37.6213, lon: -122.3790, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  LAX: { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'US', lat: 33.9416, lon: -118.4085, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  SEA: { iata: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'US', lat: 47.4502, lon: -122.3088, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  YVR: { iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'CA', lat: 49.1967, lon: -123.1815, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  YYZ: { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'CA', lat: 43.6777, lon: -79.6248, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  SYD: { iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'AU', lat: -33.9399, lon: 151.1753, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  MEL: { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'AU', lat: -37.6690, lon: 144.8410, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  BNE: { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'AU', lat: -27.3842, lon: 153.1175, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  AKL: { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'NZ', lat: -37.0082, lon: 174.7850, tzOffset: 12, isMajorHub: true, region: 'OCEANIA' },
  GRU: { iata: 'GRU', name: 'São Paulo/Guarulhos Airport', city: 'São Paulo', country: 'BR', lat: -23.4356, lon: -46.4731, tzOffset: -3, isMajorHub: true, region: 'SAMER' },
  MEX: { iata: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'MX', lat: 19.4361, lon: -99.0719, tzOffset: -6, isMajorHub: true, region: 'NAMER' },
  JNB: { iata: 'JNB', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'ZA', lat: -26.1367, lon: 28.2411, tzOffset: 2, isMajorHub: true, region: 'ME_AFRICA' },
  CPT: { iata: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'ZA', lat: -33.9715, lon: 18.6021, tzOffset: 2, isMajorHub: false, region: 'ME_AFRICA' },
};

export const GLOBAL_AIRLINES = {
  SQ: { code: 'SQ', name: 'Singapore Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['SIN'], otp: 0.89, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 32 } },
  CX: { code: 'CX', name: 'Cathay Pacific', alliance: 'ONEWORLD', primaryHubs: ['HKG'], otp: 0.84, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  NH: { code: 'NH', name: 'All Nippon Airways', alliance: 'STAR_ALLIANCE', primaryHubs: ['HND', 'NRT'], otp: 0.91, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  JL: { code: 'JL', name: 'Japan Airlines', alliance: 'ONEWORLD', primaryHubs: ['HND', 'NRT'], otp: 0.92, defaultAircraft: 'A350-1000', baggagePolicy: { pieces: 2, weightKg: 23 } },
  BA: { code: 'BA', name: 'British Airways', alliance: 'ONEWORLD', primaryHubs: ['LHR', 'LGW'], otp: 0.79, defaultAircraft: 'B777-200', baggagePolicy: { pieces: 1, weightKg: 23 } },
  LH: { code: 'LH', name: 'Lufthansa', alliance: 'STAR_ALLIANCE', primaryHubs: ['FRA', 'MUC'], otp: 0.82, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AF: { code: 'AF', name: 'Air France', alliance: 'SKYTEAM', primaryHubs: ['CDG'], otp: 0.81, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 1, weightKg: 23 } },
  KL: { code: 'KL', name: 'KLM Royal Dutch Airlines', alliance: 'SKYTEAM', primaryHubs: ['AMS'], otp: 0.83, defaultAircraft: 'B787-10', baggagePolicy: { pieces: 1, weightKg: 23 } },
  EK: { code: 'EK', name: 'Emirates', alliance: 'INDEPENDENT', primaryHubs: ['DXB'], otp: 0.88, defaultAircraft: 'A380-800', baggagePolicy: { pieces: 2, weightKg: 30 } },
  QR: { code: 'QR', name: 'Qatar Airways', alliance: 'ONEWORLD', primaryHubs: ['DOH'], otp: 0.90, defaultAircraft: 'A350-1000', baggagePolicy: { pieces: 2, weightKg: 30 } },
  EY: { code: 'EY', name: 'Etihad Airways', alliance: 'INDEPENDENT', primaryHubs: ['AUH'], otp: 0.86, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  UA: { code: 'UA', name: 'United Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ORD', 'SFO', 'EWR', 'DEN', 'IAH'], otp: 0.78, defaultAircraft: 'B777-200ER', baggagePolicy: { pieces: 1, weightKg: 23 } },
  AA: { code: 'AA', name: 'American Airlines', alliance: 'ONEWORLD', primaryHubs: ['DFW', 'MIA', 'ORD', 'JFK', 'CLT'], otp: 0.76, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 1, weightKg: 23 } },
  DL: { code: 'DL', name: 'Delta Air Lines', alliance: 'SKYTEAM', primaryHubs: ['ATL', 'MSP', 'DTW', 'JFK', 'SEA'], otp: 0.85, defaultAircraft: 'A330-900neo', baggagePolicy: { pieces: 1, weightKg: 23 } },
  QF: { code: 'QF', name: 'Qantas', alliance: 'ONEWORLD', primaryHubs: ['SYD', 'MEL', 'BNE'], otp: 0.83, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 30 } },
  NZ: { code: 'NZ', name: 'Air New Zealand', alliance: 'STAR_ALLIANCE', primaryHubs: ['AKL'], otp: 0.87, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TK: { code: 'TK', name: 'Turkish Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['IST'], otp: 0.84, defaultAircraft: 'B787-9', baggagePolicy: { pieces: 2, weightKg: 23 } },
  KE: { code: 'KE', name: 'Korean Air', alliance: 'SKYTEAM', primaryHubs: ['ICN'], otp: 0.86, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  OZ: { code: 'OZ', name: 'Asiana Airlines', alliance: 'STAR_ALLIANCE', primaryHubs: ['ICN'], otp: 0.85, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  BR: { code: 'BR', name: 'EVA Air', alliance: 'STAR_ALLIANCE', primaryHubs: ['TPE'], otp: 0.88, defaultAircraft: 'B777-300ER', baggagePolicy: { pieces: 2, weightKg: 23 } },
  CI: { code: 'CI', name: 'China Airlines', alliance: 'SKYTEAM', primaryHubs: ['TPE'], otp: 0.84, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  MH: { code: 'MH', name: 'Malaysia Airlines', alliance: 'ONEWORLD', primaryHubs: ['KUL'], otp: 0.80, defaultAircraft: 'A330-300', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TG: { code: 'TG', name: 'Thai Airways', alliance: 'STAR_ALLIANCE', primaryHubs: ['BKK'], otp: 0.81, defaultAircraft: 'A350-900', baggagePolicy: { pieces: 2, weightKg: 23 } },
  TR: { code: 'TR', name: 'Scoot', alliance: 'LCC', primaryHubs: ['SIN'], otp: 0.77, defaultAircraft: 'B787-8', baggagePolicy: { pieces: 0, weightKg: 0 } },
  UO: { code: 'UO', name: 'HK Express', alliance: 'LCC', primaryHubs: ['HKG'], otp: 0.79, defaultAircraft: 'A321neo', baggagePolicy: { pieces: 0, weightKg: 0 } },
  WN: { code: 'WN', name: 'Southwest Airlines', alliance: 'LCC', primaryHubs: ['DAL', 'MDW', 'HOU'], otp: 0.77, defaultAircraft: 'B737-800', baggagePolicy: { pieces: 2, weightKg: 23 } },
};

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateFlightDurationMin(distanceKm) {
  const cruiseSpeedKmh = 820;
  return Math.round(45 + (distanceKm / cruiseSpeedKmh) * 60);
}

// ---------------------------------------------------------------------------
// 3. Curated Business Presets Catalog (F2)
// ---------------------------------------------------------------------------

export const CURATED_PRESETS = [
  {
    tripId: 'TRIP-SIN-NRT-2026',
    origin: 'SIN',
    destination: 'NRT',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Wei Chen',
      ticketReference: 'SQ-4471-XK2',
      loyaltyProgram: 'Singapore Airlines KrisFlyer',
      loyaltyTier: 'Elite Gold',
      loyaltyNumber: 'KF-88392019',
      nationality: 'SG',
      passportNumber: 'E9283741A',
      passportExpiryIso: '2030-05-12',
      issuingCountry: 'SGP',
      contactEmail: 'wei.chen@apex-advisory.sg',
      contactPhone: '+65 9123 4567',
      checkedBags: 1,
    },
    tripPurpose: 'Contract signing — ¥2.1B infrastructure partnership, Marunouchi client HQ',
    mission: {
      title: 'Infrastructure Deal Signing',
      description: '¥2.1B infrastructure partnership agreement signature with Tokyo board.',
      venue: 'Marunouchi Client HQ, Tokyo',
      location: 'Tokyo, Japan',
      dealValue: 2100000000,
      dealCurrency: 'JPY',
      importance: 'CRITICAL',
      deadlineIso: '2026-08-28T08:30:00+09:00',
      timezone: 'Asia/Tokyo',
    },
    constraints: {
      budgetUsd: 150,
      mctMin: 60,
      arrivalDeadlineIso: '2026-08-28T08:30:00+09:00',
      hardArrivalLimitIso: '2026-08-28T12:00:00+09:00',
      baggagePieces: 1,
      baggageWeightKg: 23,
    },
    commitments: [
      {
        id: 'cm-transfer',
        kind: 'TRANSFER',
        label: 'Private airport transfer (prepaid)',
        detail: 'Chauffeur meet-and-greet, NRT Terminal 1 → Shinagawa',
        atIso: '2026-08-27T20:30:00+09:00',
        location: 'Narita Terminal 1',
      },
      {
        id: 'cm-hotel',
        kind: 'HOTEL',
        label: 'Shinagawa Prince Hotel — check-in',
        detail: 'Guaranteed late arrival, room held with card',
        atIso: '2026-08-27T22:00:00+09:00',
        location: 'Shinagawa, Tokyo',
      },
      {
        id: 'cm-meeting',
        kind: 'MEETING',
        label: 'Contract signing — Marunouchi client HQ',
        detail: 'The entire purpose of the trip. Client board flies out same day.',
        atIso: '2026-08-28T08:30:00+09:00',
        location: 'Marunouchi, Tokyo',
      },
    ],
    legs: [
      {
        flightNumber: 'SQ856',
        airlineCode: 'SQ',
        airlineName: 'Singapore Airlines',
        from: 'SIN',
        to: 'HKG',
        depIso: '2026-08-27T08:00:00+08:00',
        arrIso: '2026-08-27T12:05:00+08:00',
        durationMin: 245,
        aircraft: 'A350-900',
        cabin: 'Business',
      },
      {
        flightNumber: 'CX520',
        airlineCode: 'CX',
        airlineName: 'Cathay Pacific',
        from: 'HKG',
        to: 'NRT',
        depIso: '2026-08-27T14:30:00+08:00',
        arrIso: '2026-08-27T19:45:00+09:00',
        durationMin: 255,
        aircraft: 'B777-300ER',
        cabin: 'Business',
      },
    ],
  },
  {
    tripId: 'TRIP-LHR-JFK-2026',
    origin: 'LHR',
    destination: 'JFK',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Eleanor Vance',
      ticketReference: 'BA-9921-LDN',
      loyaltyProgram: 'British Airways Executive Club',
      loyaltyTier: 'Gold',
      loyaltyNumber: 'BA-7718290',
      nationality: 'GB',
      passportNumber: 'P8837192B',
      passportExpiryIso: '2029-11-20',
      issuingCountry: 'GBR',
      contactEmail: 'e.vance@meridian-cap.co.uk',
      contactPhone: '+44 20 7946 0912',
      checkedBags: 2,
    },
    tripPurpose: 'Wall Street Q3 M&A Closing & Syndicate Assembly',
    mission: {
      title: 'Q3 M&A Closing Syndicate',
      description: '$180M fintech acquisition syndication closing session.',
      venue: 'Midtown Financial Tower, Manhattan',
      location: 'New York, USA',
      dealValue: 180000000,
      dealCurrency: 'USD',
      importance: 'CRITICAL',
      deadlineIso: '2026-08-28T09:00:00-04:00',
      timezone: 'America/New_York',
    },
    constraints: {
      budgetUsd: 200,
      mctMin: 90,
      arrivalDeadlineIso: '2026-08-28T09:00:00-04:00',
      hardArrivalLimitIso: '2026-08-28T14:00:00-04:00',
      baggagePieces: 2,
      baggageWeightKg: 32,
    },
    commitments: [
      {
        id: 'cm-hotel-jfk',
        kind: 'HOTEL',
        label: 'The Carlyle Rosewood — Upper East Side',
        detail: 'Executive suite check-in, late arrival confirmed',
        atIso: '2026-08-27T22:00:00-04:00',
        location: 'New York, NY',
      },
      {
        id: 'cm-meeting-jfk',
        kind: 'MEETING',
        label: 'Wall Street M&A Syndicate Closing',
        detail: 'Legal signing and wire release authorization.',
        atIso: '2026-08-28T09:00:00-04:00',
        location: 'Midtown Manhattan',
      },
    ],
    legs: [
      {
        flightNumber: 'BA117',
        airlineCode: 'BA',
        airlineName: 'British Airways',
        from: 'LHR',
        to: 'JFK',
        depIso: '2026-08-27T14:00:00+01:00',
        arrIso: '2026-08-27T17:15:00-04:00',
        durationMin: 495,
        aircraft: 'B777-200',
        cabin: 'Club World',
      },
    ],
  },
  {
    tripId: 'TRIP-SFO-HND-2026',
    origin: 'SFO',
    destination: 'HND',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Marcus Brody',
      ticketReference: 'UA-8751-SFO',
      loyaltyProgram: 'United MileagePlus',
      loyaltyTier: 'Premier 1K',
      loyaltyNumber: 'MP-9948201',
      nationality: 'US',
      passportNumber: 'US4829104',
      passportExpiryIso: '2031-02-14',
      issuingCountry: 'USA',
      contactEmail: 'mbrody@nexustech.io',
      contactPhone: '+1 415 555 0198',
      checkedBags: 1,
    },
    tripPurpose: 'Silicon Valley AI Keynote & Venture Partnership ($10M Term Sheet)',
    mission: {
      title: 'Global AI Summit Keynote',
      description: 'Opening keynote address at Tokyo Big Sight and Series B term sheet signing.',
      venue: 'Tokyo Big Sight / Roppongi Hills Club',
      location: 'Tokyo, Japan',
      dealValue: 10000000,
      dealCurrency: 'USD',
      importance: 'CRITICAL',
      deadlineIso: '2026-08-28T14:00:00+09:00',
      timezone: 'Asia/Tokyo',
    },
    constraints: {
      budgetUsd: 300,
      mctMin: 60,
      arrivalDeadlineIso: '2026-08-28T14:00:00+09:00',
      hardArrivalLimitIso: '2026-08-28T18:00:00+09:00',
      baggagePieces: 1,
      baggageWeightKg: 23,
    },
    commitments: [
      {
        id: 'cm-keynote-hnd',
        kind: 'EVENT',
        label: 'Global AI Summit Keynote',
        detail: 'Opening presentation on stage 1.',
        atIso: '2026-08-28T14:00:00+09:00',
        location: 'Tokyo Big Sight',
      },
    ],
    legs: [
      {
        flightNumber: 'UA875',
        airlineCode: 'UA',
        airlineName: 'United Airlines',
        from: 'SFO',
        to: 'HND',
        depIso: '2026-08-27T11:00:00-07:00',
        arrIso: '2026-08-28T14:30:00+09:00',
        durationMin: 690,
        aircraft: 'B777-200ER',
        cabin: 'Polaris Business',
      },
    ],
  },
  {
    tripId: 'TRIP-SYD-LAX-2026',
    origin: 'SYD',
    destination: 'LAX',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Kylie Harrison',
      ticketReference: 'QF-1109-SYD',
      loyaltyProgram: 'Qantas Frequent Flyer',
      loyaltyTier: 'Platinum One',
      loyaltyNumber: 'QF-1948201',
      nationality: 'AU',
      passportNumber: 'N4810294',
      passportExpiryIso: '2028-09-30',
      issuingCountry: 'AUS',
      contactEmail: 'kylie.harrison@pacific-resources.com.au',
      contactPhone: '+61 2 9381 2000',
      checkedBags: 2,
    },
    tripPurpose: 'Clean Energy Bilateral Summit & Port Offtake Agreement',
    mission: {
      title: 'Pacific Clean Energy Offtake',
      description: 'Long-term clean hydrogen supply contract confirmation.',
      venue: 'Century Plaza Hotel, Los Angeles',
      location: 'Los Angeles, USA',
      dealValue: 65000000,
      dealCurrency: 'USD',
      importance: 'HIGH',
      deadlineIso: '2026-08-27T16:00:00-07:00',
      timezone: 'America/Los_Angeles',
    },
    constraints: {
      budgetUsd: 250,
      mctMin: 75,
      arrivalDeadlineIso: '2026-08-27T16:00:00-07:00',
      hardArrivalLimitIso: '2026-08-27T21:00:00-07:00',
      baggagePieces: 2,
      baggageWeightKg: 30,
    },
    commitments: [
      {
        id: 'cm-summit-lax',
        kind: 'MEETING',
        label: 'Port of LA Offtake Session',
        detail: 'Joint delegation session.',
        atIso: '2026-08-27T16:00:00-07:00',
        location: 'Century Plaza, Los Angeles',
      },
    ],
    legs: [
      {
        flightNumber: 'QF11',
        airlineCode: 'QF',
        airlineName: 'Qantas',
        from: 'SYD',
        to: 'LAX',
        depIso: '2026-08-27T10:15:00+10:00',
        arrIso: '2026-08-27T06:50:00-07:00',
        durationMin: 815,
        aircraft: 'A380-800',
        cabin: 'Business',
      },
    ],
  },
  {
    tripId: 'TRIP-DXB-CDG-2026',
    origin: 'DXB',
    destination: 'CDG',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Tariq Al-Mansoor',
      ticketReference: 'EK-7301-DXB',
      loyaltyProgram: 'Emirates Skywards',
      loyaltyTier: 'Platinum',
      loyaltyNumber: 'EK-9021849',
      nationality: 'AE',
      passportNumber: 'AE881920',
      passportExpiryIso: '2032-01-01',
      issuingCountry: 'ARE',
      contactEmail: 't.almansoor@gulf-sovereign.ae',
      contactPhone: '+971 4 299 1111',
      checkedBags: 2,
    },
    tripPurpose: 'Aviation Leasing Syndicate & Paris Air Forum',
    mission: {
      title: 'Paris Aviation Syndicate Signing',
      description: 'Financing syndicate ratification for 12 widebody aircraft.',
      venue: 'Le Bourget Executive Conference Centre',
      location: 'Paris, France',
      dealValue: 450000000,
      dealCurrency: 'EUR',
      importance: 'CRITICAL',
      deadlineIso: '2026-08-27T17:00:00+02:00',
      timezone: 'Europe/Paris',
    },
    constraints: {
      budgetUsd: 350,
      mctMin: 60,
      arrivalDeadlineIso: '2026-08-27T17:00:00+02:00',
      hardArrivalLimitIso: '2026-08-27T22:00:00+02:00',
      baggagePieces: 2,
      baggageWeightKg: 32,
    },
    commitments: [
      {
        id: 'cm-forum-cdg',
        kind: 'MEETING',
        label: 'Aviation Syndicate Ratification',
        detail: 'Signing ceremony.',
        atIso: '2026-08-27T17:00:00+02:00',
        location: 'Le Bourget, Paris',
      },
    ],
    legs: [
      {
        flightNumber: 'EK73',
        airlineCode: 'EK',
        airlineName: 'Emirates',
        from: 'DXB',
        to: 'CDG',
        depIso: '2026-08-27T08:20:00+04:00',
        arrIso: '2026-08-27T13:30:00+02:00',
        durationMin: 430,
        aircraft: 'A380-800',
        cabin: 'First Class',
      },
    ],
  },
  {
    tripId: 'TRIP-FRA-SIN-2026',
    origin: 'FRA',
    destination: 'SIN',
    travelDateIso: '2026-08-27',
    passenger: {
      name: 'Dr. Hans Richter',
      ticketReference: 'LH-7781-FRA',
      loyaltyProgram: 'Miles & More',
      loyaltyTier: 'Senator',
      loyaltyNumber: 'MM-38291048',
      nationality: 'DE',
      passportNumber: 'C8849201D',
      passportExpiryIso: '2029-08-15',
      issuingCountry: 'DEU',
      contactEmail: 'richter@bavaria-pharma.de',
      contactPhone: '+49 69 7561 0',
      checkedBags: 1,
    },
    tripPurpose: 'Biomedical Supply Chain Sovereign Reserve Accord',
    mission: {
      title: 'Sovereign Biomedical Accord',
      description: 'ASEAN regional biomedical logistics distribution agreement.',
      venue: 'Biopolis Phase 4 Research Concourse',
      location: 'Singapore',
      dealValue: 95000000,
      dealCurrency: 'EUR',
      importance: 'HIGH',
      deadlineIso: '2026-08-28T10:00:00+08:00',
      timezone: 'Asia/Singapore',
    },
    constraints: {
      budgetUsd: 180,
      mctMin: 60,
      arrivalDeadlineIso: '2026-08-28T10:00:00+08:00',
      hardArrivalLimitIso: '2026-08-28T15:00:00+08:00',
      baggagePieces: 1,
      baggageWeightKg: 23,
    },
    commitments: [
      {
        id: 'cm-accord-sin',
        kind: 'MEETING',
        label: 'Biopolis Sovereign Accord',
        detail: 'Signing with ministry delegates.',
        atIso: '2026-08-28T10:00:00+08:00',
        location: 'Biopolis, Singapore',
      },
    ],
    legs: [
      {
        flightNumber: 'LH778',
        airlineCode: 'LH',
        airlineName: 'Lufthansa',
        from: 'FRA',
        to: 'SIN',
        depIso: '2026-08-27T21:55:00+02:00',
        arrIso: '2026-08-28T16:15:00+08:00',
        durationMin: 740,
        aircraft: 'A350-900',
        cabin: 'Business',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. PNR & JSON Parser Reference (F3)
// ---------------------------------------------------------------------------

export function formatPnr(itinerary) {
  const p = itinerary.passenger;
  const surname = p.name.split(' ').pop().toUpperCase();
  const given = p.name.split(' ').slice(0, -1).join(' ').toUpperCase() || 'TRAVELER';
  
  let out = `1.1${surname}/${given} MR\n`;
  itinerary.legs.forEach((leg, idx) => {
    const depDate = new Date(leg.depIso);
    const day = String(depDate.getUTCDate()).padStart(2, '0');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const mon = months[depDate.getUTCMonth()];
    const depTime = leg.depIso.slice(11, 16).replace(':', '');
    const arrTime = leg.arrIso.slice(11, 16).replace(':', '');
    out += `${idx + 1}. ${leg.airlineCode} ${leg.flightNumber.replace(/^[A-Z]+/, '')} Y ${day}${mon} ${leg.from}${leg.to} HK1 ${depTime} ${arrTime}\n`;
  });
  
  out += `RM TKT NBR ${p.ticketReference}\n`;
  out += `RM FQTV ${p.loyaltyProgram || 'Loyalty'} ${p.loyaltyTier || 'Member'} ${p.loyaltyNumber || ''}\n`;
  out += `RM PSPO ${p.issuingCountry || p.nationality || 'UN'} ${p.passportNumber || 'NONE'}\n`;
  out += `RM CTCE ${p.contactEmail || 'traveler@example.com'}\n`;
  out += `RM CTCP ${p.contactPhone || '+1 000 000 0000'}\n`;
  out += `RM MISSION ${itinerary.mission?.title || itinerary.tripPurpose || 'Business'}\n`;
  out += `RM BUDGET USD ${itinerary.constraints.budgetUsd} MCT ${itinerary.constraints.mctMin} BAG ${itinerary.constraints.baggagePieces}X${itinerary.constraints.baggageWeightKg}KG\n`;
  return out.trim();
}

export function parsePnr(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { success: false, errors: ['Empty PNR content'] };
  }
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const errors = [];
  let passenger = { name: '', ticketReference: 'TKT-UNASSIGNED', loyaltyProgram: 'Standard', loyaltyTier: 'Member', loyaltyNumber: '', nationality: 'UN', contactEmail: 'traveler@example.com', contactPhone: '+1 000 000 0000', checkedBags: 1 };
  const legs = [];
  let budgetUsd = 200, mctMin = 60, baggagePieces = 1, baggageWeightKg = 23, missionTitle = 'Corporate Travel';
  
  for (const line of lines) {
    const paxMatch = line.match(/^1\.1([A-Z\s]+)\/([A-Z\s]+)$/i);
    if (paxMatch) {
      let rawGiven = paxMatch[2].replace(/\b(MR|MRS|MS|DR|MISS)\b/gi, '').trim();
      let rawSur = paxMatch[1].replace(/\b(MR|MRS|MS|DR|MISS)\b/gi, '').trim();
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      passenger.name = `${cap(rawGiven)} ${cap(rawSur)}`;
      continue;
    }
    const legMatch = line.match(/^(\d+)\.\s+([A-Z0-9]{2})\s*(\d+)\s+([A-Z])\s+(\d{2})([A-Z]{3})\s+([A-Z]{3})([A-Z]{3})\s+HK\d+\s+(\d{4})\s+(\d{4})/i);
    if (legMatch) {
      const carrier = legMatch[2].toUpperCase(), num = legMatch[3], flightNumber = `${carrier}${num}`;
      const day = legMatch[5], monStr = legMatch[6].toUpperCase(), from = legMatch[7].toUpperCase(), to = legMatch[8].toUpperCase();
      const depTime = legMatch[9], arrTime = legMatch[10];
      const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
      const mon = months[monStr] || '08', year = '2026';
      const fromTz = GLOBAL_AIRPORTS[from]?.tzOffset ?? 0, toTz = GLOBAL_AIRPORTS[to]?.tzOffset ?? 0;
      const fromTzStr = `${fromTz >= 0 ? '+' : '-'}${String(Math.abs(fromTz)).padStart(2, '0')}:00`;
      const toTzStr = `${toTz >= 0 ? '+' : '-'}${String(Math.abs(toTz)).padStart(2, '0')}:00`;
      const depIso = `${year}-${mon}-${day}T${depTime.slice(0, 2)}:${depTime.slice(2, 4)}:00${fromTzStr}`;
      const arrIso = `${year}-${mon}-${day}T${arrTime.slice(0, 2)}:${arrTime.slice(2, 4)}:00${toTzStr}`;
      const dist = calculateDistanceKm(GLOBAL_AIRPORTS[from]?.lat || 0, GLOBAL_AIRPORTS[from]?.lon || 0, GLOBAL_AIRPORTS[to]?.lat || 0, GLOBAL_AIRPORTS[to]?.lon || 0);
      const durationMin = calculateFlightDurationMin(dist) || 120;
      legs.push({ flightNumber, airlineCode: carrier, airlineName: GLOBAL_AIRLINES[carrier]?.name || carrier, from, to, depIso, arrIso, durationMin, aircraft: GLOBAL_AIRLINES[carrier]?.defaultAircraft || 'B777-300ER', cabin: 'Economy' });
      continue;
    }
    if (line.startsWith('RM TKT NBR')) passenger.ticketReference = line.replace('RM TKT NBR', '').trim();
    else if (line.startsWith('RM CTCE')) passenger.contactEmail = line.replace('RM CTCE', '').trim();
    else if (line.startsWith('RM CTCP')) passenger.contactPhone = line.replace('RM CTCP', '').trim();
    else if (line.startsWith('RM MISSION')) missionTitle = line.replace('RM MISSION', '').trim();
    else if (line.startsWith('RM BUDGET')) {
      const bMatch = line.match(/USD\s+(\d+)/); if (bMatch) budgetUsd = Number(bMatch[1]);
      const mMatch = line.match(/MCT\s+(\d+)/); if (mMatch) mctMin = Number(mMatch[1]);
      const bagMatch = line.match(/BAG\s+(\d+)X(\d+)KG/); if (bagMatch) { baggagePieces = Number(bagMatch[1]); baggageWeightKg = Number(bagMatch[2]); }
    }
  }
  if (legs.length === 0) errors.push('No valid flight segment lines found in PNR');
  if (!passenger.name) errors.push('No passenger name found in PNR');
  if (errors.length > 0) return { success: false, errors };
  
  const origin = legs[0].from, destination = legs[legs.length - 1].to, travelDateIso = legs[0].depIso.slice(0, 10);
  return {
    success: true,
    itinerary: {
      tripId: `TRIP-${origin}-${destination}-${travelDateIso.slice(0, 4)}`,
      origin, destination, travelDateIso, legs, passenger, tripPurpose: missionTitle,
      mission: { title: missionTitle, description: missionTitle, venue: `${destination} Hub`, location: destination, importance: 'HIGH', deadlineIso: legs[legs.length - 1].arrIso, timezone: 'UTC' },
      constraints: { budgetUsd, mctMin, arrivalDeadlineIso: legs[legs.length - 1].arrIso, hardArrivalLimitIso: legs[legs.length - 1].arrIso, baggagePieces, baggageWeightKg },
      commitments: [],
    }
  };
}

// ---------------------------------------------------------------------------
// 5. Algorithmic Route & Candidate Generator Reference (F6)
// ---------------------------------------------------------------------------

export function generateAlgorithmicCandidates(options) {
  const { origin, destination, travelDateIso, baseFareUsd = 800, budgetCeilingUsd = 200, mctMin = 60, isCanonicalDemo = false } = options;
  if (origin === 'SIN' && destination === 'NRT' && isCanonicalDemo) return getCanonicalSinNrtCandidates(travelDateIso);
  
  const candidates = [];
  const origAirport = GLOBAL_AIRPORTS[origin] || { lat: 0, lon: 0, tzOffset: 0 };
  const destAirport = GLOBAL_AIRPORTS[destination] || { lat: 0, lon: 0, tzOffset: 0 };
  const directDist = calculateDistanceKm(origAirport.lat, origAirport.lon, destAirport.lat, destAirport.lon);
  const directDuration = calculateFlightDurationMin(directDist);
  
  let candidateHubs = Object.values(GLOBAL_AIRPORTS).filter(hub => {
    if (hub.iata === origin || hub.iata === destination) return false;
    if (!hub.isMajorHub) return false;
    const d1 = calculateDistanceKm(origAirport.lat, origAirport.lon, hub.lat, hub.lon);
    const d2 = calculateDistanceKm(hub.lat, hub.lon, destAirport.lat, destAirport.lon);
    return ((d1 + d2) / (directDist || 1)) < 1.6;
  });
  if (candidateHubs.length < 12) {
    const allHubs = Object.values(GLOBAL_AIRPORTS).filter(h => h.iata !== origin && h.iata !== destination && h.isMajorHub);
    const remaining = allHubs.filter(h => !candidateHubs.some(ch => ch.iata === h.iata));
    candidateHubs = [...candidateHubs, ...remaining].slice(0, 16);
  }
  
  const airlines = Object.values(GLOBAL_AIRLINES);
  let idCounter = 1;
  
  // Direct Candidates (6)
  for (let i = 0; i < 6; i++) {
    const air = airlines[i % airlines.length];
    const depHour = 8 + i * 2;
    const depIso = `${travelDateIso}T${String(depHour).padStart(2, '0')}:00:00${formatTz(origAirport.tzOffset)}`;
    const depUtcMs = new Date(depIso).getTime();
    const arrUtcMs = depUtcMs + directDuration * 60000;
    const arrIso = formatIsoWithOffset(new Date(arrUtcMs), destAirport.tzOffset);
    
    let fareDiffUsd = 0, baggagePieces = (i % 2 === 0 ? 1 : 2), baggageWeightKg = (i % 2 === 0 ? 23 : 32), fixtureClass = 'finalist';
    if (i === 2 || i === 3) { fareDiffUsd = budgetCeilingUsd + 120 + i * 40; fixtureClass = 'over_budget'; }
    else if (i === 4) { baggagePieces = 0; baggageWeightKg = 0; fixtureClass = 'baggage_incompatible'; }
    else { fareDiffUsd = Math.max(-50, budgetCeilingUsd - 80 + i * 20); fixtureClass = 'finalist'; }
    
    candidates.push({
      id: `cand-${String(idCounter++).padStart(2, '0')}`,
      fareKey: `FARE-DIR-${air.code}-${i + 1}`,
      airlineCode: air.code,
      airlineName: air.name,
      label: `${air.code} Nonstop ${air.name}`,
      legs: [{ flightNumber: `${air.code}${100 + i * 10}`, airlineCode: air.code, airlineName: air.name, from: origin, to: destination, depIso, arrIso, durationMin: directDuration, aircraft: air.defaultAircraft, cabin: 'Economy' }],
      layovers: [], depIso, arrIso, totalDurationMin: directDuration, stops: 0, minConnectionMin: null,
      fareDiffUsd, baggagePieces, baggageWeightKg, seatsLeft: 5, otp: air.otp, fixtureClass,
    });
  }
  
  // 1-Stop Connecting Candidates (34)
  for (let h = 0; h < Math.min(candidateHubs.length, 12); h++) {
    const hub = candidateHubs[h];
    const d1 = calculateDistanceKm(origAirport.lat, origAirport.lon, hub.lat, hub.lon);
    const d2 = calculateDistanceKm(hub.lat, hub.lon, destAirport.lat, destAirport.lon);
    const dur1 = calculateFlightDurationMin(d1), dur2 = calculateFlightDurationMin(d2);
    
    for (let k = 0; k < 3; k++) {
      const air1 = airlines[(h + k) % airlines.length];
      const air2 = airlines[(h + k + 1) % airlines.length];
      const depHour = 6 + (k * 4) % 14;
      const depIso = `${travelDateIso}T${String(depHour).padStart(2, '0')}:30:00${formatTz(origAirport.tzOffset)}`;
      const leg1ArrUtc = new Date(depIso).getTime() + dur1 * 60000;
      
      let layoverMin = Math.max(90, mctMin + 15), fixtureClass = 'finalist', fareDiffUsd = budgetCeilingUsd - 40, baggagePieces = 2, baggageWeightKg = 32;
      if (k === 1) { layoverMin = Math.max(25, mctMin - 20); fixtureClass = 'unsafe_connection'; }
      else if (k === 2 && h % 2 === 0) { fareDiffUsd = budgetCeilingUsd + 150; fixtureClass = 'over_budget'; }
      else if (k === 2 && h % 2 !== 0) { baggagePieces = 0; baggageWeightKg = 0; fixtureClass = 'baggage_incompatible'; }
      
      const leg2DepUtc = leg1ArrUtc + layoverMin * 60000;
      const leg2ArrUtc = leg2DepUtc + dur2 * 60000;
      const leg1ArrIso = formatIsoWithOffset(new Date(leg1ArrUtc), hub.tzOffset);
      const leg2DepIso = formatIsoWithOffset(new Date(leg2DepUtc), hub.tzOffset);
      const arrIso = formatIsoWithOffset(new Date(leg2ArrUtc), destAirport.tzOffset);
      
      candidates.push({
        id: `cand-${String(idCounter++).padStart(2, '0')}`,
        fareKey: `FARE-HUB-${hub.iata}-${air1.code}-${k + 1}`,
        airlineCode: air1.code, airlineName: air1.name, label: `${air1.code}+${air2.code} via ${hub.iata}`,
        legs: [
          { flightNumber: `${air1.code}${200 + h * 10 + k}`, airlineCode: air1.code, airlineName: air1.name, from: origin, to: hub.iata, depIso, arrIso: leg1ArrIso, durationMin: dur1, aircraft: air1.defaultAircraft, cabin: 'Economy' },
          { flightNumber: `${air2.code}${300 + h * 10 + k}`, airlineCode: air2.code, airlineName: air2.name, from: hub.iata, to: destination, depIso: leg2DepIso, arrIso, durationMin: dur2, aircraft: air2.defaultAircraft, cabin: 'Economy' },
        ],
        layovers: [{ airport: hub.iata, minutes: layoverMin }],
        depIso, arrIso, totalDurationMin: dur1 + layoverMin + dur2, stops: 1, minConnectionMin: layoverMin,
        fareDiffUsd, baggagePieces, baggageWeightKg, seatsLeft: 4, otp: Math.min(air1.otp, air2.otp), fixtureClass,
      });
      if (candidates.length >= 40) break;
    }
    if (candidates.length >= 40) break;
  }
  return candidates;
}

function getCanonicalSinNrtCandidates(travelDateIso) {
  const candidates = [];
  for (let i = 1; i <= 42; i++) {
    let fixtureClass = 'finalist', fareDiff = 0, minConn = 90, bags = 1, arrHour = 7, dayOffset = 1;
    if (i <= 12) { fixtureClass = 'over_budget'; fareDiff = 160 + i * 10; }
    else if (i <= 30) { fixtureClass = 'unsafe_connection'; minConn = 45; }
    else if (i <= 39) { fixtureClass = 'baggage_incompatible'; bags = 0; }
    else {
      fixtureClass = 'finalist';
      if (i === 40) { fareDiff = 30; arrHour = 11; }
      if (i === 41) { fareDiff = 40; arrHour = 7; }
      if (i === 42) { fareDiff = 95; arrHour = 8; }
    }
    const depIso = `${travelDateIso}T08:00:00+08:00`;
    const arrIso = `2026-08-${27 + dayOffset}T${String(arrHour).padStart(2, '0')}:00:00+09:00`;
    candidates.push({
      id: `cand-${String(i).padStart(2, '0')}`,
      fareKey: `FARE-CANONICAL-${i}`,
      airlineCode: i === 42 ? 'NH' : 'SQ',
      airlineName: i === 42 ? 'ANA' : 'Singapore Airlines',
      label: `Option ${i}`,
      legs: [{ flightNumber: `SQ${800 + i}`, airlineCode: 'SQ', airlineName: 'Singapore Airlines', from: 'SIN', to: 'NRT', depIso, arrIso, durationMin: 420, aircraft: 'A350-900', cabin: 'Economy' }],
      layovers: minConn ? [{ airport: 'HKG', minutes: minConn }] : [],
      depIso, arrIso, totalDurationMin: 420, stops: minConn ? 1 : 0, minConnectionMin: minConn,
      fareDiffUsd: fareDiff, baggagePieces: bags, baggageWeightKg: bags ? 23 : 0, seatsLeft: 3, otp: 0.88, fixtureClass,
    });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// 6. Dynamic Impact Graph & Risk Calculator Reference (F8)
// ---------------------------------------------------------------------------

export function calculateTripImpactGraph(itinerary, disruption) {
  const nodes = [], edges = [];
  itinerary.legs.forEach((leg, idx) => {
    const isDisrupted = leg.flightNumber.toUpperCase() === disruption.flightNumber.toUpperCase();
    const status = isDisrupted ? 'impacted' : 'safe';
    const delayVal = disruption.delayMinutes !== undefined ? disruption.delayMinutes : 45;
    const prob = isDisrupted ? (disruption.event === 'CANCELLATION' ? 1.0 : Math.min(1.0, delayVal / 180)) : 0.05;
    nodes.push({ id: `nd-flight-${idx}`, kind: 'FLIGHT', label: `${leg.flightNumber} (${leg.from} → ${leg.to})`, detail: isDisrupted ? `${disruption.event}: ${disruption.reason}` : 'Operating normally', weight: 0.10, probability: prob, severity: isDisrupted ? 'critical' : 'low', status });
  });
  
  const commitments = itinerary.commitments && itinerary.commitments.length > 0 ? itinerary.commitments : [
    { id: 'cm-dest', kind: 'MEETING', label: `${itinerary.destination} Mission Purpose`, atIso: itinerary.constraints.arrivalDeadlineIso, location: itinerary.destination }
  ];
  
  const destArrTime = new Date(itinerary.legs[itinerary.legs.length - 1].arrIso).getTime();
  const delayMs = disruption.event === 'DELAY' ? (disruption.delayMinutes || 45) * 60000 : 8 * 3600000;
  const newArrTime = destArrTime + delayMs;
  
  commitments.forEach((cm, idx) => {
    const cmTime = new Date(cm.atIso).getTime();
    const bufferMin = Math.round((cmTime - newArrTime) / 60000);
    let status = 'safe', prob = 0.05, severity = 'low';
    if (bufferMin < 0) { status = 'impacted'; prob = 0.95; severity = 'critical'; }
    else if (bufferMin < 60 && delayMs > 0) { status = 'at-risk'; prob = 0.70; severity = 'high'; }
    else if (bufferMin < 120 && delayMs >= 3600000) { status = 'at-risk'; prob = 0.40; severity = 'medium'; }
    const weight = cm.kind === 'MEETING' ? 0.50 : 0.25;
    nodes.push({ id: `nd-cm-${idx}`, kind: cm.kind, label: cm.label, detail: `Buffer remaining: ${bufferMin}m (scheduled ${cm.atIso})`, weight, probability: prob, severity, status });
  });
  
  const totalWeight = nodes.reduce((s, n) => s + n.weight, 0);
  nodes.forEach(n => { n.weight = n.weight / totalWeight; });
  const riskScore = Math.round(100 * nodes.reduce((sum, n) => sum + n.weight * n.probability, 0));
  const severity = riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';
  
  return {
    nodes, edges, riskScore, severity,
    summary: `${disruption.event} on ${disruption.flightNumber} evaluated with risk score ${riskScore}/100.`,
    chainNarration: {
      rootFailure: `${disruption.flightNumber} ${disruption.event} due to ${disruption.reason}`,
      cascade: [`Flight arrival delayed by ${Math.round(delayMs / 60000)}m`, 'Buffer compression on downstream commitments'],
      primaryConsequence: riskScore >= 50 ? 'Severe mission compromise' : 'Minor buffer compression',
      riskExplanation: `Deterministic risk calculated at ${riskScore}/100 based on causal timeline analysis.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Decision Funnel & Multi-Criteria Optimizer Reference (F10)
// ---------------------------------------------------------------------------

export function applyConstraintFunnel(candidates, itinerary) {
  const c = itinerary.constraints;
  const hardLimitMs = new Date(c.hardArrivalLimitIso || c.arrivalDeadlineIso).getTime();
  const prunedSummary = { misses_deadline: 0, over_budget: 0, unsafe_connection: 0, baggage_incompatible: 0 };
  const funnel = [
    { reason: 'misses_deadline', label: 'Arrival Deadline', rule: `Arrival <= ${c.hardArrivalLimitIso}`, removed: 0, remaining: candidates.length, removedIds: [] },
    { reason: 'over_budget', label: 'Budget Ceiling', rule: `Fare Diff <= $${c.budgetUsd}`, removed: 0, remaining: 0, removedIds: [] },
    { reason: 'unsafe_connection', label: 'MCT Floor', rule: `Connection >= ${c.mctMin}m`, removed: 0, remaining: 0, removedIds: [] },
    { reason: 'baggage_incompatible', label: 'Baggage Allowance', rule: `>= ${c.baggagePieces}x${c.baggageWeightKg}kg`, removed: 0, remaining: 0, removedIds: [] },
  ];
  
  let current = [...candidates];
  const s1 = []; for (const cand of current) { if (new Date(cand.arrIso).getTime() > hardLimitMs) { funnel[0].removed++; funnel[0].removedIds.push(cand.id); prunedSummary.misses_deadline++; } else { s1.push(cand); } }
  funnel[0].remaining = s1.length; current = s1;
  const s2 = []; for (const cand of current) { if (cand.fareDiffUsd > c.budgetUsd) { funnel[1].removed++; funnel[1].removedIds.push(cand.id); prunedSummary.over_budget++; } else { s2.push(cand); } }
  funnel[1].remaining = s2.length; current = s2;
  const s3 = []; for (const cand of current) { if (cand.stops > 0 && (cand.minConnectionMin === null || cand.minConnectionMin < c.mctMin)) { funnel[2].removed++; funnel[2].removedIds.push(cand.id); prunedSummary.unsafe_connection++; } else { s3.push(cand); } }
  funnel[2].remaining = s3.length; current = s3;
  const s4 = []; for (const cand of current) { if (cand.baggagePieces < c.baggagePieces || cand.baggageWeightKg < c.baggageWeightKg) { funnel[3].removed++; funnel[3].removedIds.push(cand.id); prunedSummary.baggage_incompatible++; } else { s4.push(cand); } }
  funnel[3].remaining = s4.length; current = s4;
  
  return { survivors: current, funnel, prunedSummary, totalCandidates: candidates.length };
}

export function rankRecoveryOptions(survivors, itinerary) {
  if (!survivors || survivors.length === 0) return [];
  const originalArrivalMs = new Date(itinerary.legs[itinerary.legs.length - 1].arrIso).getTime();
  
  const scored = survivors.map(cand => {
    const arrMs = new Date(cand.arrIso).getTime();
    const delayHours = Math.max(0, (arrMs - originalArrivalMs) / 3600000);
    const sArr = Math.max(0, 100 - delayHours * 6);
    const sConn = cand.stops === 0 ? 100 : Math.max(0, Math.min(100, ((cand.minConnectionMin || 60) / 120) * 100));
    const sPrice = Math.max(0, 100 - Math.max(0, cand.fareDiffUsd) * 0.4);
    const sBag = cand.baggagePieces >= itinerary.constraints.baggagePieces ? 100 : 40;
    const sRisk = Math.round(cand.otp * 100);
    const recoveryScore = Number((0.35 * sArr + 0.25 * sConn + 0.20 * sPrice + 0.10 * sBag + 0.10 * sRisk).toFixed(1));
    const residualRisk = Math.max(5, Math.round(100 - recoveryScore));
    return {
      candidate: cand, scores: { arrival: sArr, connection: sConn, price: sPrice, baggage: sBag, risk: sRisk },
      recoveryScore, residualRisk, metrics: { delayHours, fareDiffUsd: cand.fareDiffUsd, arrivalIso: cand.arrIso, departureIso: cand.depIso, connectionMin: cand.minConnectionMin, stops: cand.stops, makesMeeting: arrMs <= new Date(itinerary.constraints.arrivalDeadlineIso).getTime() }
    };
  });
  
  scored.sort((a, b) => b.recoveryScore - a.recoveryScore);
  const labels = ['A', 'B', 'C'], ids = ['opt_a', 'opt_b', 'opt_c'];
  return scored.slice(0, 3).map((item, idx) => ({
    id: ids[idx], label: labels[idx], ...item,
    status: idx === 0 ? 'RECOMMENDED' : idx === 1 ? 'SECONDARY' : 'ALTERNATIVE',
    reason: idx === 0 ? 'Highest multi-criteria resilience score' : 'Viable contingency alternative',
    why: { whyRecommended: idx === 0 ? ['Optimal arrival buffer', 'Within corporate budget limits'] : [], whyRejected: idx > 0 ? ['Lower multi-criteria score than top option'] : [], tradeoffs: [`Fare diff: $${item.candidate.fareDiffUsd}`, `Arrival: ${item.candidate.arrIso}`], preservedJourneyElements: ['Destination intact', 'Baggage policy compliant'], remainingRisks: [`Residual operational risk ${item.residualRisk}%`], verdict: idx === 0 ? 'Recommended for 1-tap rebooking execution' : 'Secondary fallback alternative' }
  }));
}

function formatTz(tzOffset) {
  const sign = tzOffset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(tzOffset))).padStart(2, '0');
  const minutes = String(Math.round((Math.abs(tzOffset) % 1) * 60)).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

function formatIsoWithOffset(date, tzOffset) {
  const tzMs = tzOffset * 3600000;
  const localDate = new Date(date.getTime() + tzMs);
  const y = localDate.getUTCFullYear(), m = String(localDate.getUTCMonth() + 1).padStart(2, '0'), d = String(localDate.getUTCDate()).padStart(2, '0');
  const h = String(localDate.getUTCHours()).padStart(2, '0'), mi = String(localDate.getUTCMinutes()).padStart(2, '0'), s = String(localDate.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mi}:${s}${formatTz(tzOffset)}`;
}

// ---------------------------------------------------------------------------
// 8. Export Suite Reference Formatters (F16)
// ---------------------------------------------------------------------------

export function generateEvidenceCsv(session) {
  const it = session.itinerary;
  const lines = [
    'SECTION,KEY,VALUE',
    `HEADER,TRIP_ID,${it.tripId}`, `HEADER,ORIGIN,${it.origin}`, `HEADER,DESTINATION,${it.destination}`, `HEADER,TRAVEL_DATE,${it.travelDateIso}`,
    `PASSENGER,NAME,"${it.passenger.name}"`, `PASSENGER,TICKET_REF,${it.passenger.ticketReference}`, `PASSENGER,LOYALTY,"${it.passenger.loyaltyProgram || it.passenger.loyalty}"`, `PASSENGER,CHECKED_BAGS,${it.passenger.checkedBags}`,
    `MISSION,TITLE,"${it.mission?.title || it.tripPurpose}"`, `MISSION,DEAL_VALUE,${it.mission?.dealValue || 0}`,
    `CONSTRAINTS,BUDGET_USD,${it.constraints.budgetUsd}`, `CONSTRAINTS,MCT_MIN,${it.constraints.mctMin}`, `CONSTRAINTS,ARRIVAL_DEADLINE,${it.constraints.arrivalDeadlineIso}`,
    `DISRUPTION,EVENT,${session.disruption?.event || 'NONE'}`, `DISRUPTION,RISK_SCORE,${session.riskScore || 0}`,
  ];
  if (session.ledger) {
    session.ledger.forEach((entry, i) => {
      lines.push(`LEDGER,ENTRY_${i + 1}_ID,${entry.id}`);
      lines.push(`LEDGER,ENTRY_${i + 1}_STATUS,${entry.status}`);
      lines.push(`LEDGER,ENTRY_${i + 1}_REF,${entry.reference || 'N/A'}`);
    });
  }
  return lines.join('\n');
}

export function generateRunReportJson(session) {
  return JSON.stringify({
    generated_at: new Date().toISOString(), engine_version: '2.0.0-enterprise',
    session: { tripId: session.tripId, state: session.state, riskScore: session.riskScore },
    itinerary: session.itinerary, disruption: session.disruption, analysis: session.analysis,
    execution: session.execution, ledger: session.ledger || [], events: session.events || [],
  }, null, 2);
}

export { assert };
