import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEADLINE_ISO } from "@/lib/constants";
import { trackFromNim } from "@/lib/nim";
import { TestDb, hoursFromNow, nimFactory } from "./harness";

let db: TestDb;
const nims = nimFactory();

beforeAll(async () => {
  db = await TestDb.create();
});

afterAll(async () => {
  await db?.destroy();
});

describe("konstanta", () => {
  it("app_deadline() sama dengan DEADLINE_ISO di TypeScript", async () => {
    const { rows } = await db.pool.query("select public.app_deadline() as d");
    expect(new Date(rows[0].d).toISOString()).toBe(new Date(DEADLINE_ISO).toISOString());
  });

  it("nim_track() di SQL sama dengan trackFromNim() di TypeScript", async () => {
    const cases = ["19724001", "19024001", "19224001", "18024001", "abc", "1972400", "197240011", "", "19124001"];
    for (const nim of cases) {
      const { rows } = await db.pool.query("select public.nim_track($1) as t", [nim]);
      const ts = trackFromNim(nim);
      expect(rows[0].t, nim).toBe(ts.ok ? ts.track : null);
    }
  });
});

describe("deadline (pakai deadline asli)", () => {
  it("menolak sesi yang selesai melewati deadline", async () => {
    const host = await db.createUser(nims.reg());
    const res = await db.rpc(host, "create_session", [
      "2026-10-17T23:40:00+07:00", 30, "offline", "SBM", 5, "BEBAS", null,
    ]);
    // Jika test dijalankan setelah 17 Oktober, waktu mulai sudah lewat.
    expect(["PAST_DEADLINE", "START_IN_PAST"]).toContain(res.code);
  });
});

describe("dengan deadline jauh", () => {
  beforeAll(async () => {
    await db.useFarDeadline();
  });

  describe("onboarding", () => {
    it("menurunkan jalur dari NIM dan menolak NIM ganda", async () => {
      const nim = nims.iup();
      const a = await db.createUser(nim, "Ani");
      const { rows } = await db.pool.query(
        "select pr.track as private_track, pu.track as public_track from public.profiles_private pr join public.profiles_public pu using (id) where id = $1",
        [a],
      );
      expect(rows[0]).toEqual({ private_track: "IUP", public_track: "IUP" });

      await expect(db.createUser(nim, "Penyusup")).rejects.toThrow(/NIM_TAKEN/);
    });

    it("menolak NIM tidak valid dan onboarding kedua kali", async () => {
      const uid = crypto.randomUUID();
      await db.pool.query("insert into auth.users (id, email) values ($1, 'x@example.test')", [uid]);
      const bad = await db.rpc(uid, "complete_onboarding", ["Nama Lengkap", "Nama", "18024001", "line"]);
      expect(bad.code).toBe("INVALID_NIM");
      const ok = await db.rpc(uid, "complete_onboarding", ["Nama Lengkap", "Nama", nims.reg(), "line"]);
      expect(ok).toMatchObject({ ok: true, track: "REGULER" });
      const again = await db.rpc(uid, "complete_onboarding", ["Nama Lengkap", "Nama", nims.reg(), "line"]);
      expect(again.code).toBe("ALREADY_ONBOARDED");
    });

    it("jalur di profiles_public tidak bisa menyimpang dari NIM", async () => {
      const a = await db.createUser(nims.reg());
      await expect(
        db.pool.query("update public.profiles_public set track = 'IUP' where id = $1", [a]),
      ).rejects.toThrow(/profiles_public_track_matches_nim/);
    });

    it("update profil tidak mengubah NIM", async () => {
      const nim = nims.reg();
      const a = await db.createUser(nim);
      const res = await db.rpc(a, "update_my_profile", ["Nama Baru", "Baru", "line_baru"]);
      expect(res.ok).toBe(true);
      const { rows } = await db.pool.query(
        "select pr.nim, pr.full_name, pu.nickname from public.profiles_private pr join public.profiles_public pu using (id) where id = $1",
        [a],
      );
      expect(rows[0]).toEqual({ nim, full_name: "Nama Baru", nickname: "Baru" });
    });
  });

  describe("RLS", () => {
    it("client tidak bisa menulis langsung ke tabel", async () => {
      const a = await db.createUser(nims.reg());
      await expect(
        db.asUser(a, "update public.profiles_private set nim = '19099999' where id = $1", [a]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.asUser(
          a,
          "insert into public.sessions (host_id, starts_at, ends_at, mode, location, capacity) values ($1, now() + interval '1 day', now() + interval '1 day 30 min', 'online', 'x', 5)",
          [a],
        ),
      ).rejects.toThrow(/permission denied/);
      const sid = await db.createSession(a, { startsAt: hoursFromNow(200) });
      await expect(
        db.asUser(a, "delete from public.session_members where session_id = $1", [sid]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.asUser(a, "update public.sessions set status = 'done' where id = $1", [sid]),
      ).rejects.toThrow(/permission denied/);
    });

    it("anon tidak bisa membaca apa pun", async () => {
      await expect(db.asUser(null, "select * from public.profiles_public")).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.asUser(null, "select public.join_session(gen_random_uuid())")).rejects.toThrow(
        /permission denied/,
      );
    });

    it("data sensitif hanya untuk pemilik, admin, dan sesama anggota sesi aktif", async () => {
      const host = await db.createUser(nims.reg());
      const member = await db.createUser(nims.iup());
      const stranger = await db.createUser(nims.reg());
      const admin = await db.createUser(nims.iup());
      await db.pool.query("update public.profiles_private set is_admin = true where id = $1", [admin]);

      const sid = await db.createSession(host, { startsAt: hoursFromNow(300) });
      expect((await db.rpc(member, "join_session", [sid])).ok).toBe(true);

      const visible = async (viewer: string, target: string) =>
        (await db.asUser(viewer, "select id from public.profiles_private where id = $1", [target])).length === 1;

      expect(await visible(member, host)).toBe(true);
      expect(await visible(host, member)).toBe(true);
      expect(await visible(stranger, host)).toBe(false);
      expect(await visible(admin, host)).toBe(true);
      expect(await visible(stranger, stranger)).toBe(true);

      // Nama panggilan dan jalur tetap publik.
      const pub = await db.asUser(stranger, "select nickname, track from public.profiles_public where id = $1", [host]);
      expect(pub).toHaveLength(1);

      expect((await db.rpc(host, "cancel_session", [sid])).ok).toBe(true);
      expect(await visible(member, host)).toBe(false);
    });
  });

  describe("create_session", () => {
    it("memvalidasi input", async () => {
      const h = await db.createUser(nims.reg());
      const start = hoursFromNow(400).toISOString();
      const call = (overrides: Partial<Record<string, unknown>>) => {
        const a = { start, dur: 30, mode: "online", loc: "https://meet.google.com/x", cap: 5, pref: "BEBAS", ...overrides };
        return db.rpc(h, "create_session", [a.start, a.dur, a.mode, a.loc, a.cap, a.pref, null]);
      };
      expect((await call({ dur: 19 })).code).toBe("INVALID_DURATION");
      expect((await call({ cap: 1 })).code).toBe("INVALID_CAPACITY");
      expect((await call({ cap: 11 })).code).toBe("INVALID_CAPACITY");
      expect((await call({ mode: "hybrid" })).code).toBe("INVALID_MODE");
      expect((await call({ loc: "  " })).code).toBe("LOCATION_REQUIRED");
      expect((await call({ start: hoursFromNow(-1).toISOString() })).code).toBe("START_IN_PAST");
      expect((await call({ start: "2098-12-31T23:50:00+07:00" })).code).toBe("PAST_DEADLINE");
      const ok = await call({});
      expect(ok.ok).toBe(true);
      const { rows } = await db.pool.query("select duration_minutes, ends_at - starts_at as d from public.sessions where id = $1", [ok.session_id]);
      expect(rows[0].duration_minutes).toBe(30);
    });

    it("menolak sesi baru yang tumpang tindih dengan sesi aktif host", async () => {
      const h = await db.createUser(nims.reg());
      const base = hoursFromNow(500);
      await db.createSession(h, { startsAt: base, duration: 60 });
      const overlap = await db.rpc(h, "create_session", [
        new Date(base.getTime() + 30 * 60_000).toISOString(), 30, "online", "x", 5, "BEBAS", null,
      ]);
      expect(overlap.code).toBe("OVERLAP");
      // Tepat setelah sesi pertama selesai: boleh.
      const adjacent = await db.rpc(h, "create_session", [
        new Date(base.getTime() + 60 * 60_000).toISOString(), 30, "online", "x", 5, "BEBAS", null,
      ]);
      expect(adjacent.ok).toBe(true);
    });
  });

  describe("join_session", () => {
    it("sesi khusus jalur hanya bisa diikuti jalur itu", async () => {
      const h = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { trackPref: "IUP", startsAt: hoursFromNow(610) });
      const reg = await db.createUser(nims.reg());
      const iup = await db.createUser(nims.iup());
      const listed = await db.asUser<{ blocker: string | null }>(
        reg,
        "select blocker from public.list_open_sessions_v2() where id = $1",
        [sid],
      );
      expect(listed[0].blocker).toBe("TRACK_NOT_ALLOWED");
      expect((await db.rpc(reg, "join_session", [sid])).code).toBe("TRACK_NOT_ALLOWED");
      expect((await db.rpc(iup, "join_session", [sid])).ok).toBe(true);
      expect(await db.memberCount(sid)).toBe(2);

      const reguler = await db.createSession(h, { trackPref: "REGULER", startsAt: hoursFromNow(620) });
      expect((await db.rpc(iup, "join_session", [reguler])).code).toBe("TRACK_NOT_ALLOWED");
      expect((await db.rpc(reg, "join_session", [reguler])).ok).toBe(true);

      const bebas = await db.createSession(h, { startsAt: hoursFromNow(630) });
      expect((await db.rpc(iup, "join_session", [bebas])).ok).toBe(true);
      expect((await db.rpc(reg, "join_session", [bebas])).ok).toBe(true);
    });

    it("menolak jika sesi penuh (kapasitas termasuk host)", async () => {
      const h = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { capacity: 3, startsAt: hoursFromNow(600) });
      const a = await db.createUser(nims.iup());
      const b = await db.createUser(nims.iup());
      const c = await db.createUser(nims.iup());
      expect((await db.rpc(a, "join_session", [sid])).ok).toBe(true);
      expect((await db.rpc(b, "join_session", [sid])).ok).toBe(true);
      expect((await db.rpc(c, "join_session", [sid])).code).toBe("SESSION_FULL");
      expect(await db.memberCount(sid)).toBe(3);
    });

    it("menolak jika sudah menjadi anggota", async () => {
      const h = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(610) });
      const a = await db.createUser(nims.iup());
      expect((await db.rpc(a, "join_session", [sid])).ok).toBe(true);
      expect((await db.rpc(a, "join_session", [sid])).code).toBe("ALREADY_MEMBER");
      expect((await db.rpc(h, "join_session", [sid])).code).toBe("ALREADY_MEMBER");
    });

    it("menolak jika waktu tumpang tindih dengan sesi aktif lain milik user", async () => {
      const h1 = await db.createUser(nims.reg());
      const h2 = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const base = hoursFromNow(700);
      const s1 = await db.createSession(h1, { startsAt: base, duration: 60 });
      const s2 = await db.createSession(h2, { startsAt: new Date(base.getTime() + 45 * 60_000) });
      expect((await db.rpc(a, "join_session", [s1])).ok).toBe(true);
      expect((await db.rpc(a, "join_session", [s2])).code).toBe("OVERLAP");
      // Setelah keluar dari s1, boleh join s2.
      expect((await db.rpc(a, "leave_session", [s1])).ok).toBe(true);
      expect((await db.rpc(a, "join_session", [s2])).ok).toBe(true);
    });

    it("sesi yang dibatalkan tidak dihitung tumpang tindih", async () => {
      const h1 = await db.createUser(nims.reg());
      const h2 = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const base = hoursFromNow(710);
      const s1 = await db.createSession(h1, { startsAt: base });
      const s2 = await db.createSession(h2, { startsAt: base });
      expect((await db.rpc(a, "join_session", [s1])).ok).toBe(true);
      expect((await db.rpc(h1, "cancel_session", [s1])).ok).toBe(true);
      expect((await db.rpc(a, "join_session", [s2])).ok).toBe(true);
    });

    it("boleh bertemu partner yang sama lagi, tapi progres tetap dihitung unik per orang", async () => {
      const h1 = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const b = await db.createUser(nims.iup());
      const s1 = await db.createSession(h1, { startsAt: hoursFromNow(800) });
      expect((await db.rpc(a, "join_session", [s1])).ok).toBe(true);
      expect((await db.rpc(b, "join_session", [s1])).ok).toBe(true);
      expect(await db.progress(a)).toEqual({ iup_scheduled: 1, iup_done: 0, reguler_scheduled: 1, reguler_done: 0 });

      // a dan h1 bertemu lagi di sesi lain (h1 host): sekarang diizinkan.
      const s2 = await db.createSession(h1, { startsAt: hoursFromNow(805) });
      const before = await db.asUser<{ id: string; blocker: string | null; repeat_count: number }>(
        a,
        "select id, blocker, repeat_count from public.list_open_sessions_v2() where id = $1",
        [s2],
      );
      expect(before[0]).toMatchObject({ blocker: null, repeat_count: 1 });
      expect((await db.rpc(a, "join_session", [s2])).ok).toBe(true);

      // h1 tetap dihitung satu kali di progres a, dan a satu kali di progres h1.
      expect(await db.progress(a)).toEqual({ iup_scheduled: 1, iup_done: 0, reguler_scheduled: 1, reguler_done: 0 });
      expect(await db.progress(h1)).toEqual({ iup_scheduled: 2, iup_done: 0, reguler_scheduled: 0, reguler_done: 0 });

      // Di detail sesi s2, a melihat 1 anggota yang sudah pernah wawancara dengannya.
      const [{ n }] = await db.asUser<{ n: number }>(a, "select public.my_repeat_partner_count($1) as n", [s2]);
      expect(n).toBe(1);
    });

    it("pertemuan ulang setelah sesi selesai: dihitung Selesai, tidak dobel", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const s1 = await db.createSession(h, { startsAt: hoursFromNow(900) });
      expect((await db.rpc(a, "join_session", [s1])).ok).toBe(true);
      await db.moveSessionToPast(s1);
      expect((await db.rpc(h, "complete_session", [s1, "https://example.com/memo"])).ok).toBe(true);
      const s2 = await db.createSession(h, { startsAt: hoursFromNow(905) });
      expect((await db.rpc(a, "join_session", [s2])).ok).toBe(true);
      expect(await db.progress(a)).toEqual({ iup_scheduled: 0, iup_done: 0, reguler_scheduled: 0, reguler_done: 1 });
      const records = await db.asUser<{ nim: string }>(a, "select nim from public.my_interview_records()");
      expect(records).toHaveLength(2); // dua pertemuan, satu orang
    });

    it("menolak jika sesi sudah dimulai, dibatalkan, atau selesai", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const started = await db.createSession(h, { startsAt: hoursFromNow(1000) });
      await db.moveSessionToPast(started, 5);
      expect((await db.rpc(a, "join_session", [started])).code).toBe("SESSION_STARTED");

      const cancelled = await db.createSession(h, { startsAt: hoursFromNow(1010) });
      expect((await db.rpc(h, "cancel_session", [cancelled])).ok).toBe(true);
      expect((await db.rpc(a, "join_session", [cancelled])).code).toBe("SESSION_NOT_OPEN");

      expect((await db.rpc(a, "join_session", [crypto.randomUUID()])).code).toBe("SESSION_NOT_FOUND");
    });

    it("menolak user yang belum onboarding", async () => {
      const h = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1100) });
      const uid = crypto.randomUUID();
      await db.pool.query("insert into auth.users (id) values ($1)", [uid]);
      expect((await db.rpc(uid, "join_session", [sid])).code).toBe("NOT_ONBOARDED");
    });

    it("list_open_sessions menyertakan alasan tidak bisa gabung", async () => {
      const h = await db.createUser(nims.reg(), "HostList");
      const a = await db.createUser(nims.iup());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1200), capacity: 2 });
      let rows = await db.asUser<{ id: string; blocker: string | null; members: unknown[] }>(
        a,
        "select id, blocker, members from public.list_open_sessions() where id = $1",
        [sid],
      );
      expect(rows[0].blocker).toBeNull();
      expect(rows[0].members).toEqual([{ nickname: "HostList", track: "REGULER", is_host: true }]);
      rows = await db.asUser(h, "select id, blocker from public.list_open_sessions() where id = $1", [sid]);
      expect(rows[0].blocker).toBe("ALREADY_MEMBER");
      await db.rpc(a, "join_session", [sid]);
      const c = await db.createUser(nims.iup());
      rows = await db.asUser(c, "select id, blocker from public.list_open_sessions() where id = $1", [sid]);
      expect(rows[0].blocker).toBe("SESSION_FULL");
    });
  });

  describe("keluar, batal, selesai, dan progres", () => {
    it("menghitung progres per jalur (terjadwal vs selesai)", async () => {
      const me = await db.createUser(nims.reg());
      const i1 = await db.createUser(nims.iup());
      const i2 = await db.createUser(nims.iup());
      const r1 = await db.createUser(nims.reg());
      const sDone = await db.createSession(me, { startsAt: hoursFromNow(1300) });
      const sOpen = await db.createSession(me, { startsAt: hoursFromNow(1305) });
      for (const u of [i1, r1]) expect((await db.rpc(u, "join_session", [sDone])).ok).toBe(true);
      expect((await db.rpc(i2, "join_session", [sOpen])).ok).toBe(true);

      expect(await db.progress(me)).toEqual({ iup_scheduled: 2, iup_done: 0, reguler_scheduled: 1, reguler_done: 0 });

      await db.moveSessionToPast(sDone);
      expect((await db.rpc(me, "complete_session", [sDone, ""])).ok).toBe(true);
      expect(await db.progress(me)).toEqual({ iup_scheduled: 1, iup_done: 1, reguler_scheduled: 0, reguler_done: 1 });
      // Progres partner juga ikut terhitung.
      expect(await db.progress(i1)).toEqual({ iup_scheduled: 0, iup_done: 0, reguler_scheduled: 0, reguler_done: 2 });

      const partners = await db.asUser<{ partner_id: string; nim: string; line_id: string }>(
        me,
        "select partner_id, nim, line_id from public.my_partners()",
      );
      expect(partners.map((p) => p.partner_id).sort()).toEqual([i1, i2, r1].sort());
    });

    it("keluar dari sesi memperbarui progres kedua pihak", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1400) });
      await db.rpc(a, "join_session", [sid]);
      expect((await db.progress(h)).iup_scheduled).toBe(1);
      expect((await db.progress(a)).reguler_scheduled).toBe(1);
      expect((await db.rpc(a, "leave_session", [sid])).ok).toBe(true);
      expect((await db.progress(h)).iup_scheduled).toBe(0);
      expect((await db.progress(a)).reguler_scheduled).toBe(0);
      expect((await db.rpc(a, "leave_session", [sid])).code).toBe("NOT_MEMBER");
    });

    it("host tidak bisa keluar; anggota tidak bisa keluar setelah sesi mulai", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1500) });
      await db.rpc(a, "join_session", [sid]);
      expect((await db.rpc(h, "leave_session", [sid])).code).toBe("HOST_CANNOT_LEAVE");
      await db.moveSessionToPast(sid, 1);
      expect((await db.rpc(a, "leave_session", [sid])).code).toBe("SESSION_STARTED");
    });

    it("membatalkan sesi menghapus progres semua anggota", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const b = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1600) });
      await db.rpc(a, "join_session", [sid]);
      await db.rpc(b, "join_session", [sid]);
      expect(await db.progress(a)).toEqual({ iup_scheduled: 0, iup_done: 0, reguler_scheduled: 2, reguler_done: 0 });
      expect((await db.rpc(a, "cancel_session", [sid])).code).toBe("NOT_HOST");
      expect((await db.rpc(h, "cancel_session", [sid])).ok).toBe(true);
      expect(await db.progress(a)).toEqual({ iup_scheduled: 0, iup_done: 0, reguler_scheduled: 0, reguler_done: 0 });
      expect(await db.progress(h)).toEqual({ iup_scheduled: 0, iup_done: 0, reguler_scheduled: 0, reguler_done: 0 });
      // Setelah batal, mereka boleh dipertemukan lagi di sesi lain.
      const s2 = await db.createSession(h, { startsAt: hoursFromNow(1610) });
      expect((await db.rpc(a, "join_session", [s2])).ok).toBe(true);
    });

    it("tandai selesai: hanya host, setelah mulai, URL valid, status final", async () => {
      const h = await db.createUser(nims.reg());
      const a = await db.createUser(nims.iup());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1700) });
      expect((await db.rpc(h, "complete_session", [sid, null])).code).toBe("SESSION_NOT_STARTED");
      await db.moveSessionToPast(sid);
      expect((await db.rpc(h, "complete_session", [sid, null])).code).toBe("NO_PARTNERS");
      await db.pool.query("insert into public.session_members (session_id, user_id) values ($1, $2)", [sid, a]);
      expect((await db.rpc(a, "complete_session", [sid, null])).code).toBe("NOT_HOST");
      expect((await db.rpc(h, "complete_session", [sid, "ftp://memo"])).code).toBe("INVALID_URL");
      expect((await db.rpc(h, "complete_session", [sid, "bukan url"])).code).toBe("INVALID_URL");
      expect((await db.rpc(h, "complete_session", [sid, "https://drive.google.com/x"])).ok).toBe(true);
      expect((await db.rpc(h, "cancel_session", [sid])).code).toBe("SESSION_NOT_OPEN");
      expect((await db.rpc(h, "complete_session", [sid, null])).code).toBe("SESSION_NOT_OPEN");
      await expect(
        db.pool.query("update public.sessions set status = 'open' where id = $1", [sid]),
      ).rejects.toThrow(/final/);
    });
  });

  describe("admin", () => {
    it("hanya admin yang bisa memakai RPC admin, dan reset profil membebaskan NIM", async () => {
      const admin = await db.createUser(nims.iup());
      await db.pool.query("update public.profiles_private set is_admin = true where id = $1", [admin]);
      const nim = nims.reg();
      const squatter = await db.createUser(nim);

      expect((await db.rpc(squatter, "admin_overview")).code).toBe("NOT_ADMIN");
      expect((await db.rpc(squatter, "admin_reset_profile", [admin])).code).toBe("NOT_ADMIN");
      expect(await db.asUser(squatter, "select * from public.admin_participants()")).toHaveLength(0);

      const overview = await db.rpc(admin, "admin_overview");
      expect(overview.ok).toBe(true);
      expect(overview.users_by_track).toBeTruthy();

      expect((await db.rpc(admin, "admin_reset_profile", [admin])).code).toBe("CANNOT_RESET_ADMIN");
      expect((await db.rpc(admin, "admin_reset_profile", [squatter])).ok).toBe(true);
      // NIM bisa diklaim pemilik aslinya.
      const owner = await db.createUser(nim);
      expect(owner).toBeTruthy();
      // Akun yang direset harus onboarding ulang.
      expect((await db.rpc(squatter, "update_my_profile", ["Nama", "N", "l"])).code).toBe("NOT_ONBOARDED");
    });

    it("admin bisa menghapus sesi", async () => {
      const admin = await db.createUser(nims.iup());
      await db.pool.query("update public.profiles_private set is_admin = true where id = $1", [admin]);
      const h = await db.createUser(nims.reg());
      const sid = await db.createSession(h, { startsAt: hoursFromNow(1800) });
      expect((await db.rpc(h, "admin_delete_session", [sid])).code).toBe("NOT_ADMIN");
      expect((await db.rpc(admin, "admin_delete_session", [sid])).ok).toBe(true);
      expect(await db.memberCount(sid)).toBe(0);
    });
  });
});
