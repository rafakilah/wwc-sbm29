import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Lengkapi profil" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  const googleName = (data?.claims?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Satu langkah lagi</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Lengkapi profilmu</h1>
      <p className="mt-2 text-sm text-slate-600">
        Masuk sebagai <span className="font-medium text-slate-800">{email ?? "akun Google"}</span>. Isi sekali saja,
        NIM tidak bisa diubah setelah disimpan.
      </p>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <OnboardingForm defaultFullName={googleName} next={next} />
      </div>
      <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
        Data ini hanya dipakai untuk tugas Wawancara Angkatan. Nama lengkap, NIM, dan ID LINE cuma terlihat oleh
        kamu, admin, dan teman satu sesi wawancaramu.
      </p>
      <form action="/auth/signout" method="post" className="mt-6 text-center">
        <button type="submit" className="text-sm font-medium text-slate-600 underline underline-offset-4">
          Bukan akunmu? Keluar
        </button>
      </form>
    </main>
  );
}
