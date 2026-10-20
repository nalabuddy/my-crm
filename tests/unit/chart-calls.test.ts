import { describe, expect, it } from "vitest";
import { chartData, parseCallList, sortLeads } from "@/lib/logic";
import type { CallLead, Deal, Expense, Payment } from "@/lib/types";

const TODAY = "2026-10-14";
const pay = (received_on: string, amount: number): Payment => ({ id: received_on + amount, invoice_id: "i", amount, received_on });
const exp = (spent_on: string, amount: number): Expense => ({ id: spent_on + amount, spent_on, amount, category: "General", note: "" });
const deal = (value: number, stage: Deal["stage"], due: string | null): Deal => ({
  id: String(value) + String(due), client_id: null, title: "d", value, stage, owner: "Both", due, created_at: "",
});

describe("chartData (received, profit, projected)", () => {
  const base = { payments: [], expenses: [], deals: [], target: 0, today: TODAY };
  it("spans 6 months back, this month and 5 ahead, crossing the year", () => {
    const { months } = chartData({ ...base, today: "2026-02-10" });
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe("2025-08");
    expect(months[6]).toMatchObject({ key: "2026-02", current: true, future: false });
    expect(months[7]).toMatchObject({ key: "2026-03", future: true });
    expect(months[11].key).toBe("2026-07");
  });
  it("profit = money received − expenses, by month", () => {
    const { months } = chartData({
      ...base, payments: [pay("2026-10-01", 5000), pay("2026-10-20", 2500.5), pay("2026-09-05", 1000)],
      expenses: [exp("2026-10-03", 1200), exp("2026-09-10", 1500), exp("2020-01-01", 999)],
    });
    const oct = months.find((m) => m.key === "2026-10")!, sep = months.find((m) => m.key === "2026-09")!;
    expect(oct).toMatchObject({ received: 7500.5, expenses: 1200, profit: 6300.5 });
    expect(sep).toMatchObject({ received: 1000, expenses: 1500, profit: -500 }); // a loss is negative
  });
  it("projected = open deals by due month; overdue counts now; Paid ignored; undated and later reported", () => {
    const r = chartData({
      ...base, target: 50000,
      deals: [
        deal(10000, "In progress", "2026-12-15"), deal(2000, "Quote sent", "2026-12-01"),
        deal(3000, "Delivered", "2026-08-01"),            // overdue → this month
        deal(9999, "Paid", "2026-11-01"),                // already paid → ignored
        deal(700, "Lead", null),                          // no due date
        deal(400, "Lead", "2027-06-01"),                  // beyond the chart
      ],
    });
    const by = Object.fromEntries(r.months.map((m) => [m.key, m.projected]));
    expect(by["2026-12"]).toBe(12000);
    expect(by["2026-10"]).toBe(3000);
    expect(by["2026-11"]).toBe(0);
    expect(r.undated).toBe(700);
    expect(r.later).toBe(400);
    expect(r.months.every((m) => m.target === 50000)).toBe(true);
  });
});

describe("parseCallList (paste)", () => {
  it("handles commas, tabs, dashes and a trailing phone", () => {
    const r = parseCallList([
      "Acme Plumbing, Sipho, 082 123 4567",
      "Blue Dental\t011 555 0102",
      "Green Garden - Thandi - +27 71 222 3333",
      "Roofing Pros 084 999 0000",
    ].join("\n"));
    expect(r).toEqual([
      { business: "Acme Plumbing", contact: "Sipho", phone: "082 123 4567", notes: "" },
      { business: "Blue Dental", contact: "", phone: "011 555 0102", notes: "" },
      { business: "Green Garden", contact: "Thandi", phone: "+27 71 222 3333", notes: "" },
      { business: "Roofing Pros", contact: "", phone: "084 999 0000", notes: "" },
    ]);
  });
  it("finds the phone wherever it is, keeps extra columns as notes, skips blanks and a header row", () => {
    const r = parseCallList("Business, Phone\n\n0821234567, Bakery Co, Maria, wants a website, call after 3\n   \n");
    expect(r).toEqual([{ business: "Bakery Co", contact: "Maria", phone: "0821234567", notes: "wants a website, call after 3" }]);
  });
  it("a name with no number is still added; a bare number becomes the name", () => {
    expect(parseCallList("Just A Name")).toEqual([{ business: "Just A Name", contact: "", phone: "", notes: "" }]);
    expect(parseCallList("082 123 4567")).toEqual([{ business: "082 123 4567", contact: "", phone: "082 123 4567", notes: "" }]);
  });
});

describe("sortLeads", () => {
  const lead = (id: string, outcome: CallLead["outcome"], extra: Partial<CallLead> = {}): CallLead => ({
    id, business: id, contact: "", phone: "", notes: "", outcome, callback_on: null, attempts: 0, last_called_on: null,
    called_by: null, client_id: null, created_at: id, ...extra,
  });
  it("due call-backs first, then not called, then no answer, then future call-backs, then finished", () => {
    const sorted = sortLeads([
      lead("done", "Not interested"), lead("future", "Call back later", { callback_on: "2026-10-30" }),
      lead("noans", "No answer", { last_called_on: "2026-10-10" }), lead("fresh", "Not called"),
      lead("due", "Call back later", { callback_on: "2026-10-13" }),
    ], TODAY).map((l) => l.id);
    expect(sorted).toEqual(["due", "fresh", "noans", "future", "done"]);
  });
});
