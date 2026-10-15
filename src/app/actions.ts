"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMe, requireAuth } from "@/lib/session";
import {
  ACTIVITY_TYPES, INVOICE_KINDS, OWNERS, PRIORITIES, SOURCES, STAGES, STATUSES,
} from "@/lib/types";

export type Result = { error?: string; id?: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((v) => v || null);
const money = z.coerce.number().finite().min(0);
const uuid = z.string().uuid();
const optUuid = z.string().uuid().nullable().optional().transform((v) => v || null);

async function run<T>(schema: z.ZodType<T>, input: unknown, fn: (v: T, c: { supabase: Awaited<ReturnType<typeof requireAuth>>["supabase"] }) => PromiseLike<{ error: { message: string } | null; id?: string }>): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  // Authorisation proper is Row Level Security (only profiled users pass); this just needs a valid login.
  const ctx = await requireAuth();
  const r = await fn(parsed.data, ctx);
  if (r.error) return { error: r.error.message };
  revalidatePath("/", "layout");
  return { id: r.id };
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
