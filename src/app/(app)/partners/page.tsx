import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { wibDateKey } from "@/lib/time";
import type { InterviewRecord } from "@/lib/types";
import { ManualInterviewForm } from "./manual-interview-form";
import { PartnerTable } from "./partner-table";

export const metadata: Metadata = { title: "Progress wawancara" };

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_interview_records");
  const records = (data ?? []) as InterviewRecord[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Progress wawancara"
        description="Semua orang yang kamu wawancarai: dari sesi aktif (terjadwal dan selesai) dan catatan manual. Sesi yang dibatalkan atau yang kamu tinggalkan tidak dihitung."
      />
      <ManualInterviewForm maxDate={wibDateKey(new Date())} />
      {error ? (
        <p className="text-sm text-red-700">Gagal memuat progress. Coba muat ulang halaman.</p>
      ) : (
        <PartnerTable records={records} />
      )}
    </div>
  );
}
