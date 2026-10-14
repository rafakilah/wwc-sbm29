/** Utilitas "Tambah ke kalender": link Google Calendar dan file iCalendar (.ics). */

export type CalendarEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
};

export type CalendarSessionInput = {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: "online" | "offline";
  location: string;
  notes: string | null;
  hostNickname: string;
  sessionUrl: string;
};

/** Format UTC dasar iCalendar/Google: YYYYMMDDTHHMMSSZ. */
export function toCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendarEvent(input: CalendarSessionInput): CalendarEvent {
  const lines = [
    `Mode: ${input.mode === "online" ? "Online" : "Offline"}`,
    `${input.mode === "online" ? "Link meeting" : "Lokasi"}: ${input.location}`,
  ];
  if (input.notes) lines.push("", `Catatan: ${input.notes}`);
  lines.push(
    "",
    `Halaman sesi: ${input.sessionUrl}`,
    "Jadwal bisa berubah atau dibatalkan, cek status terbaru di website.",
  );
  return {
    uid: `${input.id}@wwc-sbm29`,
    title: `Wawancara Angkatan SBM 2026 · Host: ${input.hostNickname}`,
    start: new Date(input.startsAt),
    end: new Date(input.endsAt),
    location: input.location,
    description: lines.join("\n"),
  };
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarStamp(event.start)}/${toCalendarStamp(event.end)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape teks iCalendar (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lipat baris > 75 oktet (UTF-8) dengan CRLF + spasi, tanpa memotong karakter. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // baris lanjutan diawali satu spasi
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OS SBM ITB 2026//Wawancara Angkatan//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toCalendarStamp(now)}`,
    `DTSTART:${toCalendarStamp(event.start)}`,
    `DTEND:${toCalendarStamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Sesi wawancara angkatan mulai 30 menit lagi",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
