"use client";
import { useState } from "react";
import { clearPaymentPlan, savePaymentPlan } from "@/app/actions";
import { ConfirmButton, ErrorText, Field, Modal, MoneyInput, useAct } from "@/components/ui";
import { fmtRand, MONEY_HELP, parseMoney, todayISO } from "@/lib/format";
import { addMonths, splitPlan, type PlanLine } from "@/lib/logic";
import type { Invoice } from "@/lib/types";

type Row = { due_on: string; amount: string };
const toRows = (r: { due_on: string; amount: number }[]): Row[] => r.map((x) => ({ due_on: x.due_on, amount: String(x.amount) }));

/** Say when the rest of an invoice will be paid: equal monthly payments to start from, every date and amount can be changed. */
export default function PlanModal({ invoice, clientName, current, onClose }: { invoice: Invoice; clientName: string; current: PlanLine[]; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const owing = Number(invoice.balance);
  const unpaid = current.filter((l) => l.owed > 0);
  const [count, setCount] = useState("3");
  const [first, setFirst] = useState(unpaid[0]?.due_on ?? addMonths(todayISO(), 1));
  const [rows, setRows] = useState<Row[]>(unpaid.length ? toRows(unpaid.map((l) => ({ due_on: l.due_on, amount: l.owed }))) : toRows(splitPlan(owing, 3, addMonths(todayISO(), 1))));
  const amounts = rows.map((r) => parseMoney(r.amount));
  const sum = amounts.reduce<number>((s, n) => s + (n ?? 0), 0);
  const left = Math.round((owing - sum) * 100) / 100;
  const set = (i: number, k: keyof Row, v: string) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  function fill() {
    const n = Math.floor(Number(count));
    if (!(n >= 1 && n <= 36)) return setError("Number of payments must be between 1 and 36.");
    setError(null);
    setRows(toRows(splitPlan(owing, n, first)));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = amounts.findIndex((n) => n === null || n <= 0);
    if (bad >= 0) return setError(`Payment ${bad + 1}: ${MONEY_HELP}`);
    if (left < -0.005) return setError(`That adds up to ${fmtRand(sum)} but only ${fmtRand(owing)} is still owed.`);
    act(() => savePaymentPlan({ invoice_id: invoice.id, rows: rows.map((r, i) => ({ due_on: r.due_on, amount: amounts[i] as number })) }), onClose);
  }

  return (
    <Modal title="Payment plan" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted">{clientName} · {invoice.label}. Still owed <b className="text-ink">{fmtRand(owing)}</b>.</p>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
          <Field label="Split into"><input className="input !w-20" type="number" min={1} max={36} value={count} onChange={(e) => setCount(e.target.value)} /></Field>
          <Field label="First payment on"><input className="input !w-auto" type="date" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <button type="button" className="btn btn-sm" onClick={fill}>Make equal monthly payments</button>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" data-testid="plan-row">
            <Field label={`Payment ${i + 1} date`}><input className="input" required type="date" value={r.due_on} onChange={(e) => set(i, "due_on", e.target.value)} /></Field>
            <Field label={`Payment ${i + 1} amount (R)`}><MoneyInput required value={r.amount} onChange={(v) => set(i, "amount", v)} /></Field>
            <button type="button" className="btn btn-sm" aria-label={`Remove payment ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setRows((p) => [...p, { due_on: addMonths(p[p.length - 1]?.due_on ?? todayISO(), 1), amount: left > 0 ? String(left) : "" }])}>+ Add a payment</button>
        <p className="text-sm text-muted" data-testid="plan-total">Planned {fmtRand(sum)} · {left >= 0 ? `not scheduled yet ${fmtRand(left)}` : <span className="text-bad">over by {fmtRand(-left)}</span>}</p>
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {current.length ? <ConfirmButton label="Remove plan" confirm="Remove this payment plan? Payments already received stay." onConfirm={() => act(() => clearPaymentPlan(invoice.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save plan</button>
        </div>
      </form>
    </Modal>
  );
}
