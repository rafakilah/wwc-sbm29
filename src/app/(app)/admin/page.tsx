import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminParticipants, AdminSessions, type AdminParticipant, type AdminSession } from "./admin-tables";

export const metadata: Metadata = { title: "Admin" };

type Overview = {
  ok: boolean;
  users_by_track: Record<string, number>;
  sessions_by_status: Record<string, number>;
  progress_buckets: { bucket: number; count: number }[];
  scheduled_complete: number;
  done_complete: number;
};

const BUCKET_LABEL: Record<number, string> = {
  0: "0–9",
  10: "10–19",
  20: "20–29",
  30: "30–39",
  40: "40–49",
  50: "50 (lengkap)",
};

export default async function AdminPage() {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();

  const supabase = await createClient();
  const [{ data: overviewData }, { data: participants }, { data: sessions }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_participants"),
    supabase.rpc("admin_sessions"),
  ]);
  const overview = overviewData as Overview | null;
  if (!overview?.ok) notFound();

  const totalUsers = Object.values(overview.users_by_track).reduce((a, b) => a + b, 0);
  const buckets = [0, 10, 20, 30, 40, 50].map((b) => ({
    bucket: b,
    count: overview.progress_buckets.find((x) => x.bucket === b)?.count ?? 0,
  }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="space-y-5">
      <PageHeader title="Admin" description="Ringkasan seluruh peserta. Data sensitif, jangan dibagikan sembarangan." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total peserta" value={totalUsers} />
        <Stat label="IUP" value={overview.users_by_track.IUP ?? 0} />
        <Stat label="Reguler" value={overview.users_by_track.REGULER ?? 0} />
        <Stat label="Lengkap 25+25 (selesai)" value={overview.done_complete} />
        <Stat label="Sesi terjadwal" value={overview.sessions_by_status.open ?? 0} />
        <Stat label="Sesi selesai" value={overview.sessions_by_status.done ?? 0} />
        <Stat label="Sesi dibatalkan" value={overview.sessions_by_status.cancelled ?? 0} />
        <Stat label="Lengkap 25+25 (terjadwal)" value={overview.scheduled_complete} />
      </div>

      <Card>
        <h2 className="mb-1 text-base font-semibold text-slate-900">Sebaran progres peserta</h2>
        <p className="mb-3 text-xs text-slate-500">Jumlah partner (terjadwal + selesai), maksimal 25 per jalur.</p>
        <ul className="space-y-2">
          {buckets.map((b) => (
            <li key={b.bucket} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
              <span className="text-slate-600">{BUCKET_LABEL[b.bucket]}</span>
              <span className="h-4 overflow-hidden rounded bg-slate-100">
                <span className="block h-full rounded bg-brand-600" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-slate-900">{b.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <AdminParticipants participants={(participants ?? []) as AdminParticipant[]} />
      <AdminSessions sessions={(sessions ?? []) as AdminSession[]} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </Card>
  );
}
