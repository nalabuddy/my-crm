"use client";
import { useState } from "react";
import { setQuoteStatus } from "@/app/actions";
import { MakeInvoiceModal, QuoteModal } from "@/components/forms";
import { Empty, ErrorText, useAct } from "@/components/ui";
import { fmtDate, fmtRand } from "@/lib/format";
import type { Client, Deal, Quote } from "@/lib/types";

const tone: Record<Quote["status"], string> = { Draft: "text-muted", Sent: "text-accent", Accepted: "text-good", Declined: "text-bad" };

export default function QuotesPanel({ quotes, clients, deals, ready }: { quotes: Quote[]; clients: Client[]; deals: Deal[]; ready: boolean }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [converting, setConverting] = useState<Quote | null>(null);
  const { act, error } = useAct();
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const shown = quotes.filter((q) => filter === "all" || (q.status !== "Declined" && !q.invoiced));
  const openValue = quotes.filter((q) => (q.status === "Draft" || q.status === "Sent") && !q.invoiced).reduce((s, q) => s + Number(q.amount), 0);

  if (!ready) return (
    <div className="card p-4 text-sm" role="alert">
      Quotes aren’t switched on yet. Run <code>supabase/migrations/0002_quotes.sql</code> in the Supabase SQL Editor, then refresh.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Waiting for an answer: <b className="text-ink" data-testid="open-quotes">{fmtRand(openValue)}</b></p>
        <button className="btn btn-primary" disabled={!clients.length} onClick={() => setAdding(true)}>+ Quote</button>
      </div>
      <div className="flex gap-2">
        {(["open", "all"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} className={`btn btn-sm capitalize ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <ErrorText error={error} />
      {shown.length === 0 ? <div className="card px-4"><Empty>{filter === "open" ? "No open quotes." : "No quotes yet."}</Empty></div> : (
        <ul className="space-y-3">
          {shown.map((q) => (
            <li key={q.id} className="card p-4" data-testid="quote-card">
              <div className="flex items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => setEditing(q)}>
                  <div className="truncate font-medium">{name(q.client_id)}</div>
                  <div className="text-sm text-muted">{q.label}</div>
                </button>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">{fmtRand(q.amount)}</div>
                  <div className={`text-xs font-medium ${tone[q.status]}`} data-testid="quote-status">{q.invoiced ? "Invoiced ✓" : q.status}{q.sent_on && !q.invoiced ? ` · ${fmtDate(q.sent_on)}` : ""}</div>
                </div>
              </div>
              {!q.invoiced && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {q.status === "Draft" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Sent"))}>Mark sent</button>}
                  {q.status === "Sent" && <button className="btn btn-sm btn-danger" onClick={() => act(() => setQuoteStatus(q.id, "Declined"))}>Declined</button>}
                  {q.status === "Sent" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Accepted"))}>Accepted</button>}
                  {q.status === "Declined" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Draft"))}>Reopen</button>}
                  {q.status !== "Declined" && <button className="btn btn-primary btn-sm" onClick={() => setConverting(q)}>Make invoice</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <QuoteModal clients={clients} deals={deals} onClose={() => setAdding(false)} />}
      {editing && <QuoteModal quote={editing} clients={clients} deals={deals} onClose={() => setEditing(null)} />}
      {converting && <MakeInvoiceModal quote={converting} clientName={name(converting.client_id)} onClose={() => setConverting(null)} />}
    </div>
  );
}
