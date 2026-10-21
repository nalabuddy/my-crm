import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_MESSAGE, isMobile, leadMessage, whatsappUrl } from "@/lib/chase";
import { addMonths, chartData, mapSheetStatus, parseCallList, planLines, scheduledByMonth, sortLeads, splitPlan } from "@/lib/logic";
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

// Rows exactly as Google Sheets puts them on the clipboard (tab separated). Taken from the real lead sheet.
const T = "\t";
const HEADER = ["Lead ID", "Assigned To", "Niche", "Tier", "Business Name", "Category", "Phone", "City", "Reviews", "Unclaimed GBP", "Also Listed As (same phone)", "Call Status (live)"].join(T);
const ROWS = [
  ["L-001", "Dom", "Legal", "A", "Balt Attorneys", "Attorney", "+27 44 382 3111", "Knysna", "62", "No", "Deon Boshoff Attorney", "Not Called"],
  ["L-004", "Dom", "Legal", "B", "Zolile Ngqeza Attorneys", "Attorney", "+27 41 487 2178", "Gqeberha", "30", "Yes", "", "Not Called"],
  ["L-094", "Dom", "Legal", "C", "Boyens Attorneys Incorporated - Labour Law Practitioners", "Attorney", "+27 41 205 0968", "Gqeberha", "3", "No", "", "Not Called"],
  ["A-034", "Dom", "Accounting", "C", "Trust Accounting Agency", "", "+27 34 312 2800", "Newcastle", "3", "Yes", "", "Not Called"],
  ["A-106", "Dom", "Accounting", "C", "T&M Accounting", "Accounting firm", "+27 71303930", "Vredenburg", "0", "Yes", "", "Not Called"],
  ["S-006", "Dom", "Solar & Electrical", "A", "CJ Electrical & Solar", "Electrician", "+27 72 348 8289", "", "55", "No", "", "Not Called"],
  ["L-002", "Obi", "Legal", "B", "Schoeman En Hamman Prokureurs", "Attorney", "+27 22 715 1727", "Vredenburg", "49", "Yes", "", "Not Called"],
  ["L-180", "Tyler", "Legal", "C", "Tarryn Gravenor Attorney, Conveyancer & Notary +27(0)84 904 1015", "Attorney", "+27 84 904 1015", "St Helena Bay", "0", "No", "", "Not Called"],
  ["L-072", "Tyler", "Legal", "C", "Selvie Pillay & Co", "Attorney", "+27 32 551 5889", "KwaDukuza", "4", "Yes", "", "Do Not Call"],
  ["P-112", "Tyler", "Plumbing & Building", "C", "Bt Plumbers and Civils", "Construction company", "+27 73 100 4004", "Gqeberha", "1", "No", "", "No Answer"],
].map((r) => r.join(T));

describe("parseCallList: lead sheet rows", () => {
  it("reads the sheet columns (with the header row) into the right fields", () => {
    const r = parseCallList([HEADER, ...ROWS].join("\n"));
    expect(r).toHaveLength(9);
    expect(r[0]).toEqual({
      business: "Balt Attorneys", contact: "", phone: "+27 44 382 3111",
      notes: "Attorney · 62 Google reviews · Also listed as: Deon Boshoff Attorney",
      assigned_to: "Dom", niche: "Legal", tier: "A", city: "Knysna", lead_code: "L-001", outcome: "Not called", attempts: 0,
    });
    expect(r[1].notes).toBe("Attorney · 30 Google reviews · Google profile unclaimed"); // unclaimed profile is a selling point
    expect(r[6]).toMatchObject({ business: "Schoeman En Hamman Prokureurs", assigned_to: "Obi", tier: "B", city: "Vredenburg" });
  });
  it("works without the header row too", () => {
    expect(parseCallList(ROWS.join("\n"))).toHaveLength(9);
  });
  it("keeps awkward names whole (commas, dashes, an embedded phone number)", () => {
    const r = parseCallList(ROWS.join("\n"));
    expect(r[2].business).toBe("Boyens Attorneys Incorporated - Labour Law Practitioners");
    expect(r[7].business).toBe("Tarryn Gravenor Attorney, Conveyancer & Notary +27(0)84 904 1015");
    expect(r[7].phone).toBe("+27 84 904 1015");
  });
  it("handles empty cells (no category, no city) and short phone numbers", () => {
    const r = parseCallList(ROWS.join("\n"));
    expect(r[3]).toMatchObject({ business: "Trust Accounting Agency", city: "Newcastle", notes: "3 Google reviews · Google profile unclaimed" });
    expect(r[5]).toMatchObject({ business: "CJ Electrical & Solar", city: "", niche: "Solar & Electrical", tier: "A" });
    expect(r[4].phone).toBe("+27 71303930");
  });
  it("turns the sheet's call status into the app's results", () => {
    const r = parseCallList(ROWS.join("\n"));
    expect(r.some((l) => l.business.includes("Selvie Pillay"))).toBe(false); // Do Not Call rows are never imported
    expect(r[8]).toMatchObject({ outcome: "No answer", attempts: 1 });
    expect(mapSheetStatus("Meeting Booked").outcome).toBe("Meeting booked");
    expect(mapSheetStatus("Call Back").outcome).toBe("Call back later");
    expect(mapSheetStatus("Not Interested").outcome).toBe("Not interested");
    expect(mapSheetStatus("Interested").outcome).toBe("Interested");
    expect(mapSheetStatus("Something odd")).toMatchObject({ outcome: "Not called", note: "Status in sheet: Something odd" });
  });
  it("still understands plain lines in the same paste box", () => {
    expect(parseCallList("Blue Dental\t011 555 0102")).toEqual([{ business: "Blue Dental", contact: "", phone: "011 555 0102", notes: "" }]);
  });
});

describe("sortLeads with tiers", () => {
  const L = (id: string, tier: CallLead["tier"]): CallLead => ({
    id, business: id, contact: "", phone: "", notes: "", outcome: "Not called", callback_on: null, attempts: 0,
    last_called_on: null, called_by: null, client_id: null, created_at: id, tier,
  });
  it("Tier A before B before C, then pasted order", () => {
    expect(sortLeads([L("c1", "C"), L("a2", "A"), L("b1", "B"), L("a1", "A"), L("none", "")], TODAY).map((l) => l.id)).toEqual(["a1", "a2", "b1", "c1", "none"]);
  });
});

describe("payment plans", () => {
  const inst = (id: string, due_on: string, amount: number, paid_before = 0) => ({ id, invoice_id: "inv", due_on, amount, paid_before });
  it("splits into equal monthly payments, odd cents on the last", () => {
    expect(splitPlan(10000, 4, "2026-11-25")).toEqual([
      { amount: 2500, due_on: "2026-11-25" }, { amount: 2500, due_on: "2026-12-25" },
      { amount: 2500, due_on: "2027-01-25" }, { amount: 2500, due_on: "2027-02-25" },
    ]);
    const odd = splitPlan(100, 3, "2026-01-01");
    expect(odd.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(odd.reduce((s, r) => s + r.amount * 100, 0)).toBe(10000);
  });
  it("keeps month ends sensible", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("ticks payments off in due order and flags what is late", () => {
    const plan = [inst("c", "2026-12-20", 3000), inst("a", "2026-10-20", 3000), inst("b", "2026-11-20", 3000)];
    const l = planLines(plan, 4000, "2026-11-25");
    expect(l.map((x) => [x.id, x.state, x.owed])).toEqual([["a", "Paid", 0], ["b", "Overdue", 2000], ["c", "Upcoming", 3000]]);
    expect(planLines(plan, 0, "2026-10-01").map((x) => x.state)).toEqual(["Upcoming", "Upcoming", "Upcoming"]);
    expect(planLines(plan, 1000, "2026-10-01")[0].state).toBe("Part paid");
  });
  it("ignores what was already paid when the plan was made", () => {
    const plan = [inst("a", "2026-11-20", 2500, 5000), inst("b", "2026-12-20", 2500, 5000)];
    expect(planLines(plan, 5000, "2026-11-01").map((x) => x.state)).toEqual(["Upcoming", "Upcoming"]);
    expect(planLines(plan, 7500, "2026-11-01").map((x) => x.state)).toEqual(["Paid", "Upcoming"]);
  });
  it("totals what plans expect per month, overdue counting in this month", () => {
    const plan = [inst("a", "2026-09-20", 1000), inst("b", "2026-11-20", 2000), { ...inst("c", "2026-11-28", 500), invoice_id: "other" }];
    const m = scheduledByMonth(plan, [{ id: "inv", paid: 0 }, { id: "other", paid: 500 }], "2026-10-21");
    expect(m.get("2026-10")).toBe(1000);
    expect(m.get("2026-11")).toBe(2000); // "other" is fully paid
  });
});

describe("WhatsApp for the call list", () => {
  it("only offers WhatsApp for mobile numbers", () => {
    for (const ok of ["082 123 4567", "+27 82 123 4567", "0721234567", "+27 63 740 6866", "27 78 069 8038"]) expect(isMobile(ok), ok).toBe(true);
    for (const no of ["041 581 2292", "+27 41 452 1087", "011 555 0102", "+27 10 110 0549", "", "+27 71303930"]) expect(isMobile(no), no).toBe(false);
  });
  it("fills the business and your name into the message", () => {
    expect(leadMessage("Hi {business}, it's {me}. {Business} again", { business: "Acme & Sons", me: "Michael" })).toBe("Hi Acme & Sons, it's Michael. Acme & Sons again");
    expect(leadMessage(DEFAULT_LEAD_MESSAGE, { business: "Blue Dental", me: "Trevor" })).toContain("Trevor from Next Level Web Solutions");
    expect(whatsappUrl("082 123 4567", leadMessage("Hi {business}", { business: "A & B", me: "x" }))).toBe("https://wa.me/27821234567?text=Hi%20A%20%26%20B");
  });
});
