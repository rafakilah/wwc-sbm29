import { describe, expect, it } from "vitest";
import { DEADLINE } from "@/lib/constants";
import { formatDateTimeWib, formatTimeRangeWib, wibDateKey, wibInputToDate, wibTimeKey } from "@/lib/time";

describe("waktu WIB", () => {
  it("input WIB dikonversi ke UTC yang benar", () => {
    expect(wibInputToDate("2026-10-13", "10:00")?.toISOString()).toBe("2026-10-13T03:00:00.000Z");
    expect(wibInputToDate("2026-10-13", "00:30")?.toISOString()).toBe("2026-10-12T17:30:00.000Z");
  });

  it("menolak input tidak valid", () => {
    expect(wibInputToDate("2026-02-31", "10:00")).toBeNull();
    expect(wibInputToDate("13-10-2026", "10:00")).toBeNull();
    expect(wibInputToDate("2026-10-13", "25:00")).toBeNull();
  });

  it("menampilkan dalam WIB apa pun zona waktu proses", () => {
    const d = new Date("2026-10-12T17:30:00Z");
    expect(wibDateKey(d)).toBe("2026-10-13");
    expect(wibTimeKey(d)).toBe("00:30");
    expect(formatDateTimeWib(d)).toContain("WIB");
    expect(formatTimeRangeWib(d, new Date(d.getTime() + 30 * 60_000))).toBe("00.30–01.00 WIB");
  });

  it("deadline 17 Oktober 2026 23.59 WIB", () => {
    expect(DEADLINE.toISOString()).toBe("2026-10-17T16:59:00.000Z");
    expect(wibDateKey(DEADLINE)).toBe("2026-10-17");
    expect(wibTimeKey(DEADLINE)).toBe("23:59");
  });
});
