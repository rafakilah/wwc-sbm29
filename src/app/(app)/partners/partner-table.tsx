"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteManualInterview } from "@/app/actions/manual";
import { Alert, Button, EmptyState, StatusBadge, TrackBadge } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { toCsv, toTsv } from "@/lib/csv";
import { formatDateTimeWib } from "@/lib/time";
import type { InterviewRecord } from "@/lib/types";

const HEADER = [
  "Nama lengkap",
  "Nama panggilan",
  "NIM",
  "Jalur",
  "ID LINE",
  "Waktu wawancara (WIB)",
  "Status",
  "Sumber",
  "Link voice memo",
  "Catatan",
];

function toRows(records: InterviewRecord[]) {
  return records.map((r) => [
    r.full_name,
    r.nickname ?? "",
    r.nim,
    r.track === "IUP" ? "IUP" : "Reguler",
    r.line_id ?? "",
    formatDateTimeWib(r.happened_at),
    r.status === "done" ? "Selesai" : "Terjadwal",
    r.source === "manual" ? "Manual" : "Sesi",
    r.voice_memo_url ?? "",
    r.notes ?? "",
  ]);
}

function SourceBadge({ source }: { source: InterviewRecord["source"] }) {
  return source === "manual" ? (
    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
      Manual
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
      Sesi
    </span>
  );
}

function WhenCell({ record }: { record: InterviewRecord }) {
  const when = formatDateTimeWib(record.happened_at);
  return record.source === "session" ? (
    <Link href={`/sessions/${record.record_id}`} className="text-brand-700 underline underline-offset-2">
      {when}
    </Link>
  ) : (
    <span>{when}</span>
  );
}

export function PartnerTable({ records }: { records: InterviewRecord[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [filter, setFilter] = useState<"" | "IUP" | "REGULER">("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const shown = filter ? records.filter((r) => r.track === filter) : records;
  const iup = records.filter((r) => r.track === "IUP").length;

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
    a.download = "progress-wawancara-angkatan.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function remove(record: InterviewRecord) {
    if (!window.confirm(`Hapus catatan manual untuk ${record.full_name} (${record.nim})?`)) return;
    startTransition(async () => {
      setResult(await deleteManualInterview(record.record_id));
      router.refresh();
    });
  }

  if (records.length === 0) {
    return (
      <EmptyState>
        Belum ada wawancara tercatat.{" "}
        <Link href="/sessions" className="font-medium text-brand-700 underline">
          Cari sesi
        </Link>
        , buat sesi baru, atau catat wawancara lama lewat “Tambah wawancara manual”.
      </EmptyState>
    );
  }

  const deleteButton = (r: InterviewRecord) =>
    r.source === "manual" ? (
      <button
        type="button"
        disabled={pending}
        onClick={() => remove(r)}
        className="min-h-10 rounded-lg px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Hapus
      </button>
    ) : null;

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
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"
          >
            <option value="">Semua ({records.length})</option>
            <option value="IUP">IUP ({iup})</option>
            <option value="REGULER">Reguler ({records.length - iup})</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">
        “Salin tabel” menyalin format tab-separated, tinggal tempel ke Google Sheets atau Excel.
      </p>
      {result?.message ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}

      {/* Mobile: kartu */}
      <ul className="space-y-2 md:hidden">
        {shown.map((r) => (
          <li key={`${r.source}-${r.record_id}-${r.nim}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{r.nickname ?? r.full_name}</p>
                {r.nickname ? <p className="text-slate-700">{r.full_name}</p> : null}
              </div>
              <TrackBadge track={r.track} />
            </div>
            <p className="mt-1 text-slate-600">
              NIM {r.nim}
              {r.line_id ? (
                <>
                  {" "}
                  · LINE <span className="font-medium text-slate-800">{r.line_id}</span>
                </>
              ) : null}
            </p>
            {r.notes ? <p className="mt-1 text-xs text-slate-600">{r.notes}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <WhenCell record={r} />
              <StatusBadge status={r.status} />
              <SourceBadge source={r.source} />
              {r.voice_memo_url ? (
                <a href={r.voice_memo_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
                  Voice memo
                </a>
              ) : null}
              <span className="ml-auto">{deleteButton(r)}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Nama</th>
              <th scope="col" className="px-3 py-2 font-semibold">NIM</th>
              <th scope="col" className="px-3 py-2 font-semibold">Jalur</th>
              <th scope="col" className="px-3 py-2 font-semibold">ID LINE</th>
              <th scope="col" className="px-3 py-2 font-semibold">Waktu</th>
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2 font-semibold">Sumber</th>
              <th scope="col" className="px-3 py-2 font-semibold">Voice memo</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={`${r.source}-${r.record_id}-${r.nim}`}>
                <td className="px-3 py-2">
                  <p className="text-slate-900">{r.full_name}</p>
                  {r.nickname ? <p className="text-xs text-slate-500">{r.nickname}</p> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.nim}</td>
                <td className="px-3 py-2"><TrackBadge track={r.track} /></td>
                <td className="px-3 py-2">{r.line_id ?? <span className="text-slate-400">-</span>}</td>
                <td className="whitespace-nowrap px-3 py-2"><WhenCell record={r} /></td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2"><SourceBadge source={r.source} /></td>
                <td className="px-3 py-2">
                  {r.voice_memo_url ? (
                    <a href={r.voice_memo_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
                      Buka
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{deleteButton(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
