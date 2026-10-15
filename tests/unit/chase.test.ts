import { describe, expect, it } from "vitest";
import { chaseMessage, mailtoUrl, waNumber, whatsappUrl } from "@/lib/chase";

describe("waNumber", () => {
  it("turns South African local numbers into international digits", () => {
    expect(waNumber("082 123 4567")).toBe("27821234567");
    expect(waNumber("0821234567")).toBe("27821234567");
    expect(waNumber("+27 82 123 4567")).toBe("27821234567");
    expect(waNumber("27821234567")).toBe("27821234567");
    expect(waNumber("0027821234567")).toBe("27821234567");
    expect(waNumber("821234567")).toBe("27821234567");
  });
  it("keeps other international numbers and rejects junk", () => {
    expect(waNumber("+44 7700 900123")).toBe("447700900123");
    expect(waNumber("")).toBeNull();
    expect(waNumber("n/a")).toBeNull();
  });
});

describe("chase message and links", () => {
  const base = { clientName: "Mohammed Co", contact: "Mohammed", label: "Completed project", balance: 10500, me: "Michael" };
  it("names the amount, project and sender with a plain-space rand", () => {
    const t = chaseMessage(base);
    expect(t).toContain("Hi Mohammed,");
    expect(t).toContain('R 10 500 for "Completed project"');
    expect(t).not.toContain(" ");
    expect(t).toContain("Thanks, Michael");
  });
  it("falls back to the client name and mentions a promised date", () => {
    const t = chaseMessage({ ...base, contact: "", promised: "2026-10-01" });
    expect(t).toContain("Hi Mohammed Co,");
    expect(t).toContain("(you mentioned 01/10/2026)");
  });
  it("builds a WhatsApp link, or opens the contact picker without a phone", () => {
    expect(whatsappUrl("082 123 4567", "Hi there")).toBe("https://wa.me/27821234567?text=Hi%20there");
    expect(whatsappUrl("", "Hi")).toBe("https://wa.me/?text=Hi");
    expect(whatsappUrl(null, "A & B")).toBe("https://wa.me/?text=A%20%26%20B");
  });
  it("builds a mailto link", () => {
    expect(mailtoUrl("a@b.co", "Reminder: X", "Hi & bye")).toBe("mailto:a@b.co?subject=Reminder%3A%20X&body=Hi%20%26%20bye");
  });
});
