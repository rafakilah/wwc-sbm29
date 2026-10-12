"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_ON = ["/login", "/onboarding", "/sessions/new"];

/** Tombol "+ Buat sesi" yang selalu terlihat di pojok kanan bawah. */
export function CreateSessionFab() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <Link
      href="/sessions/new"
      aria-label="Buat sesi"
      className="fixed right-4 z-50 inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-base font-semibold text-white shadow-lg shadow-brand-600/30 ring-4 ring-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 sm:right-6 sm:px-5"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className="max-[359px]:sr-only">Buat sesi</span>
    </Link>
  );
}
