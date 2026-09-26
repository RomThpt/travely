import { z } from "zod";

const envSchema = z.object({
  PROXY_PORT: z.coerce.number().int().positive().default(8787),
  PROXY_KEY: z.string().min(16),
  AERODATABOX_KEY: z.string().min(1).optional(),
  AERODATABOX_HOST: z.string().min(1).default("aerodatabox.p.rapidapi.com"),
  SNCF_KEY: z.string().min(1).optional(),
  AISSTREAM_KEY: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).default("data"),
  FIXTURES_DIR: z.string().min(1).optional(),
  RATE_LIMIT_PER_IP_PER_MIN: z.coerce.number().int().positive().default(60),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  PASSKEY_RP_ID: z.string().min(1).optional(),
  PASSKEY_APPLE_TEAM_ID: z.string().min(1).optional(),
  PASSKEY_ANDROID_SHA256_FINGERPRINTS: z.string().min(1).optional(),
  ENOKI_PRIVATE_API_KEY: z.string().min(1).optional(),
  ENOKI_API_URL: z.string().url().default("https://api.enoki.mystenlabs.com/v1"),
  SUI_RPC_URL: z.string().url().default("https://fullnode.testnet.sui.io:443"),
  SUI_PACKAGE_ID: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
    .default("0x15b2b349eb5b7ef96ba76fe50db525134b99b86ff38986ad64ba71c879d9805a"),
  SUI_USDC_TYPE: z.string().min(1)
    .default("0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"),
  MAX_POSITION_USDC: z.coerce.number().positive().max(10_000).default(100),
});

export type Config = {
  port: number;
  proxyKey: string;
  aerodatabox: { key: string; host: string } | undefined;
  sncfKey: string | undefined;
  aisstreamKey: string | undefined;
  dataDir: string;
  fixturesDir: string;
  rateLimitPerIpPerMin: number;
  googleOAuth?: { clientId: string; clientSecret: string; redirectUri: string } | undefined;
  passkeyAssociation?: {
    rpId: string;
    appleTeamId?: string;
    androidFingerprints: string[];
  } | undefined;
  sui: {
    network: "testnet";
    rpcUrl: string;
    packageId: string;
    usdcType: string;
    maxPositionBaseUnits: bigint;
    enokiApiUrl: string;
    enokiPrivateApiKey?: string;
  };
};

function withoutBlankValues(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(withoutBlankValues(env));
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid proxy configuration:\n${issues.join("\n")}`);
  }
  const parsed = result.data;
  const googleFields = [parsed.GOOGLE_CLIENT_ID, parsed.GOOGLE_CLIENT_SECRET, parsed.GOOGLE_REDIRECT_URI];
  if (googleFields.some(Boolean) && !googleFields.every(Boolean)) {
    throw new Error("Invalid proxy configuration: Google OAuth requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.");
  }
  if (parsed.GOOGLE_REDIRECT_URI) {
    const redirect = new URL(parsed.GOOGLE_REDIRECT_URI);
    const localHttp = redirect.protocol === "http:" &&
      (redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1");
    if ((!localHttp && redirect.protocol !== "https:") ||
      redirect.pathname !== "/auth/google/callback" ||
      redirect.username || redirect.password || redirect.search || redirect.hash) {
      throw new Error("Invalid proxy configuration: GOOGLE_REDIRECT_URI must be an HTTPS or local HTTP /auth/google/callback URL.");
    }
  }
  if ((parsed.PASSKEY_APPLE_TEAM_ID || parsed.PASSKEY_ANDROID_SHA256_FINGERPRINTS) && !parsed.PASSKEY_RP_ID) {
    throw new Error("Invalid proxy configuration: PASSKEY_RP_ID is required for passkey association files.");
  }
  if (parsed.PASSKEY_RP_ID && (parsed.PASSKEY_RP_ID.length > 253 ||
    parsed.PASSKEY_RP_ID.split(".").length < 2 ||
    parsed.PASSKEY_RP_ID.split(".").some((label) =>
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) {
    throw new Error("Invalid proxy configuration: PASSKEY_RP_ID must be a lowercase DNS hostname.");
  }
  if (parsed.PASSKEY_APPLE_TEAM_ID && !/^[A-Z0-9]{10}$/.test(parsed.PASSKEY_APPLE_TEAM_ID)) {
    throw new Error("Invalid proxy configuration: PASSKEY_APPLE_TEAM_ID must be a 10-character Apple Team ID.");
  }
  const androidFingerprints = parsed.PASSKEY_ANDROID_SHA256_FINGERPRINTS
    ?.split(",").map((fingerprint) => fingerprint.trim().toUpperCase()).filter(Boolean) ?? [];
  if (androidFingerprints.some((fingerprint) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint))) {
    throw new Error("Invalid proxy configuration: PASSKEY_ANDROID_SHA256_FINGERPRINTS must contain SHA-256 certificate fingerprints.");
  }
  return {
    port: parsed.PROXY_PORT,
    proxyKey: parsed.PROXY_KEY,
    aerodatabox: parsed.AERODATABOX_KEY
      ? { key: parsed.AERODATABOX_KEY, host: parsed.AERODATABOX_HOST }
      : undefined,
    sncfKey: parsed.SNCF_KEY,
    aisstreamKey: parsed.AISSTREAM_KEY,
    dataDir: parsed.DATA_DIR,
    fixturesDir: parsed.FIXTURES_DIR ?? new URL("../../../fixtures", import.meta.url).pathname,
    rateLimitPerIpPerMin: parsed.RATE_LIMIT_PER_IP_PER_MIN,
    googleOAuth:
      parsed.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_SECRET && parsed.GOOGLE_REDIRECT_URI
        ? { clientId: parsed.GOOGLE_CLIENT_ID, clientSecret: parsed.GOOGLE_CLIENT_SECRET, redirectUri: parsed.GOOGLE_REDIRECT_URI }
        : undefined,
    passkeyAssociation: parsed.PASSKEY_RP_ID
      ? {
        rpId: parsed.PASSKEY_RP_ID,
        ...(parsed.PASSKEY_APPLE_TEAM_ID ? { appleTeamId: parsed.PASSKEY_APPLE_TEAM_ID } : {}),
        androidFingerprints,
      }
      : undefined,
    sui: {
      network: "testnet",
      rpcUrl: parsed.SUI_RPC_URL,
      packageId: parsed.SUI_PACKAGE_ID.toLowerCase(),
      usdcType: parsed.SUI_USDC_TYPE,
      maxPositionBaseUnits: BigInt(Math.round(parsed.MAX_POSITION_USDC * 1_000_000)),
      enokiApiUrl: parsed.ENOKI_API_URL.replace(/\/$/, ""),
      ...(parsed.ENOKI_PRIVATE_API_KEY
        ? { enokiPrivateApiKey: parsed.ENOKI_PRIVATE_API_KEY }
        : {}),
    },
  };
}
