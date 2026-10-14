"use client";

import { useState } from "react";
import { MySessionList } from "@/components/my-session-list";
import { Card } from "@/components/ui";
import type { MySessionRow } from "@/lib/types";

const INITIAL_COUNT = 5;

/** Riwayat semua sesi user; sudah diurutkan oleh server (terjadwal dulu, lalu terbaru). */
export function SessionHistory({ sessions }: { sessions: MySessionRow[] }) {
  const [showAll, setShowAll] = useState(false);
  if (sessions.length === 0) return null;
  const shown = showAll ? sessions : sessions.slice(0, INITIAL_COUNT);

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Riwayat sesi</h2>
        <p className="text-xs text-slate-500">{sessions.length} sesi · klik untuk membuka</p>
      </div>
      <MySessionList sessions={shown} />
      {sessions.length > INITIAL_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="min-h-11 text-sm font-medium text-brand-700 underline underline-offset-4"
        >
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${sessions.length})`}
        </button>
      ) : null}
    </Card>
  );
}
