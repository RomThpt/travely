import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface QuotaState {
  month: string;
  used: number;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monthly counter for the AeroDataBox free tier, persisted across restarts. */
export class Quota {
  private state: QuotaState;

  constructor(
    private readonly filePath: string,
    readonly limit = 550,
  ) {
    this.state = this.load();
  }

  private load(): QuotaState {
    const month = currentMonth();
    if (existsSync(this.filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as QuotaState;
        if (parsed.month === month && typeof parsed.used === "number") return parsed;
      } catch {
        // corrupted quota file: start fresh for the current month
      }
    }
    return { month, used: 0 };
  }

  private persist(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state), "utf8");
  }

  private rollIfNeeded(): void {
    const month = currentMonth();
    if (this.state.month !== month) {
      this.state = { month, used: 0 };
      this.persist();
    }
  }

  get used(): number {
    this.rollIfNeeded();
    return this.state.used;
  }

  isExhausted(): boolean {
    this.rollIfNeeded();
    return this.state.used >= this.limit;
  }

  use(cost = 1): void {
    this.rollIfNeeded();
    this.state.used += cost;
    this.persist();
  }
}
