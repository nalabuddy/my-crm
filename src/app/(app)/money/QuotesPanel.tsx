"use client";
import Link from "next/link";
import { useState } from "react";
import { setQuoteStatus } from "@/app/actions";
import { MakeInvoiceModal } from "@/components/forms";
import { BusinessModal, QuoteModal } from "@/components/quoteforms";
import type { Business } from "@/lib/quotedoc";
import { Empty, ErrorText, useAct } from "@/components/ui";
import { fmtDate, fmtRand } from "@/lib/format";
import type { Client, Deal, Quote } from "@/lib/types";

const tone: Record<Quote["status"], string> = { Draft: "text-muted", Sent: "text-accent", Accepted: "text-good", Declined: "text-bad" };

export default function QuotesPanel({ quotes, clients, deals, ready, business, docsReady }: { quotes: Quote[]; clients: Client[]; deals: Deal[]; ready: boolean; business: Business; docsReady: boolean }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [converting, setConverting] = useState<Quote | null>(null);
  const [settings, setSettings] = useState(false);
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
        <span className="flex gap-2">
          {docsReady && <button className="btn" onClick={() => setSettings(true)}>Quote settings</button>}
          <button className="btn btn-primary" disabled={!clients.length} onClick={() => setAdding(true)}>+ Quote</button>
        </span>
      </div>
      {!docsReady && <p className="card p-3 text-sm" role="alert">Printable quotes need <code>supabase/migrations/0006_quote_documents.sql</code> run in Supabase. Until then quotes work as before.</p>}
      {docsReady && !business.name && <p className="card p-3 text-sm" data-testid="settings-hint">Tap <b>Quote settings</b> first and fill in your business and banking details. They are printed on every quote.</p>}
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
                  <div className="text-sm text-muted">{q.label}{q.number ? <span className="chip ml-1">{q.number}</span> : null}</div>
                </button>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums">{fmtRand(q.amount)}</div>
                  <div className={`text-xs font-medium ${tone[q.status]}`} data-testid="quote-status">{q.invoiced ? "Invoiced ✓" : q.status}{q.sent_on && !q.invoiced ? ` · ${fmtDate(q.sent_on)}` : ""}</div>
                </div>
              </div>
              {(docsReady || !q.invoiced) && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {docsReady && <Link className="btn btn-sm" href={`/quote/${q.id}`} data-testid="quote-view">View / PDF</Link>}
                  {!q.invoiced && q.status === "Draft" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Sent"))}>Mark sent</button>}
                  {!q.invoiced && q.status === "Sent" && <button className="btn btn-sm btn-danger" onClick={() => act(() => setQuoteStatus(q.id, "Declined"))}>Declined</button>}
                  {!q.invoiced && q.status === "Sent" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Accepted"))}>Accepted</button>}
                  {!q.invoiced && q.status === "Declined" && <button className="btn btn-sm" onClick={() => act(() => setQuoteStatus(q.id, "Draft"))}>Reopen</button>}
                  {!q.invoiced && q.status !== "Declined" && <button className="btn btn-primary btn-sm" onClick={() => setConverting(q)}>Make invoice</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <QuoteModal clients={clients} deals={deals} business={business} docsReady={docsReady} earlier={quotes} onClose={() => setAdding(false)} />}
      {editing && <QuoteModal quote={editing} clients={clients} deals={deals} business={business} docsReady={docsReady} onClose={() => setEditing(null)} />}
      {settings && <BusinessModal business={business} onClose={() => setSettings(false)} />}
      {converting && <MakeInvoiceModal quote={converting} clientName={name(converting.client_id)} onClose={() => setConverting(null)} />}
    </div>
  );
}
