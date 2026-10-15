"use client";
import { useState } from "react";
import { setPromisedDate } from "@/app/actions";
import { InvoiceModal, PaymentModal } from "@/components/forms";
import { Empty, ErrorText, useAct } from "@/components/ui";
import { fmtDate, fmtRand, todayISO } from "@/lib/format";
import type { Client, Invoice } from "@/lib/types";

export default function MoneyView({ invoices, clients }: { invoices: Invoice[]; clients: Client[] }) {
  const [filter, setFilter] = useState<"outstanding" | "all">("outstanding");
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [adding, setAdding] = useState(false);
  const { act, error } = useAct();
  const today = todayISO();
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const shown = invoices.filter((i) => filter === "all" || i.balance > 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(i.balance, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Money</h1><p className="text-sm text-muted">Outstanding: <b className="text-ink">{fmtRand(outstanding)}</b></p></div>
        <button className="btn btn-primary" disabled={!clients.length} onClick={() => setAdding(true)}>+ Invoice / deposit</button>
      </div>
      <div className="flex gap-2">
        {(["outstanding", "all"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} className={`btn btn-sm capitalize ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <ErrorText error={error} />
      {shown.length === 0 ? <div className="card px-4"><Empty>{filter === "outstanding" ? "Nothing outstanding." : "No invoices yet."}</Empty></div> : (
        <ul className="space-y-3">
          {shown.map((i) => {
            const late = i.balance > 0 && !!i.promised_date && i.promised_date < today;
            return (
              <li key={i.id} className="card p-4" data-testid="invoice-card">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setEditing(i)}>
                    <div className="truncate font-medium">{name(i.client_id)}</div>
                    <div className="text-sm text-muted">{i.label} <span className="chip ml-1">{i.kind}</span></div>
                  </button>
                  <div className="text-right">
                    <div className={`text-lg font-bold tabular-nums ${i.balance > 0 ? "text-bad" : "text-good"}`} data-testid="balance">{i.balance > 0 ? fmtRand(i.balance) : "Paid"}</div>
                    <div className="text-xs text-muted">of {fmtRand(i.amount)}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2 text-xs text-muted">
                  <span>Paid {fmtRand(i.paid)}{i.payment_count > 0 && ` · ${i.payment_count} payment${i.payment_count === 1 ? "" : "s"}`}</span>
                  {i.due && <span>Due {fmtDate(i.due)}</span>}
                  <label className="flex items-center gap-2">
                    <span className={late ? "font-medium text-bad" : ""}>Promised{late ? " (late)" : ""}:</span>
                    <input type="date" className="input !min-h-[32px] !w-auto !px-2 !py-0 !text-xs" defaultValue={i.promised_date ?? ""} key={i.promised_date ?? "none"}
                      onChange={(e) => act(() => setPromisedDate(i.id, e.target.value || null))} />
                  </label>
                  {i.balance > 0 && <button className="btn btn-primary btn-sm ml-auto" onClick={() => setPaying(i)}>Record payment</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {paying && <PaymentModal invoice={paying} clientName={name(paying.client_id)} onClose={() => setPaying(null)} />}
      {editing && <InvoiceModal invoice={editing} clients={clients} onClose={() => setEditing(null)} />}
      {adding && <InvoiceModal clients={clients} onClose={() => setAdding(false)} />}
    </div>
  );
}
