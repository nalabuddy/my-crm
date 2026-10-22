import { loadAll, loadBusiness, loadMoneyExtras } from "@/lib/data";
import MoneyView from "./MoneyView";

export default async function Money() {
  const [{ invoices, clients, payments, me, quotes, quotesReady, deals }, extras, biz] = await Promise.all([loadAll(), loadMoneyExtras(), loadBusiness()]);
  return <MoneyView expenses={extras.expenses} target={extras.target} extrasReady={extras.extrasReady} installments={extras.installments} plansReady={extras.plansReady} business={biz.business} docsReady={biz.ready} invoices={invoices} clients={clients} payments={payments} me={me} quotes={quotes} deals={deals} quotesReady={quotesReady} />;
}
