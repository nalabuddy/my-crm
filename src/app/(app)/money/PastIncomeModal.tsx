"use client";
import { useState } from "react";
import { addPastIncome } from "@/app/actions";
import { ErrorText, Field, Modal, MoneyInput, useAct } from "@/components/ui";
import { fmtRand, MONEY_HELP, parseMoney, todayISO } from "@/lib/format";
import type { Client } from "@/lib/types";

type Row = { month: string; amount: string; note: string; client_id: string };
const blank = (month: string): Row => ({ month, amount: "", note: "", client_id: "" });

/** Log income you already received, one row per amount, each booked to the month you pick. */
export default function PastIncomeModal({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const thisMonth = todayISO().slice(0, 7);
  const [rows, setRows] = useState<Row[]>([blank(thisMonth)]);
  const set = (i: number, k: keyof Row, v: string) => setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const parsed = rows.map((r) => parseMoney(r.amount));
  const total = parsed.reduce<number>((s, n) => s + (n ?? 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = parsed.findIndex((n) => n === null || n <= 0);
    if (bad >= 0) return setError(`Row ${bad + 1}: ${MONEY_HELP}`);
    act(() => addPastIncome({ rows: rows.map((r, i) => ({ month: r.month, amount: parsed[i] as number, note: r.note, client_id: r.client_id || null })) }), onClose);
  }

  return (
    <Modal title="Add past income" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted">One row per payment you received. Pick the month it belongs to and it lands in that month on the chart.</p>
        {rows.map((r, i) => (
          <fieldset key={i} className="space-y-2 rounded-lg border border-line p-3" data-testid="past-row">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Month"><input className="input" required type="month" max={thisMonth} value={r.month} onChange={(e) => set(i, "month", e.target.value)} /></Field>
              <Field label="Amount (R)"><MoneyInput required value={r.amount} onChange={(v) => set(i, "amount", v)} /></Field>
            </div>
            <Field label="What was it for? (optional)"><input className="input" placeholder="e.g. Mohammed website" value={r.note} onChange={(e) => set(i, "note", e.target.value)} /></Field>
            <Field label="Client (optional)">
              <select className="input" value={r.client_id} onChange={(e) => set(i, "client_id", e.target.value)}>
                <option value="">Not tied to a client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {rows.length > 1 && <button type="button" className="btn btn-sm" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>Remove this row</button>}
          </fieldset>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setRows((p) => [...p, blank(p[p.length - 1]?.month ?? thisMonth)])}>+ Add another row</button>
        <p className="text-sm text-muted">Total <b className="text-ink">{fmtRand(total)}</b></p>
        <ErrorText error={error} />
        <div className="flex justify-end"><button className="btn btn-primary" disabled={pending}>Save</button></div>
      </form>
    </Modal>
  );
}
