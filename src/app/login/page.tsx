import type { Metadata } from "next";
import { Alert } from "@/components/ui";
import { DEADLINE } from "@/lib/constants";
import { safeNext } from "@/lib/safe-next";
import { formatDateTimeWib } from "@/lib/time";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  domain: "Akun ini tidak diizinkan masuk. Pakai akun email yang ditentukan panitia, ya.",
  auth: "Login gagal atau dibatalkan. Coba lagi, ya.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = errorKey ? (ERRORS[errorKey] ?? ERRORS.auth) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">OS SBM ITB 2026 · Angkatan 29</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Penjadwal Wawancara Angkatan</h1>
        <p className="mt-3 text-slate-600">
          Atur sesi wawancara dan pantau progres 25 IUP + 25 Reguler.
        </p>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {error ? <Alert>{error}</Alert> : null}
        <GoogleButton next={safeNext(params.next)} />
        <p className="text-center text-xs text-slate-500">
          Deadline Termin 1: {formatDateTimeWib(DEADLINE)}
        </p>
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Web ini hanya membantu penjadwalan.{" "}
        <a href="/privasi" className="underline underline-offset-2">
          Kebijakan privasi
        </a>
      </p>
    </main>
  );
}
