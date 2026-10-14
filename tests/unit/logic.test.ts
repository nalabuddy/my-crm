import { describe, expect, it } from "vitest";
import { fmtDate, fmtRand, todayISO } from "@/lib/format";
import {
  balanceOf, depositsPending, dueTodayOrLate, filterTasks, goQuiet, moneyToChase,
  nextStage, openPipelineValue, owedOnInvoices, workload,
} from "@/lib/logic";
import type { Activity, Client, Deal, Invoice, Task } from "@/lib/types";

const TODAY = "2026-10-14";
const inv = (o: Partial<Invoice>): Invoice => ({
  id: "i", client_id: "c1", label: "x", kind: "Invoice", amount: 1000, due: null, promised_date: null, notes: "",
  created_at: "", paid: 0, balance: 1000, payment_count: 0, ...o,
});
const task = (o: Partial<Task>): Task => ({
  id: "t", title: "t", assignee: "Both", due: null, priority: "Normal", client_id: null, notes: "",
  done: false, done_at: null, created_at: "", ...o,
});
const client = (o: Partial<Client>): Client => ({
  id: "c1", name: "A", status: "Active", contact: "", phone: "", email: "", source: "Other", notes: "",
  created_at: "2026-01-01T00:00:00Z", ...o,
});

describe("formatting", () => {
  it("formats rand with space grouping", () => {
    expect(fmtRand(10500)).toBe("R 10 500");
    expect(fmtRand(15000)).toBe("R 15 000");
    expect(fmtRand(0)).toBe("R 0");
    expect(fmtRand(1234.5)).toBe("R 1 234,50");
    expect(fmtRand("99")).toBe("R 99");
  });
  it("formats dates DD/MM/YYYY", () => {
    expect(fmtDate("2026-10-14")).toBe("14/10/2026");
    expect(fmtDate("2026-10-14T22:30:00Z")).toBe("14/10/2026");
    expect(fmtDate(null)).toBe("—");
  });
  it("uses South African calendar day", () => {
    // 22:30 UTC on the 14th is already the 15th in Johannesburg (UTC+2)
    expect(todayISO(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
  });
});

describe("balance & part payments", () => {
  it("balance = amount − sum(payments)", () => {
    expect(balanceOf(10500, [{ amount: 3000 }, { amount: 2500.5 }])).toBe(4999.5);
    expect(balanceOf(1000, [])).toBe(1000);
    expect(balanceOf(1000, [{ amount: 1000 }])).toBe(0);
  });
  it("splits owed vs deposits and ignores settled", () => {
    const list = [inv({ balance: 10500 }), inv({ kind: "Deposit", balance: 15000 }), inv({ balance: 0 })];
    expect(owedOnInvoices(list)).toBe(10500);
    expect(depositsPending(list)).toBe(15000);
  });
});

describe("pipeline", () => {
  it("open pipeline excludes Paid", () => {
    const d = (value: number, stage: Deal["stage"]) => ({ id: "d", client_id: null, title: "", value, stage, owner: "Both", due: null, created_at: "" }) as Deal;
    expect(openPipelineValue([d(100, "Lead"), d(200, "In progress"), d(999, "Paid")])).toBe(300);
  });
  it("moves one stage at a time and stops at the ends", () => {
    expect(nextStage("Lead", 1)).toBe("Quote sent");
    expect(nextStage("Delivered", 1)).toBe("Paid");
    expect(nextStage("Paid", 1)).toBeNull();
    expect(nextStage("Lead", -1)).toBeNull();
  });
});

describe("money to chase", () => {
  it("includes no-promised-date and past-promised, excludes future and settled", () => {
    const list = [
      inv({ id: "none" }),
      inv({ id: "late", promised_date: "2026-10-01" }),
      inv({ id: "future", promised_date: "2026-10-30" }),
      inv({ id: "today", promised_date: TODAY }),
      inv({ id: "paid", balance: 0 }),
    ];
    expect(moneyToChase(list, TODAY).map((i) => i.id).sort()).toEqual(["late", "none"]);
  });
});

describe("tasks", () => {
  const list = [
    task({ id: "a", due: "2026-10-10" }), task({ id: "b", due: TODAY }), task({ id: "c", due: "2026-10-20" }),
    task({ id: "d" }), task({ id: "e", due: "2026-10-01", done: true }),
  ];
  it("due today or late excludes future, undated and done", () => {
    expect(dueTodayOrLate(list, TODAY).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("filters Mine / person / show done", () => {
    const ts = [task({ id: "m", assignee: "Michael" }), task({ id: "t", assignee: "Trevor" }), task({ id: "b", assignee: "Both" }), task({ id: "x", assignee: "Trevor", done: true })];
    expect(filterTasks(ts, "Everyone", "Michael", false).map((t) => t.id)).toEqual(["m", "t", "b"]);
    expect(filterTasks(ts, "Mine", "Michael", false).map((t) => t.id)).toEqual(["m", "b"]);
    expect(filterTasks(ts, "Trevor", "Michael", true).map((t) => t.id)).toEqual(["t", "b", "x"]);
  });
  it("workload counts Both for each person", () => {
    const w = workload([task({ assignee: "Michael" }), task({ assignee: "Both", due: "2026-10-01" })], TODAY);
    expect(w).toEqual([
      { person: "Michael", open: 2, overdue: 1, high: 0 },
      { person: "Trevor", open: 1, overdue: 1, high: 0 },
    ]);
  });
});

describe("go quiet", () => {
  const act = (client_id: string, at: string): Activity => ({ id: at, client_id, type: "Call", text: "", at, by: "Michael", created_at: "" });
  it("flags Lead/Active with 14+ days since last contact, uses newest log", () => {
    const cs = [client({ id: "old" }), client({ id: "recent" }), client({ id: "edge" }), client({ id: "past", status: "Past" })];
    const acts = [act("old", "2026-09-01"), act("old", "2026-09-20"), act("recent", "2026-10-10"), act("edge", "2026-09-30"), act("past", "2025-01-01")];
    const r = goQuiet(cs, acts, TODAY);
    expect(r.map((x) => x.client.id)).toEqual(["old", "edge"]);
    expect(r.find((x) => x.client.id === "old")!.days).toBe(24);
    expect(r.find((x) => x.client.id === "edge")!.days).toBe(14);
  });
  it("falls back to created date when never contacted", () => {
    const r = goQuiet([client({ id: "n", created_at: "2026-10-13T08:00:00Z" }), client({ id: "m", created_at: "2026-01-01T00:00:00Z" })], [], TODAY);
    expect(r.map((x) => x.client.id)).toEqual(["m"]);
  });
});
