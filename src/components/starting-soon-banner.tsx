"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTimeRangeWib } from "@/lib/time";
import type { MySessionRow } from "@/lib/types";

/** Banner muncul mulai 30 menit sebelum sesi dimulai sampai sesi selesai. */
export const REMINDER_WINDOW_MS = 30 * 60_000;

export function isInReminderWindow(s: Pick<MySessionRow, "status" | "starts_at" | "ends_at">, nowMs: number) {
  if (s.status !== "open") return false;
  const start = new Date(s.starts_at).getTime();
  const end = new Date(s.ends_at).getTime();
  return start - REMINDER_WINDOW_MS <= nowMs && nowMs < end;
}

/**
 * Pengingat di paling atas dashboard. Jam diperbarui tiap 30 detik, jadi banner
 * muncul sendiri tanpa reload. Waktu awal dari server agar tidak hydration mismatch.
 */
export function StartingSoonBanner({ sessions, serverNow }: { sessions: MySessionRow[]; serverNow: number }) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const soon = sessions
    .filter((s) => isInReminderWindow(s, now))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (soon.length === 0) return null;

  return (
    <section aria-label="Sesi segera dimulai" className="space-y-2">
      {soon.map((s) => {
        const minutes = Math.ceil((new Date(s.starts_at).getTime() - now) / 60_000);
        const started = minutes <= 0;
        const online = s.mode === "online" && /^https?:\/\//i.test(s.location);
        return (
          <div key={s.id} role="status" className="rounded-2xl bg-brand-600 p-4 text-white shadow-lg shadow-brand-600/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-100">
              {started ? "Sedang berlangsung" : "Jangan lupa!"}
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {started ? "Sesi wawancaramu sedang berlangsung" : `Sesi wawancaramu mulai ${minutes} menit lagi`}
            </p>
            <p className="mt-1 text-sm text-brand-50">
              {formatTimeRangeWib(s.starts_at, s.ends_at)} · {s.is_host ? "Kamu host" : `Host: ${s.host_nickname}`}
            </p>
            <p className="mt-0.5 break-words text-sm text-brand-50">
              {s.mode === "online" ? "Online: " : "Lokasi: "}
              {online ? (
                <a href={s.location} target="_blank" rel="noopener noreferrer" className="font-semibold text-white underline underline-offset-2">
                  {s.location}
                </a>
              ) : (
                s.location
              )}
            </p>
            <Link
              href={`/sessions/${s.id}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Buka sesi
            </Link>
          </div>
        );
      })}
    </section>
  );
}
