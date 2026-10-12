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

-- -----------------------------------------------------------------------------
-- 6. Helper internal (tidak bisa dipanggil client)
-- -----------------------------------------------------------------------------

create or replace function public._result(p_ok boolean, p_code text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('ok', p_ok, 'code', p_code) || coalesce(p_extra, '{}'::jsonb)
$$;

-- Alasan p_uid tidak bisa bergabung ke p_session_id, atau NULL jika bisa.
-- Dipakai oleh join_session (setelah mengunci baris) dan oleh daftar sesi.
create or replace function public._join_blocker(p_uid uuid, p_session_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_count integer;
begin
  if p_uid is null then
    return 'NOT_AUTHENTICATED';
  end if;
  if not exists (select 1 from public.profiles_public where id = p_uid) then
    return 'NOT_ONBOARDED';
  end if;

  select * into v_session from public.sessions where id = p_session_id;
  if not found then
    return 'SESSION_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.session_members
    where session_id = p_session_id and user_id = p_uid
  ) then
    return 'ALREADY_MEMBER';
  end if;

  -- 1. Sesi open dan belum dimulai.
  if v_session.status <> 'open' then
    return 'SESSION_NOT_OPEN';
  end if;
  if v_session.starts_at <= now() then
    return 'SESSION_STARTED';
  end if;

  -- 2. Kapasitas.
  select count(*) into v_count from public.session_members where session_id = p_session_id;
  if v_count >= v_session.capacity then
    return 'SESSION_FULL';
  end if;

  -- 4. Tidak tumpang tindih dengan sesi aktif lain milik user.
  if exists (
    select 1 from public.active_memberships am
    where am.user_id = p_uid
      and am.session_id <> p_session_id
      and tstzrange(am.starts_at, am.ends_at) && tstzrange(v_session.starts_at, v_session.ends_at)
  ) then
    return 'OVERLAP';
  end if;

  -- 5. Tidak ada anggota sesi ini yang sudah menjadi partner user di sesi aktif lain.
  if exists (
    select 1
    from public.session_members m
    join public.active_partners ap on ap.partner_id = m.user_id and ap.user_id = p_uid
    where m.session_id = p_session_id
  ) then
    return 'DUPLICATE_PARTNER';
  end if;

  return null;
end;
$$;

-- Kunci profil (urut id supaya tidak deadlock) untuk menserialkan cek
-- tumpang tindih dan duplikat partner antar sesi yang berbeda.
create or replace function public._lock_profiles(p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.profiles_public
  where id = any (p_ids)
  order by id
  for no key update;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: onboarding dan profil
-- -----------------------------------------------------------------------------

create or replace function public.complete_onboarding(
  p_full_name text,
  p_nickname text,
  p_nim text,
  p_line_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nim text := btrim(coalesce(p_nim, ''));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_line_id text := btrim(coalesce(p_line_id, ''));
  v_track text;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;
  if exists (select 1 from public.profiles_private where id = v_uid) then
    return public._result(false, 'ALREADY_ONBOARDED');
  end if;

  v_track := public.nim_track(v_nim);
  if v_track is null then
    return public._result(false, 'INVALID_NIM');
  end if;
  if char_length(v_full_name) not between 2 and 100 then
    return public._result(false, 'INVALID_FULL_NAME');
  end if;
  if char_length(v_nickname) not between 1 and 40 then
    return public._result(false, 'INVALID_NICKNAME');
  end if;
  if char_length(v_line_id) not between 1 and 50 then
    return public._result(false, 'INVALID_LINE_ID');
  end if;
  if exists (select 1 from public.profiles_private where nim = v_nim) then
    return public._result(false, 'NIM_TAKEN');
  end if;

  begin
    insert into public.profiles_private (id, full_name, nim, line_id)
    values (v_uid, v_full_name, v_nim, v_line_id);
    insert into public.profiles_public (id, nickname, track)
    values (v_uid, v_nickname, v_track);
  exception when unique_violation then
    return public._result(false, 'NIM_TAKEN');
  end;

  return public._result(true, 'OK', jsonb_build_object('track', v_track));
end;
$$;

create or replace function public.update_my_profile(
  p_full_name text,
  p_nickname text,
  p_line_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_line_id text := btrim(coalesce(p_line_id, ''));
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;
  if not exists (select 1 from public.profiles_private where id = v_uid) then
    return public._result(false, 'NOT_ONBOARDED');
  end if;
  if char_length(v_full_name) not between 2 and 100 then
    return public._result(false, 'INVALID_FULL_NAME');
  end if;
  if char_length(v_nickname) not between 1 and 40 then
    return public._result(false, 'INVALID_NICKNAME');
  end if;
  if char_length(v_line_id) not between 1 and 50 then
    return public._result(false, 'INVALID_LINE_ID');
  end if;

  update public.profiles_private
  set full_name = v_full_name, line_id = v_line_id
  where id = v_uid;
  update public.profiles_public
  set nickname = v_nickname
  where id = v_uid;

  return public._result(true, 'OK');
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: sesi
-- -----------------------------------------------------------------------------

create or replace function public.create_session(
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_mode text,
  p_location text,
  p_capacity integer,
  p_track_pref text,
  p_notes text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_location text := btrim(coalesce(p_location, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_track_pref text := coalesce(nullif(btrim(p_track_pref), ''), 'BEBAS');
  v_ends_at timestamptz;
  v_id uuid;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;
  if not exists (select 1 from public.profiles_public where id = v_uid) then
    return public._result(false, 'NOT_ONBOARDED');
  end if;
  if p_starts_at is null then
    return public._result(false, 'INVALID_START');
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 20 and 240 then
    return public._result(false, 'INVALID_DURATION');
  end if;
  if p_capacity is null or p_capacity not between 2 and 10 then
    return public._result(false, 'INVALID_CAPACITY');
  end if;
  if p_mode is null or p_mode not in ('online', 'offline') then
    return public._result(false, 'INVALID_MODE');
  end if;
  if char_length(v_location) = 0 then
    return public._result(false, 'LOCATION_REQUIRED');
  end if;
  if char_length(v_location) > 300 then
    return public._result(false, 'LOCATION_TOO_LONG');
  end if;
  if v_track_pref not in ('BEBAS', 'IUP', 'REGULER') then
    return public._result(false, 'INVALID_TRACK_PREF');
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    return public._result(false, 'NOTES_TOO_LONG');
  end if;
  if p_starts_at <= now() then
    return public._result(false, 'START_IN_PAST');
  end if;

  v_ends_at := p_starts_at + make_interval(mins => p_duration_minutes);
  if v_ends_at > public.app_deadline() then
    return public._result(false, 'PAST_DEADLINE');
  end if;

  perform public._lock_profiles(array[v_uid]);

  if exists (
    select 1 from public.active_memberships am
    where am.user_id = v_uid
      and tstzrange(am.starts_at, am.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    return public._result(false, 'OVERLAP');
  end if;

  insert into public.sessions (
    host_id, starts_at, duration_minutes, ends_at, mode, location, capacity, track_pref, notes
  )
  values (
    v_uid, p_starts_at, p_duration_minutes, v_ends_at, p_mode, v_location, p_capacity, v_track_pref, v_notes
  )
  returning id into v_id;

  insert into public.session_members (session_id, user_id) values (v_id, v_uid);

  return public._result(true, 'OK', jsonb_build_object('session_id', v_id));
end;
$$;

create or replace function public.join_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member_ids uuid[];
  v_code text;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;

  -- Kunci baris sesi: semua join/keluar/batal/selesai untuk sesi ini antre di sini.
  perform 1 from public.sessions where id = p_session_id for no key update;
  if not found then
    return public._result(false, 'SESSION_NOT_FOUND');
  end if;

  -- Kunci profil user dan semua anggota sesi supaya cek tumpang tindih dan
  -- duplikat partner tidak bisa dilangkahi transaksi lain di sesi berbeda.
  select array_agg(user_id) into v_member_ids
  from public.session_members where session_id = p_session_id;
  perform public._lock_profiles(array_append(coalesce(v_member_ids, '{}'::uuid[]), v_uid));

  v_code := public._join_blocker(v_uid, p_session_id);
  if v_code is not null then
    return public._result(false, v_code);
  end if;

  insert into public.session_members (session_id, user_id) values (p_session_id, v_uid);
  return public._result(true, 'OK');
end;
$$;

create or replace function public.leave_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;

  select * into v_session from public.sessions where id = p_session_id for no key update;
  if not found then
    return public._result(false, 'SESSION_NOT_FOUND');
  end if;
  if v_session.host_id = v_uid then
    return public._result(false, 'HOST_CANNOT_LEAVE');
  end if;
  if not exists (
    select 1 from public.session_members where session_id = p_session_id and user_id = v_uid
  ) then
    return public._result(false, 'NOT_MEMBER');
  end if;
  if v_session.status <> 'open' then
    return public._result(false, 'SESSION_NOT_OPEN');
  end if;
  if v_session.starts_at <= now() then
    return public._result(false, 'SESSION_STARTED');
  end if;

  delete from public.session_members where session_id = p_session_id and user_id = v_uid;
  return public._result(true, 'OK');
end;
$$;

create or replace function public.cancel_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;

  select * into v_session from public.sessions where id = p_session_id for no key update;
  if not found then
    return public._result(false, 'SESSION_NOT_FOUND');
  end if;
  if v_session.host_id <> v_uid then
    return public._result(false, 'NOT_HOST');
  end if;
  if v_session.status <> 'open' then
    return public._result(false, 'SESSION_NOT_OPEN');
  end if;

  update public.sessions
  set status = 'cancelled', cancelled_at = now()
  where id = p_session_id;
  return public._result(true, 'OK');
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_voice_memo_url text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.sessions%rowtype;
  v_url text := nullif(btrim(coalesce(p_voice_memo_url, '')), '');
  v_count integer;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;

  select * into v_session from public.sessions where id = p_session_id for no key update;
  if not found then
    return public._result(false, 'SESSION_NOT_FOUND');
  end if;
  if v_session.host_id <> v_uid then
    return public._result(false, 'NOT_HOST');
  end if;
  if v_session.status <> 'open' then
    return public._result(false, 'SESSION_NOT_OPEN');
  end if;
  if v_session.starts_at > now() then
    return public._result(false, 'SESSION_NOT_STARTED');
  end if;
  if v_url is not null and (v_url !~* '^https?://[^[:space:]]+$' or char_length(v_url) > 500) then
    return public._result(false, 'INVALID_URL');
  end if;

  select count(*) into v_count from public.session_members where session_id = p_session_id;
  if v_count < 2 then
    return public._result(false, 'NO_PARTNERS');
  end if;

  update public.sessions
  set status = 'done', completed_at = now(), voice_memo_url = v_url
  where id = p_session_id;
  return public._result(true, 'OK');
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: baca data untuk UI
-- -----------------------------------------------------------------------------

-- Sesi open yang belum mulai, plus alasan user saat ini tidak bisa bergabung.
create or replace function public.list_open_sessions()
returns table (
  id uuid,
  host_id uuid,
  host_nickname text,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer,
  mode text,
  location text,
  capacity integer,
  track_pref text,
  notes text,
  member_count integer,
  members jsonb,
  blocker text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.host_id,
    hp.nickname,
    s.starts_at,
    s.ends_at,
    s.duration_minutes,
    s.mode,
    s.location,
    s.capacity,
    s.track_pref,
    s.notes,
    coalesce(m.member_count, 0),
    coalesce(m.members, '[]'::jsonb),
    public._join_blocker(auth.uid(), s.id)
  from public.sessions s
  join public.profiles_public hp on hp.id = s.host_id
  left join lateral (
    select
      count(*)::int as member_count,
      jsonb_agg(
        jsonb_build_object('nickname', p.nickname, 'track', p.track, 'is_host', p.id = s.host_id)
        order by sm.joined_at
      ) as members
    from public.session_members sm
    join public.profiles_public p on p.id = sm.user_id
    where sm.session_id = s.id
  ) m on true
  where auth.uid() is not null
    and s.status = 'open'
    and s.starts_at > now()
  order by s.starts_at, s.created_at
$$;

create or replace function public.my_join_blocker(p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public._join_blocker(auth.uid(), p_session_id)
$$;

-- Semua sesi yang diikuti user (semua status).
create or replace function public.my_sessions()
returns table (
  id uuid,
  host_id uuid,
  host_nickname text,
  is_host boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  mode text,
  location text,
  capacity integer,
  track_pref text,
  status text,
  member_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.host_id,
    hp.nickname,
    s.host_id = auth.uid(),
    s.starts_at,
    s.ends_at,
    s.mode,
    s.location,
    s.capacity,
    s.track_pref,
    s.status,
    (select count(*)::int from public.session_members x where x.session_id = s.id)
  from public.session_members sm
  join public.sessions s on s.id = sm.session_id
  join public.profiles_public hp on hp.id = s.host_id
  where sm.user_id = auth.uid()
  order by s.starts_at
$$;

create or replace function public.my_progress()
returns table (
  iup_scheduled integer,
  iup_done integer,
  reguler_scheduled integer,
  reguler_done integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select pp.iup_scheduled, pp.iup_done, pp.reguler_scheduled, pp.reguler_done
  from public.participant_progress pp
  where pp.user_id = auth.uid()
$$;

-- Semua partner dari sesi aktif, lengkap dengan data sensitif.
create or replace function public.my_partners()
returns table (
  partner_id uuid,
  full_name text,
  nickname text,
  nim text,
  track text,
  line_id text,
  session_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  mode text,
  session_status text,
  voice_memo_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ap.partner_id,
    pr.full_name,
    pu.nickname,
    pr.nim,
    pu.track,
    pr.line_id,
    s.id,
    s.starts_at,
    s.ends_at,
    s.mode,
    s.status,
    s.voice_memo_url
  from public.active_partners ap
  join public.sessions s on s.id = ap.session_id
  join public.profiles_public pu on pu.id = ap.partner_id
  join public.profiles_private pr on pr.id = ap.partner_id
  where ap.user_id = auth.uid()
  order by s.starts_at, pu.nickname
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: admin
-- -----------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    return public._result(false, 'NOT_ADMIN');
  end if;

  with totals as (
    select
      pp.user_id,
      pp.iup_scheduled + pp.iup_done as iup_total,
      pp.reguler_scheduled + pp.reguler_done as reguler_total,
      pp.iup_done,
      pp.reguler_done
    from public.participant_progress pp
  )
  select public._result(true, 'OK', jsonb_build_object(
    'users_by_track', (
      select coalesce(jsonb_object_agg(track, n), '{}'::jsonb)
      from (select track, count(*) as n from public.profiles_public group by track) t
    ),
    'sessions_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from public.sessions group by status) t
    ),
    'progress_buckets', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', n) order by bucket), '[]'::jsonb)
      from (
        select least(50, (least(iup_total, 25) + least(reguler_total, 25)) / 10 * 10) as bucket, count(*) as n
        from totals
        group by 1
      ) b
    ),
    'scheduled_complete', (
      select count(*) from totals where iup_total >= 25 and reguler_total >= 25
    ),
    'done_complete', (
      select count(*) from totals where iup_done >= 25 and reguler_done >= 25
    )
  ))
  into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_participants()
returns table (
  user_id uuid,
  email text,
  full_name text,
  nickname text,
  nim text,
  track text,
  line_id text,
  is_admin boolean,
  created_at timestamptz,
  iup_scheduled integer,
  iup_done integer,
  reguler_scheduled integer,
  reguler_done integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    au.email::text,
    pr.full_name,
    pu.nickname,
    pr.nim,
    pr.track,
    pr.line_id,
    pr.is_admin,
    pr.created_at,
    pp.iup_scheduled,
    pp.iup_done,
    pp.reguler_scheduled,
    pp.reguler_done
  from public.profiles_private pr
  join public.profiles_public pu on pu.id = pr.id
  join public.participant_progress pp on pp.user_id = pr.id
  left join auth.users au on au.id = pr.id
  where public.is_admin()
  order by pr.nim
$$;

create or replace function public.admin_sessions()
returns table (
  id uuid,
  host_nickname text,
  host_nim text,
  starts_at timestamptz,
  ends_at timestamptz,
  mode text,
  status text,
  capacity integer,
  member_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    pu.nickname,
    pr.nim,
    s.starts_at,
    s.ends_at,
    s.mode,
    s.status,
    s.capacity,
    (select count(*)::int from public.session_members x where x.session_id = s.id)
  from public.sessions s
  join public.profiles_public pu on pu.id = s.host_id
  join public.profiles_private pr on pr.id = s.host_id
  where public.is_admin()
  order by s.starts_at desc
$$;

create or replace function public.admin_delete_session(p_session_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return public._result(false, 'NOT_ADMIN');
  end if;
  perform 1 from public.sessions where id = p_session_id for update;
  if not found then
    return public._result(false, 'SESSION_NOT_FOUND');
  end if;
  delete from public.sessions where id = p_session_id;
  return public._result(true, 'OK');
end;
$$;

-- Hapus profil user (privat + publik, beserta keanggotaan dan sesi yang ia host)
-- supaya NIM-nya bisa dipakai lagi. Akun Google-nya tetap ada dan akan diminta
-- onboarding ulang saat login berikutnya.
create or replace function public.admin_reset_profile(p_user_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_target public.profiles_private%rowtype;
begin
  if not public.is_admin() then
    return public._result(false, 'NOT_ADMIN');
  end if;
  select * into v_target from public.profiles_private where id = p_user_id;
  if not found then
    return public._result(false, 'USER_NOT_FOUND');
  end if;
  if v_target.is_admin then
    return public._result(false, 'CANNOT_RESET_ADMIN');
  end if;
  delete from public.profiles_private where id = p_user_id;
  return public._result(true, 'OK', jsonb_build_object('nim', v_target.nim));
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Hak eksekusi fungsi
-- -----------------------------------------------------------------------------

revoke all on function
  public.app_deadline(),
  public.nim_track(text),
  public.tg_sessions_guard(),
  public.tg_touch_updated_at(),
  public.is_admin(),
  public.shares_active_session(uuid),
  public._result(boolean, text, jsonb),
  public._join_blocker(uuid, uuid),
  public._lock_profiles(uuid[]),
  public.complete_onboarding(text, text, text, text),
  public.update_my_profile(text, text, text),
  public.create_session(timestamptz, integer, text, text, integer, text, text),
  public.join_session(uuid),
  public.leave_session(uuid),
  public.cancel_session(uuid),
  public.complete_session(uuid, text),
  public.list_open_sessions(),
  public.my_join_blocker(uuid),
  public.my_sessions(),
  public.my_progress(),
  public.my_partners(),
  public.admin_overview(),
  public.admin_participants(),
  public.admin_sessions(),
  public.admin_delete_session(uuid),
  public.admin_reset_profile(uuid)
from public, anon, authenticated;

grant execute on function
  public.app_deadline(),
  public.nim_track(text),
  public.is_admin(),
  public.shares_active_session(uuid),
  public.complete_onboarding(text, text, text, text),
  public.update_my_profile(text, text, text),
  public.create_session(timestamptz, integer, text, text, integer, text, text),
  public.join_session(uuid),
  public.leave_session(uuid),
  public.cancel_session(uuid),
  public.complete_session(uuid, text),
  public.list_open_sessions(),
  public.my_join_blocker(uuid),
  public.my_sessions(),
  public.my_progress(),
  public.my_partners(),
  public.admin_overview(),
  public.admin_participants(),
  public.admin_sessions(),
  public.admin_delete_session(uuid),
  public.admin_reset_profile(uuid)
to authenticated;
