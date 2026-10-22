import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtRand } from "@/lib/format";
import { readBusiness, readDoc } from "@/lib/quotedoc";
import { requireAuth } from "@/lib/session";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
const NAVY = "#26427a";

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
const rand2 = (n: number) => fmtRand(n).replace("R ", "R ");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid print:mt-2.5">
      <h2 className="border-b border-slate-200 pb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>{title}</h2>
      <div className="mt-1.5 text-[13px] leading-relaxed text-slate-800 print:text-[11px] print:leading-snug">{children}</div>
    </section>
  );
}
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1 print:space-y-0.5">{items.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: NAVY }} />{t}</li>)}</ul>
);

/** A printable quote. Needs a login like every other page; "Download / print PDF" saves it as a PDF from the browser. */
export default async function QuoteDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAuth();
  const q = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (q.error || !q.data) notFound();
  const [c, b] = await Promise.all([
    supabase.from("clients").select("name").eq("id", q.data.client_id).maybeSingle(),
    supabase.from("settings").select("value").eq("key", "business").maybeSingle(),
  ]);
  const quote = q.data as { label: string; amount: number; number?: string; doc?: unknown; created_at: string };
  const doc = readDoc(quote.doc), biz = readBusiness(b.data?.value);
  const options = doc.options.length ? doc.options : [{ name: "Total", price: Number(quote.amount), note: "" }];
  const hasBank = !!(biz.bank || biz.account_no);
  const bank: [string, string][] = [["Bank", biz.bank], ["Account Name", biz.account_name], ["Account No.", biz.account_no], ["Account Type", biz.account_type], ["Branch Code", biz.branch_code], ["Reference", quote.number ?? ""]];

  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white print:pb-0">
      <style>{`@page { size: A4; margin: 0 } @media print { html, body { background: #fff !important } * { -webkit-print-color-adjust: exact; print-color-adjust: exact } }`}</style>
      <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-slate-800 print:hidden">
        <Link href="/money" className="btn btn-sm">← Back to Money</Link>
        <span className="text-xs text-slate-500">On a phone: tap the button, choose Print, then Save as PDF.</span>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[820px] bg-white text-slate-900 shadow print:shadow-none print:[zoom:0.86]" data-testid="quote-doc">
        <div className="h-2.5" style={{ background: NAVY }} />
        <div className="px-6 pb-8 pt-6 sm:px-10 print:px-10 print:pb-4 print:pt-4">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-4 print:pb-2">
            <div className="min-w-0">
              <h1 className="font-serif text-3xl print:text-2xl font-bold uppercase leading-tight tracking-tight" data-testid="doc-business">{biz.name || "Your business name"}</h1>
              {biz.subtitle && <p className="text-base text-slate-500">{biz.subtitle}</p>}
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {biz.legal_line && <p>{biz.legal_line}</p>}
                {biz.reg_no && <p>Reg no: {biz.reg_no}</p>}
                {biz.contact_line && <p>{biz.contact_line}</p>}
                {biz.address && <p>{biz.address}</p>}
              </div>
            </div>
            <div className="min-w-[220px]">
              <p className="font-serif text-2xl font-bold uppercase" style={{ color: NAVY }}>Quotation</p>
              <dl className="mt-1 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                <dt className="font-bold text-slate-500">Quote No.:</dt><dd data-testid="doc-number">{quote.number || "—"}</dd>
                <dt className="font-bold text-slate-500">Date:</dt><dd>{longDate(quote.created_at)}</dd>
                <dt className="font-bold text-slate-500">Valid For:</dt><dd>{doc.valid_days} days</dd>
                <dt className="font-bold text-slate-500">To:</dt><dd data-testid="doc-client">{c.data?.name ?? "—"}</dd>
              </dl>
            </div>
          </header>

          {(doc.project || quote.label) && <Section title="Project"><p>{doc.project || quote.label}</p></Section>}
          {doc.included.length > 0 && <Section title="What’s included"><Bullets items={doc.included} /></Section>}
          {doc.not_included.length > 0 && <Section title="Not included"><Bullets items={doc.not_included} /></Section>}
          {doc.needs.length > 0 && <Section title="What we need from you"><Bullets items={doc.needs} /></Section>}

          <Section title="Investment">
            <div data-testid="doc-options">
              {options.map((o, i) => (
                <div key={i} className={`px-3 py-3 print:py-1 ${i % 2 === 0 ? "bg-slate-50" : ""}`} data-testid="doc-option">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] font-bold print:text-[13px]">{o.name}</span>
                    <span className="text-[17px] font-bold tabular-nums print:text-[15px]" style={{ color: NAVY }}>{rand2(o.price)}</span>
                  </div>
                  {o.note && <p className="mt-0.5 text-[11px] text-slate-500">{o.note}</p>}
                </div>
              ))}
            </div>
            {(doc.extras.length > 0 || biz.vat_note) && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                {doc.extras.length > 0 && <Bullets items={doc.extras} />}
                {biz.vat_note && <p className="mt-1 text-[11px] text-slate-500">{biz.vat_note}</p>}
              </div>
            )}
          </Section>

          {doc.terms.length > 0 && <Section title="Payment terms"><Bullets items={doc.terms} /></Section>}
          {doc.timeline && <Section title="Timeline"><p>{doc.timeline}</p></Section>}

          {hasBank && (
            <div className="mt-5 break-inside-avoid border-l-4 print:mt-2.5 print:py-1.5 bg-slate-100 px-4 py-3" style={{ borderColor: NAVY, background: "#e9eef7" }} data-testid="doc-bank">
              <h2 className="mb-2 text-[15px] font-bold">Banking Details</h2>
              <dl className="grid grid-cols-[7rem_1fr] gap-y-0.5 text-[12px] print:text-[10px] print:gap-y-0">
                {bank.filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="font-bold text-slate-500">{k}:</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          )}

          <Section title="Acceptance">
            <p>To accept, reply “Accepted” to this quote or sign below.</p>
            <div className="mt-8 grid grid-cols-2 gap-10 print:mt-4 text-[12px]">
              <div className="border-t border-slate-900 pt-1"><p className="font-bold">Director — {biz.name || "Your business"}</p>{biz.signer && <p className="text-slate-500">{biz.signer}</p>}<p className="mt-2 text-slate-500">Date: ____________________</p></div>
              <div className="border-t border-slate-900 pt-1"><p className="font-bold">Client</p><p className="mt-1 text-slate-500">Name: ____________________</p><p className="mt-2 text-slate-500">Date: ____________________</p></div>
            </div>
          </Section>
          <p className="mt-5 text-[11px] font-bold print:mt-2.5">Thank you for the opportunity to build this with you.</p>
        </div>
        <div className="h-2.5" style={{ background: NAVY }} />
      </article>
    </div>
  );
}
