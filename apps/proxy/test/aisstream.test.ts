import { describe, expect, test } from "bun:test";
import { AisStreamClient } from "../src/providers/aisstream";
import type { WebSocketLike } from "../src/providers/aisstream";

class FakeSocket implements WebSocketLike {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  closed = false;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  triggerMessage(data: string): void {
    this.onmessage?.({ data });
  }
}

function buildClient(apiKey: string | undefined) {
  let time = 0;
  const sockets: FakeSocket[] = [];
  const client = new AisStreamClient(
    apiKey,
    () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    () => time,
  );
  return { client, sockets, advance: (ms: number) => (time += ms) };
}

describe("AisStreamClient", () => {
  test("does nothing without an API key", () => {
    const { client, sockets } = buildClient(undefined);
    expect(client.requestVessel("123")).toBeUndefined();
    expect(sockets).toHaveLength(0);
  });

  test("connects lazily on the first request and reuses the open socket", () => {
    const { client, sockets } = buildClient("key");
    client.requestVessel("123");
    expect(sockets).toHaveLength(1);
    sockets[0]?.onopen?.();
    client.requestVessel("123");
    expect(sockets).toHaveLength(1);
  });

  test("updates the last known position from a PositionReport message", () => {
    const { client, sockets } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.onopen?.();
    sockets[0]?.triggerMessage(
      JSON.stringify({
        MetaData: { MMSI: 123 },
        Message: { PositionReport: { Latitude: 1, Longitude: 2, Cog: 90 } },
      }),
    );
    expect(client.getPosition("123")).toMatchObject({ lat: 1, lon: 2, heading: 90 });
  });

  test("backs off exponentially and does not reconnect before the delay elapses", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    expect(sockets).toHaveLength(1);

    sockets[0]?.close();
    client.requestVessel("123");
    expect(sockets).toHaveLength(1);

    advance(999);
    client.requestVessel("123");
    expect(sockets).toHaveLength(1);

    advance(1);
    client.requestVessel("123");
    expect(sockets).toHaveLength(2);
  });

  test("doubles the backoff on repeated failures, capped at 60s", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.close();

    advance(1_000);
    client.requestVessel("123");
    expect(sockets).toHaveLength(2);
    sockets[1]?.close();

    advance(1_999);
    client.requestVessel("123");
    expect(sockets).toHaveLength(2);
    advance(1);
    client.requestVessel("123");
    expect(sockets).toHaveLength(3);

    for (let i = 0; i < 10; i += 1) {
      sockets[sockets.length - 1]?.close();
      advance(60_000);
      client.requestVessel("123");
    }
    const beforeCount = sockets.length;
    sockets[sockets.length - 1]?.close();
    advance(59_999);
    client.requestVessel("123");
    expect(sockets).toHaveLength(beforeCount);
    advance(1);
    client.requestVessel("123");
    expect(sockets).toHaveLength(beforeCount + 1);
  });

  test("resets the backoff after a successful open", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.close();

    advance(1_000);
    client.requestVessel("123");
    expect(sockets).toHaveLength(2);
    sockets[1]?.onopen?.();
    sockets[1]?.close();

    advance(999);
    client.requestVessel("123");
    expect(sockets).toHaveLength(2);
    advance(1);
    client.requestVessel("123");
    expect(sockets).toHaveLength(3);
  });

  test("sweepIdle closes the socket once no vessel was requested recently", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.onopen?.();

    advance(10 * 60_000 + 1);
    client.sweepIdle();
    expect(sockets[0]?.closed).toBe(true);

    advance(1);
    client.requestVessel("999");
    expect(sockets).toHaveLength(2);
  });

  test("sweepIdle reconnects when demand is still active and the backoff has elapsed", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.close();

    advance(1_000);
    client.sweepIdle();
    expect(sockets).toHaveLength(2);
  });

  test("sweepIdle does not reconnect an idle-closed socket", () => {
    const { client, sockets, advance } = buildClient("key");
    client.requestVessel("123");
    sockets[0]?.onopen?.();

    advance(10 * 60_000 + 1);
    client.sweepIdle();
    advance(60_000);
    client.sweepIdle();
    expect(sockets).toHaveLength(1);
  });
});
