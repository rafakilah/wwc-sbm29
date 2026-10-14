import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { nowMs, wibDateKey } from "@/lib/time";
import type { InterviewRecord, MySessionRow } from "@/lib/types";
import { ManualInterviewForm } from "./manual-interview-form";
import { PartnerTable } from "./partner-table";
import { SessionHistory } from "./session-history";

export const metadata: Metadata = { title: "Progress wawancara" };

export default async function ProgressPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: sessionRows }] = await Promise.all([
    supabase.rpc("my_interview_records"),
    supabase.rpc("my_sessions"),
  ]);
  const records = (data ?? []) as InterviewRecord[];

  // Terjadwal (belum selesai waktunya) di atas, urut terdekat; sisanya terbaru dulu.
  const now = nowMs();
  const sessions = (sessionRows ?? []) as MySessionRow[];
  const isUpcoming = (s: MySessionRow) => s.status === "open" && new Date(s.ends_at).getTime() > now;
  const history = [
    ...sessions.filter(isUpcoming).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    ...sessions.filter((s) => !isUpcoming(s)).sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Progress wawancara"
        description="Semua orang yang kamu wawancarai: dari sesi aktif (terjadwal dan selesai) dan catatan manual. Sesi yang dibatalkan atau yang kamu tinggalkan tidak dihitung."
      />
      <SessionHistory sessions={history} />
      <ManualInterviewForm maxDate={wibDateKey(new Date())} />
      {error ? (
        <p className="text-sm text-red-700">Gagal memuat progress. Coba muat ulang halaman.</p>
      ) : (
        <PartnerTable records={records} />
      )}
    </div>
  );
}
