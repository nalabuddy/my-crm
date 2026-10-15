import Link from "next/link";
import { loadAll } from "@/lib/data";
import { fmtDate, fmtRand, todayISO } from "@/lib/format";
import { depositsPending, dueTodayOrLate, goQuiet, isOverdueTask, moneyToChase, openPipelineValue, owedOnInvoices, workload } from "@/lib/logic";
import ChaseLinks from "@/components/ChaseLinks";
import { TaskList } from "@/components/TaskList";
import { Empty } from "@/components/ui";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export default async function Overview() {
  const { me, clients, deals, invoices, tasks, activities } = await loadAll();
  const today = todayISO();
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const due = dueTodayOrLate(tasks, today);
  const chase = moneyToChase(invoices, today);
  const quiet = goQuiet(clients, activities, today);
  const overdue = tasks.filter((t) => isOverdueTask(t, today)).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Hi {me} 👋</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <Stat label="Owed on invoices" value={fmtRand(owedOnInvoices(invoices))} />
        <Stat label="Deposits pending" value={fmtRand(depositsPending(invoices))} />
        <Stat label="Open pipeline" value={fmtRand(openPipelineValue(deals))} />
        <Stat label="Overdue tasks" value={String(overdue)} tone={overdue ? "text-bad" : ""} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="h2">Due today or late</h2>
          <TaskList tasks={due} clients={clients} empty="Nothing due. Nice." />
        </section>

        <section className="card p-4">
          <h2 className="h2">Money to chase</h2>
          {chase.length === 0 ? <Empty>Nothing to chase.</Empty> : (
            <ul className="divide-y divide-line">
              {chase.map((i) => (
                <li key={i.id} className="py-2.5">
                  <Link href="/money" className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{clientName(i.client_id)} · {i.label}</div>
                      <div className="text-xs text-muted">
                        {i.kind} · {i.promised_date ? `Promised ${fmtDate(i.promised_date)} (late)` : "No promised date"}
                      </div>
                    </div>
                    <div className="shrink-0 font-semibold tabular-nums text-bad">{fmtRand(i.balance)}</div>
                  </Link>
                  <ChaseLinks invoice={i} client={clients.find((c) => c.id === i.client_id)} me={me} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="h2">Go quiet check</h2>
          {quiet.length === 0 ? <Empty>Everyone has been contacted recently.</Empty> : (
            <ul className="divide-y divide-line">
              {quiet.map(({ client, last, days }) => (
                <li key={client.id}>
                  <Link href={`/clients/${client.id}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="text-sm">{client.name} <span className="chip ml-1">{client.status}</span></div>
                    <div className="text-xs text-muted">{days} days · last {fmtDate(last)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <h2 className="h2">Workload</h2>
          <ul className="divide-y divide-line">
            {workload(tasks, today).map((w) => (
              <li key={w.person} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{w.person}</span>
                <span className="text-xs text-muted">
                  {w.open} open · <span className={w.overdue ? "text-bad" : ""}>{w.overdue} overdue</span> · {w.high} high
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Tasks assigned to “Both” count for each person.</p>
        </section>
      </div>
    </div>
  );
}
