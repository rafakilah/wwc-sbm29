"use client";

import { buildCalendarEvent, buildIcs, googleCalendarUrl, type CalendarSessionInput } from "@/lib/calendar";
import { wibDateKey } from "@/lib/time";
import { buttonVariants, cn } from "./ui";

type Props = Omit<CalendarSessionInput, "sessionUrl">;

function eventFor(props: Props) {
  return buildCalendarEvent({ ...props, sessionUrl: `${window.location.origin}/sessions/${props.id}` });
}

/** Tombol "Tambah ke kalender": Google Calendar (tab baru) dan file .ics (Apple/Outlook). */
export function AddToCalendar(props: Props) {
  function openGoogle() {
    window.open(googleCalendarUrl(eventFor(props)), "_blank", "noopener,noreferrer");
  }

  function downloadIcs() {
    const blob = new Blob([buildIcs(eventFor(props))], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wawancara-angkatan-${wibDateKey(props.startsAt)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Tambah ke kalender</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={openGoogle} className={cn(buttonVariants.secondary, "whitespace-nowrap")}>
          <GoogleCalendarIcon />
          Google Calendar
        </button>
        <button type="button" onClick={downloadIcs} className={cn(buttonVariants.secondary, "whitespace-nowrap")}>
          <CalendarIcon />
          Apple / Outlook (.ics)
        </button>
      </div>
      <p className="text-xs text-slate-500">Kalau sesi dibatalkan, hapus acaranya dari kalendermu sendiri, ya.</p>
    </div>
  );
}

/** Ikon bergaya Google Calendar (kotak putih dengan tepi empat warna dan angka 31). */
function GoogleCalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <rect x="6" y="6" width="36" height="36" rx="4" fill="#fff" />
      <path d="M34 6h4a4 4 0 0 1 4 4v4h-8z" fill="#1967D2" />
      <path d="M34 34h8v4a4 4 0 0 1-4 4h-4z" fill="#EA4335" />
      <path d="M6 34h28v8H10a4 4 0 0 1-4-4z" fill="#188038" />
      <path d="M34 14h8v20h-8z" fill="#FBBC04" />
      <path d="M10 6h24v8H6v-4a4 4 0 0 1 4-4z" fill="#4285F4" />
      <path d="M6 14h28v20H6z" fill="#fff" />
      <text x="20" y="30.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="14" fill="#4285F4">
        31
      </text>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
