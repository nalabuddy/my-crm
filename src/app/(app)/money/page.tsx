import { loadAll } from "@/lib/data";
import MoneyView from "./MoneyView";

export default async function Money() {
  const { invoices, clients, payments, me, quotes, quotesReady, deals } = await loadAll();
  return <MoneyView invoices={invoices} clients={clients} payments={payments} me={me} quotes={quotes} deals={deals} quotesReady={quotesReady} />;
}
