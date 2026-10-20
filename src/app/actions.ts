"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { phoneKey } from "@/lib/logic";
import { getMe, requireAuth } from "@/lib/session";
import {
  ACTIVITY_TYPES, INVOICE_KINDS, LEAD_OUTCOMES, OWNERS, PRIORITIES, QUOTE_STATUSES, SOURCES, STAGES, STATUSES,
} from "@/lib/types";

export type Result = { error?: string; id?: string; info?: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v || null);
const money = z.coerce.number().finite().min(0);
const uuid = z.string().uuid();
const optUuid = z.string().uuid().nullable().optional().transform((v) => v || null);

async function run<T>(schema: z.ZodType<T>, input: unknown, fn: (v: T, c: { supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"] }) => PromiseLike<{ error: { message: string } | null; id?: string; info?: string }>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  // Authorisation proper is Row Level Security (only profiled users pass); this just needs a valid login.
  const ctx = await requireAuth();
  const r = await fn(parsed.data, ctx);
  if (r.error) return { error: r.error.message };
  revalidatePath("/", "layout");
  return { id: r.id, info: r.info };
}

// ---------- auth ----------
export async function signIn(_: unknown, form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password." };
  redirect("/");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------- clients ----------
const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  status: z.enum(STATUSES), source: z.enum(SOURCES),
  contact: z.string().default(""), phone: z.string().default(""),
  email: z.string().default(""), notes: z.string().default(""),
});
export async function addClient(input: z.input<typeof clientSchema>): Promise<Result> {
  return run(clientSchema, input, async (v, { supabase }) => {
    const { data, error } = await supabase.from("clients").insert(v).select("id").single();
    return { error, id: data?.id };
  });
}

export async function updateClient(id: string, input: z.input<typeof clientSchema>): Promise<Result> {
  return run(clientSchema.extend({ id: uuid }), { ...input, id }, async ({ id, ...v }, { supabase }) =>
    supabase.from("clients").update(v).eq("id", id));
}

export async function deleteClient(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("clients").delete().eq("id", v));
}

// ---------- tasks ----------
const taskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required"),
  assignee: z.enum(OWNERS), due: date, priority: z.enum(PRIORITIES).default("Normal"),
  client_id: optUuid, notes: z.string().default(""),
});
export async function addTask(input: z.input<typeof taskSchema>): Promise<Result> {
  return run(taskSchema, input, (v, { supabase }) => supabase.from("tasks").insert(v));
}

export async function updateTask(id: string, input: z.input<typeof taskSchema>): Promise<Result> {
  return run(taskSchema.extend({ id: uuid }), { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("tasks").update(v).eq("id", id));
}

export async function setTaskDone(id: string, done: boolean): Promise<Result> {
  return run(z.object({ id: uuid, done: z.boolean() }), { id, done }, (v, { supabase }) =>
    supabase.from("tasks").update({ done: v.done, done_at: v.done ? new Date().toISOString() : null }).eq("id", v.id));
}

export async function deleteTask(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("tasks").delete().eq("id", v));
}

// ---------- deals ----------
const dealSchema = z.object({
  title: z.string().trim().min(1, "Deal title is required"),
  client_id: optUuid, value: money, stage: z.enum(STAGES), owner: z.enum(OWNERS), due: date,
});
export async function addDeal(input: z.input<typeof dealSchema>): Promise<Result> {
  return run(dealSchema, input, (v, { supabase }) => supabase.from("deals").insert(v));
}

export async function updateDeal(id: string, input: z.input<typeof dealSchema>): Promise<Result> {
  return run(dealSchema.extend({ id: uuid }), { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("deals").update(v).eq("id", id));
}

export async function moveDeal(id: string, stage: string): Promise<Result> {
  return run(z.object({ id: uuid, stage: z.enum(STAGES) }), { id, stage }, (v, { supabase }) =>
    supabase.from("deals").update({ stage: v.stage }).eq("id", v.id));
}

export async function deleteDeal(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("deals").delete().eq("id", v));
}

// ---------- invoices & payments ----------
const invoiceSchema = z.object({
  client_id: uuid, label: z.string().trim().min(1, "Label is required"),
  kind: z.enum(INVOICE_KINDS), amount: money.refine((n) => n > 0, "Amount must be more than 0"),
  due: date, promised_date: date, notes: z.string().default(""),
});
export async function addInvoice(input: z.input<typeof invoiceSchema>): Promise<Result> {
  return run(invoiceSchema, input, (v, { supabase }) => supabase.from("invoices").insert(v));
}

export async function updateInvoice(id: string, input: z.input<typeof invoiceSchema>): Promise<Result> {
  return run(invoiceSchema.extend({ id: uuid }), { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("invoices").update(v).eq("id", id));
}

export async function setPromisedDate(id: string, promised_date: string | null): Promise<Result> {
  return run(z.object({ id: uuid, promised_date: date }), { id, promised_date }, (v, { supabase }) =>
    supabase.from("invoices").update({ promised_date: v.promised_date }).eq("id", v.id));
}

export async function deleteInvoice(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("invoices").delete().eq("id", v));
}

export async function recordPayment(input: { invoice_id: string; amount: number | string; received_on: string }): Promise<Result> {
  return run(
    z.object({ invoice_id: uuid, amount: money.refine((n) => n > 0, "Amount must be more than 0"), received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    input,
    (v, { supabase }) => supabase.from("payments").insert(v),
  );
}

const paymentEditSchema = z.object({
  id: uuid, amount: money.refine((n) => n > 0, "Amount must be more than 0"),
  received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export async function updatePayment(id: string, input: { amount: number | string; received_on: string }): Promise<Result> {
  return run(paymentEditSchema, { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("payments").update(v).eq("id", id));
}
export async function deletePayment(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("payments").delete().eq("id", v));
}

// ---------- quotes ----------
const quoteSchema = z.object({
  client_id: uuid, deal_id: optUuid, label: z.string().trim().min(1, "Describe the quote"),
  amount: money.refine((n) => n > 0, "Amount must be more than 0"),
  status: z.enum(QUOTE_STATUSES), sent_on: date, notes: z.string().default(""),
});
export async function addQuote(input: z.input<typeof quoteSchema>): Promise<Result> {
  return run(quoteSchema, input, async (v, { supabase }) => {
    const r = await supabase.from("quotes").insert({ ...v, sent_on: v.sent_on ?? (v.status === "Sent" ? todayISO() : null) });
    if (!r.error) await syncDealToQuoteSent(supabase, v.deal_id, v.status);
    return r;
  });
}
export async function updateQuote(id: string, input: z.input<typeof quoteSchema>): Promise<Result> {
  return run(quoteSchema.extend({ id: uuid }), { ...input, id }, async ({ id, ...v }, { supabase }) => {
    const r = await supabase.from("quotes").update({ ...v, sent_on: v.sent_on ?? (v.status === "Sent" ? todayISO() : null) }).eq("id", id);
    if (!r.error) await syncDealToQuoteSent(supabase, v.deal_id, v.status);
    return r;
  });
}
export async function setQuoteStatus(id: string, status: string): Promise<Result> {
  return run(z.object({ id: uuid, status: z.enum(QUOTE_STATUSES) }), { id, status }, async (v, { supabase }) => {
    const patch = v.status === "Sent" ? { status: v.status, sent_on: todayISO() } : { status: v.status };
    const r = await supabase.from("quotes").update(patch).eq("id", v.id).select("deal_id").single();
    if (!r.error) await syncDealToQuoteSent(supabase, r.data?.deal_id ?? null, v.status);
    return { error: r.error };
  });
}
export async function deleteQuote(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("quotes").delete().eq("id", v));
}
/** Accepted quote → invoice (or deposit + final invoice) in one atomic database step. */
export async function convertQuote(id: string, depositPct: number): Promise<Result> {
  return run(z.object({ id: uuid, pct: z.coerce.number().min(0).max(99) }), { id, pct: depositPct }, async (v, { supabase }) => {
    const r = await supabase.rpc("convert_quote", { p_quote: v.id, p_deposit_pct: v.pct });
    return { error: r.error };
  });
}
/** Marking a quote "Sent" moves a linked deal from Lead to "Quote sent" (never backwards). */
async function syncDealToQuoteSent(supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"], dealId: string | null, status: string) {
  if (!dealId || status !== "Sent") return;
  await supabase.from("deals").update({ stage: "Quote sent" }).eq("id", dealId).eq("stage", "Lead");
}

// ---------- expenses & target ----------
const expenseSchema = z.object({
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: money.refine((n) => n > 0, "Amount must be more than 0"),
  category: z.string().trim().min(1, "Pick or type a category"), note: z.string().default(""),
});
export async function addExpense(input: z.input<typeof expenseSchema>): Promise<Result> {
  return run(expenseSchema, input, (v, { supabase }) => supabase.from("expenses").insert(v));
}
export async function updateExpense(id: string, input: z.input<typeof expenseSchema>): Promise<Result> {
  return run(expenseSchema.extend({ id: uuid }), { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("expenses").update(v).eq("id", id));
}
export async function deleteExpense(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("expenses").delete().eq("id", v));
}
export async function setMonthlyTarget(amount: number | string): Promise<Result> {
  return run(money, amount, (v, { supabase }) => supabase.from("revenue_targets").upsert({ month: "default", amount: v }));
}

// ---------- cold call list ----------
const leadFields = z.object({
  business: z.string().trim().min(1, "Business name is required"),
  contact: z.string().trim().default(""), phone: z.string().trim().default(""), notes: z.string().default(""),
});
/** Bulk add (paste). Skips phone numbers already on the list, and repeats within the paste. */
export async function addLeads(list: z.input<typeof leadFields>[]): Promise<Result> {
  return run(z.array(leadFields).min(1, "Nothing to add").max(1000, "Paste at most 1000 at a time"), list, async (rows, { supabase }) => {
    const existing = await supabase.from("call_leads").select("phone");
    if (existing.error) return { error: existing.error };
    const seen = new Set((existing.data ?? []).map((r) => phoneKey(r.phone)).filter(Boolean));
    const fresh = rows.filter((r) => {
      const k = phoneKey(r.phone);
      if (!k) return true;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (fresh.length) {
      const ins = await supabase.from("call_leads").insert(fresh);
      if (ins.error) return { error: ins.error };
    }
    const skipped = rows.length - fresh.length;
    return { error: null, info: `Added ${fresh.length}${skipped ? `, skipped ${skipped} already on the list` : ""}.` };
  });
}
export async function updateLead(id: string, input: z.input<typeof leadFields>): Promise<Result> {
  return run(leadFields.extend({ id: uuid }), { ...input, id }, ({ id, ...v }, { supabase }) =>
    supabase.from("call_leads").update(v).eq("id", id));
}
export async function deleteLead(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("call_leads").delete().eq("id", v));
}
/** Tick the result of a call. "Not called" resets the lead without counting an attempt. */
export async function setLeadOutcome(id: string, outcome: string, callbackOn?: string | null): Promise<Result> {
  return run(z.object({ id: uuid, outcome: z.enum(LEAD_OUTCOMES), callbackOn: date }), { id, outcome, callbackOn }, async (v, { supabase }) => {
    if (v.outcome === "Not called") {
      return supabase.from("call_leads").update({ outcome: v.outcome, callback_on: null }).eq("id", v.id);
    }
    const me = await getMe();
    const cur = await supabase.from("call_leads").select("attempts").eq("id", v.id).single();
    if (cur.error) return { error: cur.error };
    return supabase.from("call_leads").update({
      outcome: v.outcome, callback_on: v.outcome === "Call back later" ? v.callbackOn : null,
      attempts: (cur.data?.attempts ?? 0) + 1, last_called_on: todayISO(), called_by: me,
    }).eq("id", v.id);
  });
}
/** Interested → client (source Cold call) + "send quote" task + call log, in one database step. */
export async function convertLead(id: string): Promise<Result> {
  return run(uuid, id, async (v, { supabase }) => {
    const r = await supabase.rpc("convert_lead", { p_lead: v });
    return { error: r.error, id: (r.data as string | null) ?? undefined };
  });
}

// ---------- activities ----------
const activitySchema = z.object({
  client_id: uuid, type: z.enum(ACTIVITY_TYPES), text: z.string().trim().default(""),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export async function addActivity(input: z.input<typeof activitySchema>): Promise<Result> {
  return run(activitySchema, input, async (v, { supabase }) => {
    const me = await getMe();
    return supabase.from("activities").insert({ ...v, by: me });
  });
}

export async function deleteActivity(id: string): Promise<Result> {
  return run(uuid, id, (v, { supabase }) => supabase.from("activities").delete().eq("id", v));
}
