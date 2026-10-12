import type { Metadata } from "next";
import { Card, PageHeader, TrackBadge } from "@/components/ui";
import { requireViewer } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const viewer = await requireViewer();
  return (
    <>
      <PageHeader title="Profil" description="Nama dan ID LINE bisa diubah kapan saja." />
      <Card className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="break-all font-medium text-slate-900">{viewer.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">NIM</dt>
            <dd className="flex items-center gap-2 font-medium text-slate-900">
              <span className="tabular-nums">{viewer.nim}</span> <TrackBadge track={viewer.track} />
            </dd>
            <dd className="mt-1 text-xs text-slate-500">NIM tidak bisa diubah. Salah NIM? Hubungi admin.</dd>
          </div>
        </dl>
        <ProfileForm fullName={viewer.fullName} nickname={viewer.nickname} lineId={viewer.lineId} />
      </Card>
    </>
  );
}
