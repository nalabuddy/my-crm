"use client";
import { useState } from "react";
import { moveDeal } from "@/app/actions";
import { DealModal } from "@/components/forms";
import { ErrorText, useAct } from "@/components/ui";
import { fmtDate, fmtRand } from "@/lib/format";
import { nextStage } from "@/lib/logic";
import { STAGES, type Client, type Deal } from "@/lib/types";

export default function PipelineView({ deals, clients }: { deals: Deal[]; clients: Client[] }) {
  const { act, pending, error } = useAct();
  const [editing, setEditing] = useState<Deal | null>(null);
  const [adding, setAdding] = useState(false);
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pipeline</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add deal</button>
      </div>
      <ErrorText error={error} />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3">
        {STAGES.map((stage) => {
          const col = deals.filter((d) => d.stage === stage);
          const total = col.reduce((s, d) => s + Number(d.value), 0);
          return (
            <section key={stage} aria-label={stage} className="w-64 shrink-0 snap-start" data-testid={`col-${stage}`}>
              <div className="mb-2 px-1">
                <div className="flex items-center justify-between text-sm font-semibold"><span>{stage}</span><span className="chip">{col.length}</span></div>
                <div className="text-xs tabular-nums text-muted">{fmtRand(total)}</div>
              </div>
              <div className="space-y-2">
                {col.map((d) => {
                  const prev = nextStage(d.stage, -1), next = nextStage(d.stage, 1);
                  return (
                    <div key={d.id} className="card p-3" data-testid="deal-card">
                      <button className="w-full text-left" onClick={() => setEditing(d)}>
                        <div className="text-sm font-medium">{d.title}</div>
                        <div className="text-xs text-muted">{name(d.client_id) ?? "No client"} · {d.owner}</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">{fmtRand(d.value)}</div>
                        {d.due && <div className="text-xs text-muted">Due {fmtDate(d.due)}</div>}
                      </button>
                      <div className="mt-2 flex justify-between">
                        <button className="btn btn-sm" disabled={!prev || pending} aria-label={`Move ${d.title} back to ${prev}`} onClick={() => prev && act(() => moveDeal(d.id, prev))}>←</button>
                        <button className="btn btn-sm" disabled={!next || pending} aria-label={`Move ${d.title} forward to ${next}`} onClick={() => next && act(() => moveDeal(d.id, next))}>→</button>
                      </div>
                    </div>
                  );
                })}
                {col.length === 0 && <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">Empty</div>}
              </div>
            </section>
          );
        })}
      </div>
      {adding && <DealModal clients={clients} onClose={() => setAdding(false)} />}
      {editing && <DealModal deal={editing} clients={clients} onClose={() => setEditing(null)} />}
    </div>
  );
}
