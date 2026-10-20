"use client";
import { useState } from "react";
import {
  addActivity, addClient, addDeal, addInvoice, addTask, deleteClient, deleteDeal, deleteInvoice,
  deleteTask, deletePayment, deleteQuote, addQuote, convertQuote, updateQuote, recordPayment, updateClient, updateDeal, updateInvoice, updatePayment, updateTask,
} from "@/app/actions";
import { MONEY_HELP, parseMoney, todayISO, fmtDate, fmtRand } from "@/lib/format";
import {
  ACTIVITY_TYPES, INVOICE_KINDS, OWNERS, PRIORITIES, QUOTE_STATUSES, SOURCES, STAGES, STATUSES,
  type Client, type Deal, type Invoice, type Payment, type Quote, type Task,
} from "@/lib/types";
import { ConfirmButton, ErrorText, Field, Modal, MoneyInput, Select, useAct } from "./ui";

const clientOptions = (clients: Client[]) => (
  <>
    <option value="">— none —</option>
    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
  </>
);

export function ClientModal({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (id?: string) => void }) {
  const { act, pending, error } = useAct();
  const [f, setF] = useState({
    name: client?.name ?? "", status: client?.status ?? "Lead", contact: client?.contact ?? "",
    phone: client?.phone ?? "", email: client?.email ?? "", source: client?.source ?? "Other", notes: client?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={client ? "Edit client" : "Add client"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => client ? updateClient(client.id, f) : addClient(f), (r) => { onSaved?.(r.id); onClose(); }); }}>
        <Field label="Business / client name"><input className="input" required value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><Select value={f.status} options={STATUSES} onChange={(v) => set("status", v)} /></Field>
          <Field label="Source"><Select value={f.source} options={SOURCES} onChange={(v) => set("source", v)} /></Field>
        </div>
        <Field label="Contact person"><input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><textarea className="input py-2" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {client ? <ConfirmButton label="Delete" confirm={`Delete ${client.name} and all their deals, invoices and contact log?`} onConfirm={() => act(() => deleteClient(client.id), () => { onSaved?.(); onClose(); })} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function TaskModal({ task, clients, defaultClientId, onClose }: { task?: Task; clients: Client[]; defaultClientId?: string; onClose: () => void }) {
  const { act, pending, error } = useAct();
  const [f, setF] = useState({
    title: task?.title ?? "", assignee: task?.assignee ?? "Both", due: task?.due ?? "",
    priority: task?.priority ?? "Normal", client_id: task?.client_id ?? defaultClientId ?? "", notes: task?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const payload = { ...f, due: f.due || null, client_id: f.client_id || null };
  return (
    <Modal title={task ? "Edit task" : "Add task"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => task ? updateTask(task.id, payload) : addTask(payload), onClose); }}>
        <Field label="Task"><input className="input" required value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee"><Select value={f.assignee} options={OWNERS} onChange={(v) => set("assignee", v)} /></Field>
          <Field label="Due"><input className="input" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
          <Field label="Priority"><Select value={f.priority} options={PRIORITIES} onChange={(v) => set("priority", v)} /></Field>
          <Field label="Client"><select className="input" value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>{clientOptions(clients)}</select></Field>
        </div>
        <Field label="Notes"><textarea className="input py-2" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {task ? <ConfirmButton label="Delete" confirm="Delete this task?" onConfirm={() => act(() => deleteTask(task.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function DealModal({ deal, clients, defaultClientId, onClose }: { deal?: Deal; clients: Client[]; defaultClientId?: string; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [f, setF] = useState({
    title: deal?.title ?? "", client_id: deal?.client_id ?? defaultClientId ?? "", value: String(deal?.value ?? ""),
    stage: deal?.stage ?? "Lead", owner: deal?.owner ?? "Both", due: deal?.due ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const payload = { ...f, value: parseMoney(f.value || "0") ?? 0, due: f.due || null, client_id: f.client_id || null };
  return (
    <Modal title={deal ? "Edit deal" : "Add deal"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.value.trim() && parseMoney(f.value) === null) return setError(MONEY_HELP); act(() => deal ? updateDeal(deal.id, payload) : addDeal(payload), onClose); }}>
        <Field label="Deal"><input className="input" required value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client"><select className="input" value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>{clientOptions(clients)}</select></Field>
          <Field label="Value (R)"><MoneyInput value={f.value} onChange={(v) => set("value", v)} /></Field>
          <Field label="Stage"><Select value={f.stage} options={STAGES} onChange={(v) => set("stage", v)} /></Field>
          <Field label="Owner"><Select value={f.owner} options={OWNERS} onChange={(v) => set("owner", v)} /></Field>
          <Field label="Due"><input className="input" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        </div>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {deal ? <ConfirmButton label="Delete" confirm="Delete this deal?" onConfirm={() => act(() => deleteDeal(deal.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function InvoiceModal({ invoice, clients, defaultClientId, onClose }: { invoice?: Invoice; clients: Client[]; defaultClientId?: string; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [f, setF] = useState({
    client_id: invoice?.client_id ?? defaultClientId ?? clients[0]?.id ?? "", label: invoice?.label ?? "",
    kind: invoice?.kind ?? "Invoice", amount: invoice ? String(invoice.amount) : "", due: invoice?.due ?? "",
    promised_date: invoice?.promised_date ?? "", notes: invoice?.notes ?? "",
  });
  // New invoices can start part- or fully-paid: "already paid" and "still owed" follow each other.
  const [paid, setPaid] = useState("");
  const [owedText, setOwedText] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(todayISO());
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const total = parseMoney(f.amount);
  const paidN = paid.trim() ? parseMoney(paid) : 0;
  const owedAuto = total !== null && paidN !== null ? String(Math.round((total - paidN) * 100) / 100) : "";
  const owedShown = owedText ?? owedAuto;
  const setOwed = (v: string) => {
    setOwedText(v);
    const o = parseMoney(v);
    if (total !== null && o !== null) setPaid(String(Math.max(0, Math.round((total - o) * 100) / 100)));
  };
  return (
    <Modal title={invoice ? "Edit invoice" : "Add invoice / deposit"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (total === null || total <= 0) return setError(MONEY_HELP);
        if (!invoice && paidN === null) return setError("Already paid: " + MONEY_HELP);
        if (!invoice && (paidN ?? 0) > total) return setError("Already paid can’t be more than the total.");
        const base = { ...f, amount: total, due: f.due || null, promised_date: f.promised_date || null };
        act(() => invoice ? updateInvoice(invoice.id, base) : addInvoice({ ...base, paid: paidN ?? 0, paid_on: paidOn }), onClose);
      }}>
        <Field label="Client"><select className="input" required value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Label"><input className="input" required value={f.label} onChange={(e) => set("label", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.kind} options={INVOICE_KINDS} onChange={(v) => set("kind", v)} /></Field>
          <Field label="Total amount (R)"><MoneyInput required value={f.amount} onChange={(v) => { set("amount", v); setOwedText(null); }} /></Field>
          {!invoice && <>
            <Field label="Already paid (R)"><MoneyInput value={paid} placeholder="0" onChange={(v) => { setPaid(v); setOwedText(null); }} /></Field>
            <Field label="Still owed (R)"><MoneyInput value={owedShown} placeholder="" onChange={setOwed} /></Field>
            {(paidN ?? 0) > 0 && <Field label="Paid on"><input className="input" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>}
          </>}
          <Field label="Due"><input className="input" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
          <Field label="Promised payment date"><input className="input" type="date" value={f.promised_date} onChange={(e) => set("promised_date", e.target.value)} /></Field>
        </div>
        {invoice && (
          <p className="rounded-lg border border-line p-3 text-sm" data-testid="invoice-paid-summary">
            Paid so far <b>{fmtRand(invoice.paid)}</b> · still owed <b>{fmtRand(invoice.balance)}</b>. To add or fix a payment use <b>Record payment</b> on the invoice.
          </p>
        )}
        {!invoice && total !== null && paidN !== null && (
          <p className="text-sm text-muted" data-testid="invoice-owed-preview">Total {fmtRand(total)} · paid {fmtRand(paidN)} · <b className="text-ink">still owed {fmtRand(Math.max(total - paidN, 0))}</b></p>
        )}
        <Field label="Notes"><textarea className="input py-2" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {invoice ? <ConfirmButton label="Delete" confirm="Delete this invoice and its payments?" onConfirm={() => act(() => deleteInvoice(invoice.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentModal({ invoice, clientName, onClose }: { invoice: Invoice; clientName?: string; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [amount, setAmount] = useState(String(invoice.balance));
  const [on, setOn] = useState(todayISO());
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const amt = parseMoney(amount); if (amt === null || amt <= 0) return setError(MONEY_HELP); act(() => recordPayment({ invoice_id: invoice.id, amount: amt, received_on: on }), onClose); }}>
        <p className="text-sm text-muted">{clientName ? `${clientName} · ` : ""}{invoice.label} · balance <b className="text-ink">{fmtRand(invoice.balance)}</b> of {fmtRand(invoice.amount)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received (R)"><MoneyInput required value={amount} onChange={setAmount} /></Field>
          <Field label="Received on"><input className="input" required type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </div>
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Record payment"}</button>
      </form>
    </Modal>
  );
}

export function ActivityForm({ clientId }: { clientId: string }) {
  const { act, pending, error } = useAct();
  const [type, setType] = useState<(typeof ACTIVITY_TYPES)[number]>("Call");
  const [text, setText] = useState("");
  const [at, setAt] = useState(todayISO());
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(() => addActivity({ client_id: clientId, type, text, at }), () => setText("")); }}>
      <div className="grid grid-cols-2 gap-2"><Select value={type} options={ACTIVITY_TYPES} onChange={setType} />
        <input className="input" type="date" required value={at} onChange={(e) => setAt(e.target.value)} aria-label="Date" /></div>
      <textarea className="input py-2" rows={2} placeholder="What was said / agreed?" value={text} onChange={(e) => setText(e.target.value)} />
      <ErrorText error={error} />
      <button className="btn btn-primary w-full" disabled={pending}>Log contact</button>
    </form>
  );
}

/** Payments received against one invoice, each editable or removable (fixes a mistyped amount or date). */
export function PaymentList({ payments }: { payments: Payment[] }) {
  const { act, error } = useAct();
  const [editing, setEditing] = useState<Payment | null>(null);
  if (!payments.length) return null;
  return (
    <details className="mt-2 text-xs" data-testid="payment-list">
      <summary className="cursor-pointer text-muted">Payments ({payments.length})</summary>
      <ul className="mt-1 divide-y divide-line">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-1.5" data-testid="payment-row">
            <span>{fmtDate(p.received_on)} · <b className="tabular-nums">{fmtRand(p.amount)}</b></span>
            <span className="flex gap-1">
              <button className="btn btn-sm" onClick={() => setEditing(p)}>Edit</button>
              <ConfirmButton label="Delete" confirm={`Delete this ${fmtRand(p.amount)} payment?`} onConfirm={() => act(() => deletePayment(p.id))} />
            </span>
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
      {editing && <PaymentEditModal payment={editing} onClose={() => setEditing(null)} />}
    </details>
  );
}

function PaymentEditModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [amount, setAmount] = useState(String(payment.amount));
  const [on, setOn] = useState(payment.received_on);
  return (
    <Modal title="Edit payment" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const amt = parseMoney(amount); if (amt === null || amt <= 0) return setError(MONEY_HELP); act(() => updatePayment(payment.id, { amount: amt, received_on: on }), onClose); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (R)"><MoneyInput required value={amount} onChange={setAmount} /></Field>
          <Field label="Received on"><input className="input" required type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </div>
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save payment"}</button>
      </form>
    </Modal>
  );
}

export function QuoteModal({ quote, clients, deals, onClose }: { quote?: Quote; clients: Client[]; deals: Deal[]; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [f, setF] = useState({
    client_id: quote?.client_id ?? clients[0]?.id ?? "", deal_id: quote?.deal_id ?? "", label: quote?.label ?? "",
    amount: String(quote?.amount ?? ""), status: quote?.status ?? "Draft", sent_on: quote?.sent_on ?? "", notes: quote?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const clientDeals = deals.filter((d) => d.client_id === f.client_id);
  const payload = { ...f, amount: parseMoney(f.amount) ?? 0, deal_id: f.deal_id || null, sent_on: f.sent_on || null };
  return (
    <Modal title={quote ? "Edit quote" : "Add quote"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const amt = parseMoney(f.amount); if (amt === null || amt <= 0) return setError(MONEY_HELP); act(() => quote ? updateQuote(quote.id, payload) : addQuote(payload), onClose); }}>
        <Field label="Client"><select className="input" required value={f.client_id} onChange={(e) => setF((p) => ({ ...p, client_id: e.target.value, deal_id: "" }))}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="What is it for?"><input className="input" required placeholder="e.g. 5-page website" value={f.label} onChange={(e) => set("label", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quoted amount (R)"><MoneyInput required value={f.amount} onChange={(v) => set("amount", v)} /></Field>
          <Field label="Status"><Select value={f.status} options={QUOTE_STATUSES} onChange={(v) => set("status", v)} /></Field>
          <Field label="Sent on"><input className="input" type="date" value={f.sent_on} onChange={(e) => set("sent_on", e.target.value)} /></Field>
          <Field label="Linked deal"><select className="input" value={f.deal_id} onChange={(e) => set("deal_id", e.target.value)}><option value="">— none —</option>{clientDeals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        </div>
        <Field label="Notes"><textarea className="input py-2" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {quote ? <ConfirmButton label="Delete" confirm="Delete this quote?" onConfirm={() => act(() => deleteQuote(quote.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** Turn an accepted quote into one invoice, or a deposit invoice plus a final invoice. */
export function MakeInvoiceModal({ quote, clientName, onClose }: { quote: Quote; clientName: string; onClose: () => void }) {
  const { act, pending, error } = useAct();
  const [choice, setChoice] = useState<"0" | "30" | "50" | "custom">("0");
  const [custom, setCustom] = useState("40");
  const pct = choice === "custom" ? Number(custom) : Number(choice);
  const valid = Number.isFinite(pct) && pct >= 0 && pct <= 99;
  const dep = valid && pct > 0 ? Math.round(quote.amount * pct) / 100 : 0;
  return (
    <Modal title="Make invoice from quote" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => convertQuote(quote.id, pct), onClose); }}>
        <p className="text-sm text-muted">{clientName} · {quote.label} · <b className="text-ink">{fmtRand(quote.amount)}</b></p>
        <fieldset className="space-y-2">
          <legend className="label">Deposit up front?</legend>
          {([["0", "No deposit: one invoice"], ["30", "30% deposit"], ["50", "50% deposit"], ["custom", "Other %"]] as const).map(([v, text]) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="radio" name="dep" checked={choice === v} onChange={() => setChoice(v)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> {text}
            </label>
          ))}
          {choice === "custom" && <input className="input !w-28" type="number" min="1" max="99" aria-label="Deposit percent" value={custom} onChange={(e) => setCustom(e.target.value)} />}
        </fieldset>
        <p className="rounded-lg border border-line p-3 text-sm" data-testid="invoice-preview">
          {!valid ? "Enter a deposit between 1 and 99." : dep > 0
            ? <>Creates a <b>deposit of {fmtRand(dep)}</b> and a <b>final invoice of {fmtRand(quote.amount - dep)}</b>.</>
            : <>Creates <b>one invoice of {fmtRand(quote.amount)}</b>.</>}
          {quote.deal_id && " The linked deal moves forward in the pipeline."}
        </p>
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending || !valid}>{pending ? "Creating…" : "Create invoice"}</button>
      </form>
    </Modal>
  );
}
