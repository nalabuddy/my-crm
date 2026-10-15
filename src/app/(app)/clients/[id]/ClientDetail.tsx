"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteActivity } from "@/app/actions";
import ChaseLinks from "@/components/ChaseLinks";
import { ActivityForm, ClientModal, DealModal, InvoiceModal, PaymentList, PaymentModal, TaskModal } from "@/components/forms";
import { TaskList } from "@/components/TaskList";
import { Empty, useAct } from "@/components/ui";
import { fmtDate, fmtRand } from "@/lib/format";
import type { Activity, Client, Deal, Invoice, Payment, Task } from "@/lib/types";

export default function ClientDetail({ client, allClients, deals, invoices, payments, me, tasks, activities }: {
  client: Client; allClients: Client[]; deals: Deal[]; invoices: Invoice[]; payments: Payment[]; me: string; tasks: Task[]; activities: Activity[];
}) {
  const router = useRouter();
  const { act } = useAct();
  const [modal, setModal] = useState<null | "client" | "task" | "deal" | "invoice">(null);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const owed = invoices.reduce((s, i) => s + Math.max(i.balance, 0), 0);
  const close = () => { setModal(null); setEditDeal(null); setEditInv(null); setPaying(null); };

  return (
    <div className="space-y-5">
      <Link href="/clients" className="text-sm text-muted hover:text-accent">← Clients</Link>

      <section className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <div className="mt-1 flex gap-2"><span className="chip">{client.status}</span><span className="chip">{client.source}</span></div>
          </div>
          <button className="btn btn-sm" onClick={() => setModal("client")}>Edit</button>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted">Contact: </dt><dd className="inline">{client.contact || "—"}</dd></div>
          <div><dt className="inline text-muted">Phone: </dt><dd className="inline">{client.phone ? <a className="text-accent" href={`tel:${client.phone}`}>{client.phone}</a> : "—"}</dd></div>
          <div><dt className="inline text-muted">Email: </dt><dd className="inline">{client.email ? <a className="text-accent" href={`mailto:${client.email}`}>{client.email}</a> : "—"}</dd></div>
          <div><dt className="inline text-muted">Added: </dt><dd className="inline">{fmtDate(client.created_at)}</dd></div>
        </dl>
        {client.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{client.notes}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <div className="mb-1 flex items-center justify-between"><h2 className="h2 !mb-0">Money · owes {fmtRand(owed)}</h2>
            <button className="btn btn-sm" onClick={() => setModal("invoice")}>+ Invoice</button></div>
          {invoices.length === 0 ? <Empty>No invoices yet.</Empty> : (
            <ul className="divide-y divide-line">
              {invoices.map((i) => (
                <li key={i.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <button className="min-w-0 text-left" onClick={() => setEditInv(i)}>
                      <div className="truncate text-sm">{i.label} <span className="chip ml-1">{i.kind}</span></div>
                      <div className="text-xs text-muted">{fmtRand(i.amount)} · paid {fmtRand(i.paid)}{i.payment_count > 1 ? ` (${i.payment_count} payments)` : ""}{i.promised_date ? ` · promised ${fmtDate(i.promised_date)}` : ""}</div>
                    </button>
                    {i.balance > 0
                      ? <button className="btn btn-sm shrink-0" onClick={() => setPaying(i)}>{fmtRand(i.balance)} · Pay</button>
                      : <span className="text-xs font-medium text-good">Paid</span>}
                  </div>
                  <ChaseLinks invoice={i} client={client} me={me} className="mt-2" />
                  <PaymentList payments={payments.filter((p) => p.invoice_id === i.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <div className="mb-1 flex items-center justify-between"><h2 className="h2 !mb-0">Deals</h2>
            <button className="btn btn-sm" onClick={() => setModal("deal")}>+ Deal</button></div>
          {deals.length === 0 ? <Empty>No deals yet.</Empty> : (
            <ul className="divide-y divide-line">
              {deals.map((d) => (
                <li key={d.id}><button className="flex w-full items-center justify-between gap-3 py-2.5 text-left" onClick={() => setEditDeal(d)}>
                  <div><div className="text-sm">{d.title}</div><div className="text-xs text-muted">{d.owner}{d.due ? ` · due ${fmtDate(d.due)}` : ""}</div></div>
                  <div className="text-right"><div className="text-sm tabular-nums">{fmtRand(d.value)}</div><span className="chip">{d.stage}</span></div>
                </button></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <div className="mb-1 flex items-center justify-between"><h2 className="h2 !mb-0">Tasks</h2>
            <button className="btn btn-sm" onClick={() => setModal("task")}>+ Task</button></div>
          <TaskList tasks={tasks.filter((t) => !t.done)} clients={allClients} empty="No open tasks." />
        </section>

        <section className="card p-4">
          <h2 className="h2">Contact log</h2>
          <ActivityForm clientId={client.id} />
          {activities.length === 0 ? <Empty>No contact logged yet.</Empty> : (
            <ul className="mt-3 divide-y divide-line">
              {activities.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm"><span className="chip mr-2">{a.type}</span>{fmtDate(a.at)} · {a.by}</div>
                    {a.text && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{a.text}</p>}
                  </div>
                  <button className="btn btn-sm shrink-0" aria-label="Delete log entry" onClick={() => window.confirm("Delete this log entry?") && act(() => deleteActivity(a.id))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {modal === "client" && <ClientModal client={client} onClose={close} onSaved={(id) => !id && router.push("/clients")} />}
      {modal === "task" && <TaskModal clients={allClients} defaultClientId={client.id} onClose={close} />}
      {modal === "deal" && <DealModal clients={allClients} defaultClientId={client.id} onClose={close} />}
      {modal === "invoice" && <InvoiceModal clients={allClients} defaultClientId={client.id} onClose={close} />}
      {editDeal && <DealModal deal={editDeal} clients={allClients} onClose={close} />}
      {editInv && <InvoiceModal invoice={editInv} clients={allClients} onClose={close} />}
      {paying && <PaymentModal invoice={paying} clientName={client.name} onClose={close} />}
    </div>
  );
}
