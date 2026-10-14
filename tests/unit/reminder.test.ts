import { describe, expect, it } from "vitest";
import { isInReminderWindow } from "@/components/starting-soon-banner";

const start = new Date("2026-10-15T03:00:00.000Z").getTime(); // 10.00 WIB
const s = { status: "open" as const, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 30 * 60_000).toISOString() };
const min = 60_000;

describe("isInReminderWindow", () => {
  it("muncul tepat 30 menit sebelum mulai sampai sesi selesai", () => {
    expect(isInReminderWindow(s, start - 31 * min)).toBe(false);
    expect(isInReminderWindow(s, start - 30 * min)).toBe(true);
    expect(isInReminderWindow(s, start - 5 * min)).toBe(true);
    expect(isInReminderWindow(s, start + 10 * min)).toBe(true);
    expect(isInReminderWindow(s, start + 30 * min)).toBe(false);
  });
  it("tidak muncul untuk sesi yang dibatalkan atau selesai", () => {
    expect(isInReminderWindow({ ...s, status: "cancelled" as const }, start - 5 * min)).toBe(false);
    expect(isInReminderWindow({ ...s, status: "done" as const }, start + 5 * min)).toBe(false);
  });
});
