import { NextResponse, type NextRequest } from "next/server";
import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Tujuan akhir OAuth Google: tukar code dengan sesi, lalu lanjut ke aplikasi. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=domain", origin));
  }

  // Proxy akan mengalihkan ke /onboarding jika profil belum lengkap.
  return NextResponse.redirect(new URL(next, origin));
}
