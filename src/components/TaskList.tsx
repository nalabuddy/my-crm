"use client";
import { useState } from "react";
import { setTaskDone } from "@/app/actions";
import { fmtDate, todayISO } from "@/lib/format";
import type { Client, Task } from "@/lib/types";
import { TaskModal } from "./forms";
import { Empty, ErrorText, useAct } from "./ui";

export function TaskList({ tasks, clients, empty = "Nothing here." }: { tasks: Task[]; clients: Client[]; empty?: string }) {
  const { act, error } = useAct();
  const [editing, setEditing] = useState<Task | null>(null);
  const today = todayISO();
  const name = (id: string | null) => clients.find((c) => c.id === id)?.name;
  if (!tasks.length) return <Empty>{empty}</Empty>;
  return (
    <>
      <ErrorText error={error} />
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const late = !t.done && t.due && t.due < today;
          return (
            <li key={t.id} className="flex items-start gap-3 py-2.5" data-testid="task-row">
              <input type="checkbox" aria-label={`Complete ${t.title}`} checked={t.done}
                className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--accent))]"
                onChange={(e) => act(() => setTaskDone(t.id, e.target.checked))} />
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                <div className={`text-sm ${t.done ? "text-muted line-through" : ""}`}>
                  {t.priority === "High" && <span className="mr-1 font-bold text-bad" title="High priority">!</span>}{t.title}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{t.assignee}</span>
                  {t.due && <span className={late ? "font-medium text-bad" : ""}>{late ? "Overdue · " : ""}{fmtDate(t.due)}</span>}
                  {name(t.client_id) && <span>· {name(t.client_id)}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {editing && <TaskModal task={editing} clients={clients} onClose={() => setEditing(null)} />}
    </>
  );
}
