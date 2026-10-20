"use client";
import Link from "next/link";
import { useState } from "react";
import { convertLead, setLeadOutcome } from "@/app/actions";
import { LeadModal, PasteLeadsModal } from "@/components/callforms";
import { Empty, ErrorText, Modal, useAct } from "@/components/ui";
import { fmtDate, todayISO } from "@/lib/format";
import { sortLeads } from "@/lib/logic";
import type { CallLead, LeadOutcome } from "@/lib/types";

// The five results you tick after a call ("Not called" is the starting state / reset).
const RESULTS: { outcome: Exclude<LeadOutcome, "Not called">; label: string }[] = [
  { outcome: "No answer", label: "No answer" },
  { outcome: "Call back later", label: "Call back later" },
  { outcome: "Meeting booked", label: "Meeting booked" },
  { outcome: "Interested", label: "Interested: send quote" },
  { outcome: "Not interested", label: "Not interested" },
];
const tone: Record<LeadOutcome, string> = {
  "Not called": "text-muted", "No answer": "text-warn", "Call back later": "text-accent",
  "Meeting booked": "text-good", Interested: "text-good", "Not interested": "text-bad",
};
type Filter = "todo" | "callbacks" | "done" | "all";

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

function CallbackModal({ lead, onClose }: { lead: CallLead; onClose: () => void }) {
  const { act, pending, error } = useAct();
  const [on, setOn] = useState(addDays(todayISO(), 3));
  return (
    <Modal title="Call back when?" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => setLeadOutcome(lead.id, "Call back later", on), onClose); }}>
        <p className="text-sm text-muted">{lead.business}</p>
        <input className="input" type="date" required aria-label="Call back date" value={on} onChange={(e) => setOn(e.target.value)} />
        <ErrorText error={error} />
        <button className="btn btn-primary w-full" disabled={pending}>Save</button>
      </form>
    </Modal>
  );
}

export default function CallsView({ leads, ready }: { leads: CallLead[]; ready: boolean }) {
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");
  const [pasting, setPasting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CallLead | null>(null);
  const [callback, setCallback] = useState<CallLead | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { act, pending, error } = useAct();

  if (!ready) return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Calls</h1>
      <div className="card p-4 text-sm" role="alert">
        The call list isn’t switched on yet. Run <code>supabase/migrations/0003_calls_expenses.sql</code> in the Supabase SQL Editor, then refresh.
      </div>
    </div>
  );

  const dueCallback = (l: CallLead) => l.outcome === "Call back later" && (!l.callback_on || l.callback_on <= today);
  const isTodo = (l: CallLead) => l.outcome === "Not called" || l.outcome === "No answer" || dueCallback(l);
  const isDone = (l: CallLead) => ["Meeting booked", "Interested", "Not interested"].includes(l.outcome);
  const term = q.trim().toLowerCase();
  const shown = sortLeads(leads, today)
    .filter((l) => filter === "all" ? true : filter === "todo" ? isTodo(l) : filter === "done" ? isDone(l) : l.outcome === "Call back later")
    .filter((l) => !term || [l.business, l.contact, l.phone].some((x) => x.toLowerCase().includes(term)));

  const counts = {
    todo: leads.filter(isTodo).length,
    calledToday: leads.filter((l) => l.last_called_on === today).length,
    meetings: leads.filter((l) => l.outcome === "Meeting booked").length,
    interested: leads.filter((l) => l.outcome === "Interested").length,
  };
  const FILTERS: [Filter, string][] = [["todo", `To call (${counts.todo})`], ["callbacks", "Call-backs"], ["done", "Done"], ["all", `All (${leads.length})`]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Calls</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setAdding(true)}>+ Add</button>
          <button className="btn btn-primary" onClick={() => setPasting(true)}>Paste list</button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Call stats">
        {[["To call", counts.todo], ["Called today", counts.calledToday], ["Meetings booked", counts.meetings], ["Interested", counts.interested]].map(([l, v]) => (
          <div key={l as string} className="card p-3"><div className="text-xs text-muted">{l}</div><div className="mt-1 text-xl font-bold tabular-nums">{v}</div></div>
        ))}
      </section>

      {notice && <p role="status" className="card p-3 text-sm" data-testid="notice">{notice}</p>}
      <ErrorText error={error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" type="search" aria-label="Search the call list" placeholder="Search business, contact, number…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([f, label]) => (
            <button key={f} aria-pressed={filter === f} className={`btn btn-sm ${filter === f ? "btn-primary" : ""}`} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card px-4"><Empty>{leads.length === 0 ? "Your call list is empty. Tap “Paste list” to add your numbers." : filter === "todo" ? "Nobody left to call. 🎉" : "Nothing here."}</Empty></div>
      ) : (
        <ul className="space-y-3">
          {shown.map((l) => (
            <li key={l.id} className="card p-4" data-testid="lead-card">
              <div className="flex items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => setEditing(l)}>
                  <div className="truncate font-medium">{l.business}</div>
                  {l.contact && <div className="truncate text-sm text-muted">{l.contact}</div>}
                </button>
                <div className="shrink-0 text-right text-xs">
                  <div className={`font-medium ${tone[l.outcome]}`} data-testid="lead-status">{l.outcome}</div>
                  {l.outcome === "Call back later" && l.callback_on && <div className={dueCallback(l) ? "font-medium text-bad" : "text-muted"}>{fmtDate(l.callback_on)}</div>}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {l.phone ? <a className="text-accent" href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>{l.phone}</a> : <span className="text-muted">No number</span>}
                {l.attempts > 0 && <span className="text-xs text-muted">Called {l.attempts}× · last {fmtDate(l.last_called_on)}{l.called_by ? ` by ${l.called_by}` : ""}</span>}
              </div>
              {l.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{l.notes}</p>}

              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Result of the call to ${l.business}`}>
                {RESULTS.map((r) => (
                  <button key={r.outcome} disabled={pending} aria-pressed={l.outcome === r.outcome}
                    className={`btn btn-sm ${l.outcome === r.outcome ? "btn-primary" : ""}`}
                    onClick={() => r.outcome === "Call back later" ? setCallback(l) : act(() => setLeadOutcome(l.id, r.outcome))}>
                    {r.label}
                  </button>
                ))}
                {l.outcome !== "Not called" && <button className="btn btn-sm" disabled={pending} onClick={() => act(() => setLeadOutcome(l.id, "Not called"))}>Reset</button>}
              </div>

              {l.client_id ? (
                <p className="mt-2 text-sm"><span className="text-good">Client ✓</span> · <Link className="text-accent" href={`/clients/${l.client_id}`}>open client</Link></p>
              ) : (l.outcome === "Interested" || l.outcome === "Meeting booked") && (
                <div className="mt-2">
                  <button className="btn btn-sm" disabled={pending} onClick={() => act(() => convertLead(l.id), (r) => setNotice(`${l.business} is now a client, with a task to send the quote.`))}>Make client + “send quote” task</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pasting && <PasteLeadsModal onClose={() => setPasting(false)} onDone={(i) => setNotice(i ?? null)} />}
      {adding && <LeadModal onClose={() => setAdding(false)} />}
      {editing && <LeadModal lead={editing} onClose={() => setEditing(null)} />}
      {callback && <CallbackModal lead={callback} onClose={() => setCallback(null)} />}
    </div>
  );
}
