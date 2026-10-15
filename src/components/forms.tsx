"use client";
import { useState } from "react";
import {
  addActivity, addClient, addDeal, addInvoice, addTask, deleteClient, deleteDeal, deleteInvoice,
  deleteTask, deletePayment, recordPayment, updateClient, updateDeal, updateInvoice, updatePayment, updateTask,
} from "@/app/actions";
import { todayISO, fmtDate, fmtRand } from "@/lib/format";
import {
  ACTIVITY_TYPES, INVOICE_KINDS, OWNERS, PRIORITIES, SOURCES, STAGES, STATUSES,
  type Client, type Deal, type Invoice, type Payment, type Task,
} from "@/lib/types";
import { ConfirmButton, ErrorText, Field, Modal, Select, useAct } from "./ui";

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
  const { act, pending, error } = useAct();
  const [f, setF] = useState({
    title: deal?.title ?? "", client_id: deal?.client_id ?? defaultClientId ?? "", value: String(deal?.value ?? ""),
    stage: deal?.stage ?? "Lead", owner: deal?.owner ?? "Both", due: deal?.due ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const payload = { ...f, value: Number(f.value || 0), due: f.due || null, client_id: f.client_id || null };
  return (
    <Modal title={deal ? "Edit deal" : "Add deal"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => deal ? updateDeal(deal.id, payload) : addDeal(payload), onClose); }}>
        <Field label="Deal"><input className="input" required value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client"><select className="input" value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>{clientOptions(clients)}</select></Field>
          <Field label="Value (R)"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={f.value} onChange={(e) => set("value", e.target.value)} /></Field>
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
  const { act, pending, error } = useAct();
  const [f, setF] = useState({
    client_id: invoice?.client_id ?? defaultClientId ?? clients[0]?.id ?? "", label: invoice?.label ?? "",
    kind: invoice?.kind ?? "Invoice", amount: String(invoice?.amount ?? ""), due: invoice?.due ?? "",
    promised_date: invoice?.promised_date ?? "", notes: invoice?.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const payload = { ...f, amount: Number(f.amount), due: f.due || null, promised_date: f.promised_date || null };
  return (
    <Modal title={invoice ? "Edit invoice" : "Add invoice / deposit"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => invoice ? updateInvoice(invoice.id, payload) : addInvoice(payload), onClose); }}>
        <Field label="Client"><select className="input" required value={f.client_id} onChange={(e) => set("client_id", e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Label"><input className="input" required value={f.label} onChange={(e) => set("label", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.kind} options={INVOICE_KINDS} onChange={(v) => set("kind", v)} /></Field>
          <Field label="Amount (R)"><input className="input" required type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
          <Field label="Due"><input className="input" type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
          <Field label="Promised payment date"><input className="input" type="date" value={f.promised_date} onChange={(e) => set("promised_date", e.target.value)} /></Field>
        </div>
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
  const { act, pending, error } = useAct();
  const [amount, setAmount] = useState(String(invoice.balance));
  const [on, setOn] = useState(todayISO());
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => recordPayment({ invoice_id: invoice.id, amount, received_on: on }), onClose); }}>
        <p className="text-sm text-muted">{clientName ? `${clientName} · ` : ""}{invoice.label} · balance <b className="text-ink">{fmtRand(invoice.balance)}</b> of {fmtRand(invoice.amount)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received (R)"><input className="input" required type="number" inputMode="decimal" min="0.01" step="0.01" max={invoice.balance} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
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
  const { act, pending, error } = useAct();
  const [amount, setAmount] = useState(String(payment.amount));
  const [on, setOn] = useState(payment.received_on);
  return (
    <Modal title="Edit payment" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => updatePayment(payment.id, { amount, received_on: on }), onClose); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (R)"><input className="input" required type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Received on"><input className="input" required type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        </div>
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save payment"}</button>
      </form>
    </Modal>
  );
}
