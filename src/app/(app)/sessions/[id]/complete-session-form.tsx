"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { completeSession } from "@/app/actions/sessions";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";

export function CompleteSessionForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useFormAction(completeSession);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <Field
        label="Link voice memo (opsional)"
        htmlFor="voice_memo_url"
        error={state.fieldErrors?.voice_memo_url}
        hint="Link Google Drive/rekaman, diawali http:// atau https://. Tetap masukkan juga ke logbook Canva."
      >
        <input id="voice_memo_url" name="voice_memo_url" type="url" inputMode="url" autoCapitalize="none" placeholder="https://drive.google.com/…" className={inputClass} />
      </Field>
      {state.message && !state.fieldErrors ? <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tandai selesai"}
      </Button>
    </form>
  );
}
