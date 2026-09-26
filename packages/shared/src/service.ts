/** Normalise a user-typed service number: "af 1180" becomes "AF1180". */
export function normaliseNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Build YYYYMMDD from an ISO local date. */
export function toServiceDate(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) throw new Error(`Invalid ISO date "${isoDate}"`);
  return Number(`${match[1]}${match[2]}${match[3]}`);
}

export function fromServiceDate(serviceDate: number): string {
  const value = String(serviceDate).padStart(8, "0");
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
