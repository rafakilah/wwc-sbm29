-- -----------------------------------------------------------------------------
-- RPC yang menghapus baris: keluar/batal/selesai sesi dan aksi admin.
-- -----------------------------------------------------------------------------

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

  select * from public.sessions where id = p_session_id for no key update into v_session;
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

  select * from public.sessions where id = p_session_id for no key update into v_session;
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

  select * from public.sessions where id = p_session_id for no key update into v_session;
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

  v_count := (select count(*) from public.session_members where session_id = p_session_id);
  if v_count < 2 then
    return public._result(false, 'NO_PARTNERS');
  end if;

  update public.sessions
  set status = 'done', completed_at = now(), voice_memo_url = v_url
  where id = p_session_id;
  return public._result(true, 'OK');
end;
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
  select * from public.profiles_private where id = p_user_id into v_target;
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
-- 11b. Hak eksekusi fungsi di file ini
-- -----------------------------------------------------------------------------

revoke all on function
  public.leave_session(uuid),
  public.cancel_session(uuid),
  public.complete_session(uuid, text),
  public.admin_delete_session(uuid),
  public.admin_reset_profile(uuid)
from public, anon, authenticated;

grant execute on function
  public.leave_session(uuid),
  public.cancel_session(uuid),
  public.complete_session(uuid, text),
  public.admin_delete_session(uuid),
  public.admin_reset_profile(uuid)
to authenticated;
