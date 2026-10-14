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
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={openGoogle} className={cn(buttonVariants.secondary, "flex-1 sm:flex-none")}>
          Google Calendar
        </button>
        <button type="button" onClick={downloadIcs} className={cn(buttonVariants.secondary, "flex-1 sm:flex-none")}>
          Apple / Outlook (.ics)
        </button>
      </div>
      <p className="text-xs text-slate-500">Kalau sesi dibatalkan, hapus acaranya dari kalendermu sendiri, ya.</p>
    </div>
  );
}
