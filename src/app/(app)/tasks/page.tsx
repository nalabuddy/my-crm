import { loadAll } from "@/lib/data";
import TasksView from "./TasksView";

export default async function Tasks() {
  const { me, tasks, clients } = await loadAll();
  return <TasksView me={me} tasks={tasks} clients={clients} />;
}
