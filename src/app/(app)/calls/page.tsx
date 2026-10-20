import { loadLeads } from "@/lib/data";
import CallsView from "./CallsView";

export default async function Calls() {
  const { leads, ready } = await loadLeads();
  return <CallsView leads={leads} ready={ready} />;
}
