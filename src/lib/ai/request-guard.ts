import "server-only";

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSupabase } from "../supabase/server";
import { DEMO_COOKIE, isDemoEnabled } from "../supabase/config";
import { allowDemoAi } from "./server-env";

type Identity = { kind: "user"; id: string } | { kind: "demo"; id: string };

// Resolves who is calling an AI endpoint. Signed-in Supabase users are always
// allowed; the local demo is allowed only when ALLOW_DEMO_AI=true.
export async function requireAiIdentity(): Promise<Identity | NextResponse> {
  const supabase = await getServerSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (userId) return { kind: "user", id: userId };
  }
  const cookieStore = await cookies();
  if (isDemoEnabled && cookieStore.get(DEMO_COOKIE)?.value === "1") {
    if (!allowDemoAi) {
      return errorResponse(403, "ai_disabled_in_demo", "AI features are off in the local demo. Sign in, or set ALLOW_DEMO_AI=true for local testing.");
    }
    const headerStore = await headers();
    const address = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    return { kind: "demo", id: `demo:${address}` };
  }
  return errorResponse(401, "unauthenticated", "Please sign in to use the assistant.");
}

// Simple in-memory sliding window. It protects a single server instance;
// a multi-instance deployment should move this to a shared store.
const requestLog = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return NextResponse.json(
      { error: { code: "rate_limited", message: `Too many requests. Try again in about ${retryAfter} seconds.` } },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  recent.push(now);
  requestLog.set(key, recent);
  return null;
}

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
