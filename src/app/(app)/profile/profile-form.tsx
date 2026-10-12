"use client";

import { updateProfile } from "@/app/actions/profile";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";

export function ProfileForm({ fullName, nickname, lineId }: { fullName: string; nickname: string; lineId: string }) {
  const { state, pending, onSubmit } = useFormAction(updateProfile);
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert> : null}
      <Field label="Nama lengkap" htmlFor="full_name" error={fe.full_name}>
        <input id="full_name" name="full_name" required maxLength={100} defaultValue={fullName} className={inputClass} />
      </Field>
      <Field label="Nama panggilan" htmlFor="nickname" error={fe.nickname}>
        <input id="nickname" name="nickname" required maxLength={40} defaultValue={nickname} className={inputClass} />
      </Field>
      <Field label="ID LINE" htmlFor="line_id" error={fe.line_id}>
        <input id="line_id" name="line_id" required maxLength={50} autoCapitalize="none" defaultValue={lineId} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan perubahan"}
      </Button>
    </form>
  );
}
