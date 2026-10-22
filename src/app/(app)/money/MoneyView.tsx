"use client";
import { useState } from "react";
import { setPromisedDate } from "@/app/actions";
import ChaseLinks from "@/components/ChaseLinks";
import { InvoiceModal, PaymentList, PaymentModal } from "@/components/forms";
import { Empty, ErrorText, useAct } from "@/components/ui";
import { fmtDate, fmtRand, todayISO } from "@/lib/format";
import { planLines } from "@/lib/logic";
import type { Business } from "@/lib/quotedoc";
import type { Client, Deal, Expense, Installment, Invoice, Payment, Quote } from "@/lib/types";
import PlanModal from "./PlanModal";
import ExpensesPanel from "./ExpensesPanel";
import QuotesPanel from "./QuotesPanel";
import RevenuePanel from "./RevenuePanel";

export default function MoneyView({ invoices, clients, payments, me, quotes, deals, quotesReady, expenses, target, extrasReady, installments, plansReady, business, docsReady }: { invoices: Invoice[]; clients: Client[]; payments: Payment[]; me: string; quotes: Quote[]; deals: Deal[]; quotesReady: boolean; expenses: Expense[]; target: number; extrasReady: boolean; installments: Installment[]; plansReady: boolean; business: Business; docsReady: boolean }) {
  const [tab, setTab] = useState<"invoices" | "quotes" | "expenses" | "revenue">("invoices");
  const [filter, setFilter] = useState<"outstanding" | "all">("outstanding");
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [planning, setPlanning] = useState<Invoice | null>(null);
  const [adding, setAdding] = useState(false);
  const { act, error } = useAct();
  const today = todayISO();
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const shown = invoices.filter((i) => filter === "all" || i.balance > 0);
  const outstanding = invoices.reduce((s, i) => s + Math.max(i.balance, 0), 0);

  const tabs = [["invoices", "Invoices"], ["quotes", "Quotes"], ["expenses", "Expenses"], ["revenue", "Revenue"]] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Money</h1><p className="text-sm text-muted">Outstanding: <b className="text-ink">{fmtRand(outstanding)}</b></p></div>
        {tab === "invoices" && <button className="btn btn-primary" disabled={!clients.length} onClick={() => setAdding(true)}>+ Invoice / deposit</button>}
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`btn btn-sm ${tab === k ? "btn-primary" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === "quotes" && <QuotesPanel quotes={quotes} clients={clients} deals={deals} ready={quotesReady} business={business} docsReady={docsReady} />}
      {tab === "expenses" && <ExpensesPanel expenses={expenses} ready={extrasReady} />}
      {tab === "revenue" && <RevenuePanel payments={payments} expenses={expenses} deals={deals} target={target} extrasReady={extrasReady} clients={clients} installments={installments} invoices={invoices} />}
      {tab === "invoices" && (<>
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
            const plan = planLines(installments.filter((x) => x.invoice_id === i.id), i.paid, today);
            const next = plan.find((l) => l.owed > 0);
            return (
              <li key={i.id} className="card p-4" data-testid="invoice-card">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => setEditing(i)}>
                    <div className="truncate font-medium">{name(i.client_id)}</div>
                    <div className="text-sm text-muted">{i.label} <span className="chip ml-1">{i.kind}</span></div>
                  </button>
                  <div className="text-right">
                    <div className={`text-lg font-bold tabular-nums ${i.balance > 0 ? "text-bad" : "text-good"}`} data-testid="balance">{i.balance > 0 ? fmtRand(i.balance) : "Paid"}</div>
                    <div className="text-xs text-muted">{i.balance > 0 ? "outstanding of" : "total"} {fmtRand(i.amount)}</div>
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
                  {i.balance > 0 && (
                    <span className="ml-auto inline-flex gap-2">
                      <ChaseLinks invoice={i} client={clients.find((c) => c.id === i.client_id)} me={me} />
                      {plansReady && <button className="btn btn-sm" onClick={() => setPlanning(i)}>{plan.length ? "Edit plan" : "Payment plan"}</button>}
                      <button className="btn btn-primary btn-sm" onClick={() => setPaying(i)}>Record payment</button>
                    </span>
                  )}
                </div>
                {plan.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm" data-testid="plan-lines" aria-label="Payment plan">
                    {plan.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3" data-testid="plan-line">
                        <span className={l.state === "Overdue" ? "font-medium text-bad" : "text-muted"}>{fmtDate(l.due_on)}</span>
                        <span className="tabular-nums">{fmtRand(l.state === "Paid" ? l.amount : l.owed)}</span>
                        <span className={`chip ${l.state === "Overdue" ? "text-bad" : l.state === "Paid" ? "text-good" : ""}`}>{l.state}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <PaymentList payments={payments.filter((p) => p.invoice_id === i.id)} />
              </li>
            );
          })}
        </ul>
      )}
      {planning && <PlanModal invoice={planning} clientName={name(planning.client_id)} current={planLines(installments.filter((x) => x.invoice_id === planning.id), planning.paid, today)} onClose={() => setPlanning(null)} />}
      {paying && <PaymentModal invoice={paying} clientName={name(paying.client_id)} onClose={() => setPaying(null)} />}
      {editing && <InvoiceModal invoice={editing} clients={clients} onClose={() => setEditing(null)} />}
      {adding && <InvoiceModal clients={clients} onClose={() => setAdding(false)} />}
      </>)}
    </div>
  );
}
