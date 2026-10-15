import { chaseMessage, mailtoUrl, whatsappUrl } from "@/lib/chase";
import type { Client, Invoice } from "@/lib/types";

/** One-tap reminder: WhatsApp (and email when the client has one) with the message ready to send. */
export default function ChaseLinks({ invoice, client, me, className = "" }: { invoice: Invoice; client?: Client; me: string; className?: string }) {
  if (invoice.balance <= 0) return null;
  const text = chaseMessage({
    clientName: client?.name ?? "there", contact: client?.contact, label: invoice.label,
    balance: invoice.balance, promised: invoice.promised_date, me,
  });
  return (
    <span className={`inline-flex gap-2 ${className}`}>
      <a className="btn btn-sm" href={whatsappUrl(client?.phone, text)} target="_blank" rel="noopener noreferrer" data-testid="chase-whatsapp">Chase on WhatsApp</a>
      {client?.email && (
        <a className="btn btn-sm" href={mailtoUrl(client.email, `Payment reminder: ${invoice.label}`, text)} data-testid="chase-email">Email</a>
      )}
    </span>
  );
}
