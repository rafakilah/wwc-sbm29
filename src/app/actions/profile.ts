"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-result";
import { errorMessage } from "@/lib/errors";
import { trackFromNim } from "@/lib/nim";
import { callRpc } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function validateNames(formData: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const fullName = text(formData, "full_name");
  const nickname = text(formData, "nickname");
  const lineId = text(formData, "line_id");
  if (fullName.length < 2 || fullName.length > 100) errors.full_name = errorMessage("INVALID_FULL_NAME");
  if (nickname.length < 1 || nickname.length > 40) errors.nickname = errorMessage("INVALID_NICKNAME");
  if (lineId.length < 1 || lineId.length > 50) errors.line_id = errorMessage("INVALID_LINE_ID");
  return errors;
}

const FIELD_FOR_CODE: Record<string, string> = {
  INVALID_NIM: "nim",
  NIM_TAKEN: "nim",
  INVALID_FULL_NAME: "full_name",
  INVALID_NICKNAME: "nickname",
  INVALID_LINE_ID: "line_id",
};

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fieldErrors = validateNames(formData);
  const nimCheck = trackFromNim(text(formData, "nim"));
  if (!nimCheck.ok) fieldErrors.nim = nimCheck.message;
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Cek lagi isian yang ditandai merah, ya.", fieldErrors };
  }

  const supabase = await createClient();
  const res = await callRpc(supabase, "complete_onboarding", {
    p_full_name: text(formData, "full_name"),
    p_nickname: text(formData, "nickname"),
    p_nim: nimCheck.ok ? nimCheck.nim : "",
    p_line_id: text(formData, "line_id"),
  });

  if (!res.ok && res.code !== "ALREADY_ONBOARDED") {
    const field = FIELD_FOR_CODE[res.code];
    return {
      ok: false,
      code: res.code,
      message: errorMessage(res.code),
      fieldErrors: field ? { [field]: errorMessage(res.code) } : undefined,
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fieldErrors = validateNames(formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Cek lagi isian yang ditandai merah, ya.", fieldErrors };
  }

  const supabase = await createClient();
  const res = await callRpc(supabase, "update_my_profile", {
    p_full_name: text(formData, "full_name"),
    p_nickname: text(formData, "nickname"),
    p_line_id: text(formData, "line_id"),
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
  return { ok: true, message: "Profil tersimpan." };
}
