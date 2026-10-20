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
  const [f, setF] = useState({
    business: lead?.business ?? "", contact: lead?.contact ?? "", phone: lead?.phone ?? "", notes: lead?.notes ?? "",
    assigned_to: lead?.assigned_to ?? "", niche: lead?.niche ?? "", tier: lead?.tier ?? "", city: lead?.city ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={lead ? "Edit lead" : "Add a business to call"} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => lead ? updateLead(lead.id, { ...f, lead_code: lead.lead_code ?? "" }) : addLeads([f]), (r) => { onSaved?.(r.info); onClose(); }); }}>
        <Field label="Business"><input className="input" required value={f.business} onChange={(e) => set("business", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Contact person"><input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Niche"><input className="input" value={f.niche} onChange={(e) => set("niche", e.target.value)} /></Field>
          <Field label="Tier"><select className="input" value={f.tier} onChange={(e) => set("tier", e.target.value)}><option value="">—</option><option>A</option><option>B</option><option>C</option></select></Field>
          <Field label="Allocated to"><input className="input" value={f.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} /></Field>
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
  const [leaveOut, setLeaveOut] = useState<Set<string>>(new Set());
  const [keepAllocation, setKeepAllocation] = useState(true);
  const parsed = useMemo(() => parseCallList(text), [text]);

  // who the pasted leads are allocated to, with counts, so whole callers can be left out
  const people = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parsed) if (p.assigned_to) m.set(p.assigned_to, (m.get(p.assigned_to) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [parsed]);
  const chosen = useMemo(
    () => parsed.filter((p) => !(p.assigned_to && leaveOut.has(p.assigned_to))).map((p) => (keepAllocation ? p : { ...p, assigned_to: "" })),
    [parsed, leaveOut, keepAllocation]);
  const left = parsed.length - chosen.length;
  const toggle = (name: string) => setLeaveOut((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const sheet = parsed.some((p) => p.lead_code || p.niche || p.tier);

  return (
    <Modal title="Paste your call list" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => addLeads(chosen), (r) => { onDone(r.info); onClose(); }); }}>
        <p className="text-sm text-muted">Paste rows straight from your lead sheet (select the rows in Google Sheets, copy, paste here), or type one business per line. Numbers already on the list are skipped.</p>
        <textarea className="input py-2 font-mono text-xs" rows={7} aria-label="Call list" placeholder={"Acme Plumbing, Sipho, 082 123 4567\nBlue Dental - 011 555 0102\nGreen Garden Services 071 222 3333"} value={text} onChange={(e) => setText(e.target.value)} />
        {parsed.length > 0 && (
          <div className="space-y-3 rounded-lg border border-line p-3 text-sm" data-testid="paste-preview">
            <div>
              <b>{chosen.length}</b> {chosen.length === 1 ? "business" : "businesses"} found{sheet ? " (lead sheet detected)" : ""}
              {left > 0 && <span className="text-muted"> · {left} left out</span>}
            </div>
            {people.length > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="label">Leave out the leads allocated to…</legend>
                {people.map(([name, n]) => (
                  <label key={name} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={leaveOut.has(name)} onChange={() => toggle(name)} />
                    <span>{name} <span className="text-muted">({n} leads)</span></span>
                  </label>
                ))}
                <label className="mt-2 flex items-center gap-2 border-t border-line pt-2">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={keepAllocation} onChange={(e) => setKeepAllocation(e.target.checked)} />
                  <span>Keep who each lead was allocated to (shows as a label you can filter by)</span>
                </label>
              </fieldset>
            )}
            <ul className="space-y-0.5 text-xs text-muted">
              {chosen.slice(0, 4).map((p, i) => <li key={i} className="truncate">{p.business}{p.tier ? ` · Tier ${p.tier}` : ""}{p.city ? ` · ${p.city}` : ""}{p.phone ? ` · ${p.phone}` : " · no number"}</li>)}
              {chosen.length > 4 && <li>…and {chosen.length - 4} more</li>}
            </ul>
          </div>
        )}
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending || chosen.length === 0}>{pending ? "Adding… (a big list takes a moment)" : `Add ${chosen.length || ""} to the list`}</button>
      </form>
    </Modal>
  );
}
