import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client, Pool } from "pg";

/**
 * Harness uji database.
 *
 * Membuat database baru yang terisolasi di server TEST_DATABASE_URL, menerapkan
 * shim Supabase (jika skema auth belum ada) dan semua migration, lalu
 * menyediakan helper untuk memanggil RPC sebagai user tertentu (role
 * authenticated + klaim JWT), persis seperti PostgREST di Supabase.
 */

const ROOT = path.resolve(__dirname, "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SHIM_PATH = path.join(__dirname, "supabase-shim.sql");

export type RpcResult = { ok: boolean; code: string; [key: string]: unknown };

export function testDatabaseUrl(): string | undefined {
  return process.env.TEST_DATABASE_URL || undefined;
}

export class TestDb {
  readonly pool: Pool;
  private constructor(
    private readonly adminUrl: string,
    readonly dbName: string,
    readonly url: string,
  ) {
    this.pool = new Pool({ connectionString: url, max: 40 });
  }

  static async create(): Promise<TestDb> {
    const adminUrl = testDatabaseUrl();
    if (!adminUrl) throw new Error("TEST_DATABASE_URL belum diset");
    const dbName = `wwc_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();

    const url = new URL(adminUrl);
    url.pathname = `/${dbName}`;
    const db = new TestDb(adminUrl, dbName, url.toString());
    await db.migrate();
    return db;
  }

  private async migrate() {
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query(
        "select exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') as has_auth",
      );
      if (!rows[0].has_auth) {
        await client.query(readFileSync(SHIM_PATH, "utf8"));
      }
      const files = readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        await client.query(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      }
    } finally {
      client.release();
    }
  }

  /** Geser deadline jauh ke depan supaya test tetap jalan setelah 17 Oktober 2026. */
  async useFarDeadline() {
    await this.pool.query(`
      create or replace function public.app_deadline()
      returns timestamptz language sql immutable parallel safe set search_path = ''
      as $$ select timestamptz '2099-01-01 00:00:00+07' $$;
    `);
  }

  async destroy() {
    await this.pool.end();
    const admin = new Client({ connectionString: this.adminUrl });
    await admin.connect();
    await admin.query(`drop database if exists ${this.dbName} with (force)`);
    await admin.end();
  }

  /** Jalankan query sebagai user terautentikasi (atau anon jika uid null). */
  async asUser<T = Record<string, unknown>>(
    uid: string | null,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(`set local role ${uid ? "authenticated" : "anon"}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "anon" }),
      ]);
      const res = await client.query(sql, params);
      await client.query("commit");
      return res.rows as T[];
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** Panggil RPC yang mengembalikan jsonb {ok, code, ...}. */
  async rpc(uid: string | null, fn: string, args: unknown[] = []): Promise<RpcResult> {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await this.asUser<{ r: RpcResult }>(
      uid,
      `select public.${fn}(${placeholders}) as r`,
      args,
    );
    return rows[0].r;
  }

  /** Buat akun auth + selesaikan onboarding. Mengembalikan uid. */
  async createUser(nim: string, nickname = `U${nim.slice(-3)}`): Promise<string> {
    const uid = randomUUID();
    await this.pool.query("insert into auth.users (id, email) values ($1, $2)", [
      uid,
      `${nim}@example.test`,
    ]);
    const res = await this.rpc(uid, "complete_onboarding", [
      `Peserta ${nickname}`,
      nickname,
      nim,
      `line_${nim}`,
    ]);
    if (!res.ok) throw new Error(`onboarding gagal untuk ${nim}: ${res.code}`);
    return uid;
  }

  /** Buat sesi via RPC sebagai host. Default: besok jam 10.00 WIB + offset menit. */
  async createSession(
    hostId: string,
    opts: { startsAt?: Date; duration?: number; capacity?: number; mode?: string } = {},
  ): Promise<string> {
    const startsAt = opts.startsAt ?? hoursFromNow(24);
    const res = await this.rpc(hostId, "create_session", [
      startsAt.toISOString(),
      opts.duration ?? 30,
      opts.mode ?? "offline",
      "Selasar SBM",
      opts.capacity ?? 10,
      "BEBAS",
      null,
    ]);
    if (!res.ok) throw new Error(`create_session gagal: ${res.code}`);
    return res.session_id as string;
  }

  /** Mundurkan waktu mulai sesi ke masa lalu (simulasi waktu berjalan). */
  async moveSessionToPast(sessionId: string, minutesAgo = 30) {
    await this.pool.query(
      "update public.sessions set starts_at = now() - make_interval(mins => $2) where id = $1",
      [sessionId, minutesAgo],
    );
  }

  async progress(uid: string) {
    const rows = await this.asUser<{
      iup_scheduled: number;
      iup_done: number;
      reguler_scheduled: number;
      reguler_done: number;
    }>(uid, "select * from public.my_progress()");
    return rows[0];
  }

  async memberCount(sessionId: string): Promise<number> {
    const { rows } = await this.pool.query(
      "select count(*)::int as n from public.session_members where session_id = $1",
      [sessionId],
    );
    return rows[0].n;
  }
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3600_000);
}

let nimCounter = 0;

/** Pembuat NIM unik untuk test (unik dalam satu proses test). */
export function nimFactory() {
  const next = () => ++nimCounter;
  return {
    iup: () => `190${String(next()).padStart(5, "0")}`,
    reg: () => `197${String(next()).padStart(5, "0")}`,
  };
}
