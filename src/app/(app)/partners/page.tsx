import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { PartnerRow } from "@/lib/types";
import { PartnerTable } from "./partner-table";

export const metadata: Metadata = { title: "Partner" };

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_partners");
  const partners = (data ?? []) as PartnerRow[];

  return (
    <>
      <PageHeader
        title="Partner wawancara"
        description="Semua orang dari sesi aktifmu (terjadwal dan selesai). Sesi yang dibatalkan atau yang kamu tinggalkan tidak dihitung."
      />
      {error ? <p className="text-sm text-red-700">Gagal memuat partner. Coba muat ulang halaman.</p> : <PartnerTable partners={partners} />}
    </>
  );
}
