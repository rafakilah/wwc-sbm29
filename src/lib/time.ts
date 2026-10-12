import { TIME_ZONE, WIB_OFFSET } from "./constants";

/** Semua format waktu memakai WIB secara eksplisit, apa pun zona waktu perangkat. */

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const keyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const keyTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "Sen, 13 Okt 2026, 10.00 WIB" */
export function formatDateTimeWib(value: Date | string): string {
  return `${dateTimeFmt.format(toDate(value))} WIB`;
}

/** "Senin, 13 Oktober" */
export function formatDateWib(value: Date | string): string {
  return dateFmt.format(toDate(value));
}

/** "10.00" */
export function formatTimeWib(value: Date | string): string {
  return timeFmt.format(toDate(value));
}

/** "10.00–10.30 WIB" */
export function formatTimeRangeWib(start: Date | string, end: Date | string): string {
  return `${formatTimeWib(start)}–${formatTimeWib(end)} WIB`;
}

/** Tanggal kalender WIB dalam format YYYY-MM-DD. */
export function wibDateKey(value: Date | string): string {
  return keyFmt.format(toDate(value));
}

/** Jam WIB dalam format HH:mm. */
export function wibTimeKey(value: Date | string): string {
  return keyTimeFmt.format(toDate(value));
}

/**
 * Ubah input tanggal (YYYY-MM-DD) dan jam (HH:mm) yang dimaksudkan sebagai WIB
 * menjadi Date. Mengembalikan null jika format tidak valid.
 */
export function wibInputToDate(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00${WIB_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  // Tolak tanggal yang "digulung" oleh Date (mis. 2026-02-31).
  if (wibDateKey(d) !== date || wibTimeKey(d) !== time) return null;
  return d;
}

/** Hitungan mundur ringkas: "4 hari 3 jam lagi". */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "sudah lewat";
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} hari ${hours} jam lagi`;
  if (hours > 0) return `${hours} jam ${mins} menit lagi`;
  return `${mins} menit lagi`;
}

/** Waktu saat ini (ms). Dipisah agar komponen server yang dirender per request bisa membacanya. */
export function nowMs(): number {
  return Date.now();
}
