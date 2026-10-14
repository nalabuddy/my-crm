import { loadAll } from "@/lib/data";
import PipelineView from "./PipelineView";

export default async function Pipeline() {
  const { deals, clients } = await loadAll();
  return <PipelineView deals={deals} clients={clients} />;
}
