import { loadAll } from "@/lib/data";
import MoneyView from "./MoneyView";

export default async function Money() {
  const { invoices, clients } = await loadAll();
  return <MoneyView invoices={invoices} clients={clients} />;
}
