"use client";

import { useState } from "react";
import { NIM_LENGTH, trackFromNim } from "@/lib/nim";
import { TrackBadge, inputClass } from "./ui";

/**
 * Input NIM dengan validasi real-time dan badge jalur otomatis.
 * `submission` berubah setiap kali form dikirim; error dari server hanya
 * ditampilkan selama NIM belum diubah sejak pengiriman itu.
 */
export function NimInput({ serverError, submission }: { serverError?: string; submission?: unknown }) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [seenSubmission, setSeenSubmission] = useState(submission);
  const [submittedValue, setSubmittedValue] = useState(value);
  if (submission !== seenSubmission) {
    setSeenSubmission(submission);
    setSubmittedValue(value);
  }
  const check = trackFromNim(value);
  const localError =
    !check.ok && value.length > 0 && (touched || value.length >= NIM_LENGTH) ? check.message : null;
  const error = localError ?? (value === submittedValue ? serverError : null) ?? null;

  return (
    <div className="space-y-1.5">
      <label htmlFor="nim" className="block text-sm font-medium text-slate-800">
        NIM
      </label>
      <input
        id="nim"
        name="nim"
        inputMode="numeric"
        autoComplete="off"
        maxLength={NIM_LENGTH + 2}
        required
        placeholder={`${NIM_LENGTH} digit, mis. 19724001`}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
        onBlur={() => setTouched(true)}
        aria-invalid={Boolean(error)}
        aria-describedby="nim-status"
        className={inputClass}
      />
      <div id="nim-status" aria-live="polite" className="min-h-5 space-y-1 text-sm">
        {check.ok ? <TrackBadge track={check.track} prefix="Terdeteksi: " /> : null}
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : check.ok ? null : (
          <p className="text-xs text-slate-500">Jalur (IUP/Reguler) terdeteksi otomatis dari NIM.</p>
        )}
      </div>
    </div>
  );
}
