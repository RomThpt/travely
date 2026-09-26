import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Config } from "../config";

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALLBACK_URI = "travely://login";
const FIVE_MINUTES = 5 * 60_000;

type Pending = { verifier: string; nonce: string; clientChallenge: string; expiresAt: number };
type Ticket = { jwt: string; state: string; clientChallenge: string; expiresAt: number };

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function appRedirect(params: Record<string, string>): string {
  const url = new URL(CALLBACK_URI);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** OAuth state and one-use tickets live only for the lifetime of this proxy process. */
export function googleAuthRoutes(config: Config): {
  callback: Hono;
  api: Hono;
} {
  const pending = new Map<string, Pending>();
  const tickets = new Map<string, Ticket>();
  const callback = new Hono();
  const api = new Hono();

  const prune = () => {
    const now = Date.now();
    for (const [key, entry] of pending) if (entry.expiresAt < now) pending.delete(key);
    for (const [key, entry] of tickets) if (entry.expiresAt < now) tickets.delete(key);
  };

  api.post("/start", async (c) => {
    c.header("Cache-Control", "no-store");
    prune();
    if (pending.size > 5_000) return c.json({ error: "temporarily_unavailable" }, 503);
    if (!config.googleOAuth) return c.json({ error: "google_not_configured" }, 503);
    const body = await c.req.json().catch(() => null);
    const nonce = body && typeof body.nonce === "string" ? body.nonce : "";
    const clientChallenge = body && typeof body.clientChallenge === "string" ? body.clientChallenge : "";
    if (!/^[A-Za-z0-9_-]{27}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(clientChallenge)) {
      return c.json({ error: "invalid_login_request" }, 400);
    }

    const state = randomToken();
    const verifier = randomToken();
    pending.set(state, { verifier, nonce, clientChallenge, expiresAt: Date.now() + FIVE_MINUTES });

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", config.googleOAuth.clientId);
    url.searchParams.set("redirect_uri", config.googleOAuth.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    return c.json({ url: url.toString(), state });
  });

  callback.get("/", async (c) => {
    c.header("Cache-Control", "no-store");
    const state = c.req.query("state") ?? "";
    const entry = pending.get(state);
    pending.delete(state);
    if (!entry || entry.expiresAt < Date.now() || !config.googleOAuth) {
      return c.redirect(appRedirect({ error: "session_expired" }));
    }
    const code = c.req.query("code");
    if (!code || c.req.query("error")) return c.redirect(appRedirect({ error: "cancelled" }));

    try {
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.googleOAuth.clientId,
          client_secret: config.googleOAuth.clientSecret,
          redirect_uri: config.googleOAuth.redirectUri,
          grant_type: "authorization_code",
          code,
          code_verifier: entry.verifier,
        }),
      });
      if (!response.ok) throw new Error("oauth_exchange_failed");
      const tokens = (await response.json()) as { id_token?: string };
      if (!tokens.id_token) throw new Error("missing_id_token");
      const verified = await jwtVerify(tokens.id_token, GOOGLE_KEYS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: config.googleOAuth.clientId,
      });
      if (verified.payload.nonce !== entry.nonce) throw new Error("nonce_mismatch");

      const ticket = randomToken();
      tickets.set(ticket, { jwt: tokens.id_token, state, clientChallenge: entry.clientChallenge, expiresAt: Date.now() + FIVE_MINUTES });
      return c.redirect(appRedirect({ ticket, state }));
    } catch {
      return c.redirect(appRedirect({ error: "google_sign_in_failed" }));
    }
  });

  api.post("/complete", async (c) => {
    prune();
    const body = await c.req.json().catch(() => null);
    const ticket = body && typeof body.ticket === "string" ? body.ticket : "";
    const state = body && typeof body.state === "string" ? body.state : "";
    const clientVerifier = body && typeof body.clientVerifier === "string" ? body.clientVerifier : "";
    const entry = tickets.get(ticket);
    tickets.delete(ticket);
    if (!entry || entry.state !== state || entry.expiresAt < Date.now() ||
      createHash("sha256").update(clientVerifier).digest("hex") !== entry.clientChallenge) {
      return c.json({ error: "session_expired" }, 400);
    }
    return c.json({ idToken: entry.jwt }, 200, { "Cache-Control": "no-store" });
  });

  return { callback, api };
}
