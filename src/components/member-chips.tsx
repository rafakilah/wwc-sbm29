import type { PublicMember } from "@/lib/types";
import { cn } from "./ui";

export function MemberChips({ members }: { members: PublicMember[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Anggota">
      {members.map((m, i) => (
        <li
          key={`${m.nickname}-${i}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
            m.track === "IUP" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          <span className="font-medium">{m.nickname}</span>
          <span className="opacity-70">· {m.track === "IUP" ? "IUP" : "Reg"}</span>
          {m.is_host ? <span className="rounded bg-white/70 px-1 text-[10px] font-semibold uppercase">host</span> : null}
        </li>
      ))}
    </ul>
  );
}
