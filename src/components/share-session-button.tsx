"use client";

import { useState } from "react";
import { buildShareText, inviteUrl } from "@/lib/share";
import { buttonVariants, cn } from "./ui";

/** Bagikan link undangan sesi: menu share HP jika ada, kalau tidak salin ke clipboard. */
export function ShareSessionButton(props: {
  sessionId: string;
  startsAt: string;
  mode: "online" | "offline";
  location: string;
  seats: number;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [manualText, setManualText] = useState("");

  async function share() {
    const url = inviteUrl(window.location.origin, props.sessionId);
    const text = buildShareText(props);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Sesi Wawancara Angkatan", text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return; // user membatalkan
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setManualText(`${text}\n${url}`);
      setStatus("manual");
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={share} className={cn(buttonVariants.primary, "w-full whitespace-nowrap sm:w-auto")}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Bagikan link sesi
      </button>
      {status === "copied" ? (
        <p role="status" className="text-sm text-emerald-700">Link tersalin, tinggal tempel di LINE.</p>
      ) : null}
      {status === "manual" ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-600">Salin teks ini secara manual:</p>
          <textarea readOnly value={manualText} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
        </div>
      ) : null}
    </div>
  );
}
