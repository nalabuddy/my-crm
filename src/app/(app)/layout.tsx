import Shell from "@/components/Shell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireUser();
  return <Shell me={me}>{children}</Shell>;
}
