"use client";
import { useMemo, useState } from "react";
import { addExpense, addLeads, deleteExpense, deleteLead, updateExpense, updateLead } from "@/app/actions";
import { MONEY_HELP, parseMoney, todayISO } from "@/lib/format";
import { parseCallList } from "@/lib/logic";
import type { CallLead, Expense } from "@/lib/types";
import { ConfirmButton, ErrorText, Field, Modal, MoneyInput, useAct } from "./ui";

export const EXPENSE_CATEGORIES = ["Hosting", "Software", "Marketing", "Fuel / travel", "Airtime / data", "Equipment", "Fees", "Salaries", "General"];

export function ExpenseModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [f, setF] = useState({ spent_on: expense?.spent_on ?? todayISO(), amount: String(expense?.amount ?? ""), category: expense?.category ?? "General", note: expense?.note ?? "" });
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));
  const payload = { ...f, amount: parseMoney(f.amount) ?? 0 };
  return (
    <Modal title={expense ? "Edit expense" : "Add expense"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const amt = parseMoney(f.amount); if (amt === null || amt <= 0) return setError(MONEY_HELP); act(() => expense ? updateExpense(expense.id, payload) : addExpense(payload), onClose); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (R)"><MoneyInput required value={f.amount} onChange={(v) => set("amount", v)} /></Field>
          <Field label="Date"><input className="input" required type="date" value={f.spent_on} onChange={(e) => set("spent_on", e.target.value)} /></Field>
        </div>
        <Field label="Category">
          <input className="input" required list="expense-cats" value={f.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="expense-cats">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Note"><input className="input" placeholder="What was it for?" value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {expense ? <ConfirmButton label="Delete" confirm="Delete this expense?" onConfirm={() => act(() => deleteExpense(expense.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function LeadModal({ lead, onClose, onSaved }: { lead?: CallLead; onClose: () => void; onSaved?: (info?: string) => void }) {
  const { act, pending, error } = useAct();
  const [f, setF] = useState({ business: lead?.business ?? "", contact: lead?.contact ?? "", phone: lead?.phone ?? "", notes: lead?.notes ?? "" });
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={lead ? "Edit lead" : "Add a business to call"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => lead ? updateLead(lead.id, f) : addLeads([f]), (r) => { onSaved?.(r.info); onClose(); }); }}>
        <Field label="Business"><input className="input" required value={f.business} onChange={(e) => set("business", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Contact person"><input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        </div>
        <Field label="Notes"><textarea className="input py-2" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {lead ? <ConfirmButton label="Delete" confirm={`Remove ${lead.business} from the list?`} onConfirm={() => act(() => deleteLead(lead.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function PasteLeadsModal({ onClose, onDone }: { onClose: () => void; onDone: (info?: string) => void }) {
  const { act, pending, error } = useAct();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseCallList(text), [text]);
  return (
    <Modal title="Paste your call list" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => addLeads(parsed), (r) => { onDone(r.info); onClose(); }); }}>
        <p className="text-sm text-muted">One business per line. Separate the name, contact and number with a comma, tab or dash. The number can be anywhere on the line. Numbers already on the list are skipped.</p>
        <textarea className="input py-2 font-mono text-xs" rows={8} aria-label="Call list" placeholder={"Acme Plumbing, Sipho, 082 123 4567\nBlue Dental - 011 555 0102\nGreen Garden Services 071 222 3333"} value={text} onChange={(e) => setText(e.target.value)} />
        {parsed.length > 0 && (
          <div className="rounded-lg border border-line p-3 text-sm" data-testid="paste-preview">
            <b>{parsed.length}</b> {parsed.length === 1 ? "business" : "businesses"} found
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {parsed.slice(0, 4).map((p, i) => <li key={i} className="truncate">{p.business}{p.contact ? ` · ${p.contact}` : ""}{p.phone ? ` · ${p.phone}` : " · no number"}</li>)}
              {parsed.length > 4 && <li>…and {parsed.length - 4} more</li>}
            </ul>
          </div>
        )}
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending || parsed.length === 0}>{pending ? "Adding…" : `Add ${parsed.length || ""} to the list`}</button>
      </form>
    </Modal>
  );
}
