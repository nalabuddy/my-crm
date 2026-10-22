import { getMe, requireAuth } from "./session";
import { readBusiness, type Business } from "./quotedoc";
import type { Activity, CallLead, Client, Deal, Expense, Installment, Invoice, Payment, Quote, Task } from "./types";

/** Small two-person dataset: load everything for the screen in one go (RLS applies). */
export async function loadAll() {
  const { supabase } = await requireAuth();
  // One parallel batch: profile + all data (a missing profile redirects inside getMe).
  const [me, c, d, i, t, a, p, q] = await Promise.all([
    getMe(),
    supabase.from("clients").select("*").order("name"),
    supabase.from("deals").select("*").order("created_at", { ascending: false }),
    supabase.from("invoice_balances").select("*").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").order("at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, invoice_id, amount, received_on").order("received_on", { ascending: false }),
    supabase.from("quotes").select("*").order("created_at", { ascending: false }),
  ]);
  const err = c.error ?? d.error ?? i.error ?? t.error ?? a.error ?? p.error;
  if (err) throw new Error(err.message);
  return {
    me,
    clients: c.data as Client[], deals: d.data as Deal[], invoices: i.data as Invoice[],
    tasks: t.data as Task[], activities: a.data as Activity[], payments: p.data as Payment[],
    // tolerate a missing quotes table (migration 0002 not run yet) so the rest of the app keeps working
    quotes: (q.error ? [] : q.data) as Quote[], quotesReady: !q.error,
  };
}

/** Expenses + the monthly revenue target. Tolerates the tables not existing yet (SQL 0003 not run). */
export async function loadMoneyExtras() {
  const { supabase } = await requireAuth();
  const [e, t, pl] = await Promise.all([
    supabase.from("expenses").select("id, spent_on, amount, category, note").order("spent_on", { ascending: false }),
    supabase.from("revenue_targets").select("amount").eq("month", "default").maybeSingle(),
    supabase.from("installments").select("id, invoice_id, amount, due_on, paid_before").order("due_on", { ascending: true }),
  ]);
  return {
    expenses: (e.error ? [] : e.data) as Expense[],
    target: Number(t.data?.amount ?? 0),
    extrasReady: !e.error && !t.error,
    // payment plans: tolerate the table not existing yet (SQL 0005 not run)
    installments: (pl.error ? [] : pl.data).map((x) => ({ ...x, amount: Number(x.amount), paid_before: Number(x.paid_before) })) as Installment[],
    plansReady: !pl.error,
  };
}

/** The cold-call list. Tolerates the table not existing yet. */
export async function loadLeads() {
  const { supabase } = await requireAuth();
  const [me, l] = await Promise.all([getMe(), supabase.from("call_leads").select("*").order("created_at", { ascending: true })]);
  return { me, leads: (l.error ? [] : l.data) as CallLead[], ready: !l.error };
}

/** Your business details for printed quotes. `ready` is false until SQL 0006 has been run. */
export async function loadBusiness(): Promise<{ business: Business; saved: boolean; ready: boolean }> {
  const { supabase } = await requireAuth();
  const r = await supabase.from("settings").select("value").eq("key", "business").maybeSingle();
  return { business: readBusiness(r.data?.value), saved: !!r.data, ready: !r.error };
}
