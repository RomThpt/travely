import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  /** When this value was written, so a reader can order entries newest first. */
  storedAt: number;
}

export interface CacheSnapshotEntry {
  key: string;
  value: unknown;
  storedAt: number;
}

/**
 * In-memory cache with JSON persistence, per-entry TTL and request coalescing (one
 * in-flight promise per key, so concurrent callers never trigger duplicate fetches).
 */
export class Cache {
  private store = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<unknown>>();
  private dirty = false;
  private flushTimer?: ReturnType<typeof setInterval>;
  /**
   * Bumped on every write and on the initial load. A reader that derives an index over the
   * cache keeps the revision it built against and rebuilds only when it moves, which is
   * what keeps `/v1/search` from walking the whole map on every keystroke.
   */
  private revisionCounter = 0;

  constructor(
    private readonly filePath: string,
    flushIntervalMs = 10_000,
  ) {
    this.load();
    if (flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(() => {});
      }, flushIntervalMs);
      this.flushTimer.unref?.();
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsed)) {
        // Entries persisted before `storedAt` existed order as the oldest, which is what
        // they are relative to anything this process has written.
        if (entry.expiresAt > now) this.store.set(key, { ...entry, storedAt: entry.storedAt ?? 0 });
      }
      this.revisionCounter += 1;
    } catch {
      this.store.clear();
    }
  }

  /** Changes whenever the contents changed; see `revisionCounter`. */
  get revision(): number {
    return this.revisionCounter;
  }

  /** Every entry that has not expired, for readers that index the cache rather than key it. */
  liveEntries(): CacheSnapshotEntry[] {
    const now = Date.now();
    const entries: CacheSnapshotEntry[] = [];
    for (const [key, entry] of this.store) {
      if (entry.expiresAt > now) entries.push({ key, value: entry.value, storedAt: entry.storedAt });
    }
    return entries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) return undefined;
    return entry.value as T;
  }

  /** Returns the value even if expired, for degraded-mode fallback. */
  getStale<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    return entry ? (entry.value as T) : undefined;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, { value, expiresAt: now + ttlMs, storedAt: now });
    this.dirty = true;
    this.revisionCounter += 1;
  }

  ttlRemainingMs(key: string): number | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  /** Coalesces concurrent loads for the same key; the loader picks its own TTL. */
  async getOrLoad<T>(key: string, loader: () => Promise<{ value: T; ttlMs: number }>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = loader()
      .then(({ value, ttlMs }) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const obj = Object.fromEntries(this.store.entries());
    await writeFile(this.filePath, JSON.stringify(obj), "utf8");
  }

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}
