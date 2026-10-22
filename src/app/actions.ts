"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { phoneKey } from "@/lib/logic";
import { nextQuoteNumber, readBusiness, readDoc } from "@/lib/quotedoc";
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
export async function addInvoice(input: z.input<typeof invoiceSchema> & { paid?: number; paid_on?: string }): Promise<Result> {
  const schema = invoiceSchema.extend({ paid: money.default(0), paid_on: date })
    .refine((v) => v.paid <= v.amount, { message: "Already paid can’t be more than the total.", path: ["paid"] });
  return run(schema, input, async ({ paid, paid_on, ...inv }, { supabase }) => {
    const ins = await supabase.from("invoices").insert(inv).select("id").single();
    if (ins.error || !ins.data) return { error: ins.error ?? { message: "Could not create the invoice" } };
    if (paid > 0) {
      const pay = await supabase.from("payments").insert({ invoice_id: ins.data.id, amount: paid, received_on: paid_on ?? todayISO() });
      if (pay.error) {
        await supabase.from("invoices").delete().eq("id", ins.data.id); // don't leave an invoice without its payment
        return { error: pay.error };
      }
    }
    return { error: null, id: ins.data.id };
  });
}
const PAST_CLIENT = "Past income (before the CRM)";
const pastIncomeSchema = z.object({
  rows: z.array(z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month for every row"),
    amount: money.refine((n) => n > 0, "Amount must be more than 0"),
    note: z.string().trim().default(""),
    client_id: optUuid,
  })).min(1, "Add at least one row").max(60),
});
/** Past money received, each row booked to a month: an invoice plus a payment dated in that month (so Revenue and Profit pick it up). */
export async function addPastIncome(input: { rows: { month: string; amount: number | string; note?: string; client_id?: string | null }[] }): Promise<Result> {
  return run(pastIncomeSchema, input, async ({ rows }, { supabase }) => {
    let fallback: string | null = null;
    if (rows.some((r) => !r.client_id)) {
      const found = await supabase.from("clients").select("id").eq("name", PAST_CLIENT).limit(1);
      if (found.error) return { error: found.error };
      fallback = found.data?.[0]?.id ?? null;
      if (!fallback) {
        const made = await supabase.from("clients").insert({ name: PAST_CLIENT, status: "Past", source: "Other", notes: "Holds income logged by month from before the CRM." }).select("id").single();
        if (made.error || !made.data) return { error: made.error ?? { message: "Could not create the holding client" } };
        fallback = made.data.id;
      }
    }
    const created: string[] = [];
    for (const r of rows) {
      const label = r.note || `Income ${r.month}`;
      const inv = await supabase.from("invoices").insert({ client_id: r.client_id ?? fallback, label, kind: "Invoice", amount: r.amount, notes: "Past income" }).select("id").single();
      if (inv.error || !inv.data) { if (created.length) await supabase.from("invoices").delete().in("id", created); return { error: inv.error ?? { message: "Could not save" } }; }
      created.push(inv.data.id);
      const pay = await supabase.from("payments").insert({ invoice_id: inv.data.id, amount: r.amount, received_on: `${r.month}-01` });
      if (pay.error) { await supabase.from("invoices").delete().in("id", created); return { error: pay.error }; }
    }
    return { error: null, info: `Added ${rows.length} month${rows.length === 1 ? "" : "s"} of income` };
  });
}
const planSchema = z.object({
  invoice_id: uuid,
  rows: z.array(z.object({
    amount: money.refine((n) => n > 0, "Every payment must be more than 0"),
    due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date for every payment"),
  })).min(1, "Add at least one payment").max(36),
});
const NEEDS_0005 = "Payment plans aren’t switched on yet. Run supabase/migrations/0005_payment_plans.sql in the Supabase SQL Editor, then try again.";
/** Replace the payment plan of an invoice. The new rows go in first; the old ones are removed only once that worked. */
export async function savePaymentPlan(input: { invoice_id: string; rows: { amount: number | string; due_on: string }[] }): Promise<Result> {
  return run(planSchema, input, async ({ invoice_id, rows }, { supabase }) => {
    const bal = await supabase.from("invoice_balances").select("balance, paid").eq("id", invoice_id).single();
    if (bal.error) return { error: bal.error };
    const total = Math.round(rows.reduce((s, r) => s + r.amount * 100, 0));
    if (total > Math.round(Number(bal.data.balance) * 100) + 1) {
      return { error: { message: `The plan adds up to R${(total / 100).toLocaleString("en-ZA")} but only R${Number(bal.data.balance).toLocaleString("en-ZA")} is still owed on this invoice.` } };
    }
    const old = await supabase.from("installments").select("id").eq("invoice_id", invoice_id);
    if (old.error) return { error: /installments/.test(old.error.message) ? { message: NEEDS_0005 } : old.error };
    const ins = await supabase.from("installments").insert(rows.map((r) => ({ invoice_id, amount: r.amount, due_on: r.due_on, paid_before: Number(bal.data.paid) })));
    if (ins.error) return { error: ins.error };
    if (old.data.length) {
      const del = await supabase.from("installments").delete().in("id", old.data.map((o) => o.id));
      if (del.error) return { error: del.error };
    }
    return { error: null, info: `Payment plan saved (${rows.length} payment${rows.length === 1 ? "" : "s"})` };
  });
}
export async function clearPaymentPlan(invoice_id: string): Promise<Result> {
  return run(uuid, invoice_id, (v, { supabase }) => supabase.from("installments").delete().eq("invoice_id", v));
}

export async function updateInvoice(id: string, input: z.input<typeof invoiceSchema>): Promise<Result> {
  return run(invoiceSchema.extend({ id: uuid }), { ...input, id }, async ({ id, ...v }, { supabase }) => {
    const cur = await supabase.from("invoice_balances").select("paid").eq("id", id).single();
    if (cur.error) return { error: cur.error };
    if (v.amount < Number(cur.data.paid)) {
      return { error: { message: `R${Number(cur.data.paid).toLocaleString("en-ZA")} has already been paid on this invoice, so the total can’t be lower than that. Fix or delete a payment first.` } };
    }
    return supabase.from("invoices").update(v).eq("id", id);
  });
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
const textLines = z.array(z.string().max(300)).max(40).default([]);
const docSchema = z.object({
  project: z.string().max(2000).default(""), included: textLines, not_included: textLines, needs: textLines,
  options: z.array(z.object({ name: z.string().trim().max(120), price: money, note: z.string().max(300).default("") })).max(6).default([]),
  chosen: z.coerce.number().int().min(0).default(0), extras: textLines, terms: textLines,
  timeline: z.string().max(1000).default(""), valid_days: z.coerce.number().int().min(1).max(365).default(14),
});
const quoteSchema = z.object({
  client_id: uuid, deal_id: optUuid, label: z.string().trim().min(1, "Describe the quote"),
  amount: money.refine((n) => n > 0, "Amount must be more than 0"),
  status: z.enum(QUOTE_STATUSES), sent_on: date, notes: z.string().default(""),
  doc: docSchema.optional(),
});
type Db = Awaited<ReturnType<typeof requireAuth>>["supabase"];
/** Next free quote number for this year, from your business settings (prefix, starting number). */
async function newQuoteNumber(supabase: Db): Promise<string> {
  const [b, q] = await Promise.all([supabase.from("settings").select("value").eq("key", "business").maybeSingle(), supabase.from("quotes").select("number")]);
  const biz = readBusiness(b.data?.value);
  const year = Number(todayISO().slice(0, 4));
  return nextQuoteNumber(biz.prefix, year, (q.data ?? []).map((r) => String((r as { number?: string }).number ?? "")), biz.next_number);
}
export async function addQuote(input: z.input<typeof quoteSchema>): Promise<Result> {
  return run(quoteSchema, input, async ({ doc, ...v }, { supabase }) => {
    const extra = doc ? { doc: readDoc(doc), number: await newQuoteNumber(supabase) } : {};
    const r = await supabase.from("quotes").insert({ ...v, ...extra, sent_on: v.sent_on ?? (v.status === "Sent" ? todayISO() : null) });
    if (!r.error) await syncDealToQuoteSent(supabase, v.deal_id, v.status);
    return r;
  });
}
export async function updateQuote(id: string, input: z.input<typeof quoteSchema>): Promise<Result> {
  return run(quoteSchema.extend({ id: uuid }), { ...input, id }, async ({ id, doc, ...v }, { supabase }) => {
    const extra: Record<string, unknown> = doc ? { doc: readDoc(doc) } : {};
    if (doc) { // a quote made before numbering existed gets its number the first time it is saved with a document
      const cur = await supabase.from("quotes").select("number").eq("id", id).single();
      if (!cur.error && !(cur.data as { number?: string }).number) extra.number = await newQuoteNumber(supabase);
    }
    const r = await supabase.from("quotes").update({ ...v, ...extra, sent_on: v.sent_on ?? (v.status === "Sent" ? todayISO() : null) }).eq("id", id);
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
const TIERS = z.enum(["", "A", "B", "C"]);
const leadFields = z.object({
  business: z.string().trim().min(1, "Business name is required"),
  contact: z.string().trim().default(""), phone: z.string().trim().default(""), notes: z.string().default(""),
  assigned_to: z.string().trim().default(""), niche: z.string().trim().default(""),
  tier: TIERS.default(""), city: z.string().trim().default(""), lead_code: z.string().trim().default(""),
});
const importFields = leadFields.extend({ outcome: z.enum(LEAD_OUTCOMES).default("Not called"), attempts: z.coerce.number().int().min(0).max(50).default(0) });
const NEEDS_0004 = "The call list needs one more database update. Run supabase/migrations/0004_lead_columns.sql in Supabase, then try again.";
const missingColumn = (m: string) => /column|schema cache/i.test(m) && /call_leads|assigned_to|niche|tier|city|lead_code/i.test(m);

/** Bulk add (paste, up to 3000 at a time). Skips phone numbers already on the list and repeats within the paste.
 *  Keeps the order you pasted. All-or-nothing: if any part fails, nothing is left behind. */
export async function addLeads(list: z.input<typeof importFields>[]): Promise<Result> {
  return run(z.array(importFields).min(1, "Nothing to add").max(3000, "Paste at most 3000 at a time"), list, async (rows, { supabase }) => {
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
    const base = Date.now();
    // Every row in one insert must carry the same fields (the database fills a missing field with "nothing", not its default).
    // The sheet columns are only sent when something uses them, so plain pastes work even before migration 0004.
    const usesSheetColumns = fresh.some((r) => r.assigned_to || r.niche || r.tier || r.city || r.lead_code);
    const records = fresh.map(({ assigned_to, niche, tier, city, lead_code, outcome, attempts, ...rest }, i) => ({
      ...rest, outcome, attempts,
      ...(usesSheetColumns && { assigned_to, niche, tier, city, lead_code }),
      created_at: new Date(base + i).toISOString(), // keeps the pasted order
    }));
    const doneIds: string[] = [];
    for (let i = 0; i < records.length; i += 500) {
      const ins = await supabase.from("call_leads").insert(records.slice(i, i + 500)).select("id");
      if (ins.error) {
        if (doneIds.length) await supabase.from("call_leads").delete().in("id", doneIds);
        return { error: { message: missingColumn(ins.error.message) ? NEEDS_0004 : ins.error.message } };
      }
      doneIds.push(...(ins.data ?? []).map((r) => r.id));
    }
    const skipped = rows.length - fresh.length;
    return { error: null, info: `Added ${fresh.length}${skipped ? `, skipped ${skipped} already on the list` : ""}.` };
  });
}
export async function updateLead(id: string, input: z.input<typeof leadFields>): Promise<Result> {
  return run(leadFields.extend({ id: uuid }), { ...input, id }, async ({ id, ...v }, { supabase }) => {
    const r = await supabase.from("call_leads").update(v).eq("id", id);
    return r.error && missingColumn(r.error.message) ? { error: { message: NEEDS_0004 } } : r;
  });
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

// ---------- business details (printed on quotes) ----------
const str = (n: number) => z.string().trim().max(n).default("");
const businessSchema = z.object({
  name: str(80), subtitle: str(80), legal_line: str(200), reg_no: str(60), contact_line: str(200), address: str(200),
  vat_note: str(100), signer: str(80), prefix: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/, "Quote prefix: letters and numbers only, up to 10").default("QUO"),
  next_number: z.coerce.number().int().min(1).max(99999).default(1001),
  bank: str(60), account_name: str(80), account_no: str(40), account_type: str(40), branch_code: str(20), defaults: docSchema,
});
export async function saveBusiness(input: z.input<typeof businessSchema>): Promise<Result> {
  return run(businessSchema, input, (v, { supabase }) =>
    supabase.from("settings").upsert({ key: "business", value: { ...v, defaults: readDoc(v.defaults) } }));
}
