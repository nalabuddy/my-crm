/** R 10 500 / R 10 500,50 — space thousands, cents only when present. */
export function fmtRand(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  const neg = v < 0;
  const abs = Math.abs(v);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const [int, dec] = abs.toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${neg ? "-" : ""}R ${grouped}${hasCents ? "," + dec : ""}`;
}

/** 2026-10-14 → 14/10/2026 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Today as YYYY-MM-DD in South African time. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.UTC(+fromISO.slice(0, 4), +fromISO.slice(5, 7) - 1, +fromISO.slice(8, 10));
  const b = Date.UTC(+toISO.slice(0, 4), +toISO.slice(5, 7) - 1, +toISO.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
