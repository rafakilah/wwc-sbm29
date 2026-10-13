import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCrossSessionDuplicateRace, runJoinRace } from "./concurrency";
import { TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create();
  await db.useFarDeadline();
});

afterAll(async () => {
  await db?.destroy();
});

describe("konkurensi join_session", () => {
  it("30 user join bersamaan ke sesi kapasitas 10 -> tepat 10 anggota", async () => {
    const { codes, members } = await runJoinRace(db, 30, 10);
    expect(members).toBe(10);
    expect(codes).toEqual({ OK: 9, SESSION_FULL: 21 });
  });

  it("bertemu partner yang sama lintas sesi bersamaan: keduanya boleh, progres tetap unik", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await runCrossSessionDuplicateRace(db)).toEqual(["OK", "OK"]);
    }
  });
});
