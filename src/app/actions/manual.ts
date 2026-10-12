"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-result";
import { errorMessage } from "@/lib/errors";
import { trackFromNim } from "@/lib/nim";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";
import { wibInputToDate } from "@/lib/time";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

const FIELD_FOR_CODE: Record<string, string> = {
  INVALID_NIM: "nim",
  SELF_NIM: "nim",
  DUPLICATE_RECORD: "nim",
  INVALID_FULL_NAME: "full_name",
  INVALID_NICKNAME: "nickname",
  INVALID_LINE_ID: "line_id",
  INVALID_DATE: "date",
  MANUAL_IN_FUTURE: "date",
  INVALID_URL: "voice_memo_url",
  NOTES_TOO_LONG: "notes",
};

/** Catat wawancara yang sudah dilakukan di luar website. */
export async function addManualInterview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fieldErrors: Record<string, string> = {};
  const fullName = text(formData, "full_name");
  const nickname = text(formData, "nickname");
  const lineId = text(formData, "line_id");
  const url = text(formData, "voice_memo_url");
  const notes = text(formData, "notes");
  const nimCheck = trackFromNim(text(formData, "nim"));
  // Jam opsional; default 12.00 WIB.
  const happenedAt = wibInputToDate(text(formData, "date"), text(formData, "time") || "12:00");

  if (!nimCheck.ok) fieldErrors.nim = nimCheck.message;
  if (fullName.length < 2 || fullName.length > 100) fieldErrors.full_name = errorMessage("INVALID_FULL_NAME");
  if (nickname.length > 40) fieldErrors.nickname = errorMessage("INVALID_NICKNAME");
  if (lineId.length > 50) fieldErrors.line_id = errorMessage("INVALID_LINE_ID");
  if (!happenedAt) fieldErrors.date = errorMessage("INVALID_DATE");
  else if (happenedAt.getTime() > Date.now()) fieldErrors.date = errorMessage("MANUAL_IN_FUTURE");
  if (url && !/^https?:\/\/\S+$/i.test(url)) fieldErrors.voice_memo_url = errorMessage("INVALID_URL");
  if (notes.length > 500) fieldErrors.notes = errorMessage("NOTES_TOO_LONG");

  if (Object.keys(fieldErrors).length > 0 || !happenedAt || !nimCheck.ok) {
    return { ok: false, message: "Cek lagi isian yang ditandai merah, ya.", fieldErrors };
  }

  const supabase = await createClient();
  const res = await callRpc(supabase, "add_manual_interview", {
    p_full_name: fullName,
    p_nickname: nickname || null,
    p_nim: nimCheck.nim,
    p_line_id: lineId || null,
    p_interviewed_at: happenedAt.toISOString(),
    p_voice_memo_url: url || null,
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
  return { ok: true, message: "Wawancara tercatat dan masuk ke progress-mu." };
}

export async function deleteManualInterview(id: string): Promise<ActionState> {
  if (!UUID_RE.test(id)) return { ok: false, message: errorMessage("RECORD_NOT_FOUND") };
  const supabase = await createClient();
  const res = await callRpc(supabase, "delete_manual_interview", { p_id: id });
  revalidatePath("/", "layout");
  return res.ok
    ? { ok: true, message: "Catatan dihapus." }
    : { ok: false, code: res.code, message: errorMessage(res.code) };
}
