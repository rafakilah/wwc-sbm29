-- Hapus catatan wawancara manual milik sendiri (dipisah karena berisi DELETE).
create or replace function public.delete_manual_interview(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;
  v_owner := (select mi.owner_id from public.manual_interviews mi where mi.id = p_id);
  if v_owner is null or v_owner <> v_uid then
    return public._result(false, 'RECORD_NOT_FOUND');
  end if;

  delete from public.manual_interviews where id = p_id and owner_id = v_uid;
  return public._result(true, 'OK');
end;
$$;

revoke all on function public.delete_manual_interview(uuid) from public, anon, authenticated;
grant execute on function public.delete_manual_interview(uuid) to authenticated;
