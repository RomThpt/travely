import { describe, expect, test } from "bun:test";
import { buildTestApp } from "./helpers";

const googleOAuth = {
  clientId: "travely-test.apps.googleusercontent.com",
  clientSecret: "test-secret",
  redirectUri: "https://proxy.example.com/auth/google/callback",
};
const headers = { "content-type": "application/json", "x-travely-key": "test-key" };
const nonce = "A".repeat(27);
const clientChallenge = "a".repeat(64);

describe("Google zkLogin OAuth", () => {
  test("fails closed when OAuth is not configured", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/auth/google/start", {
      method: "POST", headers, body: JSON.stringify({ nonce, clientChallenge }),
    });
    expect(response.status).toBe(503);
  });

  test("requires a zkLogin nonce and binds it to the authorization request", async () => {
    const { app } = buildTestApp({ config: { googleOAuth } });
    const invalid = await app.request("/v1/auth/google/start", {
      method: "POST", headers, body: JSON.stringify({ nonce: "short", clientChallenge }),
    });
    expect(invalid.status).toBe(400);
    const unbound = await app.request("/v1/auth/google/start", {
      method: "POST", headers, body: JSON.stringify({ nonce }),
    });
    expect(unbound.status).toBe(400);

    const response = await app.request("/v1/auth/google/start", {
      method: "POST", headers, body: JSON.stringify({ nonce, clientChallenge }),
    });
    expect(response.status).toBe(200);
    const { url, state } = await response.json() as { url: string; state: string };
    const authorization = new URL(url);
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("nonce")).toBe(nonce);
    expect(authorization.searchParams.get("state")).toBe(state);
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("redirect_uri")).toBe(googleOAuth.redirectUri);
  });

  test("rejects unknown and replayed callback states and tickets", async () => {
    const { app } = buildTestApp({ config: { googleOAuth } });
    const started = await app.request("/v1/auth/google/start", {
      method: "POST", headers, body: JSON.stringify({ nonce, clientChallenge }),
    });
    const { state } = await started.json() as { state: string };

    const unknown = await app.request("/auth/google/callback?state=unknown&error=access_denied");
    expect(unknown.status).toBe(302);
    expect(unknown.headers.get("location")).toContain("session_expired");

    const cancelled = await app.request(`/auth/google/callback?state=${state}&error=access_denied`);
    expect(cancelled.status).toBe(302);
    expect(cancelled.headers.get("location")).toContain("cancelled");

    const replay = await app.request(`/auth/google/callback?state=${state}&error=access_denied`);
    expect(replay.headers.get("location")).toContain("session_expired");

    const complete = await app.request("/v1/auth/google/complete", {
      method: "POST", headers, body: JSON.stringify({ ticket: "invalid", state }),
    });
    expect(complete.status).toBe(400);
  });
});
