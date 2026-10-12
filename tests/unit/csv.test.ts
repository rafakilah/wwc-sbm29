import { describe, expect, it } from "vitest";
import { UTF8_BOM, toCsv, toTsv } from "@/lib/csv";

describe("csv/tsv", () => {
  it("CSV diawali BOM dan meng-escape koma, kutip, dan baris baru", () => {
    const csv = toCsv(["Nama", "Catatan"], [["Ani, S.", 'kata "hai"'], ["Budi", "a\nb"]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${UTF8_BOM}Nama,Catatan\r\n"Ani, S.","kata ""hai"""\r\nBudi,"a\nb"\r\n`);
  });

  it("TSV mengganti tab dan baris baru di dalam sel", () => {
    expect(toTsv(["a", "b"], [["x\ty", "1\n2"], [null, 3]])).toBe("a\tb\nx y\t1 2\n\t3");
  });
});
