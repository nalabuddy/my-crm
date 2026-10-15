import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * A valid login with no team profile lands here. A Route Handler (unlike a page) can clear the session
 * cookies, so the person is really signed out and sent to the login page instead of bouncing in a loop.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=not-authorised", req.url));
}
