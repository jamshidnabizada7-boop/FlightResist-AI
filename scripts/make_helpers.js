const { writeTest } = require('./build_all_tests');

const chunks = [];

chunks.push(// tests/helpers/test-utils.mjs
import assert from  node:assert;

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
        this.results.push({ name: t.name, status: pass, durationMs: performance.now() - start });
      } catch (err) {
        this.results.push({ name: t.name, status: fail, error: err, durationMs: performance.now() - start });
      }
    }
    return this.results;
  }
}

export function createTestSuite(name) {
  return new TestSuite(name);
}
);chunks.push(
export const GLOBAL_AIRPORTS = {
  SIN: { iata:  SIN, name: Singapore Changi Airport, city: Singapore, country: SG, lat: 1.3644, lon: 103.9915, tzOffset: 8, isMajorHub: true, region: ASIA },
  HKG: { iata: HKG, name: Hong Kong International Airport, city: Hong Kong, country: HK, lat: 22.3080, lon: 113.9185, tzOffset: 8, isMajorHub: true, region: ASIA },
  NRT: { iata: NRT, name: Narita International Airport, city: Tokyo, country: JP, lat: 35.7720, lon: 140.3929, tzOffset: 9, isMajorHub: true, region: ASIA },
  HND: { iata: HND, name: Tokyo Haneda Airport, city: Tokyo, country: JP, lat: 35.5494, lon: 139.7798, tzOffset: 9, isMajorHub: true, region: ASIA },
  ICN: { iata: ICN, name: Incheon International Airport, city: Seoul, country: KR, lat: 37.4602, lon: 126.4407, tzOffset: 9, isMajorHub: true, region: ASIA },
  TPE: { iata: TPE, name: Taiwan Taoyuan International Airport, city: Taipei, country: TW, lat: 25.0797, lon: 121.2342, tzOffset: 8, isMajorHub: true, region: ASIA },
  KUL: { iata: KUL, name: Kuala Lumpur International Airport, city: Kuala Lumpur, country: MY, lat: 2.7456, lon: 101.7072, tzOffset: 8, isMajorHub: true, region: ASIA },
  BKK: { iata: BKK, name: Suvarnabhumi Airport, city: Bangkok, country: TH, lat: 13.6900, lon: 100.7501, tzOffset: 7, isMajorHub: true, region: ASIA },
  DMK: { iata: DMK, name: Don Mueang International Airport, city: Bangkok, country: TH, lat: 13.9126, lon: 100.6068, tzOffset: 7, isMajorHub: false, region: ASIA },
  SGN: { iata: SGN, name: Tan Son Nhat International Airport, city: Ho Chi Minh City, country: VN, lat: 10.8185, lon: 106.6520, tzOffset: 7, isMajorHub: true, region: ASIA },
  HAN: { iata: HAN, name: Noi Bai International Airport, city: Hanoi, country: VN, lat: 21.2212, lon: 105.8072, tzOffset: 7, isMajorHub: true, region: ASIA },
  MNL: { iata: MNL, name: Ninoy Aquino International Airport, city: Manila, country: PH, lat: 14.5086, lon: 121.0194, tzOffset: 8, isMajorHub: true, region: ASIA },
  PVG: { iata: PVG, name: Shanghai Pudong International Airport, city: Shanghai, country: CN, lat: 31.1443, lon: 121.8083, tzOffset: 8, isMajorHub: true, region: ASIA },
  PEK: { iata: PEK, name: Beijing Capital International Airport, city: Beijing, country: CN, lat: 40.0799, lon: 116.6031, tzOffset: 8, isMajorHub: true, region: ASIA },
  PKX: { iata: PKX, name: Beijing Daxing International Airport, city: Beijing, country: CN, lat: 39.5098, lon: 116.4105, tzOffset: 8, isMajorHub: true, region: ASIA },
  CAN: { iata: CAN, name: Guangzhou Baiyun International Airport, city: Guangzhou, country: CN, lat: 23.3924, lon: 113.2988, tzOffset: 8, isMajorHub: true, region: ASIA },
  DEL: { iata: DEL, name: Indira Gandhi International Airport, city: Delhi, country: IN, lat: 28.5562, lon: 77.1000, tzOffset: 5.5, isMajorHub: true, region: ASIA },
  BOM: { iata: BOM, name: Chhatrapati Shivaji Maharaj Airport, city: Mumbai, country: IN, lat: 19.0896, lon: 72.8656, tzOffset: 5.5, isMajorHub: true, region: ASIA },
  DXB: { iata: DXB, name: Dubai International Airport, city: Dubai, country: AE, lat: 25.2532, lon: 55.3657, tzOffset: 4, isMajorHub: true, region: ME_AFRICA },
  DOH: { iata: DOH, name: Hamad International Airport, city: Doha, country: QA, lat: 25.2731, lon: 51.6081, tzOffset: 3, isMajorHub: true, region: ME_AFRICA },
  AUH: { iata: AUH, name: Zayed International Airport, city: Abu Dhabi, country: AE, lat: 24.4330, lon: 54.6511, tzOffset: 4, isMajorHub: true, region: ME_AFRICA },
  IST: { iata: IST, name: Istanbul Airport, city: Istanbul, country: TR, lat: 41.2753, lon: 28.7519, tzOffset: 3, isMajorHub: true, region: EUROPE },
  LHR: { iata: LHR, name: London Heathrow Airport, city: London, country: GB, lat: 51.4700, lon: -0.4543, tzOffset: 1, isMajorHub: true, region: EUROPE },
  LGW: { iata: LGW, name: London Gatwick Airport, city: London, country: GB, lat: 51.1537, lon: -0.1821, tzOffset: 1, isMajorHub: false, region: EUROPE },
  CDG: { iata: CDG, name: Paris Charles de Gaulle Airport, city: Paris, country: FR, lat: 49.0097, lon: 2.5479, tzOffset: 2, isMajorHub: true, region: EUROPE },
  FRA: { iata: FRA, name: Frankfurt Airport, city: Frankfurt, country: DE, lat: 50.0379, lon: 8.5622, tzOffset: 2, isMajorHub: true, region: EUROPE },
  MUC: { iata: MUC, name: Munich Airport, city: Munich, country: DE, lat: 48.3537, lon: 11.7750, tzOffset: 2, isMajorHub: true, region: EUROPE },
  AMS: { iata: AMS, name: Amsterdam Airport Schiphol, city: Amsterdam, country: NL, lat: 52.3105, lon: 4.7683, tzOffset: 2, isMajorHub: true, region: EUROPE },
  MAD: { iata: MAD, name: Adolfo Suarez Madrid Barajas Airport, city: Madrid, country: ES, lat: 40.4839, lon: -3.5680, tzOffset: 2, isMajorHub: true, region: EUROPE },
  FCO: { iata: FCO, name: Leonardo da Vinci Fiumicino Airport, city: Rome, country: IT, lat: 41.8003, lon: 12.2389, tzOffset: 2, isMajorHub: true, region: EUROPE },
  ZRH: { iata: ZRH, name: Zurich Airport, city: Zurich, country: CH, lat: 47.4582, lon: 8.5555, tzOffset: 2, isMajorHub: true, region: EUROPE },
  VIE: { iata: VIE, name: Vienna International Airport, city: Vienna, country: AT, lat: 48.1103, lon: 16.5697, tzOffset: 2, isMajorHub: true, region: EUROPE },
  JFK: { iata: JFK, name: John F. Kennedy International Airport, city: New York, country: US, lat: 40.6413, lon: -73.7781, tzOffset: -4, isMajorHub: true, region: NAMER },
  EWR: { iata: EWR, name: Newark Liberty International Airport, city: New York/Newark, country: US, lat: 40.6895, lon: -74.1745, tzOffset: -4, isMajorHub: true, region: NAMER },
  BOS: { iata: BOS, name: Boston Logan International Airport, city: Boston, country: US, lat: 42.3656, lon: -71.0096, tzOffset: -4, isMajorHub: true, region: NAMER },
  ORD: { iata: ORD, name: O Hare International Airport, city: Chicago, country: US, lat: 41.9742, lon: -87.9073, tzOffset: -5, isMajorHub: true, region: NAMER },
  ATL: { iata: ATL, name: Hartsfield Jackson Atlanta Airport, city: Atlanta, country: US, lat: 33.6407, lon: -84.4277, tzOffset: -4, isMajorHub: true, region: NAMER },
  MIA: { iata: MIA, name: Miami International Airport, city: Miami, country: US, lat: 25.7959, lon: -80.2870, tzOffset: -4, isMajorHub: true, region: NAMER },
  DFW: { iata: DFW, name: Dallas/Fort Worth International Airport, city: Dallas, country: US, lat: 32.8998, lon: -97.0403, tzOffset: -5, isMajorHub: true, region: NAMER },
  DEN: { iata: DEN, name: Denver International Airport, city: Denver, country: US, lat: 39.8561, lon: -104.6737, tzOffset: -6, isMajorHub: true, region: NAMER },
  SFO: { iata: SFO, name: San Francisco International Airport, city: San Francisco, country: US, lat: 37.6213, lon: -122.3790, tzOffset: -7, isMajorHub: true, region: NAMER },
  LAX: { iata: LAX, name: Los Angeles International Airport, city: Los Angeles, country: US, lat: 33.9416, lon: -118.4085, tzOffset: -7, isMajorHub: true, region: NAMER },
  SEA: { iata: SEA, name: Seattle-Tacoma International Airport, city: Seattle, country: US, lat: 47.4502, lon: -122.3088, tzOffset: -7, isMajorHub: true, region: NAMER },
  YVR: { iata: YVR, name: Vancouver International Airport, city: Vancouver, country: CA, lat: 49.1967, lon: -123.1815, tzOffset: -7, isMajorHub: true, region: NAMER },
  YYZ: { iata: YYZ, name: Toronto Pearson International Airport, city: Toronto, country: CA, lat: 43.6777, lon: -79.6248, tzOffset: -4, isMajorHub: true, region: NAMER },
  SYD: { iata: SYD, name: Sydney Kingsford Smith Airport, city: Sydney, country: AU, lat: -33.9399, lon: 151.1753, tzOffset: 10, isMajorHub: true, region: OCEANIA },
  MEL: { iata: MEL, name: Melbourne Airport, city: Melbourne, country: AU, lat: -37.6690, lon: 144.8410, tzOffset: 10, isMajorHub: true, region: OCEANIA },
  BNE: { iata: BNE, name: Brisbane Airport, city: Brisbane, country: AU, lat: -27.3842, lon: 153.1175, tzOffset: 10, isMajorHub: true, region: OCEANIA },
  AKL: { iata: AKL, name: Auckland Airport, city: Auckland, country: NZ, lat: -37.0082, lon: 174.7850, tzOffset: 12, isMajorHub: true, region: OCEANIA },
  GRU: { iata: GRU, name: Sao Paulo Guarulhos Airport, city: Sao Paulo, country: BR, lat: -23.4356, lon: -46.4731, tzOffset: -3, isMajorHub: true, region: SAMER },
  MEX: { iata: MEX, name: Mexico City International Airport, city: Mexico City, country: MX, lat: 19.4361, lon: -99.0719, tzOffset: -6, isMajorHub: true, region: NAMER },
  JNB: { iata: JNB, name: O.R. Tambo International Airport, city: Johannesburg, country: ZA, lat: -26.1367, lon: 28.2411, tzOffset: 2, isMajorHub: true, region: ME_AFRICA },
  CPT: { iata: CPT, name: Cape Town International Airport, city: Cape Town, country: ZA, lat: -33.9715, lon: 18.6021, tzOffset: 2, isMajorHub: false, region: ME_AFRICA },
};

export const GLOBAL_AIRLINES = {
  SQ: { code: SQ, name: Singapore Airlines, alliance: STAR_ALLIANCE, primaryHubs: [SIN], otp: 0.89, defaultAircraft: A350-900, baggagePolicy: { pieces: 2, weightKg: 32 } },
  CX: { code: CX, name: Cathay Pacific, alliance: ONEWORLD, primaryHubs: [HKG], otp: 0.84, defaultAircraft: B777-300ER, baggagePolicy: { pieces: 2, weightKg: 23 } },
  NH: { code: NH, name: All Nippon Airways, alliance: STAR_ALLIANCE, primaryHubs: [HND, NRT], otp: 0.91, defaultAircraft: B787-9, baggagePolicy: { pieces: 2, weightKg: 23 } },
  JL: { code: JL, name: Japan Airlines, alliance: ONEWORLD, primaryHubs: [HND, NRT], otp: 0.92, defaultAircraft: A350-1000, baggagePolicy: { pieces: 2, weightKg: 23 } },
  BA: { code: BA, name: British Airways, alliance: ONEWORLD, primaryHubs: [LHR, LGW], otp: 0.79, defaultAircraft: B777-200, baggagePolicy: { pieces: 1, weightKg: 23 } },
  LH: { code: LH, name: Lufthansa, alliance: STAR_ALLIANCE, primaryHubs: [FRA, MUC], otp: 0.82, defaultAircraft: A350-900, baggagePolicy: { pieces: 1, weightKg: 23 } },
  AF: { code: AF, name: Air France, alliance: SKYTEAM, primaryHubs: [CDG], otp: 0.81, defaultAircraft: B777-300ER, baggagePolicy: { pieces: 1, weightKg: 23 } },
  KL: { code: KL, name: KLM Royal Dutch Airlines, alliance: SKYTEAM, primaryHubs: [AMS], otp: 0.83, defaultAircraft: B787-10, baggagePolicy: { pieces: 1, weightKg: 23 } },
  EK: { code: EK, name: Emirates, alliance: INDEPENDENT, primaryHubs: [DXB], otp: 0.88, defaultAircraft: A380-800, baggagePolicy: { pieces: 2, weightKg: 30 } },
  QR: { code: QR, name: Qatar Airways, alliance: ONEWORLD, primaryHubs: [DOH], otp: 0.90, defaultAircraft: A350-1000, baggagePolicy: { pieces: 2, weightKg: 30 } },
  EY: { code: EY, name: Etihad Airways, alliance: INDEPENDENT, primaryHubs: [AUH], otp: 0.86, defaultAircraft: B787-9, baggagePolicy: { pieces: 2, weightKg: 23 } },
  UA: { code: UA, name: United Airlines, alliance: STAR_ALLIANCE, primaryHubs: [ORD, SFO, EWR, DEN, IAH], otp: 0.78, defaultAircraft: B777-200ER, baggagePolicy: { pieces: 1, weightKg: 23 } },
  AA: { code: AA, name: American Airlines, alliance: ONEWORLD, primaryHubs: [DFW, MIA, ORD, JFK, CLT], otp: 0.76, defaultAircraft: B787-8, baggagePolicy: { pieces: 1, weightKg: 23 } },
  DL: { code: DL, name: Delta Air Lines, alliance: SKYTEAM, primaryHubs: [ATL, MSP, DTW, JFK, SEA], otp: 0.85, defaultAircraft: A330-900neo, baggagePolicy: { pieces: 1, weightKg: 23 } },
  QF: { code: QF, name: Qantas, alliance: ONEWORLD, primaryHubs: [SYD, MEL, BNE], otp: 0.83, defaultAircraft: B787-9, baggagePolicy: { pieces: 2, weightKg: 30 } },
  NZ: { code: NZ, name: Air New Zealand, alliance: STAR_ALLIANCE, primaryHubs: [AKL], otp: 0.87, defaultAircraft: B787-9, baggagePolicy: { pieces: 2, weightKg: 23 } },
  TK: { code: TK, name: Turkish Airlines, alliance: STAR_ALLIANCE, primaryHubs: [IST], otp: 0.84, defaultAircraft: B787-9, baggagePolicy: { pieces: 2, weightKg: 23 } },
  KE: { code: KE, name: Korean Air, alliance: SKYTEAM, primaryHubs: [ICN], otp: 0.86, defaultAircraft: B777-300ER, baggagePolicy: { pieces: 2, weightKg: 23 } },
  OZ: { code: OZ, name: Asiana Airlines, alliance: STAR_ALLIANCE, primaryHubs: [ICN], otp: 0.85, defaultAircraft: A350-900, baggagePolicy: { pieces: 2, weightKg: 23 } },
  BR: { code: BR, name: EVA Air, alliance: STAR_ALLIANCE, primaryHubs: [TPE], otp: 0.88, defaultAircraft: B777-300ER, baggagePolicy: { pieces: 2, weightKg: 23 } },
  CI: { code: CI, name: China Airlines, alliance: SKYTEAM, primaryHubs: [TPE], otp: 0.84, defaultAircraft: A350-900, baggagePolicy: { pieces: 2, weightKg: 23 } },
  MH: { code: MH, name: Malaysia Airlines, alliance: ONEWORLD, primaryHubs: [KUL], otp: 0.80, defaultAircraft: A330-300, baggagePolicy: { pieces: 2, weightKg: 23 } },
  TG: { code: TG, name: Thai Airways, alliance: STAR_ALLIANCE, primaryHubs: [BKK], otp: 0.81, defaultAircraft: A350-900, baggagePolicy: { pieces: 2, weightKg: 23 } },
  TR: { code: TR, name: Scoot, alliance: LCC, primaryHubs: [SIN], otp: 0.77, defaultAircraft: B787-8, baggagePolicy: { pieces: 0, weightKg: 0 } },
  UO: { code: UO, name: HK Express, alliance: LCC, primaryHubs: [HKG], otp: 0.79, defaultAircraft: A321neo, baggagePolicy: { pieces: 0, weightKg: 0 } },
  WN: { code: WN, name: Southwest Airlines, alliance: LCC, primaryHubs: [DAL, MDW, HOU], otp: 0.77, defaultAircraft: B737-800, baggagePolicy: { pieces: 2, weightKg: 23 } },
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
);