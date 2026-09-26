/**
 * Regenerates `packages/shared/data/operators.json`.
 *
 *   bun run packages/shared/scripts/build-operators.ts [path/to/airlines.dat]
 *
 * Airlines come from the OpenFlights `airlines.dat` dump (ODbL, see `data/README.md`),
 * the only free list of IATA designators carrying names and countries. It is also a
 * community dump: it holds defunct carriers, duplicate designators and placeholder rows,
 * so most of what follows is about picking one carrier per designator and dropping the
 * noise. Rail, ferry and bus operators have no equivalent public list and are curated by
 * hand in `CURATED_OPERATORS`.
 *
 * The output stores tuples rather than objects: the app bundles this file, and the key
 * names repeated a thousand times cost more than the data itself. `src/operators.ts`
 * expands them back into `Operator` records.
 */

const SOURCE_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";

interface RawAirline {
  id: number;
  name: string;
  iata: string;
  icao: string;
  country: string;
  active: boolean;
}

/** `airlines.dat` is CSV with quoted fields and `\N` for null. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') {
      quoted = true;
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

function nullable(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "\\N" || trimmed === "N/A" || trimmed === "-" ? "" : trimmed;
}

function parseAirlines(raw: string): RawAirline[] {
  const airlines: RawAirline[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const fields = parseLine(line);
    if (fields.length < 8) continue;
    airlines.push({
      id: Number(fields[0]),
      name: nullable(fields[1]),
      iata: nullable(fields[3]).toUpperCase(),
      icao: nullable(fields[4]).toUpperCase(),
      country: nullable(fields[6]),
      active: nullable(fields[7]) === "Y",
    });
  }
  return airlines;
}

const IATA_RE = /^[A-Z0-9]{2}$/;
const ICAO_RE = /^[A-Z]{3}$/;

/**
 * Rows that survive the `active` flag but are not carriers anybody types: the OpenFlights
 * placeholders, and the names that carry their own tombstone.
 */
const DEAD_NAME_RE =
  /\b(defunct|ceased|dissolved|bankrupt|suspended|former|unknown|private flight)\b/i;

/** Without an ICAO code and a country the row is a stub, and stubs are what duplicate. */
function isCandidate(airline: RawAirline): boolean {
  return (
    airline.active &&
    IATA_RE.test(airline.iata) &&
    ICAO_RE.test(airline.icao) &&
    airline.name.length > 1 &&
    airline.country.length > 1 &&
    !DEAD_NAME_RE.test(airline.name)
  );
}

/**
 * Designators OpenFlights lists more than once where the dump does not make the living
 * carrier obvious. Everything else is resolved by `score`.
 */
const PREFERRED_ICAO: Record<string, string> = {
  AA: "AAL",
  AC: "ACA",
  AD: "AZU",
  AF: "AFR",
  AI: "AIC",
  AM: "AMX",
  AR: "ARG",
  AS: "ASA",
  AV: "AVA",
  AY: "FIN",
  AZ: "AZA",
  A3: "AEE",
  BA: "BAW",
  BR: "EVA",
  CA: "CCA",
  CI: "CAL",
  CM: "CMP",
  CX: "CPA",
  CZ: "CSN",
  DL: "DAL",
  DY: "NAX",
  EI: "EIN",
  EK: "UAE",
  ET: "ETH",
  EY: "ETD",
  FR: "RYR",
  GA: "GIA",
  G3: "GLO",
  HV: "TRA",
  IB: "IBE",
  JL: "JAL",
  KE: "KAL",
  KL: "KLM",
  LA: "LAN",
  LH: "DLH",
  LO: "LOT",
  LX: "SWR",
  MH: "MAS",
  MS: "MSR",
  MU: "CES",
  NH: "ANA",
  NZ: "ANZ",
  OS: "AUA",
  OZ: "AAR",
  PR: "PAL",
  QF: "QFA",
  QR: "QTR",
  SA: "SAA",
  SK: "SAS",
  SN: "BEL",
  SQ: "SIA",
  SU: "AFL",
  TG: "THA",
  TK: "THY",
  TO: "TVF",
  TP: "TAP",
  UA: "UAL",
  U2: "EZY",
  VN: "HVN",
  VS: "VIR",
  VY: "VLG",
  WN: "SWA",
  W6: "WZZ",
};

/**
 * Higher wins the designator. Every signal is a proxy for "this is the carrier meant": an
 * explicit pick first, then a plain name, because a mainline carrier is rarely the one
 * with the longest legal name, then the lower OpenFlights id, which tracks how early the
 * airline entered the dataset and so favours the established one.
 */
function score(airline: RawAirline): number {
  let value = 0;
  if (PREFERRED_ICAO[airline.iata] === airline.icao) value += 1_000_000;
  value -= airline.name.length;
  value -= airline.id / 100_000;
  return value;
}

type CuratedMode = "train" | "ferry" | "bus";

interface CuratedOperator {
  code: string;
  name: string;
  mode: CuratedMode;
  country: string;
  /** Extra strings a traveller may type: commercial brands, service names, other codes. */
  aliases: string[];
  /** At most five characters drawn as the tile mark, and the ink to draw them in. */
  wordmark: string;
  brand: string;
}

/**
 * Rail, ferry and bus. `code` is what lands in `LegIdentity.operator`, so it stays inside
 * the eight ASCII bytes `toBytes8` allows. Aliases carry the commercial brands printed on
 * a ticket ("TGV", "OUIGO", "ICE") back to the operator that actually runs the service.
 * Inks are drawn from `components/ui/operatorColor.ts`, so a wordmark sits on the same
 * paper ground as every other mark instead of importing a brand palette.
 */
const CURATED_OPERATORS: CuratedOperator[] = [
  {
    code: "SNCF",
    name: "SNCF",
    mode: "train",
    country: "France",
    aliases: ["TGV", "TGV INOUI", "INOUI", "OUIGO", "INTERCITES", "TER", "LYRIA", "SNCF VOYAGEURS"],
    wordmark: "SNCF",
    brand: "#33566E",
  },
  {
    code: "9F",
    name: "Eurostar",
    mode: "train",
    country: "United Kingdom",
    aliases: ["EUROSTAR", "EUROSTAR RED", "THALYS", "ES", "TH"],
    wordmark: "EST",
    brand: "#7A3B48",
  },
  {
    code: "DB",
    name: "Deutsche Bahn",
    mode: "train",
    country: "Germany",
    aliases: ["DEUTSCHE BAHN", "ICE", "IC", "EC", "DB FERNVERKEHR"],
    wordmark: "DB",
    brand: "#7A3B48",
  },
  {
    code: "TI",
    name: "Trenitalia",
    mode: "train",
    country: "Italy",
    aliases: ["TRENITALIA", "FRECCIAROSSA", "FRECCIARGENTO", "FRECCIABIANCA", "FS"],
    wordmark: "TREN",
    brand: "#7A3B48",
  },
  {
    code: "ITALO",
    name: "Italo",
    mode: "train",
    country: "Italy",
    aliases: ["ITALO", "NTV"],
    wordmark: "ITALO",
    brand: "#8A4B2C",
  },
  {
    code: "RENFE",
    name: "Renfe",
    mode: "train",
    country: "Spain",
    aliases: ["RENFE", "AVE", "AVLO", "ALVIA"],
    wordmark: "RENFE",
    brand: "#6A4A64",
  },
  {
    code: "SBB",
    name: "SBB CFF FFS",
    mode: "train",
    country: "Switzerland",
    aliases: ["SBB", "CFF", "FFS"],
    wordmark: "SBB",
    brand: "#7A3B48",
  },
  {
    code: "NS",
    name: "Nederlandse Spoorwegen",
    mode: "train",
    country: "Netherlands",
    aliases: ["NS", "INTERCITY DIRECT"],
    wordmark: "NS",
    brand: "#8A4B2C",
  },
  {
    code: "OBB",
    name: "OBB",
    mode: "train",
    country: "Austria",
    aliases: ["OBB", "OEBB", "RAILJET", "NIGHTJET", "RJ", "NJ"],
    wordmark: "OBB",
    brand: "#7A3B48",
  },
  {
    code: "SNCB",
    name: "SNCB NMBS",
    mode: "train",
    country: "Belgium",
    aliases: ["SNCB", "NMBS"],
    wordmark: "SNCB",
    brand: "#33566E",
  },
  {
    code: "CFR",
    name: "Corsica Ferries",
    mode: "ferry",
    country: "France",
    aliases: ["CORSICA FERRIES", "CORSICA", "SARDINIA FERRIES"],
    wordmark: "CORS",
    brand: "#7A6230",
  },
  {
    code: "BF",
    name: "Brittany Ferries",
    mode: "ferry",
    country: "France",
    aliases: ["BRITTANY FERRIES", "BRITTANY"],
    wordmark: "BF",
    brand: "#2C6157",
  },
  {
    code: "DFDS",
    name: "DFDS",
    mode: "ferry",
    country: "Denmark",
    aliases: ["DFDS", "DFDS SEAWAYS"],
    wordmark: "DFDS",
    brand: "#33566E",
  },
  {
    code: "PO",
    name: "P&O Ferries",
    mode: "ferry",
    country: "United Kingdom",
    aliases: ["P&O", "P&O FERRIES", "PANDO"],
    wordmark: "P&O",
    brand: "#33566E",
  },
  {
    code: "GNV",
    name: "Grandi Navi Veloci",
    mode: "ferry",
    country: "Italy",
    aliases: ["GNV", "GRANDI NAVI VELOCI"],
    wordmark: "GNV",
    brand: "#2C6157",
  },
  {
    code: "FLIX",
    name: "FlixBus",
    mode: "bus",
    country: "Germany",
    aliases: ["FLIXBUS", "FLIX", "FLIXTRAIN"],
    wordmark: "FLIX",
    brand: "#3F5C3B",
  },
  {
    code: "BBC",
    name: "BlaBlaCar Bus",
    mode: "bus",
    country: "France",
    aliases: ["BLABLACAR", "BLABLACAR BUS", "OUIBUS"],
    wordmark: "BBC",
    brand: "#33566E",
  },
  {
    code: "ALSA",
    name: "Alsa",
    mode: "bus",
    country: "Spain",
    aliases: ["ALSA"],
    wordmark: "ALSA",
    brand: "#8A4B2C",
  },
  {
    code: "EURL",
    name: "Eurolines",
    mode: "bus",
    country: "Europe",
    aliases: ["EUROLINES"],
    wordmark: "EURO",
    brand: "#4E5259",
  },
];

async function readSource(): Promise<string> {
  const cached = Bun.argv[2];
  if (cached) return Bun.file(cached).text();
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Failed to download airlines.dat: ${response.status}`);
  return response.text();
}

async function main(): Promise<void> {
  const airlines = parseAirlines(await readSource()).filter(isCandidate);

  const best = new Map<string, RawAirline>();
  for (const airline of airlines) {
    const current = best.get(airline.iata);
    if (!current || score(airline) > score(current)) best.set(airline.iata, airline);
  }

  const flights = [...best.values()]
    .sort((a, b) => a.iata.localeCompare(b.iata))
    .map((airline) => [airline.iata, airline.icao, airline.name, airline.country]);

  const curated = CURATED_OPERATORS.map((operator) => [
    operator.code,
    operator.name,
    operator.mode,
    operator.country,
    operator.aliases,
    operator.wordmark,
    operator.brand,
  ]);

  const payload = {
    source: SOURCE_URL,
    licence: "ODbL 1.0, see packages/shared/data/README.md",
    generatedAt: new Date().toISOString().slice(0, 10),
    /** [iata, icao, name, country]; the mode is always "flight". */
    flights,
    /** [code, name, mode, country, aliases, wordmark, brand]. */
    curated,
  };

  const target = new URL("../data/operators.json", import.meta.url).pathname;
  await Bun.write(target, `${JSON.stringify(payload)}\n`);

  const bytes = (await Bun.file(target).arrayBuffer()).byteLength;
  console.log(
    `${flights.length} airlines, ${curated.length} curated, ${(bytes / 1024).toFixed(1)} KB`,
  );
}

await main();
