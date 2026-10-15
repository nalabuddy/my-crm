import Shell from "@/components/Shell";
import { getMe } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return <Shell me={me}>{children}</Shell>;
}
