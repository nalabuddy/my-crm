import { daysBetween } from "./format";
import type { Activity, Client, Deal, Invoice, Payment, Task, Person, Stage } from "./types";
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

/** Money actually received (payments), by calendar month, for the last n months ending with today's month. Newest first. */
export function monthlyReceived(payments: Payment[], today: string, n = 12): { key: string; label: string; total: number }[] {
  let y = +today.slice(0, 4), m = +today.slice(5, 7);
  const out: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTHS[m - 1]} ${y}`, total: 0 });
    if (--m === 0) { m = 12; y--; }
  }
  const byKey = new Map(out.map((o) => [o.key, o]));
  for (const p of payments) {
    const row = byKey.get(p.received_on.slice(0, 7));
    if (row) row.total = Math.round((row.total + Number(p.amount)) * 100) / 100;
  }
  return out;
}
