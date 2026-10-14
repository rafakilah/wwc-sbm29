import { describe, expect, it } from "vitest";
import { buildCalendarEvent, buildIcs, googleCalendarUrl, toCalendarStamp } from "@/lib/calendar";

const event = buildCalendarEvent({
  id: "11111111-2222-3333-4444-555555555555",
  startsAt: "2026-10-15T03:00:00.000Z", // 10.00 WIB
  endsAt: "2026-10-15T03:30:00.000Z",
  mode: "offline",
  location: "Selasar SBM, lantai 1; dekat tangga",
  notes: "Grup LINE: https://line.me/R/ti/g/abc123\nBawa HP, buat rekam.",
  hostNickname: "Rafa",
  sessionUrl: "https://wwc-sbm29.vercel.app/sessions/11111111-2222-3333-4444-555555555555",
});

describe("calendar", () => {
  it("stamp UTC: 10.00 WIB -> 030000Z", () => {
    expect(toCalendarStamp(new Date("2026-10-15T03:00:00.000Z"))).toBe("20261015T030000Z");
  });

  it("link Google Calendar berisi judul, waktu, lokasi, dan catatan", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261015T030000Z/20261015T033000Z");
    expect(url.searchParams.get("text")).toBe("Wawancara Angkatan SBM 2026 · Host: Rafa");
    expect(url.searchParams.get("location")).toBe("Selasar SBM, lantai 1; dekat tangga");
    expect(url.searchParams.get("details")).toContain("https://line.me/R/ti/g/abc123");
    expect(url.searchParams.get("details")).toContain("cek status terbaru di website");
  });

  it("file .ics valid: CRLF, escape, pengingat 30 menit, baris maksimal 75 oktet", () => {
    const ics = buildIcs(event, new Date("2026-10-14T00:00:00.000Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(ics).toContain("DTSTART:20261015T030000Z\r\n");
    expect(ics).toContain("DTEND:20261015T033000Z\r\n");
    expect(ics).toContain("UID:11111111-2222-3333-4444-555555555555@wwc-sbm29");
    expect(ics).toContain("LOCATION:Selasar SBM\\, lantai 1\; dekat tangga");
    expect(ics).toContain("TRIGGER:-PT30M");
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    // Setelah unfold, deskripsi utuh dan baris baru ter-escape.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("Catatan: Grup LINE: https://line.me/R/ti/g/abc123\\nBawa HP\\, buat rekam.");
  });
});
