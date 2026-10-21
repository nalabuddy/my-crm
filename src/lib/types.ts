export const STATUSES = ["Lead", "Active", "Past"] as const;
export const SOURCES = ["Cold call", "Referral", "Website", "Social media", "Other"] as const;
export const STAGES = ["Lead", "Quote sent", "Awaiting deposit", "In progress", "Delivered", "Paid"] as const;
export const PEOPLE = ["Michael", "Trevor"] as const;
export const OWNERS = ["Michael", "Trevor", "Both"] as const;
export const PRIORITIES = ["Normal", "High"] as const;
export const ACTIVITY_TYPES = ["Call", "WhatsApp", "Email", "Meeting", "Note"] as const;
export const INVOICE_KINDS = ["Invoice", "Deposit"] as const;
export const LEAD_OUTCOMES = ["Not called", "No answer", "Call back later", "Meeting booked", "Interested", "Not interested"] as const;
export const QUOTE_STATUSES = ["Draft", "Sent", "Accepted", "Declined"] as const;

export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type Stage = (typeof STAGES)[number];
export type Person = (typeof PEOPLE)[number];
export type Owner = (typeof OWNERS)[number];
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type Client = {
  id: string; name: string; status: Status; contact: string; phone: string; email: string;
  source: Source; notes: string; created_at: string;
};
export type Deal = {
  id: string; client_id: string | null; title: string; value: number; stage: Stage;
  owner: Owner; due: string | null; created_at: string;
};
/** Row of the invoice_balances view */
export type Invoice = {
  id: string; client_id: string; label: string; kind: "Invoice" | "Deposit"; amount: number;
  due: string | null; promised_date: string | null; notes: string; created_at: string;
  paid: number; balance: number; payment_count: number;
};
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type Quote = {
  id: string; client_id: string; deal_id: string | null; label: string; amount: number; status: QuoteStatus;
  sent_on: string | null; notes: string; invoiced: boolean; created_at: string;
};
export type Installment = { id: string; invoice_id: string; amount: number; due_on: string; paid_before: number };
export type Payment = { id: string; invoice_id: string; amount: number; received_on: string };
export type Task = {
  id: string; title: string; assignee: Owner; due: string | null; priority: "Normal" | "High";
  client_id: string | null; notes: string; done: boolean; done_at: string | null; created_at: string;
};
export type Activity = {
  id: string; client_id: string; type: ActivityType; text: string; at: string; by: Person; created_at: string;
};

export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];
export type CallLead = {
  id: string; business: string; contact: string; phone: string; notes: string; outcome: LeadOutcome;
  callback_on: string | null; attempts: number; last_called_on: string | null; called_by: Person | null;
  client_id: string | null; created_at: string;
  // from a lead sheet (migration 0004); absent/empty on hand-added leads
  assigned_to?: string; niche?: string; tier?: "" | "A" | "B" | "C"; city?: string; lead_code?: string;
};
export type Expense = { id: string; spent_on: string; amount: number; category: string; note: string };
