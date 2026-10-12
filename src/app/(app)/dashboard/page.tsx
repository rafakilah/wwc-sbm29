import type { Metadata } from "next";
import { ImportantLinksList } from "@/components/important-links";
import { MySessionList } from "@/components/my-session-list";
import { ProgressCard } from "@/components/progress-card";
import { ButtonLink, Card, EmptyState, TrackBadge } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { DEADLINE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { formatCountdown, formatDateTimeWib } from "@/lib/time";
import type { MySessionRow, Progress } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const EMPTY_PROGRESS: Progress = { iup_scheduled: 0, iup_done: 0, reguler_scheduled: 0, reguler_done: 0 };

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [{ data: progressRows }, { data: sessionRows }] = await Promise.all([
    supabase.rpc("my_progress"),
    supabase.rpc("my_sessions"),
  ]);
  const progress = ((progressRows as Progress[] | null)?.[0] ?? EMPTY_PROGRESS) satisfies Progress;
  const sessions = (sessionRows ?? []) as MySessionRow[];

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "open" && new Date(s.ends_at) > now);
  const past = sessions
    .filter((s) => !(s.status === "open" && new Date(s.ends_at) > now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const needsCompletion = sessions.filter((s) => s.is_host && s.status === "open" && new Date(s.starts_at) <= now);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hai, {viewer.nickname}!</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <TrackBadge track={viewer.track} /> Target: 25 IUP + 25 Reguler, 50 orang berbeda.
          </p>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-2 border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-900">
          Deadline: <strong>{formatDateTimeWib(DEADLINE)}</strong>
        </p>
        <p className="text-sm font-semibold text-amber-900">{formatCountdown(DEADLINE, now)}</p>
      </Card>

      <ProgressCard progress={progress} />

      {needsCompletion.length > 0 ? (
        <Card className="border-brand-100 bg-brand-50">
          <p className="text-sm text-brand-800">
            Ada {needsCompletion.length} sesi yang kamu host sudah lewat waktu mulai. Buka sesinya lalu tekan
            “Tandai selesai” supaya progres “Selesai” ter-update.
          </p>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Sesi mendatang</h2>
          <ButtonLink href="/sessions" variant="secondary">
            Cari sesi
          </ButtonLink>
        </div>
        {upcoming.length ? (
          <MySessionList sessions={upcoming} />
        ) : (
          <EmptyState>Belum ada sesi mendatang. Gabung ke sesi yang ada atau buat sesi baru.</EmptyState>
        )}
      </section>

      {past.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Riwayat sesi</h2>
          <MySessionList sessions={past} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Dokumen penting</h2>
        <ImportantLinksList />
      </section>
    </div>
  );
}
