import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Person } from "./types";

/**
 * Verified login. getClaims() checks the token signature locally (no network trip to Supabase)
 * when the project uses asymmetric signing keys, and falls back to asking Supabase otherwise.
 * cache(): layout, page and actions in one request share the result.
 */
export const requireAuth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
});

/** Team name (Michael / Trevor). A logged-in account with no profile is NOT allowed in. */
export const getMe = cache(async (): Promise<Person> => {
  const { supabase, userId } = await requireAuth();
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login?error=not-authorised");
  }
  return profile.name as Person;
});
