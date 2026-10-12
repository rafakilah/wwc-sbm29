# Penjadwal Wawancara Angkatan OS SBM 2026

Web app untuk peserta OS SBM ITB 2026 (angkatan 29) menjadwalkan sesi **Wawancara Angkatan Termin 1**, mencegah wawancara dobel, dan memantau progres menuju **25 IUP + 25 Reguler** (50 orang berbeda). Deadline: **Sabtu, 17 Oktober 2026, 23.59 WIB**.

Web ini bukan pengganti logbook. Rekaman voice memo tetap dimasukkan ke logbook Canva.

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase: Auth (Google OAuth saja), Postgres, Row Level Security
- Deploy: Vercel (Hobby), function di region Singapore (`sin1`)

---

## Daftar isi

1. [Rencana dan arsitektur](#1-rencana-dan-arsitektur)
2. [Setup Supabase (region Singapore)](#2-setup-supabase-region-singapore)
3. [Google OAuth](#3-google-oauth)
4. [Variabel lingkungan](#4-variabel-lingkungan)
5. [Menjalankan migration](#5-menjalankan-migration)
6. [Pengembangan lokal dan seed](#6-pengembangan-lokal-dan-seed)
7. [Menjadikan akun admin](#7-menjadikan-akun-admin)
8. [Deploy ke Vercel](#8-deploy-ke-vercel)
9. [Test](#9-test)
10. [Asumsi](#10-asumsi)

---

## 1. Rencana dan arsitektur

### Struktur folder

```
supabase/
  migrations/                          Skema lengkap (5 file berurutan): tabel, constraint, index, view, RLS, RPC, grant
  config.toml                          Konfigurasi Supabase CLI lokal
src/
  proxy.ts                             "Middleware" Next 16: refresh sesi, wajib login, wajib onboarding
  app/
    login/                             /login (tombol Google)
    auth/callback, auth/signout        Tukar code OAuth, keluar
    onboarding/                        /onboarding (form profil + validasi NIM real-time)
    (app)/                             Semua halaman setelah onboarding (header, footer, FAB)
      dashboard/ sessions/ sessions/new/ sessions/[id]/ partners/ profile/ admin/
    actions/                           Server action (memanggil RPC)
  components/                          UI bersama (FAB, progress, kartu sesi, dll.)
  lib/
    nim.ts                             SATU fungsi NIM -> jalur (frontend + server action)
    constants.ts                       Deadline, zona waktu, aturan sesi
    links.ts                           Label + URL "Dokumen penting"
    time.ts                            Format & parsing waktu WIB eksplisit
    errors.ts                          Kode alasan RPC -> pesan Bahasa Indonesia
scripts/
  seed.ts                              Seed data dummy (lokal saja)
  concurrency-test.ts                  Uji 30 user join bersamaan ke sesi kapasitas 10
  test-db-local.sh                     Jalankan test DB di cluster Postgres sementara
tests/
  unit/                                Test NIM, waktu, CSV, pesan error
  db/                                  Test aturan database (RLS, join, progres, admin, konkurensi)
```

### Skema database

| Tabel | Isi | Siapa yang bisa membaca |
|---|---|---|
| `profiles_private` | nama lengkap, **NIM (unik)**, jalur (generated dari NIM), ID LINE, `is_admin` | pemilik, admin, sesama anggota sesi aktif (policy RLS) |
| `profiles_public` | nama panggilan, jalur | semua user yang login |
| `sessions` | waktu mulai/selesai, durasi, mode, lokasi/link, kapasitas, preferensi jalur, catatan, status, link voice memo | semua user yang login |
| `session_members` | (session_id, user_id) | semua user yang login |

Penjaga konsistensi di database:

- `nim_track(nim)` mencerminkan `src/lib/nim.ts`. `profiles_private.track` adalah **generated column** dari NIM, dan `profiles_public(id, track)` punya **foreign key komposit** ke `profiles_private(id, track)`, jadi jalur tidak bisa menyimpang dari NIM.
- `profiles_private.nim` unik: satu NIM, satu akun.
- `sessions`: durasi 20–240 menit, kapasitas 2–10, `ends_at` dihitung trigger, `ends_at <= app_deadline()`, status `open → done/cancelled` dan status final dikunci trigger.
- Client hanya punya hak `SELECT`. Semua penulisan lewat RPC `security definer` yang mengecek `auth.uid()`.

**Satu definisi "partner"**: view `active_memberships` (keanggotaan di sesi `open`/`done`) dan `active_partners` (semua pasangan anggota di sesi aktif yang sama). Progres (`participant_progress`), cek duplikat, daftar partner, dan hak lihat data sensitif semuanya membaca dari view ini. Keluar atau batal otomatis memperbarui semuanya. Tidak ada tabel "pertemuan" terpisah.

### RPC

| Fungsi | Kegunaan |
|---|---|
| `complete_onboarding(full_name, nickname, nim, line_id)` | Onboarding. Kode: `INVALID_NIM`, `NIM_TAKEN`, `ALREADY_ONBOARDED`, … |
| `update_my_profile(full_name, nickname, line_id)` | Edit profil (NIM tidak bisa diubah) |
| `create_session(...)` | Buat sesi, host otomatis jadi anggota. Cek waktu masa depan, deadline, bentrok jadwal host |
| `join_session(session_id)` | Gabung. `SELECT … FOR NO KEY UPDATE` pada baris sesi + kunci profil semua pihak, lalu cek: open & belum mulai, kapasitas, belum anggota, tidak bentrok, tidak ada duplikat partner |
| `leave_session(session_id)` | Anggota (bukan host) keluar sebelum sesi mulai |
| `cancel_session(session_id)` | Host membatalkan sesi yang masih open |
| `complete_session(session_id, voice_memo_url)` | Host menandai selesai setelah waktu mulai (URL opsional, http/https) |
| `list_open_sessions()` | Sesi open yang belum mulai + alasan user tidak bisa gabung (`blocker`) |
| `my_join_blocker`, `my_sessions`, `my_progress`, `my_partners` | Data untuk UI |
| `admin_overview`, `admin_participants`, `admin_sessions`, `admin_delete_session`, `admin_reset_profile` | Admin (dicek `is_admin()` di database) |

Kode alasan gagal: `SESSION_FULL`, `OVERLAP`, `DUPLICATE_PARTNER`, `SESSION_STARTED`, `SESSION_NOT_OPEN`, `ALREADY_MEMBER`, `HOST_CANNOT_LEAVE`, `NOT_HOST`, `INVALID_URL`, dll. Pesan Bahasa Indonesianya ada di `src/lib/errors.ts`.

#### Kenapa aman dari balapan (race condition)

- Semua operasi pada satu sesi (join/keluar/batal/selesai) mengantre di kunci baris sesi tersebut, jadi kapasitas tidak bisa terlampaui (diuji: 30 user bersamaan → tepat 10 anggota).
- Duplikat partner dan bentrok jadwal bisa terjadi lintas sesi berbeda (A gabung ke S1 berisi B, sementara B gabung ke S2 berisi A). Karena itu `join_session` dan `create_session` juga mengunci baris profil semua pihak (urut id, supaya tidak deadlock). Ini juga diuji.

### Urutan kerja yang dipakai

1. Auth, onboarding, validasi NIM
2. Buat & gabung sesi dengan semua aturan + uji konkurensi
3. Dashboard progres, /partners, FAB, dua tautan
4. Admin, /profile, polish

---

## 2. Setup Supabase (region Singapore)

1. Buka <https://supabase.com/dashboard> → **New project**.
2. **Region: Southeast Asia (Singapore)**. Simpan password database.
3. Setelah jadi, buka **Project Settings → API** dan catat:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau legacy `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **Jangan** pakai `service_role`/secret key di aplikasi. Aplikasi ini tidak membutuhkannya.
4. **Authentication → Sign In / Providers**:
   - Matikan **Email** (tidak pakai magic link/OTP, karena limit email bawaan Supabase kecil).
   - Aktifkan **Google** (lihat bagian berikut).
5. **Authentication → URL Configuration**:
   - **Site URL**: URL production, mis. `https://wawancara-sbm29.vercel.app`
   - **Redirect URLs** (tambahkan semua):
     - `https://wawancara-sbm29.vercel.app/auth/callback` (production, ganti dengan domainmu)
     - `http://localhost:3000/auth/callback` (lokal)
     - opsional untuk preview Vercel: `https://*-<nama-tim>.vercel.app/auth/callback`

## 3. Google OAuth

1. Buka <https://console.cloud.google.com/> → buat/pilih project.
2. **APIs & Services → OAuth consent screen** (atau "Google Auth Platform"):
   - User type: **External** (supaya Gmail pribadi bisa login).
   - Isi nama aplikasi, email support, dan domain (`vercel.app` domainmu).
   - Scope cukup default: `openid`, `email`, `profile`.
   - **Penting: ubah Publishing status dari "Testing" ke "In production"** (tombol *Publish app*). Selama masih "Testing", hanya maksimal **100 test user** yang terdaftar manual yang bisa login, padahal peserta sekitar 400 orang. Dengan scope dasar di atas, aplikasi tidak perlu verifikasi Google.
3. **Credentials → Create credentials → OAuth client ID** → Web application:
   - Authorized JavaScript origins: `https://wawancara-sbm29.vercel.app`, `http://localhost:3000`
   - Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback` (lihat di halaman provider Google di Supabase)
4. Salin Client ID & Client Secret ke **Supabase → Authentication → Providers → Google**, lalu simpan.

### Membatasi domain email (opsional)

Variabel `ALLOWED_EMAIL_DOMAINS` (server only):

- **Kosong** (default, sesuai brief): semua akun Google boleh login.
- Diisi, mis. `itb.ac.id,students.itb.ac.id`: user dengan domain lain langsung dikeluarkan dan melihat pesan di /login. Dicek di `/auth/callback` dan di proxy pada setiap request.

Karena login terbuka, **keunikan NIM** adalah penjaga utama. Jika NIM seseorang diklaim akun lain, admin bisa me-reset profil akun tersebut dari /admin.

## 4. Variabel lingkungan

Salin `.env.example` menjadi `.env.local` lalu isi.

| Variabel | Di mana | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + lokal | URL project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + lokal | Publishable key (atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `ALLOWED_EMAIL_DOMAINS` | Vercel + lokal | Kosongkan untuk semua akun Google |
| `SEED_DATABASE_URL` | lokal saja | Untuk `npm run seed` |
| `TEST_DATABASE_URL` | lokal/CI saja | Untuk test database |

Jangan commit `.env.local`. Jangan menaruh secret apa pun di variabel `NEXT_PUBLIC_*`.

## 5. Menjalankan migration

Pilih salah satu:

**A. Supabase CLI (disarankan)**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

**B. SQL Editor**

Buka Supabase → SQL Editor, lalu jalankan isi setiap file di `supabase/migrations/` satu per satu, urut sesuai nama file. Cara ini tidak mencatat riwayat migration; kalau nanti pakai CLI, utamakan opsi A.

Migration dipecah menjadi 5 file karena konektor Supabase MCP timeout untuk SQL besar dan untuk SQL yang berisi `DELETE`. Isinya sama dengan satu skema utuh. Migration aman dijalankan sekali pada project kosong. Perubahan skema berikutnya ditambahkan sebagai file migration baru.

## 6. Pengembangan lokal dan seed

Butuh Node 20.9+ dan (untuk Supabase lokal) Docker.

```bash
npm install
cp .env.example .env.local     # isi URL & key

# Opsi 1: pakai Supabase lokal
npx supabase start             # menerapkan migration otomatis
# isi .env.local dengan API URL & publishable key yang dicetak `supabase start`
npm run seed                   # 60 peserta dummy + beberapa sesi (lokal saja)

npm run dev                    # buka http://localhost:3000 (pakai "localhost", bukan 127.0.0.1)
```

Untuk Google login di Supabase lokal, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` dan `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` sebelum `supabase start`, dan tambahkan `http://127.0.0.1:54321/auth/v1/callback` sebagai redirect URI di Google Cloud.

**Seed** (`scripts/seed.ts`):

- Membuat 60 peserta (`peserta0@seed.local` … `peserta59@seed.local`, campuran IUP 190/192 dan Reguler 197), sekitar 16 sesi mendatang dengan anggota acak (lewat RPC, jadi semua aturan join berlaku), dan 4 sesi yang sudah ditandai selesai.
- `peserta0@seed.local` dijadikan admin dummy.
- Bisa dijalankan ulang (data seed lama dihapus dulu).
- **Menolak jalan** jika host database bukan `localhost`/`127.0.0.1`, jika URL mengandung `supabase.co`/`pooler`, atau jika berjalan di Vercel/production.

## 7. Menjadikan akun admin

Admin diset manual lewat SQL Editor setelah orangnya login dan onboarding:

```sql
update public.profiles_private
set is_admin = true
where nim = '19724001';  -- NIM admin
```

Menu **Admin** akan muncul di navigasi. Fitur: total user per jalur, jumlah sesi per status, sebaran progres, export CSV peserta, hapus sesi bermasalah, dan reset profil (menghapus profil, keanggotaan, dan sesi yang di-host user itu sehingga NIM-nya bebas; akun Google-nya akan diminta onboarding ulang). Profil admin tidak bisa di-reset dari UI.

Mencabut admin: `update public.profiles_private set is_admin = false where nim = '…';`

## 8. Deploy ke Vercel

1. Push repo ke GitHub, lalu di <https://vercel.com/new> import repo ini (framework terdeteksi Next.js).
2. Isi Environment Variables (Production, dan Preview jika perlu): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_EMAIL_DOMAINS` (boleh kosong).
3. Deploy. `vercel.json` sudah mengatur `"regions": ["sin1"]` supaya function berjalan di Singapore, dekat dengan database Supabase.
4. Setelah dapat domain, perbarui **Site URL** dan **Redirect URLs** di Supabase, serta **Authorized JavaScript origins** di Google Cloud (bagian 2 dan 3).
5. Coba login dengan akun Google yang bukan test user untuk memastikan OAuth consent screen sudah "In production".

Aplikasi mengakses database hanya lewat `supabase-js`/`@supabase/ssr` (HTTP ke PostgREST), tanpa koneksi Postgres langsung dari serverless function, dan tanpa Realtime. Data dimuat ulang saat halaman dibuka atau tab difokuskan kembali.

## 9. Test

```bash
npm run lint          # ESLint
npm run typecheck     # next typegen + tsc
npm test              # unit test (NIM, waktu WIB, CSV, pesan error)
npm run build         # build production

# Test database (aturan join, RLS, progres, admin, konkurensi).
# Butuh server Postgres; script membuat database sementara lalu menghapusnya.
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
# Atau tanpa Docker, dengan binary Postgres terpasang (initdb/pg_ctl):
npm run test:db:local

# Uji konkurensi mandiri: 30 user join bersamaan ke sesi kapasitas 10 -> tepat 10 anggota
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:concurrency
```

Jika server bukan Supabase (Postgres biasa), harness otomatis memasang shim kecil (`tests/db/supabase-shim.sql`: role `anon`/`authenticated`, skema `auth`, `auth.uid()`). Test memanggil RPC sebagai role `authenticated` dengan klaim JWT, sama seperti PostgREST.

Cakupan test database: jalur NIM SQL = TypeScript, deadline SQL = TypeScript, onboarding & NIM ganda, jalur tidak bisa menyimpang, RLS menolak tulis langsung, anon tidak bisa baca, privasi data sensitif (termasuk setelah sesi batal), validasi buat sesi, bentrok jadwal host, semua aturan join (penuh, sudah anggota, bentrok, duplikat partner termasuk host dan sesi selesai, sudah mulai, batal, belum onboarding), keluar/batal memperbarui progres kedua pihak, hitungan progres terjadwal vs selesai, tandai selesai, status final, admin, dan dua uji konkurensi.

CI GitHub Actions (`.github/workflows/ci.yml`) menjalankan semuanya, termasuk test database dengan service `postgres:16`.

## 10. Asumsi

- **Next.js 16**: `middleware.ts` sudah diganti namanya menjadi `proxy.ts`. Fungsinya sama: mengalihkan ke /login dan /onboarding.
- **Kapasitas termasuk host** (2–10). Durasi maksimal 240 menit (brief hanya menetapkan minimal 20).
- **Bentrok jadwal** memakai rentang `[mulai, selesai)`: sesi yang menempel (selesai 10.00, mulai 10.00) boleh.
- **Sesi aktif** = status `open` atau `done`. Sesi `open` yang waktunya sudah lewat tapi belum ditandai selesai tetap dihitung "Terjadwal".
- **Host boleh membatalkan** selama sesi masih `open`, termasuk setelah waktu mulai (mis. sesi tidak jadi). Setelah `done`, tidak bisa dibatalkan.
- **Tandai selesai** butuh minimal 2 anggota (`NO_PARTNERS`); sesi tanpa anggota lain sebaiknya dibatalkan.
- **Duplikat partner**: user tidak bisa gabung ke sesi yang berisi siapa pun yang sudah jadi partnernya di sesi aktif lain (termasuk host). Karena pembuatan sesi hanya berisi host sendiri, pembuatan tidak perlu cek duplikat.
- **Progres total z/50** dihitung maksimal 25 per jalur, karena kelebihan di satu jalur tidak menutup kekurangan jalur lain. Angka per jalur tetap ditampilkan apa adanya (bisa lebih dari 25).
- **Preferensi jalur** sesi hanya informasi, tidak membatasi siapa yang bisa gabung.
- **Lokasi/link meeting** terlihat oleh semua user yang login (dibutuhkan untuk memutuskan gabung). Data sensitif (nama lengkap, NIM, ID LINE) hanya terlihat oleh pemilik, admin, dan sesama anggota sesi `open`/`done`; di daftar publik hanya nama panggilan dan jalur.
- **Reset profil oleh admin** menghapus profil beserta sesi yang di-host user itu (anggota lain kehilangan sesi tersebut). Ini kasus langka untuk NIM yang diklaim orang lain, dan UI meminta konfirmasi.
- Email Google ditampilkan di /profile dan export CSV admin; tidak disimpan di tabel profil.
- Tidak ada dark mode; UI dioptimalkan untuk layar HP dulu.
