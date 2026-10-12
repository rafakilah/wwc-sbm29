-- =============================================================================
-- Penjadwal Wawancara Angkatan OS SBM 2026: skema awal
--
-- Isi:
--   1. Konstanta konfigurasi (deadline, aturan NIM -> jalur)
--   2. Tabel: profiles_private, profiles_public, sessions, session_members
--   3. View terpusat: active_memberships, active_partners, participant_progress
--   4. RLS (semua tabel), grant, dan policy
--   5. RPC (security definer) untuk onboarding, profil, sesi, dan admin
--
-- Aturan "siapa partner siapa" HANYA didefinisikan di view active_memberships
-- dan active_partners. Semua hitungan progres, cek duplikat, dan daftar partner
-- membaca dari sana.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Konstanta konfigurasi
-- -----------------------------------------------------------------------------

-- Deadline pengumpulan tugas: Sabtu, 17 Oktober 2026, 23.59 WIB.
-- Harus sama dengan DEADLINE_ISO di src/lib/constants.ts.
create or replace function public.app_deadline()
returns timestamptz
language sql
immutable
parallel safe
set search_path = ''
as $$
  select timestamptz '2026-10-17 23:59:00+07'
$$;

-- NIM -> jalur. Harus sama dengan src/lib/nim.ts (NIM_LENGTH dan NIM_PREFIXES).
-- Mengembalikan 'REGULER', 'IUP', atau NULL jika NIM tidak valid.
create or replace function public.nim_track(p_nim text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_nim is null or p_nim !~ '^[0-9]{8}$' then null
    when left(p_nim, 3) = any (array['197']) then 'REGULER'
    when left(p_nim, 3) = any (array['190', '192']) then 'IUP'
    else null
  end
$$;

-- -----------------------------------------------------------------------------
-- 2. Tabel
-- -----------------------------------------------------------------------------

-- Data sensitif: hanya terlihat oleh pemilik, admin, dan sesama anggota sesi
-- aktif (open/done). Jalur diturunkan dari NIM lewat generated column.
create table public.profiles_private (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_private_full_name_len check (char_length(btrim(full_name)) between 2 and 100),
  nim text not null
    constraint profiles_private_nim_key unique
    constraint profiles_private_nim_valid check (public.nim_track(nim) is not null),
  track text generated always as (public.nim_track(nim)) stored,
  line_id text not null
    constraint profiles_private_line_id_len check (char_length(btrim(line_id)) between 1 and 50),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_private_id_track_key unique (id, track)
);

-- Data publik: nama panggilan dan jalur. Foreign key komposit (id, track)
-- memastikan jalur di sini selalu sama dengan jalur yang diturunkan dari NIM.
create table public.profiles_public (
  id uuid primary key,
  nickname text not null
    constraint profiles_public_nickname_len check (char_length(btrim(nickname)) between 1 and 40),
  track text not null
    constraint profiles_public_track_valid check (track in ('IUP', 'REGULER')),
  created_at timestamptz not null default now(),
  constraint profiles_public_track_matches_nim
    foreign key (id, track) references public.profiles_private (id, track) on delete cascade
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles_public (id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30
    constraint sessions_duration_range check (duration_minutes between 20 and 240),
  -- Diisi otomatis oleh trigger dari starts_at + duration_minutes.
  ends_at timestamptz not null,
  mode text not null
    constraint sessions_mode_valid check (mode in ('online', 'offline')),
  location text not null
    constraint sessions_location_len check (char_length(btrim(location)) between 1 and 300),
  capacity integer not null
    constraint sessions_capacity_range check (capacity between 2 and 10),
  track_pref text not null default 'BEBAS'
    constraint sessions_track_pref_valid check (track_pref in ('BEBAS', 'IUP', 'REGULER')),
  notes text
    constraint sessions_notes_len check (notes is null or char_length(notes) <= 500),
  status text not null default 'open'
    constraint sessions_status_valid check (status in ('open', 'done', 'cancelled')),
  voice_memo_url text
    constraint sessions_voice_memo_url_valid check (
      voice_memo_url is null
      or (voice_memo_url ~* '^https?://[^[:space:]]+$' and char_length(voice_memo_url) <= 500)
    ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint sessions_ends_after_start check (ends_at > starts_at),
  constraint sessions_before_deadline check (ends_at <= public.app_deadline())
);

create index sessions_status_starts_at_idx on public.sessions (status, starts_at);
create index sessions_host_id_idx on public.sessions (host_id);

create table public.session_members (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles_public (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_members_user_id_idx on public.session_members (user_id);

-- Trigger: hitung ends_at dan kunci status final (done/cancelled tidak bisa berubah).
create or replace function public.tg_sessions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  if tg_op = 'UPDATE' and old.status <> 'open' and new.status is distinct from old.status then
    raise exception 'Status sesi % sudah final', old.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sessions_guard
before insert or update on public.sessions
for each row execute function public.tg_sessions_guard();

-- Trigger: updated_at profil.
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_private_touch
before update on public.profiles_private
for each row execute function public.tg_touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. View terpusat (satu-satunya definisi "sesi aktif" dan "partner")
-- -----------------------------------------------------------------------------

-- Keanggotaan di sesi aktif. Sesi aktif = status open atau done.
create view public.active_memberships
with (security_invoker = true)
as
select
  sm.user_id,
  sm.session_id,
  s.status as session_status,
  s.starts_at,
  s.ends_at
from public.session_members sm
join public.sessions s on s.id = sm.session_id
where s.status in ('open', 'done');

-- Pasangan partner: semua anggota sesi aktif yang sama saling menjadi partner.
create view public.active_partners
with (security_invoker = true)
as
select
  am.user_id,
  other.user_id as partner_id,
  am.session_id,
  am.session_status,
  am.starts_at,
  am.ends_at
from public.active_memberships am
join public.session_members other
  on other.session_id = am.session_id
 and other.user_id <> am.user_id;

-- Progres tiap peserta. "Selesai" = partner dari sesi done, "Terjadwal" = sisanya.
create view public.participant_progress
with (security_invoker = true)
as
with pairs as (
  select ap.user_id, ap.partner_id, bool_or(ap.session_status = 'done') as is_done
  from public.active_partners ap
  group by ap.user_id, ap.partner_id
)
select
  u.id as user_id,
  (count(*) filter (where pp.track = 'IUP' and not pairs.is_done))::int as iup_scheduled,
  (count(*) filter (where pp.track = 'IUP' and pairs.is_done))::int as iup_done,
  (count(*) filter (where pp.track = 'REGULER' and not pairs.is_done))::int as reguler_scheduled,
  (count(*) filter (where pp.track = 'REGULER' and pairs.is_done))::int as reguler_done
from public.profiles_public u
left join pairs on pairs.user_id = u.id
left join public.profiles_public pp on pp.id = pairs.partner_id
group by u.id;

-- -----------------------------------------------------------------------------
-- 4. Helper untuk RLS
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pp.is_admin from public.profiles_private pp where pp.id = auth.uid()),
    false
  )
$$;

-- Apakah user saat ini dan p_other pernah/akan bertemu di sesi aktif yang sama.
create or replace function public.shares_active_session(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.active_partners ap
    where ap.user_id = auth.uid() and ap.partner_id = p_other
  )
$$;

-- -----------------------------------------------------------------------------
-- 5. RLS dan grant
-- -----------------------------------------------------------------------------

alter table public.profiles_private enable row level security;
alter table public.profiles_public enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;

-- Client hanya boleh SELECT. Semua penulisan lewat RPC.
revoke all on table
  public.profiles_private, public.profiles_public, public.sessions, public.session_members,
  public.active_memberships, public.active_partners, public.participant_progress
from anon, authenticated;

grant select on table
  public.profiles_private, public.profiles_public, public.sessions, public.session_members
to authenticated;

create policy profiles_private_select on public.profiles_private
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
  or public.shares_active_session(id)
);

create policy profiles_public_select on public.profiles_public
for select to authenticated
using (true);

create policy sessions_select on public.sessions
for select to authenticated
using (true);

create policy session_members_select on public.session_members
for select to authenticated
using (true);

-- Tidak ada policy INSERT/UPDATE/DELETE: penulisan langsung dari client ditolak.

