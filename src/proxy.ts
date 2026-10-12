import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed, supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Proxy (nama baru "middleware" di Next.js 16):
 * - menyegarkan cookie sesi Supabase,
 * - mengalihkan user yang belum login ke /login,
 * - mengalihkan user yang belum onboarding ke /onboarding,
 * - menolak email di luar ALLOWED_EMAIL_DOMAINS (jika diisi).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const res = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/auth/");
  const isLogin = path === "/login";

  // Halaman publik, bisa dibuka tanpa login (dibutuhkan Google OAuth consent screen).
  if (path === "/privasi") return response;

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    if (isLogin || isAuthRoute) return response;
    const params: Record<string, string> = {};
    if (path !== "/") params.next = path + request.nextUrl.search;
    return redirectTo("/login", params);
  }

  if (isAuthRoute) return response;

  if (!isEmailAllowed(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return redirectTo("/login", { error: "domain" });
  }

  const { data: profile } = await supabase
    .from("profiles_private")
    .select("id")
    .eq("id", claims.sub)
    .maybeSingle();
  const onboarded = Boolean(profile);

  if (!onboarded) {
    if (path === "/onboarding") return response;
    return redirectTo("/onboarding");
  }

  if (path === "/" || isLogin || path === "/onboarding") {
    return redirectTo("/dashboard");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
