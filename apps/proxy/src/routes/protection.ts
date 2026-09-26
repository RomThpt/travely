import { randomUUID } from "node:crypto";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../deps";

const CLOCK_ID = "0x6";
const BASIS_POINTS = 10_000n;
const PURCHASE_FEE_BPS = 100n;
const SETTLEMENT_FEE_BPS = 50n;
const TWO_MINUTES = 2 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;
const ID = /^0x[a-fA-F0-9]{64}$/;

const prepareSchema = z.object({
  marketId: z.string().regex(ID),
  side: z.enum(["DELAYED", "ON_TIME"]),
  quantity: z.string().regex(/^[1-9]\d*$/),
  idempotencyKey: z.string().uuid(),
});

const claimSchema = z.object({
  marketId: z.string().regex(ID),
  positionId: z.string().regex(ID),
  idempotencyKey: z.string().uuid(),
});

const executeSchema = z.object({
  digest: z.string().min(1).max(100),
  signature: z.string().min(1).max(1_000),
  idempotencyKey: z.string().uuid(),
});

type PendingIntent = {
  address: string;
  idempotencyKey: string;
  expiresAt: number;
};

type MarketFields = {
  status: bigint;
  closesAtMs: bigint;
  seedCapital: bigint;
  yesExposure: bigint;
  noExposure: bigint;
  delayThresholdMs: bigint;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_sui_object");
  return value as Record<string, unknown>;
}

function integer(value: unknown): bigint {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("invalid_sui_integer");
  return BigInt(value);
}

function objectId(value: unknown): string {
  if (typeof value === "string") return value;
  const nested = record(value);
  if (typeof nested.id !== "string") throw new Error("invalid_sui_id");
  return nested.id;
}

function parseMarket(value: unknown): MarketFields {
  const fields = record(value);
  return {
    status: integer(fields.status),
    closesAtMs: integer(fields.closes_at_ms),
    seedCapital: integer(fields.seed_capital),
    yesExposure: integer(fields.yes_exposure),
    noExposure: integer(fields.no_exposure),
    delayThresholdMs: integer(fields.delay_threshold_ms),
  };
}

function feeFor(amount: bigint, basisPoints: bigint): bigint {
  return amount === 0n ? 0n : (amount * basisPoints + BASIS_POINTS - 1n) / BASIS_POINTS;
}

function quote(market: MarketFields, delayed: boolean, quantity: bigint): bigint {
  if (quantity <= 0n || market.seedCapital <= 0n) throw new Error("invalid_amount");
  const diff = market.yesExposure - market.noExposure;
  const imbalance = diff < 0n ? -diff : diff;
  const shift = (imbalance * 5_000n) / market.seedCapital;
  const capped = shift > 4_000n ? 4_000n : shift;
  const yesPrice = diff >= 0n ? 5_000n + capped : 5_000n - capped;
  const price = delayed ? yesPrice : BASIS_POINTS - yesPrice;
  return (quantity * price + BASIS_POINTS - 1n) / BASIS_POINTS;
}

function jwt(c: { req: { header(name: string): string | undefined } }): string | null {
  const value = c.req.header("zklogin-jwt");
  return value && value.length <= 10_000 ? value : null;
}

function addressOwner(owner: unknown): string | null {
  if (typeof owner === "string") return owner;
  if (!owner || typeof owner !== "object") return null;
  const value = owner as Record<string, unknown>;
  return typeof value.AddressOwner === "string" ? value.AddressOwner : null;
}

export function protectionRoutes(deps: AppDeps): Hono {
  const app = new Hono();
  const pending = new Map<string, PendingIntent>();
  const idempotencyKeys = new Map<string, number>();

  const prune = () => {
    const now = deps.now().getTime();
    for (const [digest, intent] of pending) if (intent.expiresAt <= now) pending.delete(digest);
    for (const [key, expiresAt] of idempotencyKeys) if (expiresAt <= now) idempotencyKeys.delete(key);
  };

  const reserveKey = (key: string): boolean => {
    if (idempotencyKeys.has(key)) return false;
    idempotencyKeys.set(key, deps.now().getTime() + TWO_MINUTES);
    return true;
  };

  async function enoki<T>(path: string, userJwt: string | null, body?: unknown): Promise<T> {
    const apiKey = deps.config.sui.enokiPrivateApiKey;
    if (!apiKey) throw new Error("sponsor_not_configured");
    const response = await deps.fetchImpl(`${deps.config.sui.enokiApiUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(userJwt ? { "zklogin-jwt": userJwt } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error("sponsor_rejected");
    const payload = await response.json() as { data?: T };
    if (!payload.data) throw new Error("sponsor_invalid_response");
    return payload.data;
  }

  async function account(userJwt: string): Promise<string> {
    const data = await enoki<{ address: string }>("/zklogin?network=testnet", userJwt);
    if (!ID.test(data.address)) throw new Error("invalid_account");
    return data.address.toLowerCase();
  }

  async function sponsor(transaction: Transaction, userJwt: string, address: string, target: string) {
    transaction.setSender(address);
    const kind = await transaction.build({ client: deps.suiClient, onlyTransactionKind: true });
    return enoki<{ bytes: string; digest: string }>("/transaction-blocks/sponsor", userJwt, {
      network: deps.config.sui.network,
      transactionBlockKindBytes: toBase64(kind),
      allowedMoveCallTargets: [target],
    });
  }

  async function marketObject(marketId: string) {
    const { object } = await deps.suiClient.getObject({
      objectId: marketId,
      include: { json: true, owner: true },
    });
    const expected = `${deps.config.sui.packageId}::market::Market<${deps.config.sui.usdcType}>`;
    if (object.type !== expected) throw new Error("market_not_allowed");
    return { object, market: parseMarket(object.json) };
  }

  app.get("/sui/config", (c) => c.json({
    network: deps.config.sui.network,
    packageId: deps.config.sui.packageId,
    usdcType: deps.config.sui.usdcType,
    maxPositionBaseUnits: deps.config.sui.maxPositionBaseUnits.toString(),
    purchaseFeeBps: PURCHASE_FEE_BPS.toString(),
    settlementFeeBps: SETTLEMENT_FEE_BPS.toString(),
    sponsoredTransactions: Boolean(deps.config.sui.enokiPrivateApiKey),
    faucetUrl: "https://faucet.circle.com/",
  }));

  app.post("/protection/prepare", async (c) => {
    c.header("Cache-Control", "no-store");
    try {
      prune();
      const userJwt = jwt(c);
      if (!userJwt) return c.json({ error: "zklogin_required" }, 401);
      const parsed = prepareSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      const quantity = BigInt(parsed.data.quantity);
      if (quantity > deps.config.sui.maxPositionBaseUnits) return c.json({ error: "amount_too_large" }, 400);
      if (!reserveKey(parsed.data.idempotencyKey)) {
        return c.json({ error: "duplicate_request" }, 409);
      }
      const address = await account(userJwt);
      const { market } = await marketObject(parsed.data.marketId);
      if (market.status !== 0n || market.closesAtMs <= BigInt(deps.now().getTime())) {
        return c.json({ error: "market_closed" }, 409);
      }
      const delayed = parsed.data.side === "DELAYED";
      const premium = quote(market, delayed, quantity);
      const purchaseFee = feeFor(premium, PURCHASE_FEE_BPS);
      const settlementFee = feeFor(quantity, SETTLEMENT_FEE_BPS);
      const total = premium + purchaseFee;
      const transaction = new Transaction();
      const payment = transaction.coin({ balance: total, type: deps.config.sui.usdcType, useGasCoin: false });
      const target = `${deps.config.sui.packageId}::market::buy`;
      transaction.moveCall({
        target,
        typeArguments: [deps.config.sui.usdcType],
        arguments: [
          transaction.object(parsed.data.marketId),
          transaction.pure.bool(delayed),
          transaction.pure.u64(quantity),
          payment,
          transaction.object(CLOCK_ID),
        ],
      });
      const sponsored = await sponsor(transaction, userJwt, address, target);
      const expiresAt = deps.now().getTime() + TWO_MINUTES;
      pending.set(sponsored.digest, { address, idempotencyKey: parsed.data.idempotencyKey, expiresAt });
      return c.json({
        digest: sponsored.digest,
        transactionBytes: sponsored.bytes,
        expiresAt: new Date(expiresAt).toISOString(),
        summary: {
          debitUsdcBaseUnits: total.toString(),
          premiumUsdcBaseUnits: premium.toString(),
          feeUsdcBaseUnits: purchaseFee.toString(),
          potentialPayoutUsdcBaseUnits: (quantity - settlementFee).toString(),
          settlementFeeUsdcBaseUnits: settlementFee.toString(),
          condition: `ARRIVAL_DELAY_GTE_${market.delayThresholdMs}_MS`,
        },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "prepare_failed";
      const status = code === "sponsor_not_configured" ? 503 : code === "sponsor_rejected" ? 502 : 400;
      return c.json({ error: code }, status);
    }
  });

  app.post("/protection/claim/prepare", async (c) => {
    c.header("Cache-Control", "no-store");
    try {
      prune();
      const userJwt = jwt(c);
      if (!userJwt) return c.json({ error: "zklogin_required" }, 401);
      const parsed = claimSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      if (!reserveKey(parsed.data.idempotencyKey)) {
        return c.json({ error: "duplicate_request" }, 409);
      }
      const address = await account(userJwt);
      const { market } = await marketObject(parsed.data.marketId);
      if (market.status === 0n) return c.json({ error: "market_open" }, 409);
      const { object: position } = await deps.suiClient.getObject({
        objectId: parsed.data.positionId,
        include: { json: true, owner: true },
      });
      const expected = `${deps.config.sui.packageId}::market::Position<${deps.config.sui.usdcType}>`;
      if (position.type !== expected || addressOwner(position.owner)?.toLowerCase() !== address ||
        objectId(record(position.json).market_id).toLowerCase() !== parsed.data.marketId.toLowerCase()) {
        return c.json({ error: "position_not_allowed" }, 403);
      }
      const transaction = new Transaction();
      const target = `${deps.config.sui.packageId}::market::claim`;
      transaction.moveCall({
        target,
        typeArguments: [deps.config.sui.usdcType],
        arguments: [transaction.object(parsed.data.marketId), transaction.object(parsed.data.positionId)],
      });
      const sponsored = await sponsor(transaction, userJwt, address, target);
      const expiresAt = deps.now().getTime() + TWO_MINUTES;
      pending.set(sponsored.digest, { address, idempotencyKey: parsed.data.idempotencyKey, expiresAt });
      return c.json({ digest: sponsored.digest, transactionBytes: sponsored.bytes, expiresAt: new Date(expiresAt).toISOString() });
    } catch (error) {
      const code = error instanceof Error ? error.message : "prepare_failed";
      const status = code === "sponsor_not_configured" ? 503 : code === "sponsor_rejected" ? 502 : 400;
      return c.json({ error: code }, status);
    }
  });

  app.post("/protection/execute", async (c) => {
    c.header("Cache-Control", "no-store");
    try {
      prune();
      const userJwt = jwt(c);
      if (!userJwt) return c.json({ error: "zklogin_required" }, 401);
      const parsed = executeSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
      const intent = pending.get(parsed.data.digest);
      if (!intent || intent.idempotencyKey !== parsed.data.idempotencyKey) {
        return c.json({ error: "unknown_or_expired_transaction" }, 409);
      }
      const address = await account(userJwt);
      if (address !== intent.address) return c.json({ error: "account_mismatch" }, 403);
      const executed = await enoki<{ digest: string }>(
        `/transaction-blocks/sponsor/${encodeURIComponent(parsed.data.digest)}`,
        null,
        { signature: parsed.data.signature },
      );
      pending.delete(parsed.data.digest);
      idempotencyKeys.set(parsed.data.idempotencyKey, deps.now().getTime() + ONE_DAY);
      return c.json({ digest: executed.digest, status: "submitted", requestId: randomUUID() });
    } catch (error) {
      const code = error instanceof Error ? error.message : "execute_failed";
      const status = code === "sponsor_not_configured" ? 503 : code === "sponsor_rejected" ? 502 : 400;
      return c.json({ error: code }, status);
    }
  });

  return app;
}
