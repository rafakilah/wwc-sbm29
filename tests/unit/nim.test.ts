import { describe, expect, it } from "vitest";
import { NIM_LENGTH, trackFromNim } from "@/lib/nim";

describe("trackFromNim", () => {
  it.each([
    ["19724001", "REGULER"],
    ["19024001", "IUP"],
    ["19224001", "IUP"],
  ])("%s -> %s", (nim, track) => {
    expect(trackFromNim(nim)).toEqual({ ok: true, nim, track });
  });

  it.each([
    ["18024001", "UNKNOWN_PREFIX"],
    ["abc", "NOT_DIGITS"],
    ["1972400", "WRONG_LENGTH"],
    ["197240011", "WRONG_LENGTH"],
    ["", "EMPTY"],
    ["1972 4001", "NOT_DIGITS"],
  ])("%s ditolak (%s)", (nim, reason) => {
    const res = trackFromNim(nim);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe(reason);
      expect(res.message.length).toBeGreaterThan(0);
    }
  });

  it("mengabaikan spasi di awal/akhir", () => {
    expect(trackFromNim("  19724001 ")).toMatchObject({ ok: true, nim: "19724001" });
  });

  it("panjang NIM dikonfigurasi 8 digit", () => {
    expect(NIM_LENGTH).toBe(8);
  });
});
