import { loadAll, loadMoneyExtras } from "@/lib/data";
import MoneyView from "./MoneyView";

export default async function Money() {
  const [{ invoices, clients, payments, me, quotes, quotesReady, deals }, extras] = await Promise.all([loadAll(), loadMoneyExtras()]);
  return <MoneyView expenses={extras.expenses} target={extras.target} extrasReady={extras.extrasReady} invoices={invoices} clients={clients} payments={payments} me={me} quotes={quotes} deals={deals} quotesReady={quotesReady} />;
}
