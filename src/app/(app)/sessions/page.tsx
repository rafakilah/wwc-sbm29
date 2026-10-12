import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { OpenSessionRow } from "@/lib/types";
import { SessionBrowser } from "./session-browser";

export const metadata: Metadata = { title: "Cari sesi" };

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_open_sessions");
  const sessions = (data ?? []) as OpenSessionRow[];

  return (
    <>
      <PageHeader
        title="Cari sesi"
        description="Sesi terbuka yang belum dimulai. Semua waktu dalam WIB."
      />
      {error ? (
        <p className="text-sm text-red-700">Gagal memuat sesi. Coba muat ulang halaman.</p>
      ) : (
        <SessionBrowser sessions={sessions} />
      )}
    </>
  );
}
