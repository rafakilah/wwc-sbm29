/**
 * Satu-satunya sumber kebenaran aturan NIM -> jalur di sisi TypeScript.
 * Dipakai oleh form (validasi real-time) dan server action.
 *
 * Database mencerminkan aturan yang sama di fungsi public.nim_track()
 * (supabase/migrations/..._init.sql). Kalau aturan ini diubah, ubah keduanya.
 */

export type Track = "IUP" | "REGULER";

/** Panjang NIM (digit angka). */
export const NIM_LENGTH = 8;

/** Prefix NIM per jalur. */
export const NIM_PREFIXES: Record<Track, readonly string[]> = {
  REGULER: ["197"],
  IUP: ["190", "192"],
};

export type NimCheck =
  | { ok: true; nim: string; track: Track }
  | { ok: false; reason: "EMPTY" | "NOT_DIGITS" | "WRONG_LENGTH" | "UNKNOWN_PREFIX"; message: string };

export function trackFromNim(input: string): NimCheck {
  const nim = (input ?? "").trim();
  if (nim.length === 0) {
    return { ok: false, reason: "EMPTY", message: "NIM wajib diisi." };
  }
  if (!/^[0-9]+$/.test(nim)) {
    return { ok: false, reason: "NOT_DIGITS", message: "NIM hanya boleh berisi angka." };
  }
  if (nim.length !== NIM_LENGTH) {
    return {
      ok: false,
      reason: "WRONG_LENGTH",
      message: `NIM harus ${NIM_LENGTH} digit (sekarang ${nim.length} digit).`,
    };
  }
  for (const track of Object.keys(NIM_PREFIXES) as Track[]) {
    if (NIM_PREFIXES[track].some((prefix) => nim.startsWith(prefix))) {
      return { ok: true, nim, track };
    }
  }
  const allowed = Object.values(NIM_PREFIXES).flat().join(", ");
  return {
    ok: false,
    reason: "UNKNOWN_PREFIX",
    message: `NIM harus diawali ${allowed}. Cek lagi NIM-mu, ya.`,
  };
}

export const TRACK_LABEL: Record<Track, string> = {
  IUP: "IUP",
  REGULER: "Reguler",
};
