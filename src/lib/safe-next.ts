/**
 * Tujuan redirect setelah login/onboarding. Hanya path internal yang diterima
 * ("/..."), bukan "//host" atau "/\host" yang bisa dibaca browser sebagai domain lain.
 */
export function safeNext(value: string | string[] | null | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return undefined;
  return v;
}
