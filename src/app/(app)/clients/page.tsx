import { loadAll } from "@/lib/data";
import ClientsView from "./ClientsView";

export default async function Clients() {
  const { clients, invoices } = await loadAll();
  const owed: Record<string, number> = {};
  for (const i of invoices) owed[i.client_id] = (owed[i.client_id] ?? 0) + Math.max(i.balance, 0);
  return <ClientsView clients={clients} owed={owed} />;
}
