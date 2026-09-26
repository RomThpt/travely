import type { Position } from "@travely/shared";

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
}

interface AisPositionReport {
  Latitude: number;
  Longitude: number;
  Cog?: number;
  Sog?: number;
}

interface AisStreamMessage {
  MessageType?: string;
  MetaData?: { MMSI?: number };
  Message?: { PositionReport?: AisPositionReport };
}

const IDLE_TIMEOUT_MS = 10 * 60_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";

/**
 * Lazily connects to aisstream.io only while a vessel position has been requested in
 * the last 10 minutes, and keeps the last known position per MMSI in memory. Failed
 * connections back off exponentially (capped at 60s) instead of retrying on every call.
 */
export class AisStreamClient {
  private socket: WebSocketLike | undefined;
  private readonly lastPosition = new Map<string, Position>();
  private readonly lastRequestedAt = new Map<string, number>();
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private nextConnectAllowedAtMs = 0;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly createSocket: (url: string) => WebSocketLike = (url) =>
      new WebSocket(url) as unknown as WebSocketLike,
    private readonly now: () => number = Date.now,
  ) {}

  requestVessel(mmsi: string): Position | undefined {
    this.lastRequestedAt.set(mmsi, this.now());
    this.ensureConnected([mmsi]);
    return this.lastPosition.get(mmsi);
  }

  private ensureConnected(mmsiFilter: string[]): void {
    if (this.socket || !this.apiKey) return;
    if (this.now() < this.nextConnectAllowedAtMs) return;
    const socket = this.createSocket(AISSTREAM_URL);
    socket.onopen = () => {
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      socket.send(
        JSON.stringify({
          APIKey: this.apiKey,
          BoundingBoxes: [
            [
              [-90, -180],
              [90, 180],
            ],
          ],
          FiltersShipMMSI: mmsiFilter,
          FilterMessageTypes: ["PositionReport"],
        }),
      );
    };
    socket.onmessage = (event) => this.handleMessage(event.data);
    socket.onclose = () => {
      if (this.socket === socket) this.scheduleReconnect();
    };
    socket.onerror = () => {
      if (this.socket === socket) this.scheduleReconnect();
    };
    this.socket = socket;
  }

  private scheduleReconnect(): void {
    this.socket = undefined;
    this.nextConnectAllowedAtMs = this.now() + this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
  }

  private handleMessage(raw: string): void {
    let parsed: AisStreamMessage;
    try {
      parsed = JSON.parse(raw) as AisStreamMessage;
    } catch {
      return;
    }
    const mmsi = parsed.MetaData?.MMSI;
    const report = parsed.Message?.PositionReport;
    if (mmsi === undefined || !report) return;
    this.lastPosition.set(String(mmsi), {
      lat: report.Latitude,
      lon: report.Longitude,
      ...(report.Cog !== undefined ? { heading: report.Cog } : {}),
      ...(report.Sog !== undefined ? { speedKmh: report.Sog * 1.852 } : {}),
      at: new Date(this.now()).toISOString(),
    });
  }

  getPosition(mmsi: string): Position | undefined {
    return this.lastPosition.get(mmsi);
  }

  /**
   * Closes the socket once no vessel has been requested in the idle window; otherwise
   * makes sure a connection is (re)established, respecting the reconnect backoff.
   */
  sweepIdle(): void {
    const cutoff = this.now() - IDLE_TIMEOUT_MS;
    const activeMmsi = [...this.lastRequestedAt.entries()]
      .filter(([, at]) => at >= cutoff)
      .map(([mmsi]) => mmsi);
    if (activeMmsi.length === 0) {
      if (this.socket) {
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.close();
        this.socket = undefined;
      }
      return;
    }
    this.ensureConnected(activeMmsi);
  }
}
