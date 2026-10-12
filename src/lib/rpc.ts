import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RpcOutcome = { ok: boolean; code: string; [key: string]: unknown };

/** Panggil RPC yang mengembalikan {ok, code, ...}. Error jaringan -> code UNKNOWN. */
export async function callRpc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<RpcOutcome> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error || !data || typeof data !== "object") {
    if (error) console.error(`[rpc ${fn}]`, error.message);
    return { ok: false, code: "UNKNOWN" };
  }
  return data as RpcOutcome;
}
