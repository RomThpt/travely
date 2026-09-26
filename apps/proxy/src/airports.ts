import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Airport {
  iata: string;
  icao?: string;
  name: string;
  municipality?: string;
  isoCountry?: string;
  lat: number;
  lon: number;
  tz: string;
}

const OURAIRPORTS_CSV_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";

/**
 * Known IANA time zones for major airports. Covers roughly the top 150 by traffic; any
 * IATA code missing here falls back to a fixed-offset guess derived from longitude
 * (see `guessTzFromLongitude`), which ignores DST and local timezone boundaries.
 */
export const TZ_BY_IATA: Record<string, string> = {
  CDG: "Europe/Paris",
  ORY: "Europe/Paris",
  NCE: "Europe/Paris",
  LYS: "Europe/Paris",
  MRS: "Europe/Paris",
  TLS: "Europe/Paris",
  BOD: "Europe/Paris",
  NTE: "Europe/Paris",
  LHR: "Europe/London",
  LGW: "Europe/London",
  MAN: "Europe/London",
  STN: "Europe/London",
  LTN: "Europe/London",
  EDI: "Europe/London",
  AMS: "Europe/Amsterdam",
  FRA: "Europe/Berlin",
  MUC: "Europe/Berlin",
  BER: "Europe/Berlin",
  DUS: "Europe/Berlin",
  HAM: "Europe/Berlin",
  STR: "Europe/Berlin",
  MAD: "Europe/Madrid",
  BCN: "Europe/Madrid",
  PMI: "Europe/Madrid",
  AGP: "Europe/Madrid",
  FCO: "Europe/Rome",
  MXP: "Europe/Rome",
  LIN: "Europe/Rome",
  VCE: "Europe/Rome",
  NAP: "Europe/Rome",
  LIS: "Europe/Lisbon",
  OPO: "Europe/Lisbon",
  ZRH: "Europe/Zurich",
  GVA: "Europe/Zurich",
  VIE: "Europe/Vienna",
  BRU: "Europe/Brussels",
  CPH: "Europe/Copenhagen",
  ARN: "Europe/Stockholm",
  GOT: "Europe/Stockholm",
  OSL: "Europe/Oslo",
  HEL: "Europe/Helsinki",
  WAW: "Europe/Warsaw",
  KRK: "Europe/Warsaw",
  PRG: "Europe/Prague",
  BUD: "Europe/Budapest",
  ATH: "Europe/Athens",
  SKG: "Europe/Athens",
  IST: "Europe/Istanbul",
  DUB: "Europe/Dublin",
  KEF: "Atlantic/Reykjavik",
  LUX: "Europe/Luxembourg",
  RIX: "Europe/Riga",
  TLL: "Europe/Tallinn",
  VNO: "Europe/Vilnius",
  SOF: "Europe/Sofia",
  OTP: "Europe/Bucharest",
  ZAG: "Europe/Zagreb",
  BEG: "Europe/Belgrade",
  LJU: "Europe/Ljubljana",
  JFK: "America/New_York",
  EWR: "America/New_York",
  LGA: "America/New_York",
  BOS: "America/New_York",
  IAD: "America/New_York",
  DCA: "America/New_York",
  ATL: "America/New_York",
  MIA: "America/New_York",
  MCO: "America/New_York",
  CLT: "America/New_York",
  PHL: "America/New_York",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  IAH: "America/Chicago",
  MSP: "America/Chicago",
  DEN: "America/Denver",
  PHX: "America/Phoenix",
  LAS: "America/Los_Angeles",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  SAN: "America/Los_Angeles",
  PDX: "America/Los_Angeles",
  YYZ: "America/Toronto",
  YUL: "America/Toronto",
  YVR: "America/Vancouver",
  DXB: "Asia/Dubai",
  AUH: "Asia/Dubai",
  DOH: "Asia/Qatar",
  HND: "Asia/Tokyo",
  NRT: "Asia/Tokyo",
  KIX: "Asia/Tokyo",
  ICN: "Asia/Seoul",
  PEK: "Asia/Shanghai",
  PVG: "Asia/Shanghai",
  HKG: "Asia/Hong_Kong",
  SIN: "Asia/Singapore",
  BKK: "Asia/Bangkok",
  DEL: "Asia/Kolkata",
  BOM: "Asia/Kolkata",
  SYD: "Australia/Sydney",
  MEL: "Australia/Melbourne",
  JNB: "Africa/Johannesburg",
  CAI: "Africa/Cairo",
  CMN: "Africa/Casablanca",
  GRU: "America/Sao_Paulo",
  GIG: "America/Sao_Paulo",
  EZE: "America/Argentina/Buenos_Aires",
  BOG: "America/Bogota",
  SCL: "America/Santiago",
  LIM: "America/Lima",
  MEX: "America/Mexico_City",
};

/** DST-unaware fallback: a fixed-offset zone guessed from longitude, 15 degrees per hour. */
export function guessTzFromLongitude(lon: number): string {
  const offset = Math.max(-12, Math.min(14, Math.round(lon / 15)));
  if (offset === 0) return "Etc/GMT";
  return offset > 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

function lookupTz(iata: string, lon: number): string {
  return TZ_BY_IATA[iata] ?? guessTzFromLongitude(lon);
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseAirportsCsv(csv: string): Airport[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  const header = parseCsvLine(lines[0] ?? "");
  const columnIndex = (name: string) => header.indexOf(name);
  const typeIdx = columnIndex("type");
  const iataIdx = columnIndex("iata_code");
  const identIdx = columnIndex("ident");
  const gpsIdx = columnIndex("gps_code");
  const nameIdx = columnIndex("name");
  const municipalityIdx = columnIndex("municipality");
  const countryIdx = columnIndex("iso_country");
  const latIdx = columnIndex("latitude_deg");
  const lonIdx = columnIndex("longitude_deg");

  const airports: Airport[] = [];
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const type = fields[typeIdx];
    if (type !== "large_airport" && type !== "medium_airport") continue;
    const iata = fields[iataIdx]?.trim();
    if (!iata) continue;
    const lat = Number.parseFloat(fields[latIdx] ?? "");
    const lon = Number.parseFloat(fields[lonIdx] ?? "");
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const icao = fields[gpsIdx]?.trim() || fields[identIdx]?.trim();
    const municipality = fields[municipalityIdx]?.trim();
    const isoCountry = fields[countryIdx]?.trim();
    airports.push({
      iata,
      ...(icao ? { icao } : {}),
      name: fields[nameIdx]?.trim() || iata,
      ...(municipality ? { municipality } : {}),
      ...(isoCountry ? { isoCountry } : {}),
      lat,
      lon,
      tz: lookupTz(iata, lon),
    });
  }
  return airports;
}

export class AirportsIndex {
  private readonly byIata = new Map<string, Airport>();

  constructor(airports: readonly Airport[]) {
    for (const airport of airports) this.byIata.set(airport.iata.toUpperCase(), airport);
  }

  get(iata: string): Airport | undefined {
    return this.byIata.get(iata.toUpperCase());
  }

  all(): Airport[] {
    return [...this.byIata.values()];
  }

  get size(): number {
    return this.byIata.size;
  }
}

export async function ensureAirportsCsv(
  filePath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (existsSync(filePath)) return;
  const response = await fetchImpl(OURAIRPORTS_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to download OurAirports CSV: HTTP ${response.status}`);
  }
  const text = await response.text();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text, "utf8");
}

export async function loadAirportsIndex(
  filePath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AirportsIndex> {
  await ensureAirportsCsv(filePath, fetchImpl);
  const csv = await readFile(filePath, "utf8");
  return new AirportsIndex(parseAirportsCsv(csv));
}
