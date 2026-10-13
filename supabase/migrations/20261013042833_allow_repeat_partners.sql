-- =============================================================================
-- Izinkan bertemu partner yang sama lagi.
--
-- Sebelumnya join_session menolak (DUPLICATE_PARTNER) jika ada anggota sesi
-- yang sudah pernah diwawancarai. Sekarang boleh gabung; progres tetap dihitung
-- unik per NIM partner (participant_progress sudah mengelompokkan per NIM),
-- jadi orang yang sama tidak terhitung dua kali. UI menampilkan berapa anggota
-- yang "sudah pernah" lewat repeat_partner_count.
-- =============================================================================

-- _join_blocker tanpa cek duplikat partner.
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

  v_session := (select s from public.sessions s where s.id = p_session_id);
  if v_session.id is null then
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
  v_count := (select count(*) from public.session_members where session_id = p_session_id);
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

  return null;
end;
$$;

-- Berapa anggota sesi (selain p_uid) yang sudah pernah tercatat wawancara dengan
-- p_uid, lewat sesi aktif lain atau catatan manual, dari dua arah.
create or replace function public._repeat_partner_count(p_uid uuid, p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.session_members m
  join public.profiles_private mp on mp.id = m.user_id
  where m.session_id = p_session_id
    and m.user_id <> p_uid
    and (
      exists (
        select 1 from public.interview_records r
        where r.user_id = p_uid and r.partner_nim = mp.nim and r.session_id is distinct from p_session_id
      )
      or exists (
        select 1 from public.interview_records r
        where r.user_id = m.user_id
          and r.partner_nim = (select pr.nim from public.profiles_private pr where pr.id = p_uid)
          and r.session_id is distinct from p_session_id
      )
    )
$$;

create or replace function public.my_repeat_partner_count(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public._repeat_partner_count(auth.uid(), p_session_id)
$$;

-- Daftar sesi open + jumlah anggota yang sudah pernah wawancara dengan user.
create or replace function public.list_open_sessions_v2()
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
  blocker text,
  repeat_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.host_id,
    l.host_nickname,
    l.starts_at,
    l.ends_at,
    l.duration_minutes,
    l.mode,
    l.location,
    l.capacity,
    l.track_pref,
    l.notes,
    l.member_count,
    l.members,
    l.blocker,
    public._repeat_partner_count(auth.uid(), l.id)
  from public.list_open_sessions() l
$$;

revoke all on function
  public._join_blocker(uuid, uuid),
  public._repeat_partner_count(uuid, uuid),
  public.my_repeat_partner_count(uuid),
  public.list_open_sessions_v2()
from public, anon, authenticated;

grant execute on function
  public.my_repeat_partner_count(uuid),
  public.list_open_sessions_v2()
to authenticated;
