-- -----------------------------------------------------------------------------
-- 11a. Hak eksekusi fungsi (fungsi yang sudah dibuat di migration sebelumnya)
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
  public.list_open_sessions(),
  public.my_join_blocker(uuid),
  public.my_sessions(),
  public.my_progress(),
  public.my_partners(),
  public.admin_overview(),
  public.admin_participants(),
  public.admin_sessions()
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
  public.list_open_sessions(),
  public.my_join_blocker(uuid),
  public.my_sessions(),
  public.my_progress(),
  public.my_partners(),
  public.admin_overview(),
  public.admin_participants(),
  public.admin_sessions()
to authenticated;
