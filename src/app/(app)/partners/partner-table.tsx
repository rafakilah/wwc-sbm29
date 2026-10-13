"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteManualInterview } from "@/app/actions/manual";
import { Alert, Button, EmptyState, StatusBadge, TrackBadge } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { toCsv, toTsv } from "@/lib/csv";
import { groupByPerson, type PersonGroup } from "@/lib/interview-groups";
import { formatDateTimeWib } from "@/lib/time";
import type { InterviewRecord } from "@/lib/types";

const HEADER = [
  "Nama lengkap",
  "Nama panggilan",
  "NIM",
  "Jalur",
  "ID LINE",
  "Status",
  "Jumlah pertemuan",
  "Waktu wawancara (WIB)",
  "Sumber",
  "Link voice memo",
  "Catatan",
];

function joinUnique(values: (string | null | undefined)[]): string {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].join("; ");
}

function toRows(groups: PersonGroup[]) {
  return groups.map((g) => [
    g.full_name,
    g.nickname ?? "",
    g.nim,
    g.track === "IUP" ? "IUP" : "Reguler",
    g.line_id ?? "",
    g.status === "done" ? "Selesai" : "Terjadwal",
    g.meetings.length,
    g.meetings.map((m) => formatDateTimeWib(m.happened_at)).join("; "),
    joinUnique(g.meetings.map((m) => (m.source === "manual" ? "Manual" : "Sesi"))),
    joinUnique(g.meetings.map((m) => m.voice_memo_url)),
    joinUnique(g.meetings.map((m) => m.notes)),
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

function RepeatBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
      title="Bertemu lebih dari sekali. Tetap dihitung 1 orang di progress."
    >
      Ikut wawancara {count}x
    </span>
  );
}

export function PartnerTable({ records }: { records: InterviewRecord[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [filter, setFilter] = useState<"" | "IUP" | "REGULER">("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  const groups = groupByPerson(records);
  const shown = filter ? groups.filter((g) => g.track === filter) : groups;
  const iup = groups.filter((g) => g.track === "IUP").length;
  const repeated = groups.filter((g) => g.meetings.length > 1).length;

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

  /** Daftar pertemuan dengan satu orang (waktu, status, sumber, voice memo, hapus). */
  const meetingList = (g: PersonGroup) => (
    <ul className="space-y-1.5">
      {g.meetings.map((m) => (
        <li key={`${m.source}-${m.record_id}`} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {m.source === "session" ? (
            <Link href={`/sessions/${m.record_id}`} className="text-brand-700 underline underline-offset-2">
              {formatDateTimeWib(m.happened_at)}
            </Link>
          ) : (
            <span>{formatDateTimeWib(m.happened_at)}</span>
          )}
          <StatusBadge status={m.status} />
          <SourceBadge source={m.source} />
          {m.voice_memo_url ? (
            <a href={m.voice_memo_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-2">
              Voice memo
            </a>
          ) : null}
          {m.source === "manual" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(m)}
              className="min-h-9 rounded-lg px-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Hapus
            </button>
          ) : null}
          {m.notes ? <span className="basis-full text-slate-500">{m.notes}</span> : null}
        </li>
      ))}
    </ul>
  );

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
            <option value="">Semua ({groups.length})</option>
            <option value="IUP">IUP ({iup})</option>
            <option value="REGULER">Reguler ({groups.length - iup})</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Satu orang tampil satu kali walaupun bertemu lebih dari sekali, sama seperti hitungan progress.
        {repeated > 0 ? ` ${repeated} orang ditemui lebih dari sekali.` : ""} “Salin tabel” menyalin format
        tab-separated, tinggal tempel ke Google Sheets atau Excel.
      </p>
      {result?.message ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}

      {/* Mobile: kartu */}
      <ul className="space-y-2 md:hidden">
        {shown.map((g) => (
          <li key={g.nim} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{g.nickname ?? g.full_name}</p>
                {g.nickname ? <p className="text-slate-700">{g.full_name}</p> : null}
              </div>
              <TrackBadge track={g.track} />
            </div>
            <p className="mt-1 text-slate-600">
              NIM {g.nim}
              {g.line_id ? (
                <>
                  {" "}
                  · LINE <span className="font-medium text-slate-800">{g.line_id}</span>
                </>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={g.status} />
              <RepeatBadge count={g.meetings.length} />
            </div>
            <div className="mt-2 border-t border-slate-100 pt-2">{meetingList(g)}</div>
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
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2 font-semibold">Pertemuan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {shown.map((g) => (
              <tr key={g.nim}>
                <td className="px-3 py-2">
                  <p className="text-slate-900">{g.full_name}</p>
                  {g.nickname ? <p className="text-xs text-slate-500">{g.nickname}</p> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{g.nim}</td>
                <td className="px-3 py-2"><TrackBadge track={g.track} /></td>
                <td className="px-3 py-2">{g.line_id ?? <span className="text-slate-400">-</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={g.status} />
                    <RepeatBadge count={g.meetings.length} />
                  </div>
                </td>
                <td className="px-3 py-2">{meetingList(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
