import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/errors";

describe("errorMessage", () => {
  it("NIM_TAKEN memakai pesan dari brief", () => {
    expect(errorMessage("NIM_TAKEN")).toBe("NIM ini sudah terdaftar. Hubungi admin jika ini NIM-mu.");
  });
  it("kode tidak dikenal jatuh ke pesan umum", () => {
    expect(errorMessage("APA_INI")).toBe(errorMessage("UNKNOWN"));
  });
});
