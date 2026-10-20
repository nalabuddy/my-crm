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

export const MONEY_HELP = "Enter an amount like 10500 or 10 500 (cents with a . or ,)";

/**
 * Forgiving rand amount from typed text: "10500", "10 500", "R10,500", "R 10 500,50", "1.234.567,89" all work.
 * Anything ambiguous or malformed ("10..5", "10 5") is refused (null) rather than guessed. Rounded to cents.
 */
export function parseMoney(input: string): number | null {
  let t = (input ?? "").replace(/^[\s]*R[\s]*/i, "").trim();
  if (!t) return null;
  // spaces only as thousands groups: "10 500" yes, "10 5" no
  if (/\s/.test(t)) {
    if (!/^\d{1,3}(?:[\s\u00A0\u202F]\d{3})+(?:[.,]\d+)?$/.test(t)) return null;
    t = t.replace(/[\s\u00A0\u202F]/g, "");
  }
  if (/[^\d.,]/.test(t)) return null;
  const dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
  const grouped = (x: string, sep: string) => new RegExp(`^\\d{1,3}(?:\\${sep}\\d{3})+$`).test(x);
  if (dots && commas) {
    const dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ",";
    const thou = dec === "." ? "," : ".";
    const [int, frac, ...extra] = t.split(dec);
    if (extra.length || !/^\d+$/.test(frac ?? "") || !grouped(int, thou)) return null;
    t = int.split(thou).join("") + "." + frac;
  } else if (commas > 1 || dots > 1) {
    const sep = commas > 1 ? "," : ".";
    if (!grouped(t, sep)) return null;
    t = t.split(sep).join("");
  } else if (dots === 1 && /^\d{1,3}\.\d{3}$/.test(t)) {
    return null; // "10.500": R10.50 or R10 500? Refuse rather than guess.
  } else if (commas === 1) {
    t = /^\d{1,3},\d{3}$/.test(t) ? t.replace(",", "") : t.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(parseFloat(t) * 100) / 100;
  return Number.isFinite(n) ? n : null;
}
