import { TARGET_PER_TRACK, TARGET_TOTAL } from "@/lib/constants";
import type { Progress } from "@/lib/types";
import { Card } from "./ui";

function Bar({
  label,
  done,
  scheduled,
  target,
  color,
}: {
  label: string;
  done: number;
  scheduled: number;
  target: number;
  color: { done: string; scheduled: string };
}) {
  const total = done + scheduled;
  const pct = (n: number) => `${Math.min(100, (n / target) * 100)}%`;
  const complete = total >= target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-700">
          <span className="text-xl font-bold text-slate-900">{total}</span>/{target}
          {complete ? <span className="ml-1">✓</span> : null}
        </p>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${label}: ${total} dari ${target}`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(total, target)}
      >
        <div className={color.done} style={{ width: pct(done) }} />
        <div className={color.scheduled} style={{ width: pct(Math.min(scheduled, Math.max(0, target - done))) }} />
      </div>
      <div className="flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.done}`} aria-hidden="true" />
          Selesai {done}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.scheduled}`} aria-hidden="true" />
          Terjadwal {scheduled}
        </span>
      </div>
    </div>
  );
}

export function ProgressCard({ progress }: { progress: Progress }) {
  const iupTotal = progress.iup_done + progress.iup_scheduled;
  const regTotal = progress.reguler_done + progress.reguler_scheduled;
  // Total dihitung dengan batas 25 per jalur: kelebihan di satu jalur tidak menutup kekurangan jalur lain.
  const countedDone = Math.min(progress.iup_done, TARGET_PER_TRACK) + Math.min(progress.reguler_done, TARGET_PER_TRACK);
  const countedAll = Math.min(iupTotal, TARGET_PER_TRACK) + Math.min(regTotal, TARGET_PER_TRACK);

  return (
    <Card className="space-y-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Progres wawancara</h2>
        <p className="text-xs text-slate-500">Terjadwal = sesi belum ditandai selesai</p>
      </div>
      <Bar label="IUP" done={progress.iup_done} scheduled={progress.iup_scheduled} target={TARGET_PER_TRACK} color={{ done: "bg-sky-600", scheduled: "bg-sky-300" }} />
      <Bar label="Reguler" done={progress.reguler_done} scheduled={progress.reguler_scheduled} target={TARGET_PER_TRACK} color={{ done: "bg-emerald-600", scheduled: "bg-emerald-300" }} />
      <Bar label="Total" done={countedDone} scheduled={countedAll - countedDone} target={TARGET_TOTAL} color={{ done: "bg-brand-600", scheduled: "bg-brand-100" }} />
      {iupTotal > TARGET_PER_TRACK || regTotal > TARGET_PER_TRACK ? (
        <p className="text-xs text-slate-500">
          Kelebihan di satu jalur tidak menutup kekurangan di jalur lain, jadi total dihitung maksimal 25 per jalur.
        </p>
      ) : null}
    </Card>
  );
}
