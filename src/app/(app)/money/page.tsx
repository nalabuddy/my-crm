import { loadAll } from "@/lib/data";
import MoneyView from "./MoneyView";

export default async function Money() {
  const { invoices, clients, payments, me } = await loadAll();
  return <MoneyView invoices={invoices} clients={clients} payments={payments} me={me} />;
}
