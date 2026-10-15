import { fmtDate, fmtRand } from "./format";

/** WhatsApp wants digits only, international format. South African local numbers (0xx…) become 27xx…. */
export function waNumber(phone: string): string | null {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return "27" + digits.slice(1);
  if (digits.startsWith("27")) return digits;
  return digits.length <= 9 ? "27" + digits : digits;
}

export function chaseMessage(o: {
  clientName: string; contact?: string; label: string; balance: number; promised?: string | null; me: string;
}): string {
  const rand = fmtRand(o.balance).replace(/ /g, " ");
  const promised = o.promised ? ` (you mentioned ${fmtDate(o.promised)})` : "";
  return `Hi ${o.contact?.trim() || o.clientName}, a friendly reminder that ${rand} for "${o.label}" is still outstanding${promised}. ` +
    `Could you let me know when we can expect payment? Thanks, ${o.me} – Next Level Web Solutions`;
}

/** With no phone number WhatsApp opens its contact picker with the message ready. */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const n = phone ? waNumber(phone) : null;
  return `https://wa.me/${n ?? ""}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(email: string, subject: string, text: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
