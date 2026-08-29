/**
 * FlightResist AI 2.0 — Bi-directional PNR & Itinerary Parser / Formatter
 *
 * Implements:
 * 1. Strict Zod schemas for JSON itinerary validation (`ItinerarySchema`)
 * 2. Bi-directional GDS / PNR text parser (`parsePnr`)
 * 3. Standard GDS / PNR text serializer (`formatPnr`)
 */

import { z } from 'zod';
import type {
  FlightLeg,
  Itinerary,
  PassengerProfile,
  MissionContext,
  TripConstraints,
  TripCommitment,
  MissionImportance,
} from './types';

// ---------------------------------------------------------------------------
// 1. Zod Validation Schemas
// ---------------------------------------------------------------------------

export const FlightLegSchema = z.object({
  flightNumber: z.string().min(2),
  airlineCode: z.string().min(2).max(4),
  airlineName: z.string().min(1),
  from: z.string().min(2).max(4),
  to: z.string().min(2).max(4),
  depIso: z.string().min(10),
  arrIso: z.string().min(10),
  durationMin: z.number().nonnegative(),
  aircraft: z.string().default('Commercial Aircraft'),
  cabin: z.string().default('Economy (Flexi)'),
});

export const PassengerProfileSchema = z.object({
  name: z.string().min(1),
  ticketReference: z.string().min(1),
  loyaltyProgram: z.string().default(''),
  loyaltyTier: z.string().default(''),
  loyaltyNumber: z.string().default(''),
  nationality: z.string().default('US'),
  passportNumber: z.string().optional(),
  passportExpiryIso: z.string().optional(),
  issuingCountry: z.string().optional(),
  contactEmail: z.string().default(''),
  contactPhone: z.string().default(''),
  checkedBags: z.number().int().nonnegative().default(1),
  loyalty: z.string().default(''),
});

export const MissionContextSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  venue: z.string().default(''),
  location: z.string().default(''),
  dealValue: z.number().optional(),
  dealCurrency: z.string().default('USD').optional(),
  importance: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
  deadlineIso: z.string().min(10),
  timezone: z.string().default('UTC'),
});

export const TripConstraintsSchema = z.object({
  budgetUsd: z.number().nonnegative(),
  mctMin: z.number().nonnegative(),
  arrivalDeadlineIso: z.string().min(10),
  hardArrivalLimitIso: z.string().min(10),
  baggagePieces: z.number().int().nonnegative().default(1),
  baggageWeightKg: z.number().nonnegative().default(23),
});

export const TripCommitmentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['MEETING', 'HOTEL', 'TRANSFER', 'EVENT']),
  label: z.string().min(1),
  detail: z.string().default(''),
  atIso: z.string().min(10),
  location: z.string().default(''),
});

export const ItinerarySchema = z.object({
  tripId: z.string().min(1),
  origin: z.string().min(2).max(4),
  destination: z.string().min(2).max(4),
  travelDateIso: z.string().min(10),
  legs: z.array(FlightLegSchema).min(1),
  passenger: PassengerProfileSchema,
  mission: MissionContextSchema,
  tripPurpose: z.string().default(''),
  constraints: TripConstraintsSchema,
  commitments: z.array(TripCommitmentSchema).default([]),
});

export type ValidatedItinerary = z.infer<typeof ItinerarySchema>;

// ---------------------------------------------------------------------------
// 2. Month and Date Helpers for GDS Parsing
// ---------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDateToGds(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getUTCMonth()];
    return `${day}${month}`;
  } catch {
    return '27AUG';
  }
}

function formatTimeToGds(isoString: string): string {
  try {
    // Extract HH:MM from ISO string if offset is present, e.g. 2026-08-27T08:00:00+08:00
    const m = /T(\d{2}):(\d{2})/.exec(isoString);
    if (m) {
      return `${m[1]}${m[2]}`;
    }
    const d = new Date(isoString);
    return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch {
    return '0800';
  }
}

// ---------------------------------------------------------------------------
// 3. PNR Formatter (Itinerary -> Standard GDS Text)
// ---------------------------------------------------------------------------

export function formatPnr(itinerary: Itinerary): string {
  const lines: string[] = [];

  // PNR Header / Locator
  const pnrLocator = itinerary.tripId.replace(/[^A-Z0-9]/g, '').slice(-6) || 'FR2026';
  lines.push(`*** FLIGHTRESIST AI GDS PNR: ${pnrLocator} ***`);
  lines.push(`RP/SIN1A0980/1A   ${formatDateToGds(itinerary.travelDateIso)}26   ${pnrLocator}`);

  // 1. Passenger Name (Amadeus / Sabre format: SURNAME/FIRSTNAME TITLE)
  const nameParts = itinerary.passenger.name.trim().split(/\s+/);
  let gdsName = '';
  if (nameParts.length === 1) {
    gdsName = `1.1${nameParts[0].toUpperCase()}/TRAVELER MR`;
  } else {
    const surname = nameParts[nameParts.length - 1].toUpperCase();
    const given = nameParts.slice(0, -1).join(' ').toUpperCase();
    gdsName = `1.1${surname}/${given} MR`;
  }
  lines.push(gdsName);

  // 2. Flight Segments (Lines: 1. SQ 856 Y 27AUG SINHKG HK1 0800 1205)
  itinerary.legs.forEach((leg, index) => {
    const legNum = index + 1;
    const airline = leg.airlineCode.padEnd(2, ' ');
    const flightNum = leg.flightNumber.replace(/^[A-Z0-9]{2}/, '');
    const cabinCode = leg.cabin.toUpperCase().includes('FIRST')
      ? 'F'
      : leg.cabin.toUpperCase().includes('BUSINESS') || leg.cabin.toUpperCase().includes('POLARIS') || leg.cabin.toUpperCase().includes('CLUB')
      ? 'J'
      : 'Y';
    const gdsDate = formatDateToGds(leg.depIso);
    const depTime = formatTimeToGds(leg.depIso);
    const arrTime = formatTimeToGds(leg.arrIso);
    const cityPair = `${leg.from}${leg.to}`;

    lines.push(` ${legNum}. ${airline} ${flightNum} ${cabinCode} ${gdsDate} ${cityPair} HK1 ${depTime} ${arrTime} /E`);
  });

  // 3. Ticket & Loyalty Remarks
  lines.push(`RM TKT NBR ${itinerary.passenger.ticketReference}`);
  if (itinerary.passenger.loyaltyProgram || itinerary.passenger.loyaltyNumber) {
    const program = itinerary.passenger.loyaltyProgram || itinerary.legs[0]?.airlineName || 'AIRLINE';
    const tier = itinerary.passenger.loyaltyTier || itinerary.passenger.loyalty || 'MEMBER';
    const num = itinerary.passenger.loyaltyNumber || '00000000';
    lines.push(`RM FQTV ${program} | ${tier} | ${num}`);
  }

  // 4. Contact & Nationality / Passport Remarks
  if (itinerary.passenger.contactEmail || itinerary.passenger.contactPhone) {
    lines.push(`RM CTC EMAIL: ${itinerary.passenger.contactEmail} | TEL: ${itinerary.passenger.contactPhone}`);
  }
  if (itinerary.passenger.passportNumber) {
    lines.push(
      `RM DOCS P/${itinerary.passenger.nationality || 'XX'}/${itinerary.passenger.passportNumber}/${
        itinerary.passenger.issuingCountry || 'XX'
      }/${itinerary.passenger.passportExpiryIso || '2030-01-01'}`
    );
  }

  // 5. Baggage Allowance Remark
  lines.push(
    `RM BAG ${itinerary.constraints.baggagePieces ?? 1}PC ${itinerary.constraints.baggageWeightKg ?? 23}KG`
  );

  // 6. Mission Context Remark
  const dealStr = itinerary.mission?.dealValue
    ? ` | DEAL: ${itinerary.mission.dealValue} ${itinerary.mission.dealCurrency || 'USD'}`
    : '';
  lines.push(
    `RM MISSION TITLE: ${itinerary.mission?.title || itinerary.tripPurpose || 'Enterprise Travel'} | VENUE: ${
      itinerary.mission?.venue || 'Meeting Location'
    }${dealStr} | IMP: ${itinerary.mission?.importance || 'HIGH'} | DEADLINE: ${
      itinerary.mission?.deadlineIso || itinerary.constraints.arrivalDeadlineIso
    } | TZ: ${itinerary.mission?.timezone || 'UTC'}`
  );

  // 7. Policy Constraints Remark
  lines.push(
    `RM BUDGET USD ${itinerary.constraints.budgetUsd} | MCT ${itinerary.constraints.mctMin} | ARR_DEADLINE ${itinerary.constraints.arrivalDeadlineIso} | HARD_LIMIT ${itinerary.constraints.hardArrivalLimitIso}`
  );

  // 8. Commitments Remarks
  if (itinerary.commitments && itinerary.commitments.length > 0) {
    for (const c of itinerary.commitments) {
      lines.push(`RM CMT ${c.kind} | ${c.label} | ${c.atIso} | ${c.location} | ${c.detail}`);
    }
  }

  lines.push(`*** END OF PNR ***`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 4. PNR Parser (Standard GDS Text -> Itinerary)
// ---------------------------------------------------------------------------

export interface PnrParseResult {
  success: boolean;
  itinerary?: Itinerary;
  errors?: string[];
  warnings?: string[];
}

export function parsePnr(rawPnr: string): PnrParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawPnr || typeof rawPnr !== 'string' || rawPnr.trim().length === 0) {
    return { success: false, errors: ['PNR raw text cannot be empty.'] };
  }

  const lines = rawPnr
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let pnrLocator = 'PNR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  let passengerName = '';
  let ticketReference = '';
  let loyaltyProgram = '';
  let loyaltyTier = '';
  let loyaltyNumber = '';
  let nationality = 'US';
  let passportNumber: string | undefined;
  let passportExpiryIso: string | undefined;
  let issuingCountry: string | undefined;
  let contactEmail = '';
  let contactPhone = '';
  let baggagePieces = 1;
  let baggageWeightKg = 23;

  let missionTitle = '';
  let missionVenue = '';
  let missionDealValue: number | undefined;
  let missionDealCurrency = 'USD';
  let missionImportance: MissionImportance = 'HIGH';
  let missionDeadlineIso = '';
  let missionTimezone = 'UTC';

  let budgetUsd = 250;
  let mctMin = 60;
  let arrivalDeadlineIso = '';
  let hardArrivalLimitIso = '';

  const commitments: TripCommitment[] = [];
  const parsedLegs: FlightLeg[] = [];

  // Parse header
  const headerMatch = /\*\*\* FLIGHTRESIST AI GDS PNR:\s*([A-Z0-9-]+)\s*\*\*\*/i.exec(rawPnr);
  if (headerMatch) {
    pnrLocator = headerMatch[1];
  }

  for (const line of lines) {
    // 1. Passenger Name line: 1.1SURNAME/GIVEN MR or 1.1 CHEN/WEI
    const nameMatch = /^1\.1\s*([\p{L}\s'.-]+)\/([\p{L}\s'.-]+?)(?:\s+(MR|MRS|MS|DR|PROF))?$/iu.exec(line);
    if (nameMatch) {
      const surname = nameMatch[1].trim();
      const given = nameMatch[2].trim();
      // Capitalize nicely, handling hyphens and dots
      const formatWord = (w: string) =>
        w
          .split('-')
          .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
          .join('-');
      const formattedGiven = given.split(/\s+/).map(formatWord).join(' ');
      const formattedSurname = surname.split(/\s+/).map(formatWord).join(' ');
      passengerName = `${formattedGiven} ${formattedSurname}`;
      continue;
    }

    // Direct plain passenger line fallback
    const directNameMatch = /^1\.1\s*([\p{L}\s'.-]+)$/iu.exec(line);
    if (directNameMatch && !passengerName && !line.includes('SQ') && !line.includes('BA')) {
      passengerName = directNameMatch[1].trim();
      continue;
    }

    // 2. Flight Leg line: 1. SQ 856 Y 27AUG SINHKG HK1 0800 1205
    // or: 1. BA117 J 27AUG LHRJFK HK1 0840 1130
    const legMatch = /^\s*(\d+)\.?\s+([A-Z0-9]{2})\s*(\d+)\s+([A-Z])\s+(\d{1,2}[A-Z]{3})\s+([A-Z]{3})\s*([A-Z]{3})\s+(?:HK\d+|CONF|OK)?\s*(\d{4})\s+(\d{4})/i.exec(
      line
    );

    if (legMatch) {
      const airlineCode = legMatch[2].toUpperCase();
      const rawNum = legMatch[3].replace(/^0+/, '');
      const flightNumber = `${airlineCode}${rawNum || legMatch[3]}`;
      const cabinLetter = legMatch[4].toUpperCase();
      const dateStr = legMatch[5].toUpperCase();
      const from = legMatch[6].toUpperCase();
      const to = legMatch[7].toUpperCase();
      const depTime = legMatch[8];
      const arrTime = legMatch[9];

      // Parse date
      const dayMatch = /^(\d{1,2})([A-Z]{3})$/.exec(dateStr);
      let year = new Date().getFullYear();
      let month = '08';
      let day = '27';
      if (dayMatch) {
        day = dayMatch[1].padStart(2, '0');
        month = MONTHS[dayMatch[2]] || '08';
      }

      const depHours = depTime.slice(0, 2);
      const depMins = depTime.slice(2, 4);
      const arrHours = arrTime.slice(0, 2);
      const arrMins = arrTime.slice(2, 4);

      // Sane ISO string generation
      const depIso = `${year}-${month}-${day}T${depHours}:${depMins}:00Z`;
      let arrIso = `${year}-${month}-${day}T${arrHours}:${arrMins}:00Z`;

      // If arrival time is earlier than dep time, assume next day (+1)
      if (parseInt(arrTime, 10) < parseInt(depTime, 10)) {
        const nextDay = String(parseInt(day, 10) + 1).padStart(2, '0');
        arrIso = `${year}-${month}-${nextDay}T${arrHours}:${arrMins}:00Z`;
      }

      // Compute approximate duration in minutes
      let depDateMs = new Date(depIso).getTime();
      let arrDateMs = new Date(arrIso).getTime();
      let durationMin = Math.round((arrDateMs - depDateMs) / (60 * 1000));
      if (durationMin <= 0) durationMin = 240;

      const cabin = cabinLetter === 'F' ? 'First Class' : cabinLetter === 'J' ? 'Business Class' : 'Economy (Flexi)';

      parsedLegs.push({
        flightNumber,
        airlineCode,
        airlineName: getAirlineName(airlineCode),
        from,
        to,
        depIso,
        arrIso,
        durationMin,
        aircraft: 'Commercial Jet',
        cabin,
      });
      continue;
    }

    // 3. Ticket Number Remark: RM TKT NBR SQ-4471-XK2
    const tktMatch = /^RM\s+TKT\s+(?:NBR\s+)?([A-Z0-9-]+)/i.exec(line);
    if (tktMatch) {
      ticketReference = tktMatch[1].trim();
      continue;
    }

    // 4. Frequent Flyer Remark: RM FQTV SQ | KrisFlyer Elite Gold | SQ-KF-99281741
    const fqtvMatch = /^RM\s+FQTV\s+(.+)$/i.exec(line);
    if (fqtvMatch) {
      const parts = fqtvMatch[1].split('|').map((s) => s.trim());
      if (parts.length >= 3) {
        loyaltyProgram = parts[0];
        loyaltyTier = parts[1];
        loyaltyNumber = parts[2];
      } else if (parts.length === 1) {
        loyaltyTier = parts[0];
        loyaltyProgram = parts[0];
      }
      continue;
    }

    // 5. Contact Remark: RM CTC EMAIL: xxx | TEL: yyy
    const ctcMatch = /^RM\s+CTC\s+(.+)$/i.exec(line);
    if (ctcMatch) {
      const emailMatch = /EMAIL:\s*([^\s|]+)/i.exec(ctcMatch[1]);
      if (emailMatch) contactEmail = emailMatch[1].trim();
      const phoneMatch = /TEL:\s*([^|]+)/i.exec(ctcMatch[1]);
      if (phoneMatch) contactPhone = phoneMatch[1].trim();
      continue;
    }

    // 6. Docs Remark: RM DOCS P/SG/E9823144A/SGP/2031-10-14
    const docsMatch = /^RM\s+DOCS\s+P\/([A-Z0-9]+)\/([A-Z0-9]+)\/([A-Z0-9]+)\/([^\s]+)/i.exec(line);
    if (docsMatch) {
      nationality = docsMatch[1];
      passportNumber = docsMatch[2];
      issuingCountry = docsMatch[3];
      passportExpiryIso = docsMatch[4];
      continue;
    }

    // 7. Baggage Remark: RM BAG 2PC 32KG
    const bagMatch = /^RM\s+BAG\s+(\d+)PC\s+(\d+)KG/i.exec(line);
    if (bagMatch) {
      baggagePieces = parseInt(bagMatch[1], 10);
      baggageWeightKg = parseInt(bagMatch[2], 10);
      continue;
    }

    // 8. Mission Remark: RM MISSION TITLE: ... | VENUE: ... | DEAL: ... | IMP: ... | DEADLINE: ... | TZ: ...
    const missionMatch = /^RM\s+MISSION\s+(.+)$/i.exec(line);
    if (missionMatch) {
      const parts = missionMatch[1].split('|').map((s) => s.trim());
      for (const part of parts) {
        const titleM = /^TITLE:\s*(.+)$/i.exec(part);
        if (titleM) missionTitle = titleM[1].trim();

        const venueM = /^VENUE:\s*(.+)$/i.exec(part);
        if (venueM) missionVenue = venueM[1].trim();

        const dealM = /^DEAL:\s*(\d+(?:\.\d+)?)\s*([A-Z]{3})?$/i.exec(part);
        if (dealM) {
          missionDealValue = parseFloat(dealM[1]);
          if (dealM[2]) missionDealCurrency = dealM[2];
        }

        const impM = /^IMP:\s*(CRITICAL|HIGH|MEDIUM|LOW)$/i.exec(part);
        if (impM) missionImportance = impM[1].toUpperCase() as MissionImportance;

        const deadM = /^DEADLINE:\s*(.+)$/i.exec(part);
        if (deadM) missionDeadlineIso = deadM[1].trim();

        const tzM = /^TZ:\s*(.+)$/i.exec(part);
        if (tzM) missionTimezone = tzM[1].trim();
      }
      continue;
    }

    // 9. Budget & Constraints Remark: RM BUDGET USD 350 | MCT 75 | ARR_DEADLINE ... | HARD_LIMIT ...
    const budgetMatch = /^RM\s+BUDGET\s+(.+)$/i.exec(line);
    if (budgetMatch) {
      const usdM = /(?:USD\s*|BUDGET\s*(?:USD\s*)?)(\d+)/i.exec(line);
      if (usdM) budgetUsd = parseInt(usdM[1], 10);

      const mctM = /MCT\s*(\d+)/i.exec(line);
      if (mctM) mctMin = parseInt(mctM[1], 10);

      const arrDeadM = /ARR_DEADLINE\s*([^\s|]+)/i.exec(line);
      if (arrDeadM) arrivalDeadlineIso = arrDeadM[1];

      const hardLimitM = /HARD_LIMIT\s*([^\s|]+)/i.exec(line);
      if (hardLimitM) hardArrivalLimitIso = hardLimitM[1];
      continue;
    }

    // 10. Commitment Remark: RM CMT MEETING | Contract signing | 2026-08-28T08:30:00+09:00 | Marunouchi, Tokyo | Detail
    const cmtMatch = /^RM\s+CMT\s+(MEETING|HOTEL|TRANSFER|EVENT)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)(?:\s*\|\s*(.*))?$/i.exec(
      line
    );
    if (cmtMatch) {
      commitments.push({
        id: `cm-${commitments.length + 1}`,
        kind: cmtMatch[1].toUpperCase() as 'MEETING' | 'HOTEL' | 'TRANSFER' | 'EVENT',
        label: cmtMatch[2].trim(),
        atIso: cmtMatch[3].trim(),
        location: cmtMatch[4].trim(),
        detail: (cmtMatch[5] || '').trim(),
      });
      continue;
    }
  }

  // Validate parsed legs
  if (parsedLegs.length === 0) {
    errors.push('No valid flight legs found in PNR text. Expected format: "1. SQ 856 Y 27AUG SINHKG HK1 0800 1205"');
    return { success: false, errors };
  }

  const origin = parsedLegs[0].from;
  const destination = parsedLegs[parsedLegs.length - 1].to;
  const travelDateIso = parsedLegs[0].depIso;
  const lastArrivalIso = parsedLegs[parsedLegs.length - 1].arrIso;

  // Defaults if remarks were missing
  if (!passengerName) {
    passengerName = 'Executive Traveler';
    warnings.push('Passenger name missing; defaulted to "Executive Traveler".');
  }

  if (!ticketReference) {
    ticketReference = `${parsedLegs[0].airlineCode}-${Math.floor(1000 + Math.random() * 9000)}-${Math.random()
      .toString(36)
      .substring(2, 5)
      .toUpperCase()}`;
  }

  if (!missionTitle) {
    missionTitle = `Executive Mission: ${origin} → ${destination}`;
  }

  if (!arrivalDeadlineIso) {
    try {
      const arrD = new Date(lastArrivalIso);
      arrD.setUTCHours(arrD.getUTCHours() + 4);
      arrivalDeadlineIso = arrD.toISOString();
    } catch {
      arrivalDeadlineIso = lastArrivalIso;
    }
  }

  if (!hardArrivalLimitIso) {
    try {
      const arrD = new Date(lastArrivalIso);
      arrD.setUTCHours(arrD.getUTCHours() + 16);
      hardArrivalLimitIso = arrD.toISOString();
    } catch {
      hardArrivalLimitIso = arrivalDeadlineIso;
    }
  }

  if (!missionDeadlineIso) {
    missionDeadlineIso = arrivalDeadlineIso;
  }

  const tripId = `TRIP-${origin}-${destination}-${pnrLocator}`;

  const passenger: PassengerProfile = {
    name: passengerName,
    ticketReference,
    loyaltyProgram,
    loyaltyTier,
    loyaltyNumber,
    nationality,
    passportNumber,
    passportExpiryIso,
    issuingCountry,
    contactEmail,
    contactPhone,
    checkedBags: baggagePieces,
    loyalty: loyaltyTier || loyaltyProgram || '',
  };

  const mission: MissionContext = {
    title: missionTitle,
    description: `Executive engagement for ${passengerName} in ${destination}.`,
    venue: missionVenue || `${destination} Central Business District`,
    location: `${destination} City Center`,
    dealValue: missionDealValue,
    dealCurrency: missionDealCurrency,
    importance: missionImportance,
    deadlineIso: missionDeadlineIso,
    timezone: missionTimezone,
  };

  const constraints: TripConstraints = {
    budgetUsd,
    mctMin,
    arrivalDeadlineIso,
    hardArrivalLimitIso,
    baggagePieces,
    baggageWeightKg,
  };

  const itinerary: Itinerary = {
    tripId,
    origin,
    destination,
    travelDateIso,
    legs: parsedLegs,
    passenger,
    mission,
    tripPurpose: missionTitle,
    constraints,
    commitments,
  };

  // Run through Zod schema validation to guarantee 100% contract compliance
  const validation = ItinerarySchema.safeParse(itinerary);
  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
  }

  return {
    success: true,
    itinerary: validation.data,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5. Airline Code Lookup
// ---------------------------------------------------------------------------

const AIRLINE_NAMES: Record<string, string> = {
  SQ: 'Singapore Airlines',
  CX: 'Cathay Pacific',
  BA: 'British Airways',
  UA: 'United Airlines',
  QF: 'Qantas',
  EK: 'Emirates',
  LH: 'Lufthansa',
  JL: 'Japan Airlines',
  NH: 'All Nippon Airways',
  AA: 'American Airlines',
  DL: 'Delta Air Lines',
  AF: 'Air France',
  KL: 'KLM Royal Dutch Airlines',
  QR: 'Qatar Airways',
  TG: 'Thai Airways',
  CI: 'China Airlines',
  BR: 'EVA Air',
  MH: 'Malaysia Airlines',
  GA: 'Garuda Indonesia',
  VN: 'Vietnam Airlines',
  PR: 'Philippine Airlines',
  OZ: 'Asiana Airlines',
  KE: 'Korean Air',
};

function getAirlineName(code: string): string {
  return AIRLINE_NAMES[code.toUpperCase()] || `${code.toUpperCase()} Air`;
}
