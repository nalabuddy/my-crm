"use client";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import type { Result } from "@/app/actions";

/** Run a server action, surface its error, optionally run a callback on success. */
export function useAct() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function act(fn: () => Promise<Result>, onOk?: (r: Result) => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error); else onOk?.(r);
    });
  }
  return { act, pending, error, setError };
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-4 sm:max-w-lg sm:rounded-b-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

export function Select<T extends string>({ value, onChange, options, name }: { value: T; onChange: (v: T) => void; options: readonly T[]; name?: string }) {
  return (
    <select name={name} className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-sm text-bad">{error}</p> : null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-1 py-3 text-sm text-muted">{children}</p>;
}

export function ConfirmButton({ label, confirm, onConfirm, className = "btn btn-danger btn-sm" }: { label: string; confirm: string; onConfirm: () => void; className?: string }) {
  return <button type="button" className={className} onClick={() => window.confirm(confirm) && onConfirm()}>{label}</button>;
}

/** Amount box that accepts how people actually type money ("10 500", "R10,500", "10500.50"). */
export function MoneyInput({ value, onChange, label, required, placeholder = "e.g. 10 500", id }: {
  value: string; onChange: (v: string) => void; label?: string; required?: boolean; placeholder?: string; id?: string;
}) {
  return <input id={id} className="input" type="text" inputMode="decimal" autoComplete="off" aria-label={label}
    required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
}
