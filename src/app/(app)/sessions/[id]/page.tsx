import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionActionButton } from "@/components/session-action-button";
import { Alert, Card, StatusBadge, TRACK_PREF_LABEL, TrackBadge } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import type { Track } from "@/lib/nim";
import { createClient } from "@/lib/supabase/server";
import { formatDateWib, formatTimeRangeWib, nowMs } from "@/lib/time";
import type { SessionMode, SessionStatus, TrackPref } from "@/lib/types";
import { CompleteSessionForm } from "./complete-session-form";

export const metadata: Metadata = { title: "Detail sesi" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SessionRecord = {
  id: string;
  host_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  mode: SessionMode;
  location: string;
  capacity: number;
  track_pref: TrackPref;
  notes: string | null;
  status: SessionStatus;
  voice_memo_url: string | null;
};

type MemberRecord = {
  user_id: string;
  joined_at: string;
  profiles_public: { nickname: string; track: Track } | null;
};

type PrivateRecord = { id: string; full_name: string; nim: string; line_id: string };

export default async function SessionDetailPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const viewer = await requireViewer();
  const supabase = await createClient();

  const [{ data: session }, { data: memberRows }, { data: blocker }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, host_id, starts_at, ends_at, duration_minutes, mode, location, capacity, track_pref, notes, status, voice_memo_url")
      .eq("id", id)
      .maybeSingle<SessionRecord>(),
    supabase
      .from("session_members")
      .select("user_id, joined_at, profiles_public(nickname, track)")
      .eq("session_id", id)
      .order("joined_at")
      .returns<MemberRecord[]>(),
    supabase.rpc("my_join_blocker", { p_session_id: id }),
  ]);
  if (!session) notFound();

  const members = memberRows ?? [];
  const memberIds = members.map((m) => m.user_id);
  const { data: privateRows } = memberIds.length
    ? await supabase.from("profiles_private").select("id, full_name, nim, line_id").in("id", memberIds).returns<PrivateRecord[]>()
    : { data: [] as PrivateRecord[] };
  const privateById = new Map((privateRows ?? []).map((p) => [p.id, p]));

  const isHost = session.host_id === viewer.id;
  const isMember = memberIds.includes(viewer.id);
  const now = nowMs();
  const started = new Date(session.starts_at).getTime() <= now;
  const isOpen = session.status === "open";
  const seats = session.capacity - members.length;
  const hostNickname = members.find((m) => m.user_id === session.host_id)?.profiles_public?.nickname ?? "Host";
  const blockerCode = typeof blocker === "string" ? blocker : null;
  const iup = members.filter((m) => m.profiles_public?.track === "IUP").length;

  return (
    <div className="space-y-4">
      <Link href="/sessions" className="inline-flex min-h-10 items-center text-sm font-medium text-brand-700">
        ← Kembali ke daftar sesi
      </Link>

      {query.dibuat ? <Alert tone="success">Sesi berhasil dibuat. Bagikan link halaman ini ke teman-temanmu!</Alert> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-brand-700">{formatDateWib(session.starts_at)}</p>
            <h1 className="text-2xl font-bold text-slate-900">{formatTimeRangeWib(session.starts_at, session.ends_at)}</h1>
            <p className="text-sm text-slate-600">
              {session.duration_minutes} menit · Host: {hostNickname}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{session.mode === "online" ? "Online · link meeting" : "Offline · lokasi"}</dt>
            <dd className="break-words font-medium text-slate-900">
              {session.mode === "online" && /^https?:\/\//i.test(session.location) ? (
                <a href={session.location} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline underline-offset-4">
                  {session.location}
                </a>
              ) : (
                session.location
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Kursi</dt>
            <dd className="font-medium text-slate-900">
              {members.length}/{session.capacity} terisi · {Math.max(seats, 0)} sisa
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Preferensi jalur</dt>
            <dd className="font-medium text-slate-900">{TRACK_PREF_LABEL[session.track_pref]}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Komposisi</dt>
            <dd className="font-medium text-slate-900">
              {iup} IUP · {members.length - iup} Reguler
            </dd>
          </div>
          {session.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Catatan</dt>
              <dd className="whitespace-pre-line text-slate-900">{session.notes}</dd>
            </div>
          ) : null}
          {session.status === "done" ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Voice memo</dt>
              <dd className="break-words">
                {session.voice_memo_url ? (
                  <a href={session.voice_memo_url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline underline-offset-4">
                    {session.voice_memo_url}
                  </a>
                ) : (
                  <span className="text-slate-600">Belum ada link.</span>
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="border-t border-slate-100 pt-4">
          <SessionActions
            sessionId={session.id}
            isOpen={isOpen}
            isHost={isHost}
            isMember={isMember}
            started={started}
            blockerCode={blockerCode}
            status={session.status}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Anggota ({members.length})</h2>
        {!isMember && !viewer.isAdmin ? (
          <p className="mb-3 text-xs text-slate-500">Nama lengkap, NIM, dan ID LINE terlihat setelah kamu bergabung.</p>
        ) : null}
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const priv = privateById.get(m.user_id);
            return (
              <li key={m.user_id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {m.profiles_public?.nickname ?? "?"}
                    {m.user_id === viewer.id ? <span className="font-normal text-slate-500"> (kamu)</span> : null}
                    {m.user_id === session.host_id ? (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">host</span>
                    ) : null}
                  </p>
                  {priv ? (
                    <p className="text-sm text-slate-600">
                      {priv.full_name} · {priv.nim} · LINE: <span className="font-medium">{priv.line_id}</span>
                    </p>
                  ) : null}
                </div>
                {m.profiles_public ? <TrackBadge track={m.profiles_public.track} /> : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function SessionActions({
  sessionId,
  isOpen,
  isHost,
  isMember,
  started,
  blockerCode,
  status,
}: {
  sessionId: string;
  isOpen: boolean;
  isHost: boolean;
  isMember: boolean;
  started: boolean;
  blockerCode: string | null;
  status: SessionStatus;
}) {
  if (!isOpen) {
    return (
      <p className="text-sm text-slate-600">
        {status === "done" ? "Sesi ini sudah selesai. Jangan lupa masukkan link voice memo ke logbook Canva." : "Sesi ini dibatalkan."}
      </p>
    );
  }

  if (isHost) {
    return (
      <div className="space-y-4">
        {started ? (
          <CompleteSessionForm sessionId={sessionId} />
        ) : (
          <p className="text-sm text-slate-600">Tombol “Tandai selesai” muncul setelah waktu mulai.</p>
        )}
        <SessionActionButton
          sessionId={sessionId}
          action="cancel"
          label="Batalkan sesi"
          pendingLabel="Membatalkan…"
          variant="danger"
          confirmText="Batalkan sesi ini? Semua anggota tidak lagi dihitung sebagai partner. Tindakan ini tidak bisa diurungkan."
        />
      </div>
    );
  }

  if (isMember) {
    return started ? (
      <p className="text-sm text-slate-600">Sesi sudah dimulai. Host akan menandai sesi selesai.</p>
    ) : (
      <SessionActionButton
        sessionId={sessionId}
        action="leave"
        label="Keluar dari sesi"
        pendingLabel="Keluar…"
        variant="danger"
        confirmText="Keluar dari sesi ini?"
      />
    );
  }

  if (blockerCode) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500">
          Gabung
        </button>
        <p className="text-sm text-slate-600">{errorMessage(blockerCode)}</p>
      </div>
    );
  }

  return <SessionActionButton sessionId={sessionId} action="join" label="Gabung sesi ini" pendingLabel="Bergabung…" />;
}
