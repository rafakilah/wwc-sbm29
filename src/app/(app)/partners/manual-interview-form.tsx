"use client";

import { useState } from "react";
import { addManualInterview } from "@/app/actions/manual";
import { NimInput } from "@/components/nim-input";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";

/** Form mencatat wawancara yang sudah dilakukan sebelum ada website. */
export function ManualInterviewForm({ maxDate }: { maxDate: string }) {
  const { state, pending, onSubmit } = useFormAction(addManualInterview);
  const fe = state.fieldErrors ?? {};
  // Setelah berhasil, form dipasang ulang (kosong) supaya bisa langsung mencatat orang berikutnya.
  const [resetFor, setResetFor] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== resetFor) {
    setResetFor(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
        <span>+ Tambah wawancara manual</span>
        <span className="text-xs font-normal text-slate-500 group-open:hidden">Untuk wawancara sebelum ada website ini</span>
      </summary>
      <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
        <p className="text-xs text-slate-600">
          Sudah wawancara seseorang sebelum pakai website ini? Catat di sini supaya masuk progress (dihitung Selesai) dan
          kalian tidak dipertemukan lagi di sesi lain. Jalur terdeteksi otomatis dari NIM.
        </p>
        {state.message ? <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert> : null}
        <form key={formKey} onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Nama lengkap" htmlFor="m_full_name" error={fe.full_name}>
            <input id="m_full_name" name="full_name" required maxLength={100} className={inputClass} />
          </Field>
          <NimInput serverError={fe.nim} submission={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama panggilan (opsional)" htmlFor="m_nickname" error={fe.nickname}>
              <input id="m_nickname" name="nickname" maxLength={40} className={inputClass} />
            </Field>
            <Field label="ID LINE (opsional)" htmlFor="m_line_id" error={fe.line_id}>
              <input id="m_line_id" name="line_id" maxLength={50} autoCapitalize="none" className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal wawancara (WIB)" htmlFor="m_date" error={fe.date}>
              <input id="m_date" name="date" type="date" required max={maxDate} className={inputClass} />
            </Field>
            <Field label="Jam (opsional)" htmlFor="m_time" hint="Kosong = 12.00 WIB">
              <input id="m_time" name="time" type="time" step={300} className={inputClass} />
            </Field>
          </div>
          <Field label="Link voice memo (opsional)" htmlFor="m_voice_memo_url" error={fe.voice_memo_url}>
            <input id="m_voice_memo_url" name="voice_memo_url" type="url" inputMode="url" autoCapitalize="none" placeholder="https://drive.google.com/…" className={inputClass} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="m_notes" error={fe.notes}>
            <textarea id="m_notes" name="notes" rows={2} maxLength={500} className={inputClass} />
          </Field>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Menyimpan…" : "Simpan catatan"}
          </Button>
        </form>
      </div>
    </details>
  );
}
