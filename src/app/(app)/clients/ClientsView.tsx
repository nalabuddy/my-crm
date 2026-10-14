"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientModal } from "@/components/forms";
import { Empty } from "@/components/ui";
import { fmtRand } from "@/lib/format";
import { STATUSES, type Client, type Status } from "@/lib/types";

export default function ClientsView({ clients, owed }: { clients: Client[]; owed: Record<string, number> }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "All">("All");
  const [adding, setAdding] = useState(false);
  const term = q.trim().toLowerCase();
  const shown = clients.filter((c) =>
    (status === "All" || c.status === status) &&
    (!term || [c.name, c.contact, c.email, c.phone].some((x) => x.toLowerCase().includes(term))));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Clients</h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add client</button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input" type="search" placeholder="Search name, contact, phone, email…" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2">
          {(["All", ...STATUSES] as const).map((s) => (
            <button key={s} aria-pressed={status === s} className={`btn btn-sm ${status === s ? "btn-primary" : ""}`} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="card px-4 py-1">
        {shown.length === 0 ? <Empty>No clients found.</Empty> : (
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 py-3" data-testid="client-row">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted">{[c.contact, c.phone].filter(Boolean).join(" · ") || c.source}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {owed[c.id] > 0 && <span className="text-sm tabular-nums text-bad">{fmtRand(owed[c.id])}</span>}
                    <span className="chip">{c.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {adding && <ClientModal onClose={() => setAdding(false)} onSaved={(id) => id && router.push(`/clients/${id}`)} />}
    </div>
  );
}
