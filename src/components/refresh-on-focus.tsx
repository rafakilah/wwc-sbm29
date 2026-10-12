"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Muat ulang data server saat tab kembali difokuskan (tanpa Realtime). */
export function RefreshOnFocus({ minIntervalMs = 15_000 }: { minIntervalMs?: number }) {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last.current < minIntervalMs) return;
      last.current = now;
      router.refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, minIntervalMs]);

  return null;
}
