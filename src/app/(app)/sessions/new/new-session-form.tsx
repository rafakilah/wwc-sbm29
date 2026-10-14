"use client";

import { useState } from "react";
import { createSession } from "@/app/actions/sessions";
import { Alert, Button, Card, Field, cn, inputClass } from "@/components/ui";
import {
  DEADLINE,
  SESSION_DEFAULT_CAPACITY,
  SESSION_DEFAULT_DURATION,
  SESSION_MAX_CAPACITY,
  SESSION_MAX_DURATION,
  SESSION_MIN_CAPACITY,
  SESSION_MIN_DURATION,
} from "@/lib/constants";
import { formatDateTimeWib, formatTimeWib, nowMs, wibInputToDate } from "@/lib/time";
import { useFormAction } from "@/lib/use-form-action";

const capacities = Array.from(
  { length: SESSION_MAX_CAPACITY - SESSION_MIN_CAPACITY + 1 },
  (_, i) => SESSION_MIN_CAPACITY + i,
);

export function NewSessionForm({ minDate, maxDate }: { minDate: string; maxDate: string }) {
  const { state, pending, onSubmit } = useFormAction(createSession);
  const fe = state.fieldErrors ?? {};
  const [date, setDate] = useState(minDate);
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(String(SESSION_DEFAULT_DURATION));
  const [mode, setMode] = useState<"online" | "offline">("offline");

  const start = wibInputToDate(date, time);
  const durationNum = Number(duration);
  const end = start && Number.isFinite(durationNum) ? new Date(start.getTime() + durationNum * 60_000) : null;
  let preview: { tone: "info" | "error"; text: string } | null = null;
  if (start && end) {
    if (start.getTime() <= nowMs()) preview = { tone: "error", text: "Waktu mulai sudah lewat." };
    else if (end.getTime() > DEADLINE.getTime())
      preview = { tone: "error", text: `Sesi akan selesai setelah deadline (${formatDateTimeWib(DEADLINE)}).` };
    else preview = { tone: "info", text: `${formatDateTimeWib(start)} sampai ${formatTimeWib(end)} WIB` };
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.message && !state.ok ? <Alert>{state.message}</Alert> : null}

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Kapan?</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal (WIB)" htmlFor="date">
            <input id="date" name="date" type="date" required min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Jam mulai (WIB)" htmlFor="time">
            <input id="time" name="time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field
          label="Durasi (menit)"
          htmlFor="duration"
          error={fe.duration}
          hint={`Minimal ${SESSION_MIN_DURATION} menit per sesi, berapa pun jumlah orangnya.`}
        >
          <input
            id="duration"
            name="duration"
            type="number"
            inputMode="numeric"
            min={SESSION_MIN_DURATION}
            max={SESSION_MAX_DURATION}
            step={5}
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={inputClass}
          />
        </Field>
        {fe.start ? (
          <Alert>{fe.start}</Alert>
        ) : preview ? (
          <Alert tone={preview.tone}>{preview.text}</Alert>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Di mana?</h2>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-800">Mode</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["offline", "online"] as const).map((m) => (
              <label
                key={m}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold",
                  mode === m ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-700",
                )}
              >
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                {m === "offline" ? "Offline" : "Online"}
              </label>
            ))}
          </div>
          {fe.mode ? <p className="mt-1 text-sm text-red-700">{fe.mode}</p> : null}
        </fieldset>
        <Field
          label={mode === "online" ? "Link meeting" : "Lokasi"}
          htmlFor="location"
          error={fe.location}
          hint={mode === "online" ? "Mis. link Google Meet/Zoom." : "Mis. Selasar SBM lantai 1, dekat tangga."}
        >
          <input
            id="location"
            name="location"
            required
            maxLength={300}
            inputMode={mode === "online" ? "url" : "text"}
            autoCapitalize={mode === "online" ? "none" : "sentences"}
            placeholder={mode === "online" ? "https://meet.google.com/…" : "Lokasi ketemuan"}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Siapa?</h2>
        <Field label="Kapasitas (termasuk kamu)" htmlFor="capacity" error={fe.capacity} hint="Maksimal 10 orang per sesi.">
          <select id="capacity" name="capacity" defaultValue={SESSION_DEFAULT_CAPACITY} className={inputClass}>
            {capacities.map((c) => (
              <option key={c} value={c}>
                {c} orang
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jalur yang boleh gabung" htmlFor="track_pref" hint="Orang dari jalur lain tidak bisa gabung ke sesi ini.">
          <select id="track_pref" name="track_pref" defaultValue="BEBAS" className={inputClass}>
            <option value="BEBAS">Semua jalur</option>
            <option value="IUP">Khusus IUP</option>
            <option value="REGULER">Khusus Reguler</option>
          </select>
        </Field>
        <Field
          label="Catatan (opsional)"
          htmlFor="notes"
          error={fe.notes}
          hint="Isi dengan link grup LINE dan/atau link docs. Link otomatis bisa diklik."
        >
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="Mis. Grup LINE: https://line.me/R/ti/g/… dan/atau link docs: https://docs.google.com/…"
            className={inputClass}
          />
        </Field>
      </Card>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Membuat sesi…" : "Buat sesi"}
      </Button>
    </form>
  );
}
