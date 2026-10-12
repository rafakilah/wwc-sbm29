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

