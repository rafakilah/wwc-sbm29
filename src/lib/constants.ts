/** Konstanta konfigurasi aplikasi. */

/** Zona waktu tampilan dan input. Semua waktu ditampilkan dalam WIB. */
export const TIME_ZONE = "Asia/Jakarta";
/** Offset WIB (tidak ada DST). */
export const WIB_OFFSET = "+07:00";

/**
 * Deadline pengumpulan: Sabtu, 17 Oktober 2026, 23.59 WIB.
 * Harus sama dengan public.app_deadline() di migration.
 */
export const DEADLINE_ISO = "2026-10-17T23:59:00+07:00";
export const DEADLINE = new Date(DEADLINE_ISO);

/** Target wawancara per jalur. */
export const TARGET_PER_TRACK = 25;
export const TARGET_TOTAL = TARGET_PER_TRACK * 2;

/** Aturan sesi (harus sama dengan constraint di database). */
export const SESSION_MIN_DURATION = 20;
export const SESSION_MAX_DURATION = 240;
export const SESSION_DEFAULT_DURATION = 30;
export const SESSION_MIN_CAPACITY = 2;
export const SESSION_MAX_CAPACITY = 10;
export const SESSION_DEFAULT_CAPACITY = 10;
