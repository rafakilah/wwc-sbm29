import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, hoursFromNow, nimFactory } from "./harness";

let db: TestDb;
const nims = nimFactory();

beforeAll(async () => {
  db = await TestDb.create();
  await db.useFarDeadline();
});

afterAll(async () => {
  await db?.destroy();
});

/** Tambah catatan manual sebagai uid. */
function addManual(
  uid: string,
  nim: string,
  opts: { name?: string; at?: Date; url?: string | null } = {},
) {
  return db.rpc(uid, "add_manual_interview", [
    opts.name ?? `Teman ${nim}`,
    null,
    nim,
    null,
    (opts.at ?? hoursFromNow(-48)).toISOString(),
    opts.url ?? null,
    null,
  ]);
}

describe("wawancara manual", () => {
  it("dihitung sebagai Selesai per jalur, termasuk NIM yang belum punya akun", async () => {
    const me = await db.createUser(nims.reg());
    expect((await addManual(me, "19099901")).ok).toBe(true);
    expect((await addManual(me, "19799902")).ok).toBe(true);
    expect((await addManual(me, "19299903")).ok).toBe(true);
    expect(await db.progress(me)).toEqual({ iup_scheduled: 0, iup_done: 2, reguler_scheduled: 0, reguler_done: 1 });

    const rows = await db.asUser<{ source: string; nim: string; status: string }>(
      me,
      "select source, nim, status from public.my_interview_records()",
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.source === "manual" && r.status === "done")).toBe(true);
  });

  it("validasi: NIM tidak valid, NIM sendiri, tanggal di masa depan, URL, duplikat", async () => {
    const myNim = nims.reg();
    const me = await db.createUser(myNim);
    expect((await addManual(me, "18099999")).code).toBe("INVALID_NIM");
    expect((await addManual(me, myNim)).code).toBe("SELF_NIM");
    expect((await addManual(me, "19099911", { at: hoursFromNow(2) })).code).toBe("MANUAL_IN_FUTURE");
    expect((await addManual(me, "19099911", { url: "bukan url" })).code).toBe("INVALID_URL");
    expect((await addManual(me, "19099911", { name: "A" })).code).toBe("INVALID_FULL_NAME");
    expect((await addManual(me, "19099911")).ok).toBe(true);
    expect((await addManual(me, "19099911")).code).toBe("DUPLICATE_RECORD");
  });

  it("menolak catatan manual untuk orang yang sudah jadi partner sesi", async () => {
    const me = await db.createUser(nims.reg());
    const otherNim = nims.iup();
    const other = await db.createUser(otherNim);
    const sid = await db.createSession(me, { startsAt: hoursFromNow(50) });
    expect((await db.rpc(other, "join_session", [sid])).ok).toBe(true);
    expect((await addManual(me, otherNim)).code).toBe("DUPLICATE_RECORD");
  });

  it("boleh bertemu lagi di sesi; ditandai dari dua arah dan tidak dihitung dobel", async () => {
    const aNim = nims.reg();
    const a = await db.createUser(aNim);
    const bNim = nims.iup();
    const b = await db.createUser(bNim);
    const c = await db.createUser(nims.iup());

    // a mencatat b secara manual.
    expect((await addManual(a, bNim)).ok).toBe(true);

    // a boleh gabung sesi berisi b, dan ditandai sudah pernah.
    const s1 = await db.createSession(b, { startsAt: hoursFromNow(60) });
    const seenByA = await db.asUser<{ blocker: string | null; repeat_count: number }>(
      a,
      "select blocker, repeat_count from public.list_open_sessions_v2() where id = $1",
      [s1],
    );
    expect(seenByA[0]).toEqual({ blocker: null, repeat_count: 1 });
    expect((await db.rpc(a, "join_session", [s1])).ok).toBe(true);
    // b tetap 1 kali di progres a (manual selesai menang atas sesi terjadwal).
    expect(await db.progress(a)).toEqual({ iup_scheduled: 0, iup_done: 1, reguler_scheduled: 0, reguler_done: 0 });

    // Dari arah sebaliknya: b melihat a sebagai "sudah pernah" di sesi lain milik a.
    const s2 = await db.createSession(a, { startsAt: hoursFromNow(70) });
    const seenByB = await db.asUser<{ repeat_count: number }>(
      b,
      "select repeat_count from public.list_open_sessions_v2() where id = $1",
      [s2],
    );
    expect(seenByB[0].repeat_count).toBe(1);

    // Orang baru tidak ditandai.
    const seenByC = await db.asUser<{ repeat_count: number }>(
      c,
      "select repeat_count from public.list_open_sessions_v2() where id = $1",
      [s2],
    );
    expect(seenByC[0].repeat_count).toBe(0);
  });

  it("menghapus catatan memperbarui progres; hanya pemilik yang bisa menghapus", async () => {
    const me = await db.createUser(nims.reg());
    const other = await db.createUser(nims.reg());
    const res = await addManual(me, "19099931");
    expect((await db.progress(me)).iup_done).toBe(1);
    expect((await db.rpc(other, "delete_manual_interview", [res.id])).code).toBe("RECORD_NOT_FOUND");
    expect((await db.rpc(me, "delete_manual_interview", [res.id])).ok).toBe(true);
    expect((await db.progress(me)).iup_done).toBe(0);
    expect((await db.rpc(me, "delete_manual_interview", [res.id])).code).toBe("RECORD_NOT_FOUND");
  });

  it("RLS: catatan hanya terlihat oleh pemilik dan admin, dan tidak bisa ditulis langsung", async () => {
    const me = await db.createUser(nims.reg());
    const stranger = await db.createUser(nims.reg());
    const admin = await db.createUser(nims.iup());
    await db.pool.query("update public.profiles_private set is_admin = true where id = $1", [admin]);
    await addManual(me, "19099941");

    const count = async (viewer: string) =>
      (await db.asUser(viewer, "select id from public.manual_interviews where owner_id = $1", [me])).length;
    expect(await count(me)).toBe(1);
    expect(await count(stranger)).toBe(0);
    expect(await count(admin)).toBe(1);

    await expect(
      db.asUser(
        me,
        "insert into public.manual_interviews (owner_id, full_name, nim, interviewed_at) values ($1, 'X Y', '19099942', now())",
        [me],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.asUser(me, "select * from public.interview_records")).rejects.toThrow(/permission denied/);
  });

  it("progres admin ikut menghitung catatan manual", async () => {
    const admin = await db.createUser(nims.iup());
    await db.pool.query("update public.profiles_private set is_admin = true where id = $1", [admin]);
    const me = await db.createUser(nims.reg());
    await addManual(me, "19799951");
    const rows = await db.asUser<{ user_id: string; reguler_done: number }>(
      admin,
      "select user_id, reguler_done from public.admin_participants() where user_id = $1",
      [me],
    );
    expect(rows[0].reguler_done).toBe(1);
  });
});
