-- Run once in Supabase SQL Editor before deploying this release.
begin;
create extension if not exists pgcrypto;
set local search_path = public, extensions;
alter table public.meetings add column if not exists created_by uuid references auth.users(id);
alter table public.meetings add column if not exists updated_at timestamptz not null default now();
alter table public.meetings add column if not exists draft_revision integer not null default 0;
alter table public.meetings add column if not exists last_save_id uuid;
alter table public.meetings add column if not exists output_snapshot jsonb;
alter table public.meetings add column if not exists source_notes text;
alter table public.action_items add column if not exists update_token text default encode(gen_random_bytes(18), 'hex');
alter table public.action_items alter column update_token set default encode(gen_random_bytes(18), 'hex');
update public.action_items set update_token = encode(gen_random_bytes(18), 'hex') where update_token is null;
alter table public.action_items add column if not exists updated_at timestamptz not null default now();
alter table public.action_items add column if not exists last_nudged_at timestamptz;
alter table public.action_items add column if not exists last_nudge_channel text;
alter table public.action_items add column if not exists update_note text;
create unique index if not exists kaarya_task_token_unique on public.action_items(update_token);
create index if not exists kaarya_meeting_owner_idx on public.meetings(created_by, created_at desc);

-- Meeting records are accessed through authenticated, owner-scoped server routes.
alter table public.meetings enable row level security;
alter table public.action_items enable row level security;
alter table public.prep_questions enable row level security;
alter table public.delivery_logs enable row level security;
revoke all on public.meetings, public.action_items, public.prep_questions, public.delivery_logs from anon, authenticated;
grant select, insert, update, delete on public.meetings, public.action_items, public.prep_questions, public.delivery_logs to service_role;

create table if not exists public.kaarya_request_limits (
  key text not null,
  bucket timestamptz not null,
  requests integer not null default 1,
  primary key(key, bucket)
);
alter table public.kaarya_request_limits enable row level security;
revoke all on public.kaarya_request_limits from anon, authenticated;
grant select, insert, update, delete on public.kaarya_request_limits to service_role;
create or replace function public.consume_kaarya_quota(p_key text, p_limit integer)
returns boolean language plpgsql set search_path = public as $$
declare n integer;
begin
  delete from kaarya_request_limits where bucket < now() - interval '2 days';
  insert into kaarya_request_limits(key, bucket) values(p_key, date_trunc('hour', now()))
  on conflict(key, bucket) do update set requests = kaarya_request_limits.requests + 1
  returning requests into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.consume_kaarya_quota(text, integer) from public, anon, authenticated;
grant execute on function public.consume_kaarya_quota(text, integer) to service_role;

create or replace function public.save_kaarya_draft(
  p_user uuid, p_meeting uuid, p_title text, p_date date,
  p_output jsonb, p_action_ids uuid[], p_revision integer, p_save_id uuid, p_notes text
) returns jsonb language plpgsql set search_path = public as $$
declare
  m meetings;
  item jsonb;
  idx integer := 0;
begin
  -- Serialize retries and edits to one meeting; all child writes are in this transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_meeting::text, 0));
  select * into m from meetings where id = p_meeting for update;
  if found then
    if m.created_by is distinct from p_user then raise exception 'NOT_OWNER'; end if;
    if m.last_save_id = p_save_id then
      return jsonb_build_object('meeting', to_jsonb(m), 'action_items', coalesce((select jsonb_agg(to_jsonb(a)) from action_items a where meeting_id = p_meeting), '[]'::jsonb));
    end if;
    if m.draft_revision <> p_revision then raise exception 'STALE_DRAFT'; end if;
  else
    if p_revision <> 0 then raise exception 'STALE_DRAFT'; end if;
    insert into meetings(id, created_by, title, meeting_date, status)
      values(p_meeting, p_user, p_title, p_date, 'draft') returning * into m;
  end if;
  if coalesce(array_length(p_action_ids, 1), 0) <> jsonb_array_length(p_output->'action_items') then raise exception 'INVALID_ACTION_IDS'; end if;
  if exists(select 1 from action_items where id = any(p_action_ids) and meeting_id <> p_meeting) then raise exception 'NOT_OWNER'; end if;
  update meetings set title = p_title, meeting_date = p_date, summary = p_output->>'summary',
    language = p_output->>'language', readiness_score = (p_output->>'readiness_score')::integer,
    output_snapshot = p_output, source_notes = p_notes, status = 'reviewed',
    draft_revision = draft_revision + 1, last_save_id = p_save_id, updated_at = now()
    where id = p_meeting returning * into m;
  for item in select value from jsonb_array_elements(p_output->'action_items') loop
    idx := idx + 1;
    insert into action_items(id, meeting_id, task, owner, team, due_date, priority, status, evidence)
      values(p_action_ids[idx], p_meeting, item->>'task', item->>'owner', item->>'team',
        nullif(item->>'due_date', '')::date, item->>'priority', item->>'status', item->>'evidence')
      on conflict(id) do update set task = excluded.task, owner = excluded.owner, team = excluded.team,
        due_date = excluded.due_date, priority = excluded.priority, status = excluded.status,
        evidence = excluded.evidence, updated_at = now();
  end loop;
  delete from action_items where meeting_id = p_meeting and not(id = any(p_action_ids));
  delete from prep_questions where meeting_id = p_meeting;
  insert into prep_questions(meeting_id, question, intended_owner, reason, next_meeting_date)
    select p_meeting, q->>'question', q->>'intended_owner', q->>'reason', nullif(q->>'next_meeting_date', '')::date
    from jsonb_array_elements(p_output->'prep_questions') q;
  return jsonb_build_object('meeting', to_jsonb(m), 'action_items', coalesce((select jsonb_agg(to_jsonb(a)) from action_items a where meeting_id = p_meeting), '[]'::jsonb));
end;
$$;
revoke all on function public.save_kaarya_draft(uuid, uuid, text, date, jsonb, uuid[], integer, uuid, text) from public, anon, authenticated;
grant execute on function public.save_kaarya_draft(uuid, uuid, text, date, jsonb, uuid[], integer, uuid, text) to service_role;
notify pgrst, 'reload schema';
create or replace function public.update_kaarya_task(p_token text, p_status text, p_note text)
returns jsonb language plpgsql set search_path = public as $$
declare t action_items;
begin
  if p_status not in ('pending', 'in_progress', 'blocked', 'done') or length(p_note) > 2000 then raise exception 'INVALID_UPDATE'; end if;
  select * into t from action_items where update_token = p_token;
  if not found then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(t.meeting_id::text, 0));
  update action_items set status = p_status, update_note = p_note, updated_at = now()
    where id = t.id and update_token = p_token returning * into t;
  if not found then return null; end if;
  update meetings set draft_revision = draft_revision + 1, updated_at = now() where id = t.meeting_id;
  return to_jsonb(t);
end;
$$;
revoke all on function public.update_kaarya_task(text, text, text) from public, anon, authenticated;
grant execute on function public.update_kaarya_task(text, text, text) to service_role;
commit;
