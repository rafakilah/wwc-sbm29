/**
 * Uji konkurensi mandiri: 30 user join bersamaan ke satu sesi kapasitas 10.
 *
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:concurrency
 *
 * Script membuat database sementara di server itu, menjalankan migration,
 * menjalankan balapan, lalu menghapus database sementara.
 */
import { runJoinRace } from "../tests/db/concurrency";
import { TestDb } from "../tests/db/harness";

async function main() {
  const db = await TestDb.create();
  try {
    await db.useFarDeadline();
    const { codes, members } = await runJoinRace(db, 30, 10);
    console.log("Hasil per kode:", codes);
    console.log("Jumlah anggota akhir:", members);
    if (members !== 10) {
      console.error("GAGAL: anggota harus tepat 10");
      process.exitCode = 1;
    } else {
      console.log("LULUS: tepat 10 anggota.");
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
