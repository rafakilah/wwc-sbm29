"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, EmptyState, StatusBadge, TrackBadge } from "@/components/ui";
import { toCsv, toTsv } from "@/lib/csv";
import { formatDateTimeWib } from "@/lib/time";
import type { PartnerRow } from "@/lib/types";

const HEADER = ["Nama lengkap", "Nama panggilan", "NIM", "Jalur", "ID LINE", "Waktu sesi (WIB)", "Status", "Link voice memo"];

function toRows(partners: PartnerRow[]) {
  return partners.map((p) => [
    p.full_name,
    p.nickname,
    p.nim,
    p.track === "IUP" ? "IUP" : "Reguler",
    p.line_id,
    formatDateTimeWib(p.starts_at),
    p.session_status === "done" ? "Selesai" : "Terjadwal",
    p.voice_memo_url ?? "",
  ]);
}

export function PartnerTable({ partners }: { partners: PartnerRow[] }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [filter, setFilter] = useState<"" | "IUP" | "REGULER">("");
  const shown = filter ? partners.filter((p) => p.track === filter) : partners;
  const iup = partners.filter((p) => p.track === "IUP").length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(HEADER, toRows(shown)));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  function download() {
    const blob = new Blob([toCsv(HEADER, toRows(shown))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "partner-wawancara-angkatan.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (partners.length === 0) {
    return (
      <EmptyState>
        Belum ada partner. <Link href="/sessions" className="font-medium text-brand-700 underline">Cari sesi</Link> atau buat sesi baru.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={copy}>
          {copied === "ok" ? "Tersalin!" : copied === "fail" ? "Gagal menyalin" : "Salin tabel"}
        </Button>
        <Button type="button" variant="secondary" onClick={download}>
          Export CSV
        </Button>
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-700">
          Jalur
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">
            <option value="">Semua ({partners.length})</option>
            <option value="IUP">IUP ({iup})</option>
            <option value="REGULER">Reguler ({partners.length - iup})</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">“Salin tabel” menyalin format tab-separated, tinggal tempel ke Google Sheets atau Excel.</p>

      {/* Mobile: kartu */}
      <ul className="space-y-2 md:hidden">
        {shown.map((p) => (
          <li key={`${p.partner_id}-${p.session_id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{p.nickname}</p>
                <p className="text-slate-700">{p.full_name}</p>
              </div>
              <TrackBadge track={p.track} />
            </div>
            <p className="mt-1 text-slate-600">
              NIM {p.nim} · LINE <span className="font-medium text-slate-800">{p.line_id}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Link href={`/sessions/${p.session_id}`} className="text-brand-700 underline underline-offset-2">
                {formatDateTimeWib(p.starts_at)}
              </Link>
              <StatusBadge status={p.session_status} />
              {p.voice_memo_url ? (
                <a href={p.voice_memo_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
                  Voice memo
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {HEADER.map((h) => (
                <th key={h} scope="col" className="px-3 py-2 font-semibold">
                  {h.replace(" (WIB)", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((p) => (
              <tr key={`${p.partner_id}-${p.session_id}`}>
                <td className="px-3 py-2 text-slate-900">{p.full_name}</td>
                <td className="px-3 py-2">{p.nickname}</td>
                <td className="px-3 py-2 tabular-nums">{p.nim}</td>
                <td className="px-3 py-2"><TrackBadge track={p.track} /></td>
                <td className="px-3 py-2">{p.line_id}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link href={`/sessions/${p.session_id}`} className="text-brand-700 underline underline-offset-2">
                    {formatDateTimeWib(p.starts_at)}
                  </Link>
                </td>
                <td className="px-3 py-2"><StatusBadge status={p.session_status} /></td>
                <td className="px-3 py-2">
                  {p.voice_memo_url ? (
                    <a href={p.voice_memo_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
                      Buka
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
