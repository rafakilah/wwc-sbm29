/** Pesan Bahasa Indonesia untuk kode alasan dari RPC database. */
const MESSAGES: Record<string, string> = {
  OK: "Berhasil.",
  NOT_AUTHENTICATED: "Sesi login-mu habis. Silakan masuk lagi.",
  NOT_ONBOARDED: "Lengkapi profilmu dulu, ya.",
  ALREADY_ONBOARDED: "Profilmu sudah lengkap.",
  INVALID_NIM: "NIM tidak valid. NIM harus 8 digit dan diawali 197, 190, atau 192.",
  NIM_TAKEN: "NIM ini sudah terdaftar. Hubungi admin jika ini NIM-mu.",
  INVALID_FULL_NAME: "Nama lengkap minimal 2 karakter dan maksimal 100 karakter.",
  INVALID_NICKNAME: "Nama panggilan wajib diisi (maksimal 40 karakter).",
  INVALID_LINE_ID: "ID LINE wajib diisi (maksimal 50 karakter).",
  INVALID_START: "Tanggal atau jam mulai belum diisi dengan benar.",
  INVALID_DURATION: "Durasi minimal 20 menit dan maksimal 240 menit.",
  INVALID_CAPACITY: "Kapasitas harus 2 sampai 10 orang (termasuk kamu).",
  INVALID_MODE: "Pilih mode online atau offline.",
  LOCATION_REQUIRED: "Isi lokasi atau link meeting-nya.",
  LOCATION_TOO_LONG: "Lokasi/link terlalu panjang (maksimal 300 karakter).",
  INVALID_TRACK_PREF: "Preferensi jalur tidak valid.",
  NOTES_TOO_LONG: "Catatan maksimal 500 karakter.",
  START_IN_PAST: "Waktu mulai harus di masa depan.",
  PAST_DEADLINE: "Sesi harus selesai paling lambat Sabtu, 17 Oktober 2026, 23.59 WIB.",
  OVERLAP: "Waktunya bentrok dengan sesi lain yang sudah kamu ikuti.",
  SESSION_NOT_FOUND: "Sesi tidak ditemukan. Mungkin sudah dihapus.",
  SESSION_NOT_OPEN: "Sesi ini sudah selesai atau dibatalkan.",
  SESSION_STARTED: "Sesi ini sudah dimulai.",
  SESSION_NOT_STARTED: "Sesi belum dimulai. Tandai selesai setelah waktu mulai, ya.",
  SESSION_FULL: "Sesi ini sudah penuh.",
  ALREADY_MEMBER: "Kamu sudah tergabung di sesi ini.",
  DUPLICATE_PARTNER: "Ada anggota sesi ini yang sudah pernah jadi partner wawancaramu.",
  NOT_MEMBER: "Kamu bukan anggota sesi ini.",
  HOST_CANNOT_LEAVE: "Host tidak bisa keluar. Batalkan sesi kalau tidak jadi.",
  NOT_HOST: "Hanya host yang bisa melakukan ini.",
  INVALID_URL: "Link voice memo harus berupa URL yang diawali http:// atau https://.",
  NO_PARTNERS: "Belum ada anggota lain di sesi ini. Batalkan saja kalau tidak jadi.",
  NOT_ADMIN: "Halaman ini khusus admin.",
  USER_NOT_FOUND: "User tidak ditemukan.",
  CANNOT_RESET_ADMIN: "Profil admin tidak bisa direset dari sini.",
  UNKNOWN: "Ada yang salah. Coba lagi sebentar lagi.",
};

/** Label pendek untuk tombol nonaktif di daftar sesi. */
const SHORT: Record<string, string> = {
  ALREADY_MEMBER: "Kamu sudah ikut",
  SESSION_FULL: "Penuh",
  OVERLAP: "Bentrok dengan jadwalmu",
  DUPLICATE_PARTNER: "Ada yang sudah jadi partnermu",
  SESSION_STARTED: "Sudah dimulai",
  SESSION_NOT_OPEN: "Tidak dibuka",
  NOT_ONBOARDED: "Lengkapi profil dulu",
};

export function errorMessage(code: string | null | undefined): string {
  if (!code) return MESSAGES.UNKNOWN;
  return MESSAGES[code] ?? MESSAGES.UNKNOWN;
}

export function blockerLabel(code: string): string {
  return SHORT[code] ?? errorMessage(code);
}
