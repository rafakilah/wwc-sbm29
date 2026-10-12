/**
 * Seed data dummy KHUSUS LOKAL: ~60 peserta (IUP + Reguler) dan beberapa sesi.
 *
 *   SEED_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run seed
 *
 * Default SEED_DATABASE_URL adalah database Supabase lokal (`supabase start`).
 * Script MENOLAK jalan jika host database bukan localhost, supaya tidak pernah
 * mengotori project production.
 *
 * Sesi dibuat dan diikuti lewat RPC yang sama dengan aplikasi (sebagai tiap user),
 * jadi semua aturan join tetap berlaku. Seed bisa dijalankan ulang: user seed
 * lama (email @seed.local) dihapus dulu.
 */
import { createHash } from "node:crypto";
import { Client } from "pg";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);
const SEED_DOMAIN = "seed.local";
const DEADLINE = new Date("2026-10-17T23:59:00+07:00");

function assertLocal(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("SEED_DATABASE_URL tidak valid.");
  }
  const host = parsed.hostname;
  if (!LOCAL_HOSTS.has(host) || /supabase\.(co|com)|pooler/i.test(url)) {
    throw new Error(
      `Seed ditolak: host database "${host}" bukan lokal. Seed hanya untuk Supabase lokal, jangan ke production.`,
    );
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("Seed ditolak: terdeteksi lingkungan production.");
  }
}

/** UUID deterministik dari string, supaya seed stabil antar-run. */
function uuidFrom(input: string): string {
  const h = createHash("sha256").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** PRNG deterministik (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ani", "Budi", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hana", "Ilham", "Joko", "Kirana", "Laras", "Made", "Nadia", "Oki", "Putri", "Rizky", "Sinta", "Tegar", "Umar", "Vina", "Wulan", "Yoga", "Zahra", "Bayu", "Dewi", "Rama", "Salsa", "Tio", "Nanda"];
const LAST = ["Pratama", "Saputra", "Lestari", "Wijaya", "Hidayat", "Kusuma", "Permata", "Nugroho", "Santoso", "Rahmawati"];

async function asUser<T>(client: Client, uid: string, sql: string, params: unknown[]): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, role: "authenticated" }),
    ]);
    const res = await client.query(sql, params);
    await client.query("commit");
    return res.rows[0] as T;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

async function rpc(client: Client, uid: string, fn: string, args: unknown[]) {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  const row = await asUser<{ r: { ok: boolean; code: string; session_id?: string } }>(
    client,
    uid,
    `select public.${fn}(${ph}) as r`,
    args,
  );
  return row.r;
}

/** Slot waktu mendatang (WIB 08.00–20.00, tiap 90 menit) sebelum deadline. */
function futureSlots(count: number): Date[] {
  const slots: Date[] = [];
  const start = new Date(Date.now() + 2 * 3600_000);
  // Bulatkan ke jam penuh berikutnya.
  start.setUTCMinutes(0, 0, 0);
  for (let t = start.getTime(); slots.length < count && t + 30 * 60_000 <= DEADLINE.getTime(); t += 90 * 60_000) {
    const wibHour = (new Date(t).getUTCHours() + 7) % 24;
    if (wibHour >= 8 && wibHour <= 20) slots.push(new Date(t));
  }
  return slots;
}

async function main() {
  const url = process.env.SEED_DATABASE_URL ?? DEFAULT_URL;
  assertLocal(url);

  const client = new Client({ connectionString: url });
  await client.connect();
  const random = rng(29);

  try {
    console.log("Menghapus data seed lama…");
    await client.query(`delete from auth.users where email like $1`, [`%@${SEED_DOMAIN}`]);

    console.log("Membuat 60 peserta…");
    const users: { id: string; track: "IUP" | "REGULER"; nickname: string }[] = [];
    for (let i = 0; i < 60; i++) {
      const isIup = i % 2 === 0;
      const prefix = isIup ? (i % 4 === 0 ? "190" : "192") : "197";
      const nim = `${prefix}26${String(900 + i).padStart(3, "0")}`;
      const nickname = `${FIRST[i % FIRST.length]}${i >= FIRST.length ? i : ""}`;
      const fullName = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
      const id = uuidFrom(`seed-user-${i}`);
      const email = `peserta${i}@${SEED_DOMAIN}`;
      await client.query(
        `insert into auth.users (id, email, aud, role, raw_user_meta_data, created_at)
         values ($1, $2, 'authenticated', 'authenticated', $3, now())`,
        [id, email, JSON.stringify({ full_name: fullName })],
      );
      const res = await rpc(client, id, "complete_onboarding", [fullName, nickname, nim, `line.${nickname.toLowerCase()}`]);
      if (!res.ok) throw new Error(`Onboarding ${nim} gagal: ${res.code}`);
      users.push({ id, track: isIup ? "IUP" : "REGULER", nickname });
    }
    await client.query("update public.profiles_private set is_admin = true where id = $1", [users[0].id]);
    console.log(`  Admin dummy: peserta0@${SEED_DOMAIN} (${users[0].nickname})`);

    const slots = futureSlots(16);
    if (slots.length === 0) {
      console.log("Deadline sudah lewat, sesi tidak dibuat.");
      return;
    }

    console.log(`Membuat ${slots.length} sesi dan mengisi anggota…`);
    const sessionIds: string[] = [];
    for (let s = 0; s < slots.length; s++) {
      const host = users[(s * 7) % users.length];
      const capacity = 4 + Math.floor(random() * 7); // 4..10
      const online = random() < 0.4;
      const res = await rpc(client, host.id, "create_session", [
        slots[s].toISOString(),
        [20, 30, 30, 45, 60][Math.floor(random() * 5)],
        online ? "online" : "offline",
        online ? `https://meet.google.com/seed-${s}` : ["Selasar SBM", "Kantin Barrac", "Perpustakaan Pusat", "Taman Ganesha"][s % 4],
        capacity,
        ["BEBAS", "BEBAS", "IUP", "REGULER"][s % 4],
        s % 3 === 0 ? "Data dummy dari seed." : null,
      ]);
      if (!res.ok) {
        console.log(`  Lewati sesi ${s}: ${res.code}`);
        continue;
      }
      const sid = res.session_id!;
      sessionIds.push(sid);
      const target = Math.max(1, capacity - 1 - Math.floor(random() * 3));
      let joined = 0;
      for (let tries = 0; tries < 40 && joined < target; tries++) {
        const u = users[Math.floor(random() * users.length)];
        const j = await rpc(client, u.id, "join_session", [sid]);
        if (j.ok) joined++;
      }
    }

    // Beberapa sesi dipindah ke kemarin lalu ditandai selesai, untuk contoh progres "Selesai".
    const toComplete = sessionIds.slice(0, Math.min(4, sessionIds.length));
    for (let k = 0; k < toComplete.length; k++) {
      const sid = toComplete[k];
      await client.query(
        `update public.sessions
         set starts_at = date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
                         - interval '1 day' + make_interval(hours => 9 + 2 * $2)
         where id = $1`,
        [sid, k],
      );
      const { rows } = await client.query("select host_id from public.sessions where id = $1", [sid]);
      const res = await rpc(client, rows[0].host_id, "complete_session", [sid, `https://drive.google.com/seed-memo-${k}`]);
      console.log(`  Sesi ${sid.slice(0, 8)} -> selesai: ${res.code}`);
    }

    const { rows: summary } = await client.query(
      "select status, count(*)::int as n from public.sessions group by status order by status",
    );
    console.log("Ringkasan sesi:", summary);
    console.log("Seed selesai.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
