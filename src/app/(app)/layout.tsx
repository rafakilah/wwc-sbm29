import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { CreateSessionFab } from "@/components/fab";
import { FooterLinks } from "@/components/important-links";
import { RefreshOnFocus } from "@/components/refresh-on-focus";
import { requireViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-4xl space-y-2 px-4 pb-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="min-w-0">
              <span className="block truncate text-base font-bold text-slate-900">Wawancara Angkatan</span>
              <span className="block text-xs text-slate-500">OS SBM ITB 2026</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-600 sm:inline">Hai, {viewer.nickname}!</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Keluar
                </button>
              </form>
            </div>
          </div>
          <AppNav isAdmin={viewer.isAdmin} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-5">{children}</main>

      <footer className="pb-fab border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-4xl space-y-2 px-4 pt-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Dokumen penting</p>
          <FooterLinks />
          <p className="text-xs text-slate-500">
            Web ini hanya membantu penjadwalan. Rekaman voice memo tetap dimasukkan ke logbook Canva.
          </p>
        </div>
      </footer>

      <CreateSessionFab />
      <RefreshOnFocus />
    </>
  );
}
