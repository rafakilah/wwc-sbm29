/** Utilitas ekspor tabel. */

export const UTF8_BOM = "﻿";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV dengan BOM UTF-8 dan CRLF supaya rapi saat dibuka di Excel. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

function tsvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.replace(/[\t\r\n]+/g, " ");
}

/** Tab-separated, siap ditempel ke Google Sheets/Excel. */
export function toTsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(tsvCell).join("\t")).join("\n");
}
