import { describe, expect, test } from "bun:test";

import {
  OPERATORS,
  airlineLogoUrl,
  bareServiceNumber,
  findOperator,
  foldCode,
  foldText,
  operatorFromReference,
  operatorLogoUrl,
  operatorModeOf,
  searchOperators,
  serviceNumberMatchesPrefix,
} from "./operators";
import { Mode } from "./types";

const codeOf = (query: string, mode?: "flight" | "train" | "ferry" | "bus") =>
  searchOperators(query, mode ? { mode } : {})[0]?.code;

describe("dataset", () => {
  test("stays inside the size budget the app bundles it under", () => {
    expect(OPERATORS.length).toBeGreaterThan(500);
    expect(OPERATORS.length).toBeLessThan(1000);
  });

  test("holds one operator per code", () => {
    const codes = OPERATORS.map((operator) => `${operator.mode}:${operator.code}`);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("gives every operator a compact code", () => {
    for (const operator of OPERATORS) {
      expect(operator.code.length).toBeGreaterThanOrEqual(2);
      expect(operator.code.length).toBeLessThanOrEqual(8);
      expect(operator.name.length).toBeGreaterThan(1);
    }
  });
});

describe("folding", () => {
  test("drops diacritics and case", () => {
    expect(foldText("Intercités")).toBe("INTERCITES");
    expect(foldText("  easyJet  ")).toBe("EASYJET");
  });

  test("drops separators from a code but not from a name", () => {
    expect(foldText("Air France")).toBe("AIR FRANCE");
    expect(foldCode("AF 1180")).toBe("AF1180");
    expect(foldCode("p&o")).toBe("P&O");
  });
});

describe("searchOperators", () => {
  test("puts an exact code first", () => {
    expect(codeOf("AF")).toBe("AF");
    expect(codeOf("BA")).toBe("BA");
    expect(codeOf("U2")).toBe("U2");
    expect(codeOf("FR")).toBe("FR");
  });

  test("is case and diacritics insensitive", () => {
    expect(codeOf("af")).toBe("AF");
    expect(searchOperators("aír france")[0]?.code).toBe("AF");
  });

  test("matches an ICAO code exactly too", () => {
    expect(codeOf("AFR")).toBe("AF");
    expect(codeOf("RYR")).toBe("FR");
  });

  test("ranks a code prefix above a name prefix", () => {
    const results = searchOperators("BA", { mode: "flight", limit: 6 });
    expect(results[0]?.code).toBe("BA");
    expect(results.findIndex((operator) => operator.code === "BA")).toBeLessThan(
      results.findIndex((operator) => operator.name.startsWith("Ba")),
    );
  });

  test("finds an operator by name prefix", () => {
    expect(codeOf("Ryanair")).toBe("FR");
    expect(codeOf("British Air")).toBe("BA");
    expect(codeOf("Lufthansa")).toBe("LH");
  });

  test("finds an operator by name substring", () => {
    const results = searchOperators("Emirates", { mode: "flight" });
    expect(results.some((operator) => operator.code === "EK")).toBe(true);
  });

  test("resolves a commercial brand through an alias", () => {
    expect(codeOf("TGV", "train")).toBe("SNCF");
    expect(codeOf("OUIGO", "train")).toBe("SNCF");
    expect(codeOf("ICE", "train")).toBe("DB");
    expect(codeOf("Thalys", "train")).toBe("9F");
    expect(codeOf("AVE", "train")).toBe("RENFE");
  });

  test("recognises the rail operators by name and by code", () => {
    expect(codeOf("SNCF", "train")).toBe("SNCF");
    expect(codeOf("DB", "train")).toBe("DB");
    expect(codeOf("Eurostar", "train")).toBe("9F");
    expect(codeOf("Trenitalia", "train")).toBe("TI");
    expect(codeOf("Deutsche", "train")).toBe("DB");
  });

  test("filters by mode", () => {
    expect(searchOperators("FR", { mode: "train" }).every((o) => o.mode === "train")).toBe(true);
    expect(searchOperators("Brittany", { mode: "ferry" })[0]?.code).toBe("BF");
    expect(searchOperators("Flix", { mode: "bus" })[0]?.code).toBe("FLIX");
    expect(searchOperators("SNCF", { mode: "flight" })).toEqual([]);
  });

  test("honours the limit and returns nothing for an empty query", () => {
    expect(searchOperators("A", { limit: 3 })).toHaveLength(3);
    expect(searchOperators("   ")).toEqual([]);
  });

  test("is deterministic", () => {
    expect(searchOperators("air").map((o) => o.code)).toEqual(
      searchOperators("air").map((o) => o.code),
    );
  });
});

describe("findOperator", () => {
  test("resolves a code, an ICAO code and an alias", () => {
    expect(findOperator("AF")?.name).toBe("Air France");
    expect(findOperator("AFR")?.name).toBe("Air France");
    expect(findOperator("TGV")?.code).toBe("SNCF");
  });

  test("disambiguates on mode", () => {
    expect(findOperator("FR", "flight")?.name).toBe("Ryanair");
    expect(findOperator("FR", "train")).toBeUndefined();
  });

  test("returns nothing for a code nobody uses", () => {
    expect(findOperator("ZZZZZ")).toBeUndefined();
  });
});

describe("operatorFromReference", () => {
  test("splits a two-character airline reference", () => {
    expect(operatorFromReference("AF 1180")).toEqual({
      operator: expect.objectContaining({ code: "AF" }),
      number: "1180",
    });
    expect(operatorFromReference("af1180")?.number).toBe("1180");
  });

  test("splits a code that is not all letters", () => {
    expect(operatorFromReference("U21234")?.operator.code).toBe("U2");
    expect(operatorFromReference("U21234")?.number).toBe("1234");
    expect(operatorFromReference("9F5012", { mode: "train" })?.operator.code).toBe("9F");
  });

  test("splits an ICAO reference", () => {
    expect(operatorFromReference("AFR1180")?.operator.code).toBe("AF");
    expect(operatorFromReference("AFR1180")?.number).toBe("1180");
  });

  test("splits a brand reference", () => {
    expect(operatorFromReference("TGV6231")?.operator.code).toBe("SNCF");
    expect(operatorFromReference("TGV 6231")?.number).toBe("6231");
    expect(operatorFromReference("SNCF6231")?.operator.code).toBe("SNCF");
    expect(operatorFromReference("ICE 574", { mode: "train" })?.operator.code).toBe("DB");
  });

  test("keeps a trailing letter on the number", () => {
    expect(operatorFromReference("BA117A")?.number).toBe("117A");
  });

  test("respects the mode filter", () => {
    expect(operatorFromReference("FR1234", { mode: "flight" })?.operator.code).toBe("FR");
    expect(operatorFromReference("FR1234", { mode: "train" })).toBeNull();
  });

  test("returns null when nothing recognisable leads the reference", () => {
    expect(operatorFromReference("6231")).toBeNull();
    expect(operatorFromReference("ZZ")).toBeNull();
    expect(operatorFromReference("")).toBeNull();
    expect(operatorFromReference("AF")).toBeNull();
    expect(operatorFromReference("AF11801234")).toBeNull();
  });
});

describe("logos", () => {
  test("builds an avs.io URL from the IATA designator", () => {
    expect(airlineLogoUrl("af")).toBe("https://pics.avs.io/200/200/AF.png");
  });

  test("gives airlines a logo and curated operators a wordmark instead", () => {
    expect(operatorLogoUrl(findOperator("AF", "flight")!)).toBe(airlineLogoUrl("AF"));
    expect(operatorLogoUrl(findOperator("SNCF", "train")!)).toBeUndefined();
    expect(findOperator("SNCF", "train")?.wordmark).toBe("SNCF");
  });
});

describe("operatorModeOf", () => {
  test("maps the numeric mode onto the operator mode", () => {
    expect(operatorModeOf(Mode.Flight)).toBe("flight");
    expect(operatorModeOf(Mode.Train)).toBe("train");
    expect(operatorModeOf(Mode.Ferry)).toBe("ferry");
    expect(operatorModeOf(Mode.Bus)).toBe("bus");
  });
});

describe("bareServiceNumber", () => {
  test("strips the operator code a flight reference repeats", () => {
    expect(bareServiceNumber("AF", "AF1180")).toBe("1180");
  });

  test("leaves a rail number that never carried the code", () => {
    expect(bareServiceNumber("SNCF", "6231")).toBe("6231");
  });

  test("never strips the whole number away", () => {
    expect(bareServiceNumber("AF", "AF")).toBe("AF");
  });
});

describe("serviceNumberMatchesPrefix", () => {
  test("matches the bare number and the full reference alike", () => {
    expect(serviceNumberMatchesPrefix("AF", "AF1180", "11")).toBe(true);
    expect(serviceNumberMatchesPrefix("AF", "AF1180", "AF11")).toBe(true);
    expect(serviceNumberMatchesPrefix("AF", "AF1180", "af 11")).toBe(true);
  });

  test("matches a rail number with or without its operator", () => {
    expect(serviceNumberMatchesPrefix("SNCF", "6231", "62")).toBe(true);
    expect(serviceNumberMatchesPrefix("SNCF", "6231", "SNCF62")).toBe(true);
  });

  test("rejects a prefix of another service", () => {
    expect(serviceNumberMatchesPrefix("AF", "AF1180", "12")).toBe(false);
  });

  test("an empty prefix matches", () => {
    expect(serviceNumberMatchesPrefix("AF", "AF1180", "")).toBe(true);
  });
});
