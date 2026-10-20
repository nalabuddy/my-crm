import { daysBetween } from "./format";
import { waNumber } from "./chase";
import type { Activity, CallLead, Client, Deal, Expense, Invoice, LeadOutcome, Payment, Task, Person, Stage } from "./types";
import { STAGES } from "./types";

export const QUIET_DAYS = 14;

/** Balance = amount − sum(payments), never below zero in display. */
export function balanceOf(amount: number, payments: { amount: number }[]): number {
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  return Math.round((Number(amount) - paid) * 100) / 100;
}

export function owedOnInvoices(invoices: Invoice[]): number {
  return sum(invoices.filter((i) => i.kind === "Invoice" && i.balance > 0).map((i) => i.balance));
}
export function depositsPending(invoices: Invoice[]): number {
  return sum(invoices.filter((i) => i.kind === "Deposit" && i.balance > 0).map((i) => i.balance));
}
export function openPipelineValue(deals: Deal[]): number {
  return sum(deals.filter((d) => d.stage !== "Paid").map((d) => Number(d.value)));
}

export function isOverdueTask(t: Task, today: string): boolean {
  return !t.done && !!t.due && t.due < today;
}
export function dueTodayOrLate(tasks: Task[], today: string): Task[] {
  return tasks
    .filter((t) => !t.done && !!t.due && t.due <= today)
    .sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : 0));
}

/** Balance > 0 and (promised date passed OR no promised date). */
export function moneyToChase(invoices: Invoice[], today: string): Invoice[] {
  return invoices
    .filter((i) => i.balance > 0 && (!i.promised_date || i.promised_date < today))
    .sort((a, b) => b.balance - a.balance);
}

/** Lead/Active clients with no contact logged for 14+ days (falls back to created date). */
export function goQuiet(
  clients: Client[], activities: Activity[], today: string,
): { client: Client; last: string; days: number }[] {
  const lastBy = new Map<string, string>();
  for (const a of activities) {
    const cur = lastBy.get(a.client_id);
    if (!cur || a.at > cur) lastBy.set(a.client_id, a.at);
  }
  return clients
    .filter((c) => c.status === "Lead" || c.status === "Active")
    .map((c) => {
      const last = lastBy.get(c.id) ?? c.created_at.slice(0, 10);
      return { client: c, last, days: daysBetween(last, today) };
    })
    .filter((r) => r.days >= QUIET_DAYS)
    .sort((a, b) => b.days - a.days);
}

export function workload(tasks: Task[], today: string) {
  return (["Michael", "Trevor"] as Person[]).map((p) => {
    const mine = tasks.filter((t) => !t.done && (t.assignee === p || t.assignee === "Both"));
    return { person: p, open: mine.length, overdue: mine.filter((t) => isOverdueTask(t, today)).length,
             high: mine.filter((t) => t.priority === "High").length };
  });
}

export type TaskFilter = "Everyone" | "Mine" | "Michael" | "Trevor";
export function filterTasks(tasks: Task[], f: TaskFilter, me: Person | null, showDone: boolean): Task[] {
  const who: Person | null = f === "Mine" ? me : f === "Michael" || f === "Trevor" ? f : null;
  return tasks
    .filter((t) => showDone || !t.done)
    .filter((t) => !who || t.assignee === who || t.assignee === "Both");
}

export function nextStage(s: Stage, dir: 1 | -1): Stage | null {
  const i = STAGES.indexOf(s) + dir;
  return i < 0 || i >= STAGES.length ? null : STAGES[i];
}

function sum(xs: number[]): number {
  return Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- revenue / profit / projected chart ----------
export type ChartMonth = {
  key: string; label: string; received: number; expenses: number; profit: number; projected: number; target: number;
  current: boolean; future: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Last `back` months, this month, and `fwd` months ahead.
 * received = payments by received date; expenses by spent date; profit = received − expenses.
 * projected = open (not Paid) deal values in the month the deal is due; an overdue open deal counts in this month.
 */
export function chartData(o: {
  payments: Payment[]; expenses: Expense[]; deals: Deal[]; target: number; today: string; back?: number; fwd?: number;
}): { months: ChartMonth[]; undated: number; later: number } {
  const back = o.back ?? 6, fwd = o.fwd ?? 5;
  const ty = +o.today.slice(0, 4), tm = +o.today.slice(5, 7);
  const idx = (y: number, m: number) => y * 12 + (m - 1);
  const currentIdx = idx(ty, tm);
  const months: ChartMonth[] = [];
  for (let d = -back; d <= fwd; d++) {
    const i = currentIdx + d, y = Math.floor(i / 12), m = (i % 12) + 1;
    months.push({
      key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTHS[m - 1]}${m === 1 || d === -back ? " " + String(y).slice(2) : ""}`,
      received: 0, expenses: 0, profit: 0, projected: 0, target: o.target, current: d === 0, future: d > 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const p of o.payments) { const m = byKey.get(p.received_on.slice(0, 7)); if (m) m.received += Number(p.amount); }
  for (const e of o.expenses) { const m = byKey.get(e.spent_on.slice(0, 7)); if (m) m.expenses += Number(e.amount); }
  const currentKey = months[back].key, lastKey = months[months.length - 1].key;
  let undated = 0, later = 0;
  for (const d of o.deals) {
    if (d.stage === "Paid") continue;
    const v = Number(d.value);
    if (!d.due) { undated += v; continue; }
    const k = d.due.slice(0, 7) < currentKey ? currentKey : d.due.slice(0, 7);
    if (k > lastKey) { later += v; continue; }
    const m = byKey.get(k); if (m) m.projected += v;
  }
  for (const m of months) {
    m.received = r2(m.received); m.expenses = r2(m.expenses); m.projected = r2(m.projected);
    m.profit = r2(m.received - m.expenses);
  }
  return { months, undated: r2(undated), later: r2(later) };
}

// ---------- cold call list ----------
export type ParsedLead = {
  business: string; contact: string; phone: string; notes: string;
  assigned_to?: string; niche?: string; tier?: "" | "A" | "B" | "C"; city?: string; lead_code?: string;
  outcome?: LeadOutcome; attempts?: number;
};
const PHONE_PART = /^\+?[\d\s().-]{8,}$/;
const TRAILING_PHONE = /^(.*\S)[\s,:-]+(\+?\d[\d\s().-]{7,}\d)$/;

// Columns of the lead sheet, in the order they appear when nothing says otherwise.
const SHEET_KEYS = ["lead id", "assigned", "niche", "tier", "business", "category", "phone", "city", "reviews", "unclaimed", "also listed", "status"] as const;
type SheetKey = (typeof SHEET_KEYS)[number];

/** Map the sheet's "Call Status (live)" onto the call results the app knows. */
export function mapSheetStatus(raw: string): { outcome: LeadOutcome; attempts: number; note: string } {
  const t = raw.trim().toLowerCase();
  if (!t || /^(not called|not yet called|new|none)$/.test(t)) return { outcome: "Not called", attempts: 0, note: "" };
  if (/no answer|voicemail|unanswered/.test(t)) return { outcome: "No answer", attempts: 1, note: "" };
  if (/call ?back|later/.test(t)) return { outcome: "Call back later", attempts: 1, note: "" };
  if (/meeting|booked|appointment/.test(t)) return { outcome: "Meeting booked", attempts: 1, note: "" };
  if (/not interested|declin|wrong number/.test(t)) return { outcome: "Not interested", attempts: 1, note: "" };
  if (/interested|quote|hot|warm/.test(t)) return { outcome: "Interested", attempts: 1, note: "" };
  return { outcome: "Not called", attempts: 0, note: `Status in sheet: ${raw.trim()}` };
}

/**
 * Paste friendly. Two kinds of input:
 *  1. Rows copied straight from the lead sheet (tab separated, 8+ columns, header row optional):
 *     business, phone, assigned to, niche, tier, city, lead id and call status are all picked up;
 *     category, reviews, "Google profile unclaimed" and "also listed as" go into the notes.
 *  2. Simple lines, one business each; separate with comma / tab / semicolon / | / " - ". The phone can be anywhere.
 */
export function parseCallList(text: string): ParsedLead[] {
  const out: ParsedLead[] = [];
  let cols: Partial<Record<SheetKey, number>> | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;

    const cells = raw.split("\t");
    if (cells.length >= 8) {
      const lower = cells.map((c) => c.trim().toLowerCase());
      if (lower.includes("business name") || lower.includes("lead id")) { // header row: find each column by its title
        cols = {};
        for (const k of SHEET_KEYS) { const i = lower.findIndex((c) => c.includes(k)); if (i >= 0) cols[k] = i; }
        continue;
      }
      const at = cols ?? Object.fromEntries(SHEET_KEYS.map((k, i) => [k, i]));
      const cell = (k: SheetKey) => (at[k] === undefined ? "" : (cells[at[k]!] ?? "").trim());
      const business = cell("business");
      if (!business) continue;
      const tierRaw = cell("tier").toUpperCase();
      if (/do not call|dnc|don'?t call/i.test(cell("status"))) continue; // never imported
      const st = mapSheetStatus(cell("status"));
      const reviews = cell("reviews");
      const notes = [
        cell("category"),
        reviews !== "" ? `${reviews} Google reviews` : "",
        /^yes$/i.test(cell("unclaimed")) ? "Google profile unclaimed" : "",
        cell("also listed") ? `Also listed as: ${cell("also listed")}` : "",
        st.note,
      ].filter(Boolean).join(" · ");
      out.push({
        business, contact: "", phone: cell("phone"), notes,
        assigned_to: cell("assigned"), niche: cell("niche"), tier: tierRaw === "A" || tierRaw === "B" || tierRaw === "C" ? tierRaw : "",
        city: cell("city"), lead_code: cell("lead id"), outcome: st.outcome, attempts: st.attempts,
      });
      continue;
    }

    const line = raw.trim();
    if (/^(business|company|name)\b.*\b(phone|number|tel|cell)/i.test(line)) continue; // header row
    const parts = line.split(/\t|;|\||,|\s[-–—]\s/).map((x) => x.trim()).filter(Boolean);
    let phone = "";
    const rest: string[] = [];
    for (const p of parts) {
      if (!phone && PHONE_PART.test(p) && p.replace(/\D/g, "").length >= 9) phone = p; else rest.push(p);
    }
    if (!phone && rest.length) { // "Acme Plumbing 082 123 4567"
      const m = TRAILING_PHONE.exec(rest[rest.length - 1]);
      if (m && m[2].replace(/\D/g, "").length >= 9) { rest[rest.length - 1] = m[1].trim(); phone = m[2].trim(); }
    }
    const business = rest[0] ?? phone;
    if (!business) continue;
    out.push({ business, contact: rest[1] ?? "", phone, notes: rest.slice(2).join(", ") });
  }
  return out;
}

/** Digits-only key used to spot the same number twice. */
export const phoneKey = (phone: string) => waNumber(phone) ?? "";

/** Sort: callbacks due first, then not yet called, then no-answers, then everything finished; Tier A before B before C; then sheet order. */
export function sortLeads(leads: CallLead[], today: string): CallLead[] {
  const rank = (l: CallLead) =>
    l.outcome === "Call back later" && l.callback_on && l.callback_on <= today ? 0
    : l.outcome === "Not called" ? 1
    : l.outcome === "No answer" ? 2
    : l.outcome === "Call back later" ? 3 : 4;
  const tier = (l: CallLead) => ({ A: 0, B: 1, C: 2 } as Record<string, number>)[l.tier ?? ""] ?? 3;
  return [...leads].sort((a, b) => rank(a) - rank(b) || tier(a) - tier(b) || (a.last_called_on ?? "").localeCompare(b.last_called_on ?? "") || a.created_at.localeCompare(b.created_at));
}
