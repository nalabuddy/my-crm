"use client";
import { useEffect, useRef } from "react";
import { fmtRand, todayISO } from "@/lib/format";
import { chartData } from "@/lib/logic";
import type { Deal, Expense, Payment } from "@/lib/types";
import TargetForm from "./TargetForm";

const short = (v: number) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : String(Math.round(v)));

/** Scrolls sideways so the current month is in the middle when the chart opens (phones show only ~6 of the 12 months). */
function ScrollBox({ focus, children }: { focus: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = Math.max(0, el.scrollWidth * focus - el.clientWidth / 2);
  }, [focus]);
  return <div ref={ref} className="overflow-x-auto" data-testid="rev-scroll">{children}</div>;
}

/** Money received, profit (received − expenses) and projected revenue (open deals) per month, with your monthly target. */
export default function RevenuePanel({ payments, expenses, deals, target, extrasReady }: {
  payments: Payment[]; expenses: Expense[]; deals: Deal[]; target: number; extrasReady: boolean;
}) {
  const { months, undated, later } = chartData({ payments, expenses, deals, target, today: todayISO() });
  const cur = months.find((m) => m.current)!;
  const projectedTotal = months.reduce((s, m) => s + m.projected, 0) + later + undated;

  // chart geometry
  const W = 680, H = 250, L = 46, R = 8, T = 12, B = 30;
  const gw = (W - L - R) / months.length, bw = Math.min(15, (gw - 8) / 3);
  const hi = Math.max(...months.flatMap((m) => [m.received, m.projected, m.target, m.profit]), 1);
  const lo = Math.min(0, ...months.map((m) => m.profit));
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const y0 = y(0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);
  const bar = (x: number, v: number, fill: string, title: string, opacity = 1) => {
    const top = Math.min(y(v), y0), h = Math.max(Math.abs(y(v) - y0), v === 0 ? 0 : 1);
    return <rect x={x} y={top} width={bw} height={h} rx={2} fill={fill} opacity={opacity}><title>{title}</title></rect>;
  };

  return (
    <div className="space-y-4" data-testid="revenue">
      {!extrasReady && <p className="card p-3 text-sm" role="alert">Profit and the target need <code>supabase/migrations/0003_calls_expenses.sql</code> run in Supabase. Until then profit equals money received.</p>}
      <div className="grid grid-cols-3 gap-3">
        {[["Received this month", cur.received, "rev-this-month"], ["Profit this month", cur.profit, "profit-this-month"], ["Projected (open deals)", projectedTotal, "projected-total"]].map(([label, v, id]) => (
          <div key={label as string} className="card p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-base font-bold tabular-nums sm:text-xl" data-testid={id as string}>{fmtRand(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="h2">Revenue, profit and projected</h2>
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--accent))" }} />Received</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--violet))" }} />Profit</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--warn))", opacity: 0.75 }} />Projected</span>
          {target > 0 && <span><i className="mr-1 inline-block h-0 w-4 border-t-2 border-dashed align-middle" style={{ borderColor: "rgb(var(--ink))" }} />Target {fmtRand(target)}</span>}
        </div>
        <p className="mb-1 text-xs text-muted sm:hidden">Swipe sideways to see all 12 months →</p>
        <ScrollBox focus={(L + (months.findIndex((m) => m.current) + 0.5) * gw) / W}>
          <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[620px] w-full" role="img" aria-label="Bar chart of money received, profit and projected revenue by month" data-testid="rev-chart">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth={1} />
                <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--muted))">{short(t)}</text>
              </g>
            ))}
            {lo < 0 && <line x1={L} x2={W - R} y1={y0} y2={y0} stroke="rgb(var(--muted))" strokeWidth={1} />}
            {months.map((m, i) => {
              const x0 = L + i * gw + (gw - (3 * bw + 4)) / 2;
              return (
                <g key={m.key} data-testid="rev-month">
                  {m.current && <rect x={L + i * gw} y={T} width={gw} height={H - T - B} fill="rgb(var(--accent))" opacity={0.07} />}
                  {!m.future && bar(x0, m.received, "rgb(var(--accent))", `${m.label} received ${fmtRand(m.received)}`)}
                  {!m.future && bar(x0 + bw + 2, m.profit, "rgb(var(--violet))", `${m.label} profit ${fmtRand(m.profit)} (received ${fmtRand(m.received)} − expenses ${fmtRand(m.expenses)})`)}
                  {(m.current || m.future) && bar(x0 + 2 * (bw + 2), m.projected, "rgb(var(--warn))", `${m.label} projected ${fmtRand(m.projected)}`, 0.75)}
                  <text x={L + i * gw + gw / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))" fontWeight={m.current ? 700 : 400}>{m.label}</text>
                </g>
              );
            })}
            {target > 0 && <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="rgb(var(--ink))" strokeWidth={1.5} strokeDasharray="5 4"><title>Monthly target {fmtRand(target)}</title></line>}
          </svg>
        </ScrollBox>
        <p className="mt-2 text-xs text-muted">
          Received and profit use the dates you record on payments and expenses. Projected is open deals (not yet Paid) in the month each deal is due; overdue deals count in this month.
          {undated > 0 && <> {fmtRand(undated)} of open deals have no due date and {later > 0 ? `${fmtRand(later)} are due after this chart` : "are not shown"}.</>}
          {undated === 0 && later > 0 && <> {fmtRand(later)} of open deals are due after this chart.</>}
        </p>
      </div>

      <div className="card p-4"><TargetForm target={target} /></div>

      <div className="card overflow-x-auto p-4">
        <table className="w-full min-w-[520px] text-sm" data-testid="rev-table">
          <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Month</th><th className="pb-2 text-right font-medium">Received</th><th className="pb-2 text-right font-medium">Expenses</th><th className="pb-2 text-right font-medium">Profit</th><th className="pb-2 text-right font-medium">Projected</th></tr></thead>
          <tbody className="divide-y divide-line tabular-nums">
            {months.map((m) => (
              <tr key={m.key} data-testid="rev-row" className={m.current ? "font-semibold" : ""}>
                <td className="py-1.5">{m.label}</td>
                <td className="py-1.5 text-right">{m.future ? "—" : fmtRand(m.received)}</td>
                <td className="py-1.5 text-right">{m.future ? "—" : fmtRand(m.expenses)}</td>
                <td className={`py-1.5 text-right ${m.profit < 0 ? "text-bad" : ""}`}>{m.future ? "—" : fmtRand(m.profit)}</td>
                <td className="py-1.5 text-right">{m.current || m.future ? fmtRand(m.projected) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
