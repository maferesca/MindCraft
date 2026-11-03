import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/workspace", "/welcome", "/reset-password"];

// Handles links from Supabase emails (sign-up confirmation and password
// recovery). Exchanges the one-time code for a session cookie.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/workspace";
  // Only allow known internal paths to prevent open redirects.
  const next = ALLOWED_NEXT.includes(requestedNext) ? requestedNext : "/workspace";

  const supabase = await getServerSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const failure = new URL("/sign-in", url.origin);
  failure.searchParams.set("error", "link");
  return NextResponse.redirect(failure);
}
