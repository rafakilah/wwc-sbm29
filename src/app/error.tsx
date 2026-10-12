"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Waduh, ada yang error</h1>
      <p className="mt-2 text-sm text-slate-600">Coba lagi sebentar. Kalau masih error, kabari admin, ya.</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">
        Coba lagi
      </button>
    </main>
  );
}
