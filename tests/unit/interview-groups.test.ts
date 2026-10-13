import { describe, expect, it } from "vitest";
import { groupByPerson } from "@/lib/interview-groups";
import type { InterviewRecord } from "@/lib/types";

function rec(over: Partial<InterviewRecord>): InterviewRecord {
  return {
    source: "session",
    record_id: crypto.randomUUID(),
    partner_id: null,
    full_name: "Budi Saputra",
    nickname: "Budi",
    nim: "19726901",
    track: "REGULER",
    line_id: "budi",
    happened_at: "2026-10-14T03:00:00.000Z",
    mode: "offline",
    status: "open",
    voice_memo_url: null,
    notes: null,
    ...over,
  };
}

describe("groupByPerson", () => {
  it("satu orang yang ditemui dua kali tampil satu kali dengan dua pertemuan", () => {
    const groups = groupByPerson([
      rec({ happened_at: "2026-10-15T03:00:00.000Z" }),
      rec({ happened_at: "2026-10-14T03:00:00.000Z", status: "done" }),
      rec({ nim: "19099901", full_name: "Citra", nickname: null, track: "IUP" }),
    ]);
    expect(groups).toHaveLength(2);
    const budi = groups.find((g) => g.nim === "19726901")!;
    expect(budi.meetings).toHaveLength(2);
    expect(budi.status).toBe("done");
    expect(budi.meetings[0].happened_at).toBe("2026-10-14T03:00:00.000Z");
  });

  it("data profil dari sesi mengalahkan isian manual", () => {
    const [g] = groupByPerson([
      rec({ source: "manual", full_name: "budi s", nickname: null, line_id: null, status: "done", happened_at: "2026-10-01T03:00:00.000Z" }),
      rec({ full_name: "Budi Saputra", nickname: "Budi", line_id: "budi" }),
    ]);
    expect(g).toMatchObject({ full_name: "Budi Saputra", nickname: "Budi", line_id: "budi", status: "done" });
  });
});
