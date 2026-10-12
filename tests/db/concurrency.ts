import { TestDb, hoursFromNow, nimFactory } from "./harness";

/**
 * 30 user mencoba join bersamaan ke satu sesi berkapasitas 10.
 * Host sudah menjadi anggota pertama, jadi tepat 9 join yang boleh berhasil
 * dan sesi berakhir dengan tepat 10 anggota.
 */
export async function runJoinRace(db: TestDb, joiners = 30, capacity = 10) {
  const nims = nimFactory();
  const host = await db.createUser(nims.reg(), "HostRace");
  const users: string[] = [];
  for (let i = 0; i < joiners; i++) {
    users.push(await db.createUser(i % 2 ? nims.iup() : nims.reg(), `Race${i}`));
  }
  const sessionId = await db.createSession(host, { startsAt: hoursFromNow(48), capacity });

  const results = await Promise.all(users.map((u) => db.rpc(u, "join_session", [sessionId])));
  const codes: Record<string, number> = {};
  for (const r of results) codes[r.code] = (codes[r.code] ?? 0) + 1;

  return { sessionId, codes, members: await db.memberCount(sessionId) };
}

/**
 * Dua transaksi di sesi berbeda yang akan membuat pasangan yang sama:
 * A gabung ke S1 (berisi B) dan B gabung ke S2 (berisi A) di waktu bersamaan.
 * Hanya satu yang boleh berhasil.
 */
export async function runCrossSessionDuplicateRace(db: TestDb) {
  const nims = nimFactory();
  const a = await db.createUser(nims.iup(), "CrossA");
  const b = await db.createUser(nims.reg(), "CrossB");
  const s1 = await db.createSession(b, { startsAt: hoursFromNow(60) });
  const s2 = await db.createSession(a, { startsAt: hoursFromNow(62) });
  const [r1, r2] = await Promise.all([
    db.rpc(a, "join_session", [s1]),
    db.rpc(b, "join_session", [s2]),
  ]);
  return [r1.code, r2.code].sort();
}
