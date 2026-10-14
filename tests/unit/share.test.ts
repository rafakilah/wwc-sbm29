import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";
import { buildShareText, inviteUrl } from "@/lib/share";

describe("share", () => {
  it("link undangan membuka popup preview", () => {
    expect(inviteUrl("https://wwc-sbm29.vercel.app", "abc")).toBe("https://wwc-sbm29.vercel.app/sessions/abc?undangan=1");
  });

  it("teks ajakan: offline menyebut lokasi, online tidak menyebar link meeting", () => {
    const base = { startsAt: "2026-10-15T03:00:00.000Z", seats: 3 };
    const off = buildShareText({ ...base, mode: "offline", location: "Selasar SBM" });
    expect(off).toContain("10.00 WIB");
    expect(off).toContain("Offline, Selasar SBM");
    expect(off).toContain("sisa 3 kursi");
    const on = buildShareText({ ...base, mode: "online", location: "https://meet.google.com/abc", seats: 0 });
    expect(on).toContain("Online");
    expect(on).not.toContain("meet.google.com");
    expect(on).toContain("kursi penuh");
  });
});

describe("safeNext", () => {
  it("menerima path internal", () => {
    expect(safeNext("/sessions/abc?undangan=1")).toBe("/sessions/abc?undangan=1");
    expect(safeNext(["/partners"])).toBe("/partners");
  });
  it("menolak URL luar dan kosong", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "", null, undefined]) {
      expect(safeNext(bad)).toBeUndefined();
    }
  });
});
