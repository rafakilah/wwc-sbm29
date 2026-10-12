import Link from "next/link";
import type { MySessionRow } from "@/lib/types";
import { formatDateWib, formatTimeRangeWib } from "@/lib/time";
import { StatusBadge } from "./ui";

export function MySessionList({ sessions }: { sessions: MySessionRow[] }) {
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link
            href={`/sessions/${s.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-600"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {formatDateWib(s.starts_at)} · {formatTimeRangeWib(s.starts_at, s.ends_at)}
              </p>
              <p className="truncate text-xs text-slate-600">
                {s.mode === "online" ? "Online" : s.location} · {s.member_count}/{s.capacity} orang ·{" "}
                {s.is_host ? "Kamu host" : `Host: ${s.host_nickname}`}
              </p>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
