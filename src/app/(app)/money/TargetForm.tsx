"use client";
import { useState } from "react";
import { setMonthlyTarget } from "@/app/actions";
import { ErrorText, useAct } from "@/components/ui";

export default function TargetForm({ target }: { target: number }) {
  const { act, pending, error } = useAct();
  const [v, setV] = useState(target ? String(target) : "");
  const [saved, setSaved] = useState(false);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSaved(false); act(() => setMonthlyTarget(v || 0), () => setSaved(true)); }}>
      <label className="block">
        <span className="label">Monthly revenue target (R)</span>
        <input className="input !w-44" type="number" inputMode="decimal" min="0" step="1" placeholder="e.g. 50000" value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} />
      </label>
      <button className="btn" disabled={pending}>Save target</button>
      {saved && <span role="status" className="text-sm text-good">Saved</span>}
      <ErrorText error={error} />
    </form>
  );
}
