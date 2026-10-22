/** Wording and business details behind the printable quote. */
export type QuoteOption = { name: string; price: number; note: string };
export type QuoteDoc = {
  project: string; included: string[]; not_included: string[]; needs: string[];
  options: QuoteOption[]; chosen: number; extras: string[]; terms: string[]; timeline: string; valid_days: number;
};
export type Business = {
  name: string; subtitle: string; legal_line: string; reg_no: string; contact_line: string; address: string;
  vat_note: string; signer: string; prefix: string; next_number: number;
  bank: string; account_name: string; account_no: string; account_type: string; branch_code: string;
  defaults: QuoteDoc;
};

export const EMPTY_DOC: QuoteDoc = {
  project: "", included: [], not_included: [], needs: [], options: [], chosen: 0, extras: [], terms: [], timeline: "", valid_days: 14,
};
export const EMPTY_BUSINESS: Business = {
  name: "", subtitle: "Quotation", legal_line: "", reg_no: "", contact_line: "", address: "", vat_note: "",
  signer: "", prefix: "QUO", next_number: 1001, bank: "", account_name: "", account_no: "", account_type: "", branch_code: "",
  defaults: EMPTY_DOC,
};

const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** Read whatever is stored, tolerating missing or odd values, so an old quote never breaks the page. */
export function readDoc(raw: unknown): QuoteDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const options = Array.isArray(o.options)
    ? o.options.map((x) => { const r = (x ?? {}) as Record<string, unknown>; return { name: String(r.name ?? "").trim(), price: Number(r.price) || 0, note: String(r.note ?? "").trim() }; }).filter((x) => x.name)
    : [];
  return {
    project: String(o.project ?? "").trim(), included: lines(o.included), not_included: lines(o.not_included), needs: lines(o.needs),
    options, chosen: Math.min(Math.max(0, Math.floor(Number(o.chosen) || 0)), Math.max(options.length - 1, 0)),
    extras: lines(o.extras), terms: lines(o.terms), timeline: String(o.timeline ?? "").trim(), valid_days: num(o.valid_days, 14),
  };
}
export function readBusiness(raw: unknown): Business {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (k: keyof Business) => String(o[k] ?? EMPTY_BUSINESS[k] ?? "").trim();
  return {
    name: s("name"), subtitle: s("subtitle"), legal_line: s("legal_line"), reg_no: s("reg_no"), contact_line: s("contact_line"),
    address: s("address"), vat_note: s("vat_note"), signer: s("signer"), prefix: s("prefix") || "QUO",
    next_number: Math.floor(num(o.next_number, 1001)), bank: s("bank"), account_name: s("account_name"), account_no: s("account_no"),
    account_type: s("account_type"), branch_code: s("branch_code"), defaults: readDoc(o.defaults),
  };
}

export const toLines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter(Boolean);
export const fromLines = (a: string[]) => a.join("\n");

/** PREFIX-YEAR-NNNN: the next number after the highest already used this year (never below `start`). */
export function nextQuoteNumber(prefix: string, year: number, existing: string[], start: number): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${year}-(\\d+)$`);
  const used = existing.map((n) => re.exec(n)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[1]));
  return `${prefix}-${year}-${Math.max(start, ...used.map((u) => u + 1))}`;
}
