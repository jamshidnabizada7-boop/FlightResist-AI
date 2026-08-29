/**
 * FlightResist AI 2.0 — Global Airport Database & Geodesic Intelligence
 *
 * Comprehensive international airport knowledge base covering major global hubs
 * across ASIA, EUROPE, NAMER, SAMER, OCEANIA, and ME_AFRICA.
 * Provides geodesic distance calculations (Haversine formula), flight duration
 * models (block times & cruise speed), and timezone offset lookups.
 */

export type AirportRegion = 'ASIA' | 'EUROPE' | 'NAMER' | 'SAMER' | 'OCEANIA' | 'ME_AFRICA' | 'OTHER';

export interface AirportData {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tzOffset: number; // Base UTC offset in hours (e.g. -4 for JFK, 1 for LHR, 8 for SIN, 9 for NRT/HND)
  isMajorHub: boolean;
  region: AirportRegion;
}

export const GLOBAL_AIRPORTS: Record<string, AirportData> = {
  // -------------------------------------------------------------------------
  // ASIA
  // -------------------------------------------------------------------------
  SIN: { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'SG', lat: 1.3644, lon: 103.9915, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  HKG: { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'HK', lat: 22.3080, lon: 113.9185, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  NRT: { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'JP', lat: 35.7720, lon: 140.3929, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  HND: { iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'JP', lat: 35.5494, lon: 139.7798, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  KIX: { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', country: 'JP', lat: 34.4347, lon: 135.2441, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  FUK: { iata: 'FUK', name: 'Fukuoka Airport', city: 'Fukuoka', country: 'JP', lat: 33.5859, lon: 130.4507, tzOffset: 9, isMajorHub: false, region: 'ASIA' },
  CTS: { iata: 'CTS', name: 'New Chitose Airport', city: 'Sapporo', country: 'JP', lat: 42.7752, lon: 141.6923, tzOffset: 9, isMajorHub: false, region: 'ASIA' },
  NGO: { iata: 'NGO', name: 'Chubu Centrair International Airport', city: 'Nagoya', country: 'JP', lat: 34.8584, lon: 136.8053, tzOffset: 9, isMajorHub: false, region: 'ASIA' },
  ICN: { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'KR', lat: 37.4602, lon: 126.4407, tzOffset: 9, isMajorHub: true, region: 'ASIA' },
  GMP: { iata: 'GMP', name: 'Gimpo International Airport', city: 'Seoul', country: 'KR', lat: 37.5583, lon: 126.7906, tzOffset: 9, isMajorHub: false, region: 'ASIA' },
  PUS: { iata: 'PUS', name: 'Gimhae International Airport', city: 'Busan', country: 'KR', lat: 35.1795, lon: 128.9382, tzOffset: 9, isMajorHub: false, region: 'ASIA' },
  TPE: { iata: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'TW', lat: 25.0797, lon: 121.2342, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  TSA: { iata: 'TSA', name: 'Taipei Songshan Airport', city: 'Taipei', country: 'TW', lat: 25.0697, lon: 121.5525, tzOffset: 8, isMajorHub: false, region: 'ASIA' },
  KHH: { iata: 'KHH', name: 'Kaohsiung International Airport', city: 'Kaohsiung', country: 'TW', lat: 22.5770, lon: 120.3500, tzOffset: 8, isMajorHub: false, region: 'ASIA' },
  KUL: { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'MY', lat: 2.7456, lon: 101.7072, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  PEN: { iata: 'PEN', name: 'Penang International Airport', city: 'Penang', country: 'MY', lat: 5.2971, lon: 100.2769, tzOffset: 8, isMajorHub: false, region: 'ASIA' },
  BKK: { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'TH', lat: 13.6900, lon: 100.7501, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  DMK: { iata: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'TH', lat: 13.9126, lon: 100.6068, tzOffset: 7, isMajorHub: false, region: 'ASIA' },
  HKT: { iata: 'HKT', name: 'Phuket International Airport', city: 'Phuket', country: 'TH', lat: 8.1132, lon: 98.3169, tzOffset: 7, isMajorHub: false, region: 'ASIA' },
  CNX: { iata: 'CNX', name: 'Chiang Mai International Airport', city: 'Chiang Mai', country: 'TH', lat: 18.7668, lon: 98.9626, tzOffset: 7, isMajorHub: false, region: 'ASIA' },
  SGN: { iata: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'VN', lat: 10.8185, lon: 106.6520, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  HAN: { iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'VN', lat: 21.2212, lon: 105.8072, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  DAD: { iata: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'VN', lat: 16.0439, lon: 108.1994, tzOffset: 7, isMajorHub: false, region: 'ASIA' },
  MNL: { iata: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'PH', lat: 14.5086, lon: 121.0194, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  CEB: { iata: 'CEB', name: 'Mactan-Cebu International Airport', city: 'Cebu', country: 'PH', lat: 10.3075, lon: 123.9794, tzOffset: 8, isMajorHub: false, region: 'ASIA' },
  PVG: { iata: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'CN', lat: 31.1443, lon: 121.8083, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  SHA: { iata: 'SHA', name: 'Shanghai Hongqiao International Airport', city: 'Shanghai', country: 'CN', lat: 31.1979, lon: 121.3363, tzOffset: 8, isMajorHub: false, region: 'ASIA' },
  PEK: { iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'CN', lat: 40.0799, lon: 116.6031, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  PKX: { iata: 'PKX', name: 'Beijing Daxing International Airport', city: 'Beijing', country: 'CN', lat: 39.5098, lon: 116.4105, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  CAN: { iata: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'CN', lat: 23.3924, lon: 113.2988, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  SZX: { iata: 'SZX', name: 'Shenzhen Baoan International Airport', city: 'Shenzhen', country: 'CN', lat: 22.6393, lon: 113.8106, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  CTU: { iata: 'CTU', name: 'Chengdu Shuangliu International Airport', city: 'Chengdu', country: 'CN', lat: 30.5785, lon: 103.9471, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  TFU: { iata: 'TFU', name: 'Chengdu Tianfu International Airport', city: 'Chengdu', country: 'CN', lat: 30.3164, lon: 104.4449, tzOffset: 8, isMajorHub: true, region: 'ASIA' },
  DEL: { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'IN', lat: 28.5562, lon: 77.1000, tzOffset: 5.5, isMajorHub: true, region: 'ASIA' },
  BOM: { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj Airport', city: 'Mumbai', country: 'IN', lat: 19.0896, lon: 72.8656, tzOffset: 5.5, isMajorHub: true, region: 'ASIA' },
  BLR: { iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'IN', lat: 13.1979, lon: 77.7063, tzOffset: 5.5, isMajorHub: true, region: 'ASIA' },
  CGK: { iata: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'ID', lat: -6.1256, lon: 106.6559, tzOffset: 7, isMajorHub: true, region: 'ASIA' },
  DPS: { iata: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali', country: 'ID', lat: -8.7482, lon: 115.1672, tzOffset: 8, isMajorHub: true, region: 'ASIA' },

  // -------------------------------------------------------------------------
  // EUROPE
  // -------------------------------------------------------------------------
  LHR: { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'GB', lat: 51.4700, lon: -0.4543, tzOffset: 1, isMajorHub: true, region: 'EUROPE' },
  LGW: { iata: 'LGW', name: 'London Gatwick Airport', city: 'London', country: 'GB', lat: 51.1537, lon: -0.1821, tzOffset: 1, isMajorHub: false, region: 'EUROPE' },
  CDG: { iata: 'CDG', name: 'Paris Charles de Gaulle Airport', city: 'Paris', country: 'FR', lat: 49.0097, lon: 2.5479, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  ORY: { iata: 'ORY', name: 'Paris Orly Airport', city: 'Paris', country: 'FR', lat: 48.7262, lon: 2.3652, tzOffset: 2, isMajorHub: false, region: 'EUROPE' },
  FRA: { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'DE', lat: 50.0379, lon: 8.5622, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  MUC: { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'DE', lat: 48.3537, lon: 11.7750, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  AMS: { iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'NL', lat: 52.3105, lon: 4.7683, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  MAD: { iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'ES', lat: 40.4839, lon: -3.5680, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  BCN: { iata: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat Airport', city: 'Barcelona', country: 'ES', lat: 41.2974, lon: 2.0833, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  FCO: { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'IT', lat: 41.8003, lon: 12.2389, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  MXP: { iata: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'IT', lat: 45.6301, lon: 8.7255, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  ZRH: { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'CH', lat: 47.4582, lon: 8.5555, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  VIE: { iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'AT', lat: 48.1103, lon: 16.5697, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  BRU: { iata: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'BE', lat: 50.9010, lon: 4.4856, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  CPH: { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'DK', lat: 55.6180, lon: 12.6508, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  ARN: { iata: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'SE', lat: 59.6498, lon: 17.9238, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  OSL: { iata: 'OSL', name: 'Oslo Airport Gardermoen', city: 'Oslo', country: 'NO', lat: 60.1976, lon: 11.1004, tzOffset: 2, isMajorHub: true, region: 'EUROPE' },
  HEL: { iata: 'HEL', name: 'Helsinki Airport', city: 'Helsinki', country: 'FI', lat: 60.3172, lon: 24.9633, tzOffset: 3, isMajorHub: true, region: 'EUROPE' },
  IST: { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'TR', lat: 41.2753, lon: 28.7519, tzOffset: 3, isMajorHub: true, region: 'EUROPE' },
  SAW: { iata: 'SAW', name: 'Istanbul Sabiha Gokcen Airport', city: 'Istanbul', country: 'TR', lat: 40.8986, lon: 29.3092, tzOffset: 3, isMajorHub: false, region: 'EUROPE' },
  ATH: { iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'GR', lat: 37.9364, lon: 23.9445, tzOffset: 3, isMajorHub: true, region: 'EUROPE' },
  DUB: { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'IE', lat: 53.4264, lon: -6.2499, tzOffset: 1, isMajorHub: true, region: 'EUROPE' },
  LIS: { iata: 'LIS', name: 'Humberto Delgado Airport', city: 'Lisbon', country: 'PT', lat: 38.7742, lon: -9.1342, tzOffset: 1, isMajorHub: true, region: 'EUROPE' },

  // -------------------------------------------------------------------------
  // NORTH AMERICA (NAMER)
  // -------------------------------------------------------------------------
  JFK: { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'US', lat: 40.6413, lon: -73.7781, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  EWR: { iata: 'EWR', name: 'Newark Liberty International Airport', city: 'New York/Newark', country: 'US', lat: 40.6895, lon: -74.1745, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  LGA: { iata: 'LGA', name: 'LaGuardia Airport', city: 'New York', country: 'US', lat: 40.7769, lon: -73.8740, tzOffset: -4, isMajorHub: false, region: 'NAMER' },
  BOS: { iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'US', lat: 42.3656, lon: -71.0096, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  IAD: { iata: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'US', lat: 38.9531, lon: -77.4565, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  DCA: { iata: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', country: 'US', lat: 38.8512, lon: -77.0402, tzOffset: -4, isMajorHub: false, region: 'NAMER' },
  ORD: { iata: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'US', lat: 41.9742, lon: -87.9073, tzOffset: -5, isMajorHub: true, region: 'NAMER' },
  MDW: { iata: 'MDW', name: 'Chicago Midway International Airport', city: 'Chicago', country: 'US', lat: 41.7868, lon: -87.7522, tzOffset: -5, isMajorHub: false, region: 'NAMER' },
  ATL: { iata: 'ATL', name: 'Hartsfield–Jackson Atlanta Airport', city: 'Atlanta', country: 'US', lat: 33.6407, lon: -84.4277, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  MIA: { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'US', lat: 25.7959, lon: -80.2870, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  DFW: { iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'US', lat: 32.8998, lon: -97.0403, tzOffset: -5, isMajorHub: true, region: 'NAMER' },
  IAH: { iata: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'US', lat: 29.9902, lon: -95.3368, tzOffset: -5, isMajorHub: true, region: 'NAMER' },
  DEN: { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'US', lat: 39.8561, lon: -104.6737, tzOffset: -6, isMajorHub: true, region: 'NAMER' },
  SFO: { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'US', lat: 37.6213, lon: -122.3790, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  LAX: { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'US', lat: 33.9416, lon: -118.4085, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  SEA: { iata: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'US', lat: 47.4502, lon: -122.3088, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  LAS: { iata: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', country: 'US', lat: 36.0840, lon: -115.1537, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  PHX: { iata: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', country: 'US', lat: 33.4352, lon: -112.0101, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  YVR: { iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'CA', lat: 49.1967, lon: -123.1815, tzOffset: -7, isMajorHub: true, region: 'NAMER' },
  YYZ: { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'CA', lat: 43.6777, lon: -79.6248, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  YUL: { iata: 'YUL', name: 'Montréal-Trudeau International Airport', city: 'Montreal', country: 'CA', lat: 45.4706, lon: -73.7408, tzOffset: -4, isMajorHub: true, region: 'NAMER' },
  MEX: { iata: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'MX', lat: 19.4361, lon: -99.0719, tzOffset: -6, isMajorHub: true, region: 'NAMER' },
  CUN: { iata: 'CUN', name: 'Cancún International Airport', city: 'Cancun', country: 'MX', lat: 21.0365, lon: -86.8771, tzOffset: -5, isMajorHub: true, region: 'NAMER' },

  // -------------------------------------------------------------------------
  // SOUTH AMERICA (SAMER)
  // -------------------------------------------------------------------------
  GRU: { iata: 'GRU', name: 'São Paulo/Guarulhos Airport', city: 'São Paulo', country: 'BR', lat: -23.4356, lon: -46.4731, tzOffset: -3, isMajorHub: true, region: 'SAMER' },
  GIG: { iata: 'GIG', name: 'Rio de Janeiro/Galeão Airport', city: 'Rio de Janeiro', country: 'BR', lat: -22.8134, lon: -43.2494, tzOffset: -3, isMajorHub: true, region: 'SAMER' },
  BOG: { iata: 'BOG', name: 'El Dorado International Airport', city: 'Bogota', country: 'CO', lat: 4.7016, lon: -74.1469, tzOffset: -5, isMajorHub: true, region: 'SAMER' },
  EZE: { iata: 'EZE', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'AR', lat: -34.8222, lon: -58.5358, tzOffset: -3, isMajorHub: true, region: 'SAMER' },
  SCL: { iata: 'SCL', name: 'Arturo Merino Benítez International Airport', city: 'Santiago', country: 'CL', lat: -33.3930, lon: -70.7858, tzOffset: -4, isMajorHub: true, region: 'SAMER' },
  LIM: { iata: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'PE', lat: -12.0219, lon: -77.1143, tzOffset: -5, isMajorHub: true, region: 'SAMER' },

  // -------------------------------------------------------------------------
  // OCEANIA
  // -------------------------------------------------------------------------
  SYD: { iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'AU', lat: -33.9399, lon: 151.1753, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  MEL: { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'AU', lat: -37.6690, lon: 144.8410, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  BNE: { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'AU', lat: -27.3842, lon: 153.1175, tzOffset: 10, isMajorHub: true, region: 'OCEANIA' },
  PER: { iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'AU', lat: -31.9403, lon: 115.9668, tzOffset: 8, isMajorHub: true, region: 'OCEANIA' },
  AKL: { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'NZ', lat: -37.0082, lon: 174.7850, tzOffset: 12, isMajorHub: true, region: 'OCEANIA' },
  CHC: { iata: 'CHC', name: 'Christchurch International Airport', city: 'Christchurch', country: 'NZ', lat: -43.4894, lon: 172.5322, tzOffset: 12, isMajorHub: false, region: 'OCEANIA' },
  NAN: { iata: 'NAN', name: 'Nadi International Airport', city: 'Nadi', country: 'FJ', lat: -17.7554, lon: 177.4434, tzOffset: 12, isMajorHub: true, region: 'OCEANIA' },

  // -------------------------------------------------------------------------
  // MIDDLE EAST & AFRICA (ME_AFRICA)
  // -------------------------------------------------------------------------
  DXB: { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'AE', lat: 25.2532, lon: 55.3657, tzOffset: 4, isMajorHub: true, region: 'ME_AFRICA' },
  DOH: { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'QA', lat: 25.2731, lon: 51.6081, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  AUH: { iata: 'AUH', name: 'Zayed International Airport', city: 'Abu Dhabi', country: 'AE', lat: 24.4330, lon: 54.6511, tzOffset: 4, isMajorHub: true, region: 'ME_AFRICA' },
  RUH: { iata: 'RUH', name: 'King Khalid International Airport', city: 'Riyadh', country: 'SA', lat: 24.9576, lon: 46.6988, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  JED: { iata: 'JED', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'SA', lat: 21.6796, lon: 39.1565, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  CAI: { iata: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'EG', lat: 30.1219, lon: 31.4056, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  JNB: { iata: 'JNB', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'ZA', lat: -26.1367, lon: 28.2411, tzOffset: 2, isMajorHub: true, region: 'ME_AFRICA' },
  CPT: { iata: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'ZA', lat: -33.9715, lon: 18.6021, tzOffset: 2, isMajorHub: false, region: 'ME_AFRICA' },
  NBO: { iata: 'NBO', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'KE', lat: -1.3192, lon: 36.9278, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  ADD: { iata: 'ADD', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'ET', lat: 8.9779, lon: 38.7993, tzOffset: 3, isMajorHub: true, region: 'ME_AFRICA' },
  CMN: { iata: 'CMN', name: 'Mohammed V International Airport', city: 'Casablanca', country: 'MA', lat: 33.3675, lon: -7.5899, tzOffset: 1, isMajorHub: true, region: 'ME_AFRICA' },
};

/**
 * Retrieve airport data by 3-letter IATA code.
 */
export function getAirport(code: string): AirportData | undefined {
  if (!code || typeof code !== 'string') return undefined;
  return GLOBAL_AIRPORTS[code.trim().toUpperCase()];
}

/**
 * Retrieve all airports situated within a specified geographic region.
 */
export function getAirportsByRegion(region: AirportRegion): AirportData[] {
  return Object.values(GLOBAL_AIRPORTS).filter((a) => a.region === region);
}

/**
 * Compute the great-circle Haversine distance in kilometers between two coordinates.
 * Overloaded to accept 4 numbers (lat1, lon1, lat2, lon2) or 2 coordinate/airport objects.
 */
export function calculateDistanceKm(
  lat1OrA1: number | { lat: number; lon: number },
  lon1OrA2: number | { lat: number; lon: number },
  lat2?: number,
  lon2?: number,
): number {
  let lat1: number;
  let lon1: number;
  let lat2Val: number;
  let lon2Val: number;

  if (typeof lat1OrA1 === 'object' && lat1OrA1 !== null && typeof lon1OrA2 === 'object' && lon1OrA2 !== null) {
    lat1 = lat1OrA1.lat;
    lon1 = lat1OrA1.lon;
    lat2Val = lon1OrA2.lat;
    lon2Val = lon1OrA2.lon;
  } else {
    lat1 = Number(lat1OrA1);
    lon1 = Number(lon1OrA2);
    lat2Val = Number(lat2 ?? 0);
    lon2Val = Number(lon2 ?? 0);
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2Val - lat1) * Math.PI) / 180;
  const dLon = ((lon2Val - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2Val * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculate realistic scheduled block flight duration in minutes based on geodesic distance.
 * Models: 45-minute standard taxi/climb/descent block time + 820 km/h cruising velocity.
 */
export function calculateFlightDurationMin(distanceKm: number): number {
  const cruiseSpeedKmh = 820;
  return Math.round(45 + (Math.max(0, distanceKm) / cruiseSpeedKmh) * 60);
}

export function getAirportName(code: string): string {
  return GLOBAL_AIRPORTS[code.toUpperCase()]?.name || code;
}

export function getAirportCity(code: string): string {
  return GLOBAL_AIRPORTS[code.toUpperCase()]?.city || code;
}
