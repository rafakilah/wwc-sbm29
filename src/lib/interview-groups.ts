import type { Track } from "./nim";
import type { InterviewRecord } from "./types";

/** Semua pertemuan dengan satu orang (dicocokkan lewat NIM). */
export type PersonGroup = {
  nim: string;
  full_name: string;
  nickname: string | null;
  track: Track;
  line_id: string | null;
  /** Selesai jika minimal satu pertemuan selesai (sama dengan hitungan progres). */
  status: "done" | "open";
  meetings: InterviewRecord[];
};

/**
 * Gabungkan catatan per orang supaya satu orang tampil satu kali walaupun
 * bertemu di beberapa sesi atau dicatat manual. Urut berdasarkan pertemuan pertama.
 */
export function groupByPerson(records: InterviewRecord[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>();
  const sorted = [...records].sort((a, b) => a.happened_at.localeCompare(b.happened_at));
  for (const r of sorted) {
    const g = map.get(r.nim);
    if (!g) {
      map.set(r.nim, {
        nim: r.nim,
        full_name: r.full_name,
        nickname: r.nickname,
        track: r.track,
        line_id: r.line_id,
        status: r.status === "done" ? "done" : "open",
        meetings: [r],
      });
      continue;
    }
    g.meetings.push(r);
    if (r.status === "done") g.status = "done";
    // Data dari profil (sesi) lebih bisa dipercaya daripada isian manual.
    if (r.source === "session") {
      g.full_name = r.full_name;
      g.nickname = r.nickname ?? g.nickname;
      g.line_id = r.line_id ?? g.line_id;
    } else {
      g.nickname ??= r.nickname;
      g.line_id ??= r.line_id;
    }
  }
  return [...map.values()];
}
