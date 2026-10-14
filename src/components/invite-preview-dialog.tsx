"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { errorMessage } from "@/lib/errors";
import { formatDateWib, formatTimeRangeWib } from "@/lib/time";
import type { PublicMember } from "@/lib/types";
import { Linkify } from "./linkify";
import { MemberChips } from "./member-chips";
import { SessionActionButton } from "./session-action-button";

export type InvitePreviewProps = {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  hostNickname: string;
  mode: "online" | "offline";
  location: string;
  notes: string | null;
  members: PublicMember[];
  capacity: number;
  repeatCount: number;
  isMember: boolean;
  /** Kode alasan tidak bisa gabung, atau null jika bisa. */
  blocker: string | null;
};

/** Popup preview sesi untuk orang yang membuka link undangan (?undangan=1). */
export function InvitePreviewDialog(props: InvitePreviewProps) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /** Tutup popup dan hapus ?undangan=1 supaya halaman detail biasa terlihat. */
  function close() {
    ref.current?.close();
  }
  function onClosed() {
    router.replace(`/sessions/${props.sessionId}`, { scroll: false });
  }

  const iup = props.members.filter((m) => m.track === "IUP").length;
  const seats = Math.max(props.capacity - props.members.length, 0);
  const canJoin = !props.isMember && !props.blocker;

  return (
    <dialog
      ref={ref}
      onClose={onClosed}
      onClick={(e) => {
        if (e.target === ref.current) close(); // klik di luar kartu
      }}
      aria-labelledby="invite-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Undangan sesi</p>
            <h2 id="invite-title" className="text-lg font-bold">Kamu diundang ke sesi wawancara</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Tutup"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="rounded-xl bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-700">{formatDateWib(props.startsAt)}</p>
          <p className="text-xl font-bold">{formatTimeRangeWib(props.startsAt, props.endsAt)}</p>
          <p className="text-sm text-slate-700">
            {props.durationMinutes} menit · Host: <span className="font-medium">{props.hostNickname}</span>
          </p>
          <p className="mt-1 break-words text-sm text-slate-700">
            {props.mode === "online" ? "Online" : `Offline · ${props.location}`}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Anggota ({props.members.length}/{props.capacity})</p>
            <p className="text-xs text-slate-600">
              {iup} IUP · {props.members.length - iup} Reguler · {seats} kursi sisa
            </p>
          </div>
          <MemberChips members={props.members} />
        </div>

        {props.notes ? (
          <p className="whitespace-pre-line break-words text-sm text-slate-700">
            <span className="font-medium">Catatan: </span>
            <Linkify text={props.notes} />
          </p>
        ) : null}

        {props.repeatCount > 0 && !props.isMember ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {props.repeatCount} orang di sesi ini sudah pernah wawancara denganmu. Tetap boleh gabung, tapi mereka tidak
            dihitung dua kali di progress.
          </p>
        ) : null}

        <div className="space-y-2 border-t border-slate-100 pt-4">
          {props.isMember ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              Kamu sudah tergabung di sesi ini.
            </p>
          ) : canJoin ? (
            <SessionActionButton
              sessionId={props.sessionId}
              action="join"
              label="Gabung sesi ini"
              pendingLabel="Bergabung…"
              className="w-full"
              successHref={`/sessions/${props.sessionId}?gabung=1`}
            />
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                disabled
                className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500"
              >
                Gabung sesi ini
              </button>
              <p className="text-sm text-slate-600">{errorMessage(props.blocker)}</p>
            </div>
          )}
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Lihat detail sesi
          </button>
        </div>
      </div>
    </dialog>
  );
}
