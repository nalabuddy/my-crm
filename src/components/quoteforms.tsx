"use client";
import { useState } from "react";
import { addQuote, deleteQuote, saveBusiness, updateQuote } from "@/app/actions";
import { fmtRand, MONEY_HELP, parseMoney } from "@/lib/format";
import { fromLines, readDoc, toLines, type Business, type QuoteDoc } from "@/lib/quotedoc";
import { QUOTE_STATUSES, type Client, type Deal, type Quote } from "@/lib/types";
import { ConfirmButton, ErrorText, Field, Modal, MoneyInput, Select, useAct } from "./ui";

type OptRow = { name: string; price: string; note: string };
const Lines = ({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) => (
  <Field label={label}><textarea className="input py-2" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />{hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}</Field>
);

/** Add or edit a quote, including the wording that is printed on the quote document. */
export function QuoteModal({ quote, clients, deals, business, docsReady, onClose }: {
  quote?: Quote; clients: Client[]; deals: Deal[]; business: Business; docsReady: boolean; onClose: () => void;
}) {
  const { act, pending, error, setError } = useAct();
  const d0: QuoteDoc = quote ? readDoc(quote.doc) : business.defaults;
  const [f, setF] = useState({
    client_id: quote?.client_id ?? clients[0]?.id ?? "", deal_id: quote?.deal_id ?? "", label: quote?.label ?? "",
    amount: String(quote?.amount ?? ""), status: quote?.status ?? "Draft", sent_on: quote?.sent_on ?? "", notes: quote?.notes ?? "",
  });
  const [project, setProject] = useState(d0.project);
  const [included, setIncluded] = useState(fromLines(d0.included));
  const [notIncluded, setNotIncluded] = useState(fromLines(d0.not_included));
  const [needs, setNeeds] = useState(fromLines(d0.needs));
  const [extras, setExtras] = useState(fromLines(d0.extras));
  const [terms, setTerms] = useState(fromLines(d0.terms));
  const [timeline, setTimeline] = useState(d0.timeline);
  const [validDays, setValidDays] = useState(String(d0.valid_days));
  const [opts, setOpts] = useState<OptRow[]>(d0.options.map((o) => ({ name: o.name, price: String(o.price), note: o.note })));
  const [chosen, setChosen] = useState(d0.chosen);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const setOpt = (i: number, k: keyof OptRow, v: string) => setOpts((p) => p.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  const clientDeals = deals.filter((d) => d.client_id === f.client_id);
  const optPrices = opts.map((o) => parseMoney(o.price));
  const hasOpts = docsReady && opts.length > 0;
  const chosenPrice = hasOpts ? optPrices[Math.min(chosen, opts.length - 1)] : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = hasOpts ? chosenPrice : parseMoney(f.amount);
    if (amt === null || amt <= 0) return setError(hasOpts ? `Option ${Math.min(chosen, opts.length - 1) + 1}: ${MONEY_HELP}` : MONEY_HELP);
    const badOpt = optPrices.findIndex((n, i) => opts[i].name.trim() && (n === null || n <= 0));
    if (badOpt >= 0) return setError(`Option ${badOpt + 1}: ${MONEY_HELP}`);
    const kept = opts.map((o, i) => ({ ...o, i })).filter((o) => o.name.trim());
    const payload = {
      ...f, amount: amt, deal_id: f.deal_id || null, sent_on: f.sent_on || null,
      ...(docsReady ? { doc: {
        project, included: toLines(included), not_included: toLines(notIncluded), needs: toLines(needs), extras: toLines(extras), terms: toLines(terms),
        timeline, valid_days: Number(validDays) || 14,
        options: kept.map((o) => ({ name: o.name.trim(), price: optPrices[o.i] ?? 0, note: o.note.trim() })),
        chosen: Math.max(0, kept.findIndex((o) => o.i === chosen)),
      } } : {}),
    };
    act(() => quote ? updateQuote(quote.id, payload) : addQuote(payload), onClose);
  }

  return (
    <Modal title={quote ? "Edit quote" : "Add quote"} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {quote?.number && <p className="text-sm text-muted">Quote number <b className="text-ink">{quote.number}</b></p>}
        <Field label="Client"><select className="input" required value={f.client_id} onChange={(e) => setF((p) => ({ ...p, client_id: e.target.value, deal_id: "" }))}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="What is it for?"><input className="input" required placeholder="e.g. 5-page website" value={f.label} onChange={(e) => set("label", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quoted amount (R)">
            {hasOpts ? <input className="input" readOnly aria-label="Quoted amount (R)" value={chosenPrice === null ? "" : fmtRand(chosenPrice)} /> : <MoneyInput required value={f.amount} onChange={(v) => set("amount", v)} />}
          </Field>
          <Field label="Status"><Select value={f.status} options={QUOTE_STATUSES} onChange={(v) => set("status", v)} /></Field>
          <Field label="Sent on"><input className="input" type="date" value={f.sent_on} onChange={(e) => set("sent_on", e.target.value)} /></Field>
          <Field label="Linked deal"><select className="input" value={f.deal_id} onChange={(e) => set("deal_id", e.target.value)}><option value="">— none —</option>{clientDeals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
        </div>
        <Field label="Notes (only you see these)"><textarea className="input py-2" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>

        {docsReady && (
          <details className="rounded-lg border border-line p-3" open={!quote}>
            <summary className="cursor-pointer text-sm font-semibold">What the printed quote says</summary>
            <div className="mt-3 space-y-3">
              <Field label="Project"><textarea className="input py-2" rows={2} placeholder="One or two sentences about what you will build" value={project} onChange={(e) => setProject(e.target.value)} /></Field>
              <Lines label="What’s included" value={included} onChange={setIncluded} hint="One item per line." />
              <Lines label="Not included" value={notIncluded} onChange={setNotIncluded} rows={3} />
              <Lines label="What we need from you" value={needs} onChange={setNeeds} rows={3} />
              <fieldset className="space-y-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-medium text-muted">Prices: add more than one for options like A and B</legend>
                {opts.map((o, i) => (
                  <div key={i} className="space-y-2 border-b border-line pb-2 last:border-0 last:pb-0" data-testid="option-row">
                    <div className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                      <Field label={`Option ${i + 1} name`}><input className="input" placeholder="e.g. Option A" value={o.name} onChange={(e) => setOpt(i, "name", e.target.value)} /></Field>
                      <Field label={`Option ${i + 1} price (R)`}><MoneyInput value={o.price} onChange={(v) => setOpt(i, "price", v)} /></Field>
                      <button type="button" className="btn btn-sm" aria-label={`Remove option ${i + 1}`} onClick={() => { setOpts((p) => p.filter((_, j) => j !== i)); setChosen((c) => (c >= i && c > 0 ? c - 1 : c)); }}>✕</button>
                    </div>
                    <input className="input" aria-label={`Option ${i + 1} note`} placeholder="Small print under the price (optional)" value={o.note} onChange={(e) => setOpt(i, "note", e.target.value)} />
                    {opts.length > 1 && <label className="flex items-center gap-2 text-xs text-muted"><input type="radio" name="chosen" checked={chosen === i} onChange={() => setChosen(i)} /> This is the price the invoice will use</label>}
                  </div>
                ))}
                <button type="button" className="btn btn-sm" onClick={() => setOpts((p) => [...p, { name: p.length ? `Option ${String.fromCharCode(65 + p.length)}` : "", price: "", note: "" }])}>+ Add a price option</button>
                {opts.length === 0 && <p className="text-xs text-muted">Leave empty to print just the quoted amount above.</p>}
              </fieldset>
              <Lines label="Extras under the price" value={extras} onChange={setExtras} rows={3} hint="e.g. Domain registration at cost, optional monthly care plan." />
              <Lines label="Payment terms" value={terms} onChange={setTerms} rows={3} />
              <Field label="Timeline"><textarea className="input py-2" rows={2} value={timeline} onChange={(e) => setTimeline(e.target.value)} /></Field>
              <Field label="Valid for (days)"><input className="input !w-24" type="number" min={1} max={365} value={validDays} onChange={(e) => setValidDays(e.target.value)} /></Field>
            </div>
          </details>
        )}
        <ErrorText error={error} />
        <div className="flex justify-between gap-2">
          {quote ? <ConfirmButton label="Delete" confirm="Delete this quote?" onConfirm={() => act(() => deleteQuote(quote.id), onClose)} /> : <span />}
          <button className="btn btn-primary" disabled={pending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** Your company details and the standard wording, filled in once and used on every quote. */
export function BusinessModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const { act, pending, error, setError } = useAct();
  const [b, setB] = useState({ ...business, next_number: String(business.next_number) });
  const set = (k: keyof typeof b, v: string) => setB((p) => ({ ...p, [k]: v }));
  const d = business.defaults;
  const [included, setIncluded] = useState(fromLines(d.included));
  const [notIncluded, setNotIncluded] = useState(fromLines(d.not_included));
  const [needs, setNeeds] = useState(fromLines(d.needs));
  const [extras, setExtras] = useState(fromLines(d.extras));
  const [terms, setTerms] = useState(fromLines(d.terms));
  const [timeline, setTimeline] = useState(d.timeline);
  const [validDays, setValidDays] = useState(String(d.valid_days));
  const txt = (label: string, k: keyof typeof b, ph = "") => <Field label={label}><input className="input" placeholder={ph} value={String(b[k])} onChange={(e) => set(k, e.target.value)} /></Field>;

  return (
    <Modal title="Quote settings" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const n = Number(b.next_number);
        if (!Number.isInteger(n) || n < 1) return setError("Next quote number must be a whole number.");
        const { defaults: _d, ...rest } = b; void _d;
        act(() => saveBusiness({
          ...rest, next_number: n,
          defaults: { ...business.defaults, project: "", options: [], chosen: 0, included: toLines(included), not_included: toLines(notIncluded), needs: toLines(needs), extras: toLines(extras), terms: toLines(terms), timeline, valid_days: Number(validDays) || 14 },
        }), onClose);
      }}>
        <p className="text-sm text-muted">Printed at the top and bottom of every quote. Kept in your database, not in the app’s code.</p>
        {txt("Business name", "name", "NEXT LEVEL WEB SOLUTIONS")}
        {txt("Under the name", "subtitle", "Website Build — Quotation")}
        {txt("Company line", "legal_line", "Your (Pty) Ltd t/a trading name")}
        {txt("Registration number", "reg_no")}
        {txt("Contact line", "contact_line", "Name | email | phone")}
        {txt("Address", "address")}
        {txt("VAT line", "vat_note", "VAT: Not registered")}
        {txt("Signed by", "signer")}
        <div className="grid grid-cols-2 gap-3">
          {txt("Quote prefix", "prefix", "NLWS")}
          {txt("Next quote number", "next_number", "1001")}
        </div>
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">Banking details</legend>
          {txt("Bank", "bank")}{txt("Account name", "account_name")}{txt("Account number", "account_no")}{txt("Account type", "account_type")}{txt("Branch code", "branch_code")}
        </fieldset>
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">Standard wording for new quotes (one item per line)</legend>
          <Lines label="What’s included" value={included} onChange={setIncluded} />
          <Lines label="Not included" value={notIncluded} onChange={setNotIncluded} rows={3} />
          <Lines label="What we need from you" value={needs} onChange={setNeeds} rows={3} />
          <Lines label="Extras under the price" value={extras} onChange={setExtras} rows={3} />
          <Lines label="Payment terms" value={terms} onChange={setTerms} rows={3} />
          <Field label="Timeline"><textarea className="input py-2" rows={2} value={timeline} onChange={(e) => setTimeline(e.target.value)} /></Field>
          <Field label="Valid for (days)"><input className="input !w-24" type="number" min={1} max={365} value={validDays} onChange={(e) => setValidDays(e.target.value)} /></Field>
        </fieldset>
        <ErrorText error={error} />
        <div className="flex justify-end"><button className="btn btn-primary" disabled={pending}>Save</button></div>
      </form>
    </Modal>
  );
}
