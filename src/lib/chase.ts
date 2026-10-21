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

/** South African mobiles are 06x/07x/08x (27 6…, 27 7…, 27 8…); 0xx landlines such as 041 or 011 rarely have WhatsApp. */
export function isMobile(phone: string | null | undefined): boolean {
  const n = phone ? waNumber(phone) : null;
  if (!n) return false;
  return n.startsWith("27") ? /^27[678]\d{8}$/.test(n) : n.length >= 10; // foreign numbers: assume yes
}

export const DEFAULT_LEAD_MESSAGE =
  "Hi, it's {me} from Next Level Web Solutions. We build professional websites that bring local businesses more customers. Could I send you a quick idea for {business}?";

/** Fill {business} and {me} into the message template. */
export function leadMessage(template: string, o: { business: string; me: string }): string {
  return template.replace(/\{business\}/gi, o.business).replace(/\{me\}/gi, o.me);
}
