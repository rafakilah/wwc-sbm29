"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-result";
import {
  DEADLINE,
  SESSION_MAX_CAPACITY,
  SESSION_MAX_DURATION,
  SESSION_MIN_CAPACITY,
  SESSION_MIN_DURATION,
} from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { wibInputToDate } from "@/lib/time";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const FIELD_FOR_CODE: Record<string, string> = {
  INVALID_START: "start",
  START_IN_PAST: "start",
  PAST_DEADLINE: "start",
  OVERLAP: "start",
  INVALID_DURATION: "duration",
  INVALID_CAPACITY: "capacity",
  INVALID_MODE: "mode",
  LOCATION_REQUIRED: "location",
  LOCATION_TOO_LONG: "location",
  NOTES_TOO_LONG: "notes",
};

export async function createSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fieldErrors: Record<string, string> = {};
  const startsAt = wibInputToDate(text(formData, "date"), text(formData, "time"));
  const duration = Number(text(formData, "duration"));
  const capacity = Number(text(formData, "capacity"));
  const mode = text(formData, "mode");
  const location = text(formData, "location");
  const trackPref = text(formData, "track_pref") || "BEBAS";
  const notes = text(formData, "notes");

  if (!startsAt) {
    fieldErrors.start = errorMessage("INVALID_START");
  } else if (startsAt.getTime() <= Date.now()) {
    fieldErrors.start = errorMessage("START_IN_PAST");
  } else if (Number.isInteger(duration) && startsAt.getTime() + duration * 60_000 > DEADLINE.getTime()) {
    fieldErrors.start = errorMessage("PAST_DEADLINE");
  }
  if (!Number.isInteger(duration) || duration < SESSION_MIN_DURATION || duration > SESSION_MAX_DURATION) {
    fieldErrors.duration = errorMessage("INVALID_DURATION");
  }
  if (!Number.isInteger(capacity) || capacity < SESSION_MIN_CAPACITY || capacity > SESSION_MAX_CAPACITY) {
    fieldErrors.capacity = errorMessage("INVALID_CAPACITY");
  }
  if (mode !== "online" && mode !== "offline") fieldErrors.mode = errorMessage("INVALID_MODE");
  if (!location) fieldErrors.location = errorMessage("LOCATION_REQUIRED");
  if (location.length > 300) fieldErrors.location = errorMessage("LOCATION_TOO_LONG");
  if (notes.length > 500) fieldErrors.notes = errorMessage("NOTES_TOO_LONG");

  if (Object.keys(fieldErrors).length > 0 || !startsAt) {
    return { ok: false, message: "Cek lagi isian yang ditandai merah, ya.", fieldErrors };
  }

  const supabase = await createClient();
  const res = await callRpc(supabase, "create_session", {
    p_starts_at: startsAt.toISOString(),
    p_duration_minutes: duration,
    p_mode: mode,
    p_location: location,
    p_capacity: capacity,
    p_track_pref: trackPref,
    p_notes: notes || null,
  });

  if (!res.ok) {
    const field = FIELD_FOR_CODE[res.code];
    return {
      ok: false,
      code: res.code,
      message: errorMessage(res.code),
      fieldErrors: field ? { [field]: errorMessage(res.code) } : undefined,
    };
  }

  revalidatePath("/", "layout");
  redirect(`/sessions/${res.session_id as string}?dibuat=1`);
}

async function sessionRpc(
  fn: "join_session" | "leave_session" | "cancel_session",
  sessionId: string,
  successMessage: string,
): Promise<ActionState> {
  if (!UUID_RE.test(sessionId)) return { ok: false, code: "SESSION_NOT_FOUND", message: errorMessage("SESSION_NOT_FOUND") };
  const supabase = await createClient();
  const res = await callRpc(supabase, fn, { p_session_id: sessionId });
  revalidatePath("/", "layout");
  if (!res.ok) return { ok: false, code: res.code, message: errorMessage(res.code) };
  return { ok: true, message: successMessage };
}

export async function joinSession(sessionId: string): Promise<ActionState> {
  return sessionRpc("join_session", sessionId, "Kamu berhasil bergabung. Sampai ketemu di sesi!");
}

export async function leaveSession(sessionId: string): Promise<ActionState> {
  return sessionRpc("leave_session", sessionId, "Kamu sudah keluar dari sesi ini.");
}

export async function cancelSession(sessionId: string): Promise<ActionState> {
  return sessionRpc("cancel_session", sessionId, "Sesi dibatalkan.");
}

export async function completeSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sessionId = text(formData, "session_id");
  const url = text(formData, "voice_memo_url");
  if (!UUID_RE.test(sessionId)) return { ok: false, message: errorMessage("SESSION_NOT_FOUND") };
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    return { ok: false, code: "INVALID_URL", message: errorMessage("INVALID_URL"), fieldErrors: { voice_memo_url: errorMessage("INVALID_URL") } };
  }

  const supabase = await createClient();
  const res = await callRpc(supabase, "complete_session", {
    p_session_id: sessionId,
    p_voice_memo_url: url || null,
  });
  revalidatePath("/", "layout");
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: errorMessage(res.code),
      fieldErrors: res.code === "INVALID_URL" ? { voice_memo_url: errorMessage("INVALID_URL") } : undefined,
    };
  }
  return { ok: true, message: "Mantap! Sesi ditandai selesai." };
}
