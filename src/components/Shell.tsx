"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions";

const NAV = [
  { href: "/", label: "Overview", icon: "◎" },
  { href: "/tasks", label: "Tasks", icon: "✓" },
  { href: "/clients", label: "Clients", icon: "☺" },
  { href: "/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/money", label: "Money", icon: "R" },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<string>("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  return (
    <button className="btn btn-sm" aria-label="Toggle light or dark mode" onClick={() => {
      const t = theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem("theme", t); } catch {}
      setTheme(t);
    }}>{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>
  );
}

export default function Shell({ me, children }: { me: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card p-4 md:flex">
        <div className="mb-6 text-lg font-bold leading-tight">Next Level<br />Web Solutions</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm font-medium ${active(n.href) ? "bg-accent/15 text-accent" : "text-muted hover:text-ink"}`}>
              <span className="mr-2 inline-block w-4 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 pt-6 text-sm">
          <div className="text-muted">Signed in as <b className="text-ink">{me}</b></div>
          <div className="flex gap-2"><ThemeToggle /><form action={signOut}><button className="btn btn-sm">Sign out</button></form></div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-2 md:hidden">
          <span className="font-bold">NLWS CRM</span>
          <div className="flex items-center gap-2"><span className="text-xs text-muted">{me}</span><ThemeToggle />
            <form action={signOut}><button className="btn btn-sm">Out</button></form></div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-10 md:pt-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center py-2 text-[11px] ${active(n.href) ? "text-accent" : "text-muted"}`}>
            <span className="text-base leading-none">{n.icon}</span>{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
