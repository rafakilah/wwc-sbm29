"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelSession, joinSession, leaveSession } from "@/app/actions/sessions";
import { Alert, Button, type ButtonVariant } from "./ui";

const ACTIONS = { join: joinSession, leave: leaveSession, cancel: cancelSession } as const;

/** Tombol aksi sesi (gabung/keluar/batal) dengan pesan hasil. */
export function SessionActionButton({
  sessionId,
  action,
  label,
  pendingLabel,
  variant = "primary",
  confirmText,
  className,
  successHref,
}: {
  sessionId: string;
  action: keyof typeof ACTIONS;
  label: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  confirmText?: string;
  className?: string;
  /** Jika diisi, pindah ke halaman ini setelah berhasil. */
  successHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string | null } | null>(null);

  function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const res = await ACTIONS[action](sessionId);
      if (res.ok && successHref) {
        router.push(successHref);
        return;
      }
      setResult(res);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} onClick={run} disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </Button>
      {result?.message ? <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert> : null}
    </div>
  );
}
