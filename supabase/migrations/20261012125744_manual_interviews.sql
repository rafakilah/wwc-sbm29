-- =============================================================================
-- Wawancara manual: catatan wawancara yang sudah dilakukan sebelum ada website.
--
-- Catatan manual dihitung "Selesai" di progres pemiliknya, dan ikut mencegah
-- duplikat: orang yang sudah diwawancarai (dicocokkan lewat NIM) tidak bisa
-- dipertemukan lagi dengan pemilik catatan di sesi mana pun.
--
-- Definisi terpusat "siapa sudah/akan mewawancarai siapa" sekarang adalah view
-- interview_records (gabungan partner sesi aktif + catatan manual).
-- =============================================================================

create table public.manual_interviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles_public (id) on delete cascade,
  full_name text not null
    constraint manual_interviews_full_name_len check (char_length(btrim(full_name)) between 2 and 100),
  nickname text
    constraint manual_interviews_nickname_len check (nickname is null or char_length(nickname) <= 40),
  nim text not null
    constraint manual_interviews_nim_valid check (public.nim_track(nim) is not null),
  track text generated always as (public.nim_track(nim)) stored,
  line_id text
    constraint manual_interviews_line_id_len check (line_id is null or char_length(line_id) <= 50),
  interviewed_at timestamptz not null,
  voice_memo_url text
    constraint manual_interviews_voice_memo_url_valid check (
      voice_memo_url is null
      or (voice_memo_url ~* '^https?://[^[:space:]]+$' and char_length(voice_memo_url) <= 500)
    ),
  notes text
    constraint manual_interviews_notes_len check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint manual_interviews_owner_nim_key unique (owner_id, nim)
);

create index manual_interviews_nim_idx on public.manual_interviews (nim);

alter table public.manual_interviews enable row level security;

revoke all on table public.manual_interviews from anon, authenticated;
grant select on table public.manual_interviews to authenticated;

create policy manual_interviews_select on public.manual_interviews
for select to authenticated
using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- View terpusat: semua catatan wawancara per user, dicocokkan lewat NIM partner.
-- -----------------------------------------------------------------------------

create view public.interview_records
with (security_invoker = true)
as
select
  ap.user_id,
  pr.nim as partner_nim,
  pu.track as partner_track,
  ap.partner_id,
  'session'::text as source,
  ap.session_id,
  null::uuid as manual_id,
  ap.session_status = 'done' as is_done
from public.active_partners ap
join public.profiles_private pr on pr.id = ap.partner_id
join public.profiles_public pu on pu.id = ap.partner_id
union all
select
  mi.owner_id,
  mi.nim,
  mi.track,
  null::uuid,
  'manual'::text,
  null::uuid,
  mi.id,
  true
from public.manual_interviews mi;

revoke all on table public.interview_records from anon, authenticated;

-- Progres sekarang membaca interview_records (sesi + manual), unik per NIM partner.
create or replace view public.participant_progress
with (security_invoker = true)
as
with pairs as (
  select r.user_id, r.partner_nim, max(r.partner_track) as track, bool_or(r.is_done) as is_done
  from public.interview_records r
  group by r.user_id, r.partner_nim
)
select
  u.id as user_id,
  (count(*) filter (where pairs.track = 'IUP' and not pairs.is_done))::int as iup_scheduled,
  (count(*) filter (where pairs.track = 'IUP' and pairs.is_done))::int as iup_done,
  (count(*) filter (where pairs.track = 'REGULER' and not pairs.is_done))::int as reguler_scheduled,
  (count(*) filter (where pairs.track = 'REGULER' and pairs.is_done))::int as reguler_done
from public.profiles_public u
left join pairs on pairs.user_id = u.id
group by u.id;

-- -----------------------------------------------------------------------------
-- _join_blocker: cek duplikat kini juga memperhitungkan catatan manual,
-- dari dua arah (catatanku tentang dia, dan catatannya tentang aku).
-- -----------------------------------------------------------------------------

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
  v_my_nim text;
begin
  if p_uid is null then
    return 'NOT_AUTHENTICATED';
  end if;
  v_my_nim := (select pr.nim from public.profiles_private pr where pr.id = p_uid);
  if v_my_nim is null then
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

  -- 5. Tidak ada anggota sesi ini yang sudah tercatat diwawancarai (sesi atau manual).
  if exists (
    select 1
    from public.session_members m
    join public.profiles_private mp on mp.id = m.user_id
    where m.session_id = p_session_id
      and (
        exists (
          select 1 from public.interview_records r
          where r.user_id = p_uid and r.partner_nim = mp.nim
        )
        or exists (
          select 1 from public.interview_records r
          where r.user_id = m.user_id and r.partner_nim = v_my_nim
        )
      )
  ) then
    return 'DUPLICATE_PARTNER';
  end if;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: tambah catatan wawancara manual
-- -----------------------------------------------------------------------------

create or replace function public.add_manual_interview(
  p_full_name text,
  p_nickname text,
  p_nim text,
  p_line_id text,
  p_interviewed_at timestamptz,
  p_voice_memo_url text,
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
  v_my_nim text;
  v_nim text := btrim(coalesce(p_nim, ''));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_line_id text := nullif(btrim(coalesce(p_line_id, '')), '');
  v_url text := nullif(btrim(coalesce(p_voice_memo_url, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    return public._result(false, 'NOT_AUTHENTICATED');
  end if;
  v_my_nim := (select pr.nim from public.profiles_private pr where pr.id = v_uid);
  if v_my_nim is null then
    return public._result(false, 'NOT_ONBOARDED');
  end if;
  if public.nim_track(v_nim) is null then
    return public._result(false, 'INVALID_NIM');
  end if;
  if v_nim = v_my_nim then
    return public._result(false, 'SELF_NIM');
  end if;
  if char_length(v_full_name) not between 2 and 100 then
    return public._result(false, 'INVALID_FULL_NAME');
  end if;
  if v_nickname is not null and char_length(v_nickname) > 40 then
    return public._result(false, 'INVALID_NICKNAME');
  end if;
  if v_line_id is not null and char_length(v_line_id) > 50 then
    return public._result(false, 'INVALID_LINE_ID');
  end if;
  if p_interviewed_at is null then
    return public._result(false, 'INVALID_DATE');
  end if;
  if p_interviewed_at > now() then
    return public._result(false, 'MANUAL_IN_FUTURE');
  end if;
  if v_url is not null and (v_url !~* '^https?://[^[:space:]]+$' or char_length(v_url) > 500) then
    return public._result(false, 'INVALID_URL');
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    return public._result(false, 'NOTES_TOO_LONG');
  end if;

  -- Serialkan dengan join_session/create_session milik user ini.
  perform public._lock_profiles(array[v_uid]);

  if exists (
    select 1 from public.interview_records r
    where r.user_id = v_uid and r.partner_nim = v_nim
  ) then
    return public._result(false, 'DUPLICATE_RECORD');
  end if;

  begin
    insert into public.manual_interviews (
      owner_id, full_name, nickname, nim, line_id, interviewed_at, voice_memo_url, notes
    )
    values (
      v_uid, v_full_name, v_nickname, v_nim, v_line_id, p_interviewed_at, v_url, v_notes
    )
    returning id into v_id;
  exception when unique_violation then
    return public._result(false, 'DUPLICATE_RECORD');
  end;

  return public._result(true, 'OK', jsonb_build_object('id', v_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: semua catatan wawancara user (sesi aktif + manual), untuk halaman Progress.
-- -----------------------------------------------------------------------------

create or replace function public.my_interview_records()
returns table (
  source text,
  record_id uuid,
  partner_id uuid,
  full_name text,
  nickname text,
  nim text,
  track text,
  line_id text,
  happened_at timestamptz,
  mode text,
  status text,
  voice_memo_url text,
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select
      'session'::text as source,
      s.id as record_id,
      ap.partner_id,
      pr.full_name,
      pu.nickname,
      pr.nim,
      pu.track,
      pr.line_id,
      s.starts_at as happened_at,
      s.mode,
      s.status,
      s.voice_memo_url,
      null::text as notes
    from public.active_partners ap
    join public.sessions s on s.id = ap.session_id
    join public.profiles_public pu on pu.id = ap.partner_id
    join public.profiles_private pr on pr.id = ap.partner_id
    where ap.user_id = auth.uid()
    union all
    select
      'manual'::text,
      mi.id,
      null::uuid,
      mi.full_name,
      mi.nickname,
      mi.nim,
      mi.track,
      mi.line_id,
      mi.interviewed_at,
      null::text,
      'done'::text,
      mi.voice_memo_url,
      mi.notes
    from public.manual_interviews mi
    where mi.owner_id = auth.uid()
  ) t
  order by t.happened_at, t.nickname nulls last, t.full_name
$$;

revoke all on function
  public._join_blocker(uuid, uuid),
  public.add_manual_interview(text, text, text, text, timestamptz, text, text),
  public.my_interview_records()
from public, anon, authenticated;

grant execute on function
  public.add_manual_interview(text, text, text, text, timestamptz, text, text),
  public.my_interview_records()
to authenticated;
