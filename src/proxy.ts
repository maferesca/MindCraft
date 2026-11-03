import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isDemoEnabled, isSupabaseConfigured } from "@/lib/supabase/config";

const PROTECTED_PREFIXES = ["/workspace", "/welcome"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

// Refreshes the Supabase session cookie and redirects signed-out visitors
// away from private pages. Data access is still enforced by RLS.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isDemo = isDemoEnabled && request.cookies.get(DEMO_COOKIE)?.value === "1";
  let response = NextResponse.next({ request });
  let signedIn = false;

  if (isSupabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isProtected && !signedIn && !isDemo) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if ((AUTH_PAGES.includes(path) || path === "/") && (signedIn || isDemo)) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|offline.html|icons|.*\.(?:svg|png|ico|webp)$).*)"],
};
