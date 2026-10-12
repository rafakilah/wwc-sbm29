import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Track } from "@/lib/nim";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
  fullName: string;
  nickname: string;
  nim: string;
  track: Track;
  lineId: string;
  isAdmin: boolean;
};

/** User yang sedang login + profilnya, atau null. Di-cache per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const [{ data: priv }, { data: pub }] = await Promise.all([
    supabase
      .from("profiles_private")
      .select("full_name, nim, track, line_id, is_admin")
      .eq("id", claims.sub)
      .maybeSingle(),
    supabase.from("profiles_public").select("nickname").eq("id", claims.sub).maybeSingle(),
  ]);
  if (!priv || !pub) return null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    fullName: priv.full_name,
    nickname: pub.nickname,
    nim: priv.nim,
    track: priv.track as Track,
    lineId: priv.line_id,
    isAdmin: priv.is_admin,
  };
});

/** Wajib login + onboarding. Dipakai di layout/halaman aplikasi. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/onboarding");
  return viewer;
}
