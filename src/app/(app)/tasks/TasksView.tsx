"use client";
import { useState } from "react";
import { addTask } from "@/app/actions";
import { TaskList } from "@/components/TaskList";
import { ErrorText, Select, useAct } from "@/components/ui";
import { filterTasks, type TaskFilter } from "@/lib/logic";
import { OWNERS, type Client, type Owner, type Person, type Task } from "@/lib/types";

const FILTERS: TaskFilter[] = ["Everyone", "Mine", "Michael", "Trevor"];

export default function TasksView({ me, tasks, clients }: { me: Person; tasks: Task[]; clients: Client[] }) {
  const [filter, setFilter] = useState<TaskFilter>("Everyone");
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<Owner>(me);
  const [due, setDue] = useState("");
  const { act, pending, error } = useAct();
  const shown = filterTasks(tasks, filter, me, showDone);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Tasks</h1>
      <form className="card grid gap-2 p-3 sm:grid-cols-[1fr_9rem_9rem_auto]"
        onSubmit={(e) => { e.preventDefault(); act(() => addTask({ title, assignee, due: due || null }), () => { setTitle(""); setDue(""); }); }}>
        <input className="input" placeholder="Add a task…" aria-label="Task title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={assignee} options={OWNERS} onChange={setAssignee} />
        <input className="input" type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        <button className="btn btn-primary" disabled={pending}>Add</button>
        <div className="sm:col-span-4"><ErrorText error={error} /></div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`btn btn-sm ${filter === f ? "btn-primary" : ""}`}>{f === "Mine" ? `Mine (${me})` : f}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /> Show done
        </label>
      </div>

      <div className="card px-4 py-1"><TaskList tasks={shown} clients={clients} empty="No tasks match." /></div>
    </div>
  );
}
