-- Apply after upgrade-focus-flow.sql. Additive: no legacy meetings are reassigned or removed.
begin;
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, company text, role text, created_at timestamptz not null default now()
);
alter table public.user_profiles add column if not exists language text not null default 'English';
alter table public.user_profiles add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

create table if not exists public.kaarya_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check(plan_id in ('free', 'pro')),
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.kaarya_usage_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_id uuid not null,
  kind text not null check(kind in ('generate', 'refine')),
  fingerprint text not null,
  status text not null check(status in ('processing', 'completed', 'failed', 'deleted')),
  lease uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kaarya_usage_user_period on public.kaarya_usage_requests(user_id, kind, created_at);
create index if not exists kaarya_usage_meeting on public.kaarya_usage_requests(meeting_id);
alter table public.kaarya_entitlements enable row level security;
alter table public.kaarya_usage_requests enable row level security;
revoke all on public.kaarya_entitlements, public.kaarya_usage_requests from anon, authenticated;
grant select, insert, update, delete on public.kaarya_entitlements, public.kaarya_usage_requests to service_role;

create or replace function public.kaarya_plan(p_user uuid)
returns text language sql stable set search_path = public as $$
  select coalesce((select plan_id from kaarya_entitlements where user_id = p_user
    and plan_id = 'pro' and valid_until > now()), 'free');
$$;

create or replace function public.kaarya_account_overview(p_user uuid, p_name text)
returns jsonb language plpgsql set search_path = public as $$
declare v_plan text; v_start timestamptz; v_reset timestamptz; v_profile user_profiles; v_used integer; v_count integer;
begin
  insert into user_profiles(id, full_name) values(p_user, left(coalesce(nullif(p_name, ''), 'My account'), 100)) on conflict(id) do nothing;
  select * into v_profile from user_profiles where id = p_user;
  v_plan := kaarya_plan(p_user);
  v_start := date_trunc(case when v_plan = 'free' then 'day' else 'month' end, now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_reset := v_start + case when v_plan = 'free' then interval '1 day' else interval '1 month' end;
  select count(*) into v_used from kaarya_usage_requests where user_id = p_user and kind = 'generate' and created_at >= v_start
    and (status in ('completed', 'deleted') or (status = 'processing' and expires_at > now()));
  select count(*) into v_count from meetings where created_by = p_user;
  return jsonb_build_object('profile', to_jsonb(v_profile), 'plan_id', v_plan,
    'usage', jsonb_build_object('generated', v_used, 'retained', v_count, 'reset_at', v_reset, 'reset_timezone', 'Asia/Kolkata'));
end;
$$;

create or replace function public.kaarya_reserve_request(p_user uuid, p_request uuid, p_meeting uuid, p_kind text, p_hash text, p_characters integer)
returns jsonb language plpgsql set search_path = public as $$
declare r kaarya_usage_requests; v_plan text; v_start timestamptz; v_limit integer; v_retained integer; v_refs integer; v_count integer; v_lease uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1701));
  if p_kind not in ('generate', 'refine') or length(p_hash) <> 64 or p_characters < 1 then raise exception 'REQUEST_CONFLICT'; end if;
  select * into r from kaarya_usage_requests where id = p_request for update;
  if found then
    if r.user_id <> p_user then raise exception 'REQUEST_CONFLICT'; end if;
    if r.status = 'deleted' then raise exception 'REQUEST_DELETED'; end if;
    if r.fingerprint <> p_hash or r.kind <> p_kind or r.meeting_id <> p_meeting then raise exception 'REQUEST_CONFLICT'; end if;
    if r.status = 'completed' then return jsonb_build_object('cached', true, 'result', r.result); end if;
    if r.status = 'processing' and r.expires_at > now() then raise exception 'REQUEST_IN_PROGRESS'; end if;
  end if;
  update kaarya_usage_requests set status = 'failed', result = null where user_id = p_user and status = 'processing' and expires_at <= now();
  v_plan := kaarya_plan(p_user);
  v_limit := case when v_plan = 'free' then 1 else 40 end;
  v_retained := case when v_plan = 'free' then 5 else 500 end;
  v_refs := case when v_plan = 'free' then 1 else 2 end;
  if p_characters > 8388608 then raise exception 'INPUT_LIMIT'; end if;
  v_start := date_trunc(case when v_plan = 'free' then 'day' else 'month' end, now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  if p_kind = 'generate' then
    select count(*) into v_count from kaarya_usage_requests where user_id = p_user and kind = 'generate' and created_at >= v_start
      and (status in ('completed', 'deleted') or (status = 'processing' and expires_at > now()));
    if v_count >= v_limit then
      if v_plan = 'free' then raise exception 'DAILY_LIMIT'; else raise exception 'MONTHLY_LIMIT'; end if;
    end if;
    select (select count(*) from meetings where created_by = p_user) +
      (select count(*) from kaarya_usage_requests where user_id = p_user and kind = 'generate' and status = 'processing' and expires_at > now()) into v_count;
    if v_count >= v_retained then raise exception 'STORAGE_FULL'; end if;
    if exists(select 1 from meetings where id = p_meeting) then raise exception 'REQUEST_CONFLICT'; end if;
  else
    if not exists(select 1 from meetings where id = p_meeting and created_by = p_user) then raise exception 'NOT_OWNER'; end if;
    select count(*) into v_count from kaarya_usage_requests where user_id = p_user and meeting_id = p_meeting and kind = 'refine'
      and (status = 'completed' or (status = 'processing' and expires_at > now()));
    if v_count >= v_refs then raise exception 'REFINEMENT_LIMIT'; end if;
    -- A period cap also prevents manual-save/delete loops from bypassing inference budgets.
    select count(*) into v_count from kaarya_usage_requests where user_id = p_user and kind = 'refine' and created_at >= v_start
      and (status in ('completed', 'deleted') or (status = 'processing' and expires_at > now()));
    if v_count >= v_limit * v_refs then raise exception 'REFINEMENT_LIMIT'; end if;
  end if;
  v_lease := gen_random_uuid();
  insert into kaarya_usage_requests(id, user_id, meeting_id, kind, fingerprint, status, lease)
    values(p_request, p_user, p_meeting, p_kind, p_hash, 'processing', v_lease)
    on conflict(id) do update set status = 'processing', lease = v_lease, expires_at = now() + interval '2 minutes', created_at = now(), result = null;
  return jsonb_build_object('cached', false, 'lease', v_lease);
end;
$$;

create or replace function public.kaarya_guard_capacity()
returns trigger language plpgsql set search_path = public as $$
declare v_limit integer; v_count integer;
begin
  if new.created_by is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.created_by::text, 1701));
  if tg_op = 'UPDATE' and old.created_by is distinct from new.created_by then raise exception 'NOT_OWNER'; end if;
  v_limit := case when kaarya_plan(new.created_by) = 'free' then 5 else 500 end;
  select (select count(*) from meetings where created_by = new.created_by and id <> new.id) +
    (select count(*) from kaarya_usage_requests where user_id = new.created_by and kind = 'generate' and meeting_id <> new.id and status = 'processing' and expires_at > now()) into v_count;
  if v_count >= v_limit then raise exception 'STORAGE_FULL'; end if;
  return new;
end;
$$;
drop trigger if exists kaarya_meeting_capacity on public.meetings;
create trigger kaarya_meeting_capacity before insert or update of created_by on public.meetings for each row execute function public.kaarya_guard_capacity();

create or replace function public.kaarya_finish_request(p_user uuid, p_request uuid, p_lease uuid, p_result jsonb, p_payload jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare r kaarya_usage_requests; m meetings; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1701));
  select * into r from kaarya_usage_requests where id = p_request and user_id = p_user for update;
  if not found then raise exception 'REQUEST_EXPIRED'; end if;
  if r.status = 'deleted' then raise exception 'REQUEST_DELETED'; end if;
  if r.status = 'completed' then return r.result; end if;
  if r.status <> 'processing' or r.lease <> p_lease or r.expires_at <= now() then raise exception 'REQUEST_EXPIRED'; end if;
  if p_result->'structured' is null then raise exception 'REQUEST_CONFLICT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.meeting_id::text, 0));
  if r.kind = 'generate' then
    insert into meetings(id, created_by, title, meeting_date, source, summary, language, readiness_score, output_snapshot, source_notes, status)
      values(r.meeting_id, p_user, p_payload->>'meeting_name', (p_payload->>'meeting_date')::date, coalesce(p_payload->>'source', 'website'),
        p_result->'structured'->>'summary', p_result->'structured'->>'language', (p_result->'structured'->>'readiness_score')::integer,
        p_result->'structured', p_payload->>'raw_notes', 'draft') returning * into m;
    v_result := p_result || jsonb_build_object('meeting', to_jsonb(m), 'saved', false, 'retained', true, 'delivery', jsonb_build_object('status', 'not_sent'));
  else
    if not exists(select 1 from meetings where id = r.meeting_id and created_by = p_user) then raise exception 'NOT_OWNER'; end if;
    v_result := p_result;
  end if;
  update kaarya_usage_requests set status = 'completed', result = v_result where id = p_request;
  return v_result;
end;
$$;

create or replace function public.kaarya_fail_request(p_user uuid, p_request uuid, p_lease uuid)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1701));
  update kaarya_usage_requests set status = 'failed', result = null where id = p_request and user_id = p_user and lease = p_lease and status = 'processing';
end;
$$;

create or replace function public.kaarya_delete_meeting(p_user uuid, p_meeting uuid)
returns void language plpgsql set search_path = public as $$
declare m meetings;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1701));
  perform pg_advisory_xact_lock(hashtextextended(p_meeting::text, 0));
  select * into m from meetings where id = p_meeting and created_by = p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if nullif(m.transcript_url, '') is not null or exists(select 1 from delivery_logs where meeting_id = p_meeting and status = 'scheduled') then raise exception 'DELETE_BLOCKED'; end if;
  update kaarya_usage_requests set status = case when status = 'completed' then 'deleted' else 'failed' end,
    result = null, fingerprint = '' where user_id = p_user and meeting_id = p_meeting;
  delete from delivery_logs where meeting_id = p_meeting or action_item_id in (select id from action_items where meeting_id = p_meeting);
  delete from prep_questions where meeting_id = p_meeting;
  delete from action_items where meeting_id = p_meeting;
  delete from meetings where id = p_meeting and created_by = p_user;
end;
$$;

-- Serialize all review saves with generation/capacity checks in the same lock order.
create or replace function public.save_kaarya_draft(
  p_user uuid, p_meeting uuid, p_title text, p_date date,
  p_output jsonb, p_action_ids uuid[], p_revision integer, p_save_id uuid, p_notes text
) returns jsonb language plpgsql set search_path = public as $$
declare m meetings; item jsonb; idx integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 1701));
  perform pg_advisory_xact_lock(hashtextextended(p_meeting::text, 0));
  select * into m from meetings where id = p_meeting for update;
  if found then
    if m.created_by is distinct from p_user then raise exception 'NOT_OWNER'; end if;
    if m.last_save_id = p_save_id then return jsonb_build_object('meeting', to_jsonb(m), 'action_items', coalesce((select jsonb_agg(to_jsonb(a)) from action_items a where meeting_id = p_meeting), '[]'::jsonb)); end if;
    if m.draft_revision <> p_revision then raise exception 'STALE_DRAFT'; end if;
  else
    if p_revision <> 0 then raise exception 'STALE_DRAFT'; end if;
    insert into meetings(id, created_by, title, meeting_date, status) values(p_meeting, p_user, p_title, p_date, 'draft') returning * into m;
  end if;
  if coalesce(array_length(p_action_ids, 1), 0) <> jsonb_array_length(p_output->'action_items') then raise exception 'INVALID_ACTION_IDS'; end if;
  if exists(select 1 from action_items where id = any(p_action_ids) and meeting_id <> p_meeting) then raise exception 'NOT_OWNER'; end if;
  update meetings set title = p_title, meeting_date = p_date, summary = p_output->>'summary', language = p_output->>'language',
    readiness_score = (p_output->>'readiness_score')::integer, output_snapshot = p_output, source_notes = coalesce(p_notes, source_notes), status = 'reviewed',
    draft_revision = draft_revision + 1, last_save_id = p_save_id, updated_at = now() where id = p_meeting returning * into m;
  for item in select value from jsonb_array_elements(p_output->'action_items') loop
    idx := idx + 1;
    insert into action_items(id, meeting_id, task, owner, team, due_date, priority, status, evidence)
      values(p_action_ids[idx], p_meeting, item->>'task', item->>'owner', item->>'team', nullif(item->>'due_date', '')::date, item->>'priority', item->>'status', item->>'evidence')
      on conflict(id) do update set task = excluded.task, owner = excluded.owner, team = excluded.team, due_date = excluded.due_date,
        priority = excluded.priority, status = excluded.status, evidence = excluded.evidence, updated_at = now();
  end loop;
  delete from action_items where meeting_id = p_meeting and not(id = any(p_action_ids));
  delete from prep_questions where meeting_id = p_meeting;
  insert into prep_questions(meeting_id, question, intended_owner, reason, next_meeting_date)
    select p_meeting, q->>'question', q->>'intended_owner', q->>'reason', nullif(q->>'next_meeting_date', '')::date from jsonb_array_elements(p_output->'prep_questions') q;
  return jsonb_build_object('meeting', to_jsonb(m), 'action_items', coalesce((select jsonb_agg(to_jsonb(a)) from action_items a where meeting_id = p_meeting), '[]'::jsonb));
end;
$$;

revoke all on function public.kaarya_plan(uuid), public.kaarya_account_overview(uuid,text), public.kaarya_reserve_request(uuid,uuid,uuid,text,text,integer),
  public.kaarya_guard_capacity(), public.kaarya_finish_request(uuid,uuid,uuid,jsonb,jsonb), public.kaarya_fail_request(uuid,uuid,uuid), public.kaarya_delete_meeting(uuid,uuid) from public, anon, authenticated;
grant execute on function public.kaarya_plan(uuid), public.kaarya_account_overview(uuid,text), public.kaarya_reserve_request(uuid,uuid,uuid,text,text,integer),
  public.kaarya_finish_request(uuid,uuid,uuid,jsonb,jsonb), public.kaarya_fail_request(uuid,uuid,uuid), public.kaarya_delete_meeting(uuid,uuid) to service_role;
revoke all on function public.save_kaarya_draft(uuid,uuid,text,date,jsonb,uuid[],integer,uuid,text) from public, anon, authenticated;
grant execute on function public.save_kaarya_draft(uuid,uuid,text,date,jsonb,uuid[],integer,uuid,text) to service_role;
notify pgrst, 'reload schema';
commit;
