"use client";
import { useState } from "react";
import { setMonthlyTarget } from "@/app/actions";
import { ErrorText, MoneyInput, useAct } from "@/components/ui";
import { MONEY_HELP, parseMoney } from "@/lib/format";

export default function TargetForm({ target }: { target: number }) {
  const { act, pending, error, setError } = useAct();
  const [v, setV] = useState(target ? String(target) : "");
  const [saved, setSaved] = useState(false);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSaved(false); const n = v.trim() ? parseMoney(v) : 0; if (n === null) return setError(MONEY_HELP); act(() => setMonthlyTarget(n), () => setSaved(true)); }}>
      <label className="block">
        <span className="label">Monthly revenue target (R)</span>
        <span className="block w-44"><MoneyInput placeholder="e.g. 50 000" value={v} onChange={(x) => { setV(x); setSaved(false); }} /></span>
      </label>
      <button className="btn" disabled={pending}>Save target</button>
      {saved && <span role="status" className="text-sm text-good">Saved</span>}
      <ErrorText error={error} />
    </form>
  );
}
