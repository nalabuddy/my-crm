"use client";
import { useState } from "react";
import { ExpenseModal } from "@/components/callforms";
import { Empty } from "@/components/ui";
import { fmtDate, fmtRand, todayISO } from "@/lib/format";
import type { Expense } from "@/lib/types";

export default function ExpensesPanel({ expenses, ready }: { expenses: Expense[]; ready: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  if (!ready) return (
    <div className="card p-4 text-sm" role="alert">
      Expenses aren’t switched on yet. Run <code>supabase/migrations/0003_calls_expenses.sql</code> in the Supabase SQL Editor, then refresh.
    </div>
  );
  const month = todayISO().slice(0, 7);
  const thisMonth = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((s, e) => s + Number(e.amount), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Spent this month: <b className="text-ink" data-testid="expenses-month">{fmtRand(thisMonth)}</b></p>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Expense</button>
      </div>
      {expenses.length === 0 ? <div className="card px-4"><Empty>No expenses yet. Add your costs so the profit bars are real.</Empty></div> : (
        <ul className="card divide-y divide-line px-4">
          {expenses.map((e) => (
            <li key={e.id} data-testid="expense-row">
              <button className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setEditing(e)}>
                <div className="min-w-0">
                  <div className="truncate text-sm">{e.category}{e.note ? <span className="text-muted"> · {e.note}</span> : null}</div>
                  <div className="text-xs text-muted">{fmtDate(e.spent_on)}</div>
                </div>
                <div className="shrink-0 font-semibold tabular-nums">{fmtRand(e.amount)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <ExpenseModal onClose={() => setAdding(false)} />}
      {editing && <ExpenseModal expense={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
