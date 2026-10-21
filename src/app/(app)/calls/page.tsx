import { loadLeads } from "@/lib/data";
import CallsView from "./CallsView";

export default async function Calls() {
  const { leads, ready, me } = await loadLeads();
  return <CallsView leads={leads} ready={ready} me={me ?? ""} />;
}
