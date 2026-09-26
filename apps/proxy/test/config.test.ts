import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

const BASE_ENV = { AERODATABOX_HOST: "aerodatabox.p.rapidapi.com" };

describe("loadConfig", () => {
  test("fails closed when PROXY_KEY is missing", () => {
    expect(() => loadConfig({ ...BASE_ENV })).toThrow(/PROXY_KEY/);
  });

  test("fails closed when PROXY_KEY is shorter than 16 characters", () => {
    expect(() => loadConfig({ ...BASE_ENV, PROXY_KEY: "short" })).toThrow(/PROXY_KEY/);
  });

  test("accepts a PROXY_KEY of at least 16 characters", () => {
    const config = loadConfig({ ...BASE_ENV, PROXY_KEY: "a".repeat(16) });
    expect(config.proxyKey).toBe("a".repeat(16));
  });

  test("loads the native testnet USDC and optional Enoki sponsor settings", () => {
    const config = loadConfig({
      ...BASE_ENV,
      PROXY_KEY: "0123456789abcdef",
      ENOKI_PRIVATE_API_KEY: "private-enoki-key",
      MAX_POSITION_USDC: "25.5",
    });
    expect(config.sui.usdcType).toContain("::usdc::USDC");
    expect(config.sui.maxPositionBaseUnits).toBe(25_500_000n);
    expect(config.sui.enokiPrivateApiKey).toBe("private-enoki-key");
  });

  test("treats blank provider keys as absent", () => {
    const config = loadConfig({
      PROXY_KEY: "0123456789abcdef",
      AERODATABOX_KEY: "",
      SNCF_KEY: "   ",
    });
    expect(config.aerodatabox).toBeUndefined();
    expect(config.sncfKey).toBeUndefined();
  });

  test("requires a complete Google OAuth configuration with a safe callback", () => {
    const base = { PROXY_KEY: "0123456789abcdef", GOOGLE_CLIENT_ID: "google-client" };
    expect(() => loadConfig(base)).toThrow(/Google OAuth requires/);
    expect(() => loadConfig({
      ...base,
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "http://example.com/auth/google/callback",
    })).toThrow(/HTTPS or local HTTP/);
    expect(loadConfig({
      ...base,
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "http://localhost:8787/auth/google/callback",
    }).googleOAuth?.redirectUri).toBe("http://localhost:8787/auth/google/callback");
    expect(loadConfig({
      ...base,
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "http://127.0.0.1:8787/auth/google/callback",
    }).googleOAuth?.redirectUri).toBe("http://127.0.0.1:8787/auth/google/callback");
    expect(loadConfig({
      ...base,
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_REDIRECT_URI: "https://proxy.example.com/auth/google/callback",
    }).googleOAuth?.clientId).toBe("google-client");
  });

  test("validates native passkey association settings", () => {
    const base = { PROXY_KEY: "0123456789abcdef" };
    expect(() => loadConfig({ ...base, PASSKEY_APPLE_TEAM_ID: "ABCDEFGHIJ" })).toThrow(/PASSKEY_RP_ID/);
    expect(() => loadConfig({ ...base, PASSKEY_RP_ID: "auth..example.com" })).toThrow(/DNS hostname/);
    expect(() => loadConfig({ ...base, PASSKEY_RP_ID: "auth.example.com", PASSKEY_APPLE_TEAM_ID: "bad" }))
      .toThrow(/Apple Team ID/);
    const fingerprint = Array.from({ length: 32 }, () => "AB").join(":");
    const config = loadConfig({
      ...base,
      PASSKEY_RP_ID: "auth.example.com",
      PASSKEY_APPLE_TEAM_ID: "ABCDEFGHIJ",
      PASSKEY_ANDROID_SHA256_FINGERPRINTS: fingerprint,
    });
    expect(config.passkeyAssociation?.rpId).toBe("auth.example.com");
    expect(config.passkeyAssociation?.androidFingerprints).toEqual([fingerprint]);
  });

});
