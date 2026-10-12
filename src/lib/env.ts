/**
 * Variabel lingkungan publik (aman untuk browser).
 * Key service_role TIDAK dipakai aplikasi web sama sekali; hanya script seed lokal.
 */
export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum diset");
  return url;
}

export function supabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diset");
  return key;
}

/**
 * Daftar domain email yang boleh login, dipisah koma (mis. "itb.ac.id,students.itb.ac.id").
 * Kosong = semua akun Google boleh login (default sesuai brief).
 */
export function allowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const domains = allowedEmailDomains();
  if (domains.length === 0) return true;
  const domain = (email ?? "").toLowerCase().split("@")[1] ?? "";
  return domains.includes(domain);
}
