-- =============================================================================
-- Batasi jalur: sessions.track_pref (BEBAS / IUP / REGULER) kini ditegakkan.
-- Sesi khusus IUP hanya bisa diikuti user IUP, begitu juga Reguler. Host tidak
-- terkena cek ini karena host masuk lewat create_session. Anggota yang sudah
-- tergabung tidak dikeluarkan.
-- =============================================================================

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

  -- 3. Jalur: sesi khusus IUP/Reguler hanya untuk jalur itu.
  if v_session.track_pref <> 'BEBAS'
     and (select pp.track from public.profiles_public pp where pp.id = p_uid) <> v_session.track_pref then
    return 'TRACK_NOT_ALLOWED';
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
