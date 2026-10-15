import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Person } from "./types";

/** Authenticated user + their team name. A logged-in account with no profile is NOT allowed in. */
/** cache(): the layout and the page both call this in one request; do the network round trips once. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=not-authorised");
  }
  return { supabase, user, me: profile.name as Person };
});
