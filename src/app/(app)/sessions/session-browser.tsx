"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MemberChips } from "@/components/member-chips";
import { SessionActionButton } from "@/components/session-action-button";
import { Card, EmptyState, TRACK_PREF_LABEL, cn, inputClass } from "@/components/ui";
import { blockerLabel, errorMessage } from "@/lib/errors";
import { formatDateWib, formatTimeRangeWib, wibDateKey } from "@/lib/time";
import type { OpenSessionRow } from "@/lib/types";

type Filters = {
  date: string;
  mode: "" | "online" | "offline";
  minSeats: number;
  trackPref: "" | "BEBAS" | "IUP" | "REGULER";
  joinableOnly: boolean;
};

const DEFAULT_FILTERS: Filters = { date: "", mode: "", minSeats: 0, trackPref: "", joinableOnly: false };

export function SessionBrowser({ sessions }: { sessions: OpenSessionRow[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const dates = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) map.set(wibDateKey(s.starts_at), formatDateWib(s.starts_at));
    return [...map.entries()];
  }, [sessions]);

  const visible = sessions.filter((s) => {
    const seats = s.capacity - s.member_count;
    if (filters.date && wibDateKey(s.starts_at) !== filters.date) return false;
    if (filters.mode && s.mode !== filters.mode) return false;
    if (filters.minSeats && seats < filters.minSeats) return false;
    if (filters.trackPref && s.track_pref !== filters.trackPref) return false;
    if (filters.joinableOnly && s.blocker) return false;
    return true;
  });

  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Tanggal
            <select className={inputClass} value={filters.date} onChange={(e) => set("date", e.target.value)}>
              <option value="">Semua</option>
              {dates.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Mode
            <select className={inputClass} value={filters.mode} onChange={(e) => set("mode", e.target.value as Filters["mode"])}>
              <option value="">Semua</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Sisa kursi
            <select className={inputClass} value={filters.minSeats} onChange={(e) => set("minSeats", Number(e.target.value))}>
              <option value={0}>Semua</option>
              <option value={1}>Minimal 1</option>
              <option value={2}>Minimal 2</option>
              <option value={3}>Minimal 3</option>
              <option value={5}>Minimal 5</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Preferensi jalur
            <select className={inputClass} value={filters.trackPref} onChange={(e) => set("trackPref", e.target.value as Filters["trackPref"])}>
              <option value="">Semua</option>
              <option value="BEBAS">Bebas</option>
              <option value="IUP">IUP</option>
              <option value="REGULER">Reguler</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              role="switch"
              checked={filters.joinableOnly}
              onChange={(e) => set("joinableOnly", e.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
            Hanya yang bisa kuikuti
          </label>
          {isFiltered ? (
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="min-h-11 text-sm font-medium text-brand-700 underline underline-offset-4">
              Reset filter
            </button>
          ) : null}
        </div>
      </Card>

      <p className="text-sm text-slate-600" aria-live="polite">
        {visible.length} dari {sessions.length} sesi
      </p>

      {visible.length === 0 ? (
        <EmptyState>
          {sessions.length === 0
            ? "Belum ada sesi terbuka. Jadilah yang pertama, tekan “Buat sesi”!"
            : "Tidak ada sesi yang cocok dengan filter."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li key={s.id}>
              <SessionListItem session={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionListItem({ session: s }: { session: OpenSessionRow }) {
  const seats = s.capacity - s.member_count;
  const iup = s.members.filter((m) => m.track === "IUP").length;
  const reg = s.members.length - iup;

  return (
    <Card className={cn("space-y-3", s.blocker && s.blocker !== "ALREADY_MEMBER" && "bg-slate-50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-700">{formatDateWib(s.starts_at)}</p>
          <p className="text-lg font-bold text-slate-900">{formatTimeRangeWib(s.starts_at, s.ends_at)}</p>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            {s.mode === "online" ? "Online" : `Offline · ${s.location}`} · {s.duration_minutes} menit
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-2xl font-bold", seats > 0 ? "text-slate-900" : "text-slate-400")}>{seats}</p>
          <p className="text-xs text-slate-500">kursi sisa</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Host: <span className="font-medium text-slate-800">{s.host_nickname}</span></span>
        <span>{TRACK_PREF_LABEL[s.track_pref]}</span>
        <span>
          {s.member_count}/{s.capacity} orang · {iup} IUP · {reg} Reg
        </span>
      </div>

      <MemberChips members={s.members} />

      <div className="flex flex-wrap items-center gap-2">
        {s.blocker ? (
          <>
            <button
              type="button"
              disabled
              title={errorMessage(s.blocker)}
              className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500"
            >
              {s.blocker === "ALREADY_MEMBER" ? "Sudah gabung" : "Gabung"}
            </button>
            <p className="text-sm text-slate-600">{blockerLabel(s.blocker)}</p>
          </>
        ) : (
          <SessionActionButton sessionId={s.id} action="join" label="Gabung" pendingLabel="Bergabung…" successHref={`/sessions/${s.id}?gabung=1`} />
        )}
        <Link href={`/sessions/${s.id}`} className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium text-brand-700 underline underline-offset-4">
          Detail
        </Link>
      </div>
    </Card>
  );
}
