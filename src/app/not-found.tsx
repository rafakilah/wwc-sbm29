import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-slate-600">Mungkin sesinya sudah dihapus atau link-nya salah.</p>
      <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">
        Ke dashboard
      </Link>
    </main>
  );
}
