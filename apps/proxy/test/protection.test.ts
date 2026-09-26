import { describe, expect, test } from "bun:test";
import { buildTestApp } from "./helpers";

const headers = { "x-travely-key": "test-key" };
const authenticated = { ...headers, "zklogin-jwt": "test-jwt" };
const objectId = `0x${"a".repeat(64)}`;

describe("protection API", () => {
  test("exposes only public Sui configuration", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/sui/config", { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      network: "testnet",
      packageId: `0x${"1".repeat(64)}`,
      usdcType: `0x${"2".repeat(64)}::usdc::USDC`,
      maxPositionBaseUnits: "100000000",
      purchaseFeeBps: "100",
      settlementFeeBps: "50",
      sponsoredTransactions: false,
      faucetUrl: "https://faucet.circle.com/",
    });
  });

  test("requires a zkLogin JWT before preparing a purchase", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/protection/prepare", {
      method: "POST",
      headers,
      body: JSON.stringify({
        marketId: objectId,
        side: "DELAYED",
        quantity: "1000000",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "zklogin_required" });
  });

  test("rejects an excessive amount before calling Enoki", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/protection/prepare", {
      method: "POST",
      headers: authenticated,
      body: JSON.stringify({
        marketId: objectId,
        side: "DELAYED",
        quantity: "100000001",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "amount_too_large" });
  });

  test("fails closed when sponsored transactions are not configured", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/protection/prepare", {
      method: "POST",
      headers: authenticated,
      body: JSON.stringify({
        marketId: objectId,
        side: "DELAYED",
        quantity: "1000000",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "sponsor_not_configured" });
  });

  test("rejects malformed claims without reaching Sui", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/protection/claim/prepare", {
      method: "POST",
      headers: authenticated,
      body: JSON.stringify({ marketId: "bad", positionId: "bad", idempotencyKey: "bad" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });

  test("will not execute an unknown sponsored digest", async () => {
    const { app } = buildTestApp();
    const response = await app.request("/v1/protection/execute", {
      method: "POST",
      headers: authenticated,
      body: JSON.stringify({
        digest: "unknown",
        signature: "signature",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "unknown_or_expired_transaction" });
  });
});
