import { notFound } from "next/navigation";
import { loadAll } from "@/lib/data";
import ClientDetail from "./ClientDetail";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const all = await loadAll();
  const client = all.clients.find((c) => c.id === id);
  if (!client) notFound();
  return (
    <ClientDetail
      client={client} allClients={all.clients}
      deals={all.deals.filter((d) => d.client_id === id)}
      invoices={all.invoices.filter((i) => i.client_id === id)}
      payments={all.payments}
      me={all.me}
      tasks={all.tasks.filter((t) => t.client_id === id)}
      activities={all.activities.filter((a) => a.client_id === id)}
    />
  );
}
