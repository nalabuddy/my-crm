import { getMe, requireAuth } from "./session";
import type { Activity, Client, Deal, Invoice, Payment, Task } from "./types";

/** Small two-person dataset: load everything for the screen in one go (RLS applies). */
export async function loadAll() {
  const { supabase } = await requireAuth();
  // One parallel batch: profile + all data (a missing profile redirects inside getMe).
  const [me, c, d, i, t, a, p] = await Promise.all([
    getMe(),
    supabase.from("clients").select("*").order("name"),
    supabase.from("deals").select("*").order("created_at", { ascending: false }),
    supabase.from("invoice_balances").select("*").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").order("at", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, invoice_id, amount, received_on").order("received_on", { ascending: false }),
  ]);
  const err = c.error ?? d.error ?? i.error ?? t.error ?? a.error ?? p.error;
  if (err) throw new Error(err.message);
  return {
    me,
    clients: c.data as Client[], deals: d.data as Deal[], invoices: i.data as Invoice[],
    tasks: t.data as Task[], activities: a.data as Activity[], payments: p.data as Payment[],
  };
}
