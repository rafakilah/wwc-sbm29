"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDeleteSession, adminResetProfile } from "@/app/actions/admin";
import { Alert, Button, Card, StatusBadge, TrackBadge, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-result";
import { toCsv } from "@/lib/csv";
import { formatDateTimeWib } from "@/lib/time";

export type AdminParticipant = {
  user_id: string;
  email: string | null;
  full_name: string;
  nickname: string;
  nim: string;
  track: "IUP" | "REGULER";
  line_id: string;
  is_admin: boolean;
  created_at: string;
  iup_scheduled: number;
  iup_done: number;
  reguler_scheduled: number;
  reguler_done: number;
};

export type AdminSession = {
  id: string;
  host_nickname: string;
  host_nim: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  status: string;
  capacity: number;
  member_count: number;
};

function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);
  const run = (confirmText: string, fn: () => Promise<ActionState>) => {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      setResult(await fn());
      router.refresh();
    });
  };
  return { pending, result, run };
}

export function AdminParticipants({ participants }: { participants: AdminParticipant[] }) {
  const [query, setQuery] = useState("");
  const { pending, result, run } = useAdminAction();
  const q = query.trim().toLowerCase();
  const shown = q
    ? participants.filter((p) =>
        [p.nim, p.full_name, p.nickname, p.email ?? "", p.line_id].some((v) => v.toLowerCase().includes(q)),
      )
    : participants;

  function exportCsv() {
    const header = [
      "NIM", "Nama lengkap", "Nama panggilan", "Jalur", "ID LINE", "Email",
      "IUP terjadwal", "IUP selesai", "Reguler terjadwal", "Reguler selesai", "Terdaftar (WIB)",
    ];
    const rows = participants.map((p) => [
      p.nim, p.full_name, p.nickname, p.track === "IUP" ? "IUP" : "Reguler", p.line_id, p.email ?? "",
      p.iup_scheduled, p.iup_done, p.reguler_scheduled, p.reguler_done, formatDateTimeWib(p.created_at),
    ]);
    const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "peserta-wawancara-angkatan.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Peserta ({participants.length})</h2>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Export CSV peserta
        </Button>
      </div>
      <input
        type="search"
        placeholder="Cari NIM, nama, email, atau ID LINE"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputClass}
        aria-label="Cari peserta"
      />
      {result?.message ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
      <p className="text-xs text-slate-500">
        Reset profil menghapus profil, keanggotaan, dan sesi yang di-host user itu, lalu membebaskan NIM-nya. Akun Google-nya
        akan diminta onboarding ulang.
      </p>
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Peserta</th>
              <th className="px-3 py-2">IUP</th>
              <th className="px-3 py-2">Reg</th>
              <th className="px-3 py-2"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.slice(0, 200).map((p) => (
              <tr key={p.user_id}>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">
                    {p.full_name} <span className="font-normal text-slate-500">({p.nickname})</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    <span className="tabular-nums">{p.nim}</span> · <TrackBadge track={p.track} /> · {p.email ?? "-"} · LINE {p.line_id}
                  </p>
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{p.iup_done}+{p.iup_scheduled}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{p.reguler_done}+{p.reguler_scheduled}</td>
                <td className="px-3 py-2 text-right">
                  {p.is_admin ? (
                    <span className="text-xs text-slate-500">admin</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(
                          `Reset profil ${p.full_name} (NIM ${p.nim})? Sesi yang ia host ikut terhapus. Tidak bisa diurungkan.`,
                          () => adminResetProfile(p.user_id),
                        )
                      }
                      className="min-h-10 rounded-lg px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Kolom IUP/Reg: selesai + terjadwal.{shown.length > 200 ? " Menampilkan 200 pertama, persempit pencarian." : ""}</p>
    </Card>
  );
}

export function AdminSessions({ sessions }: { sessions: AdminSession[] }) {
  const { pending, result, run } = useAdminAction();
  const [status, setStatus] = useState("");
  const shown = status ? sessions.filter((s) => s.status === status) : sessions;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Sesi ({sessions.length})</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" aria-label="Filter status">
          <option value="">Semua status</option>
          <option value="open">Terjadwal</option>
          <option value="done">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>
      {result?.message ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
      <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
        {shown.slice(0, 300).map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <Link href={`/sessions/${s.id}`} className="font-medium text-brand-700 underline underline-offset-2">
                {formatDateTimeWib(s.starts_at)}
              </Link>
              <p className="text-xs text-slate-600">
                Host {s.host_nickname} ({s.host_nim}) · {s.mode} · {s.member_count}/{s.capacity}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge status={s.status} />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run("Hapus sesi ini permanen? Semua anggotanya tidak lagi dihitung sebagai partner.", () => adminDeleteSession(s.id))
                }
                className="min-h-10 rounded-lg px-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Hapus
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
