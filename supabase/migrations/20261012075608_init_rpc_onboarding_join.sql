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

