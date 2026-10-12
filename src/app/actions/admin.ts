"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-result";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hak admin dicek ulang di database (is_admin()) oleh setiap RPC di bawah.

export async function adminDeleteSession(sessionId: string): Promise<ActionState> {
  if (!UUID_RE.test(sessionId)) return { ok: false, message: errorMessage("SESSION_NOT_FOUND") };
  const supabase = await createClient();
  const res = await callRpc(supabase, "admin_delete_session", { p_session_id: sessionId });
  revalidatePath("/", "layout");
  return res.ok ? { ok: true, message: "Sesi dihapus." } : { ok: false, code: res.code, message: errorMessage(res.code) };
}

export async function adminResetProfile(userId: string): Promise<ActionState> {
  if (!UUID_RE.test(userId)) return { ok: false, message: errorMessage("USER_NOT_FOUND") };
  const supabase = await createClient();
  const res = await callRpc(supabase, "admin_reset_profile", { p_user_id: userId });
  revalidatePath("/", "layout");
  return res.ok
    ? { ok: true, message: `Profil dengan NIM ${String(res.nim)} direset. NIM itu sekarang bisa didaftarkan lagi.` }
    : { ok: false, code: res.code, message: errorMessage(res.code) };
}
