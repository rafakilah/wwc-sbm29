"use client";

import { completeOnboarding } from "@/app/actions/profile";
import { NimInput } from "@/components/nim-input";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";

export function OnboardingForm({ defaultFullName, next }: { defaultFullName: string; next?: string }) {
  const { state, pending, onSubmit } = useFormAction(completeOnboarding);
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.message && !state.ok ? <Alert>{state.message}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Nama lengkap" htmlFor="full_name" error={fe.full_name}>
        <input id="full_name" name="full_name" required maxLength={100} autoComplete="name" defaultValue={defaultFullName} className={inputClass} />
      </Field>
      <Field label="Nama panggilan" htmlFor="nickname" error={fe.nickname} hint="Ini yang terlihat di daftar sesi.">
        <input id="nickname" name="nickname" required maxLength={40} autoComplete="nickname" className={inputClass} />
      </Field>
      <NimInput serverError={fe.nim} submission={state} />
      <Field label="ID LINE" htmlFor="line_id" error={fe.line_id} hint="Supaya teman satu sesi bisa menghubungimu.">
        <input id="line_id" name="line_id" required maxLength={50} autoComplete="off" autoCapitalize="none" className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan dan mulai"}
      </Button>
    </form>
  );
}
