import { fmtRand, todayISO } from "@/lib/format";
import { monthlyReceived } from "@/lib/logic";
import type { Payment } from "@/lib/types";

/** Money actually received (payments), month by month. */
export default function RevenuePanel({ payments }: { payments: Payment[] }) {
  const months = monthlyReceived(payments, todayISO(), 12);
  const max = Math.max(...months.map((m) => m.total), 1);
  const total = months.reduce((s, m) => s + m.total, 0);
  const [thisMonth, lastMonth] = months;
  return (
    <div className="space-y-4" data-testid="revenue">
      <div className="grid grid-cols-3 gap-3">
        {[["This month", thisMonth.total], ["Last month", lastMonth.total], ["Last 12 months", total]].map(([label, v]) => (
          <div key={label as string} className="card p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-base font-bold tabular-nums sm:text-xl" data-testid={`rev-${(label as string).toLowerCase().replace(/\s+/g, "-")}`}>{fmtRand(v as number)}</div>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <h2 className="h2">Money received per month</h2>
        <ul className="space-y-2">
          {months.map((m) => (
            <li key={m.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm" data-testid="rev-row">
              <span className="text-muted">{m.label}</span>
              <span className="h-3 rounded-full bg-line" aria-hidden>
                <span className="block h-3 rounded-full bg-accent" style={{ width: `${(m.total / max) * 100}%` }} />
              </span>
              <span className="min-w-[5.5rem] text-right tabular-nums">{fmtRand(m.total)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Counts payments by the date you recorded them as received, not when the invoice was made.</p>
      </div>
    </div>
  );
}
