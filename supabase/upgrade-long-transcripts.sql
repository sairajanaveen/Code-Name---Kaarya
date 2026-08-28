-- Run after upgrade-freemium.sql. Private resumable jobs; no browser table access.
begin;
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
create table if not exists public.kaarya_transcript_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  fingerprint text not null,
  upload_count integer not null check(upload_count between 1 and 66),
  status text not null default 'uploading' check(status in ('uploading','uploaded','preparing','processing','completed','cancelled')),
  source_notes text,
  warnings jsonb not null default '[]',
  usage_lease uuid,
  step_lease uuid,
  step_expires timestamptz,
  section_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.kaarya_transcript_uploads (
  job_id uuid not null references public.kaarya_transcript_jobs(id) on delete cascade,
  position integer not null check(position between 0 and 65),
  content text not null check(length(content) between 1 and 128000),
  primary key(job_id,position)
);
create table if not exists public.kaarya_transcript_sections (
  job_id uuid not null references public.kaarya_transcript_jobs(id) on delete cascade,
  position integer not null,
  content text not null,
  result jsonb,
  attempts integer not null default 0,
  primary key(job_id,position)
);
alter table public.kaarya_transcript_sections add column if not exists previous jsonb;
create index if not exists kaarya_transcript_owner on public.kaarya_transcript_jobs(user_id,created_at);
alter table public.kaarya_transcript_jobs enable row level security;
alter table public.kaarya_transcript_uploads enable row level security;
alter table public.kaarya_transcript_sections enable row level security;
revoke all on public.kaarya_transcript_jobs, public.kaarya_transcript_uploads, public.kaarya_transcript_sections from anon, authenticated;
grant all on public.kaarya_transcript_jobs, public.kaarya_transcript_uploads, public.kaarya_transcript_sections to service_role;

create or replace function public.kaarya_job_create(p_user uuid,p_job uuid,p_payload jsonb,p_hash text,p_parts integer)
returns jsonb language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
  -- Expired temporary uploads are discarded; completed meetings are never deleted here.
  delete from kaarya_transcript_jobs where user_id=p_user and expires_at<=now();
  select * into j from kaarya_transcript_jobs where id=p_job;
  if found then
    if j.user_id<>p_user or j.fingerprint<>p_hash then raise exception 'REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',j.id,'status',j.status);
  end if;
  if exists(select 1 from kaarya_usage_requests where id=p_job) then raise exception 'REQUEST_CONFLICT'; end if;
  if exists(select 1 from kaarya_transcript_jobs where user_id=p_user and status not in ('completed','cancelled')) then raise exception 'JOB_ACTIVE'; end if;
  insert into kaarya_transcript_jobs(id,user_id,payload,fingerprint,upload_count) values(p_job,p_user,p_payload,p_hash,p_parts);
  return jsonb_build_object('id',p_job,'status','uploading');
end;
$$;

create or replace function public.kaarya_job_upload(p_user uuid,p_job uuid,p_position integer,p_content text)
returns void language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs; previous text; total bigint;
begin
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.expires_at<=now() then raise exception 'REQUEST_EXPIRED'; end if;
  if p_position<0 or p_position>=j.upload_count then raise exception 'REQUEST_CONFLICT'; end if;
  select content into previous from kaarya_transcript_uploads where job_id=p_job and position=p_position;
  if found then
    if previous<>p_content then raise exception 'REQUEST_CONFLICT'; end if;
    return;
  end if;
  if j.status<>'uploading' then raise exception 'REQUEST_CONFLICT'; end if;
  select coalesce(sum(octet_length(content)),0)+octet_length(p_content) into total from kaarya_transcript_uploads where job_id=p_job;
  if total>8388608 then raise exception 'INPUT_LIMIT'; end if;
  insert into kaarya_transcript_uploads(job_id,position,content) values(p_job,p_position,p_content);
  if (select count(*) from kaarya_transcript_uploads where job_id=p_job)=j.upload_count then
    update kaarya_transcript_jobs set status='uploaded' where id=p_job;
  end if;
end;
$$;

create or replace function public.kaarya_job_claim(p_user uuid,p_job uuid)
returns jsonb language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs; part kaarya_transcript_sections; token uuid; raw text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status='completed' then return jsonb_build_object('status','completed'); end if;
  if j.expires_at<=now() then raise exception 'REQUEST_EXPIRED'; end if;
  if j.status in ('cancelled','uploading') then raise exception 'JOB_NOT_READY'; end if;
  if j.step_expires>now() then raise exception 'REQUEST_IN_PROGRESS'; end if;
  token:=gen_random_uuid();
  update kaarya_transcript_jobs set step_lease=token,step_expires=now()+interval '70 seconds' where id=p_job;
  if j.status in ('uploaded','preparing') then
    select string_agg(content,'' order by position) into raw from kaarya_transcript_uploads where job_id=p_job;
    update kaarya_transcript_jobs set status='preparing' where id=p_job;
    return jsonb_build_object('status','preparing','lease',token,'raw_notes',raw,'payload',j.payload,'fingerprint',j.fingerprint);
  end if;
  select * into part from kaarya_transcript_sections where job_id=p_job and result is null order by position limit 1;
  if found then
    if part.attempts>=3 then raise exception 'SECTION_RETRIES_EXHAUSTED'; end if;
    update kaarya_transcript_sections set attempts=attempts+1 where job_id=p_job and position=part.position;
    return jsonb_build_object('status','processing','lease',token,'position',part.position,'content',part.content,'previous',part.previous,'payload',j.payload-'structured','total',j.section_count);
  end if;
  return jsonb_build_object('status','finishing','lease',token,'payload',j.payload,'usage_lease',j.usage_lease,
    'warnings',j.warnings,'results',(select jsonb_agg(result order by position) from kaarya_transcript_sections where job_id=p_job));
end;
$$;

create or replace function public.kaarya_job_prepare(p_user uuid,p_job uuid,p_lease uuid,p_sections jsonb,p_warnings jsonb)
returns void language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs; raw text; reservation jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status<>'preparing' or j.step_lease<>p_lease or j.step_expires<=now() or j.expires_at<=now() then raise exception 'REQUEST_EXPIRED'; end if;
  if jsonb_array_length(p_sections) not between 1 and 350 then raise exception 'INPUT_LIMIT'; end if;
  select string_agg(content,'' order by position) into raw from kaarya_transcript_uploads where job_id=p_job;
  reservation:=kaarya_reserve_request(p_user,p_job,coalesce(nullif(j.payload->>'meeting_id','')::uuid,p_job),coalesce(j.payload->>'kind','generate'),j.fingerprint,length(raw));
  insert into kaarya_transcript_sections(job_id,position,content,previous) select p_job,(ordinality-1)::integer,value->>'text',value->'previous' from jsonb_array_elements(p_sections) with ordinality;
  update kaarya_transcript_jobs set status='processing',source_notes=raw,section_count=jsonb_array_length(p_sections),warnings=p_warnings,
    usage_lease=(reservation->>'lease')::uuid,step_lease=null,step_expires=null where id=p_job;
  update kaarya_usage_requests set expires_at=j.expires_at where id=p_job;
end;
$$;

create or replace function public.kaarya_job_checkpoint(p_user uuid,p_job uuid,p_lease uuid,p_position integer,p_result jsonb)
returns void language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs;
begin
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status<>'processing' or j.step_lease<>p_lease or j.step_expires<=now() or j.expires_at<=now() then raise exception 'REQUEST_EXPIRED'; end if;
  update kaarya_transcript_sections set result=p_result where job_id=p_job and position=p_position and result is null;
  update kaarya_transcript_jobs set step_lease=null,step_expires=null where id=p_job;
end;
$$;

create or replace function public.kaarya_job_release(p_user uuid,p_job uuid,p_lease uuid)
returns void language sql set search_path=public as $$
  update kaarya_transcript_jobs set step_expires=null,step_lease=null where id=p_job and user_id=p_user and step_lease=p_lease;
$$;

create or replace function public.kaarya_job_finish(p_user uuid,p_job uuid,p_lease uuid,p_result jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status='completed' then return (select r.result from kaarya_usage_requests r where r.id=p_job); end if;
  if j.status<>'processing' or j.step_lease<>p_lease or j.step_expires<=now() then raise exception 'REQUEST_EXPIRED'; end if;
  if exists(select 1 from kaarya_transcript_sections where job_id=p_job and result is null) then raise exception 'JOB_NOT_READY'; end if;
  v_result:=kaarya_finish_request(p_user,p_job,j.usage_lease,p_result,j.payload||jsonb_build_object('raw_notes',j.source_notes));
  -- Do not echo multi-megabyte notes or duplicate snapshots into browser responses or usage results.
  if v_result ? 'meeting' then v_result:=jsonb_set(v_result,'{meeting}',(v_result->'meeting')-'source_notes'-'output_snapshot'); end if;
  update kaarya_usage_requests set result=v_result where id=p_job;
  update kaarya_transcript_jobs set status='completed',source_notes=null,payload=payload-'structured',step_lease=null,step_expires=null where id=p_job;
  delete from kaarya_transcript_sections where job_id=p_job;
  delete from kaarya_transcript_uploads where job_id=p_job;
  return v_result;
end;
$$;

create or replace function public.kaarya_job_cancel(p_user uuid,p_job uuid)
returns void language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,1701));
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status='completed' then raise exception 'REQUEST_CONFLICT'; end if;
  perform kaarya_fail_request(p_user,p_job,j.usage_lease);
  update kaarya_transcript_jobs set status='cancelled',source_notes=null,payload='{}',step_lease=null,step_expires=null where id=p_job;
  delete from kaarya_transcript_sections where job_id=p_job;
  delete from kaarya_transcript_uploads where job_id=p_job;
end;
$$;

revoke all on function public.kaarya_job_create(uuid,uuid,jsonb,text,integer),public.kaarya_job_upload(uuid,uuid,integer,text),public.kaarya_job_claim(uuid,uuid),
  public.kaarya_job_prepare(uuid,uuid,uuid,jsonb,jsonb),public.kaarya_job_checkpoint(uuid,uuid,uuid,integer,jsonb),public.kaarya_job_release(uuid,uuid,uuid),
  public.kaarya_job_finish(uuid,uuid,uuid,jsonb),public.kaarya_job_cancel(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kaarya_job_create(uuid,uuid,jsonb,text,integer),public.kaarya_job_upload(uuid,uuid,integer,text),public.kaarya_job_claim(uuid,uuid),
  public.kaarya_job_prepare(uuid,uuid,uuid,jsonb,jsonb),public.kaarya_job_checkpoint(uuid,uuid,uuid,integer,jsonb),public.kaarya_job_release(uuid,uuid,uuid),
  public.kaarya_job_finish(uuid,uuid,uuid,jsonb),public.kaarya_job_cancel(uuid,uuid) to service_role;
create or replace function public.kaarya_job_seed(p_user uuid,p_job uuid,p_meeting uuid)
returns void language plpgsql set search_path=public as $$
declare j kaarya_transcript_jobs; raw text;
begin
  select * into j from kaarya_transcript_jobs where id=p_job and user_id=p_user for update;
  if not found then raise exception 'NOT_OWNER'; end if;
  if j.status<>'uploading' then return; end if;
  if j.payload->>'kind'<>'refine' or j.payload->>'meeting_id'<>p_meeting::text then raise exception 'REQUEST_CONFLICT'; end if;
  select source_notes into raw from meetings where id=p_meeting and created_by=p_user;
  if raw is null then raise exception 'NOT_OWNER'; end if;
  if octet_length(raw)>8388608 then raise exception 'INPUT_LIMIT'; end if;
  -- PostgreSQL counts Unicode characters; update the server-owned manifest accordingly.
  insert into kaarya_transcript_uploads(job_id,position,content)
    select p_job,n,substring(raw from n*128000+1 for 128000) from generate_series(0,(length(raw)-1)/128000) n;
  update kaarya_transcript_jobs set upload_count=(select count(*) from kaarya_transcript_uploads where job_id=p_job),status='uploaded' where id=p_job;
end;
$$;
revoke all on function public.kaarya_job_seed(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.kaarya_job_seed(uuid,uuid,uuid) to service_role;

create or replace function public.kaarya_remove_meeting_jobs()
returns trigger language plpgsql set search_path=public as $$
begin
  delete from kaarya_transcript_jobs where user_id=old.created_by and (id=old.id or payload->>'meeting_id'=old.id::text);
  return old;
end;
$$;
drop trigger if exists kaarya_remove_meeting_jobs on public.meetings;
create trigger kaarya_remove_meeting_jobs after delete on public.meetings for each row execute function public.kaarya_remove_meeting_jobs();
revoke all on function public.kaarya_remove_meeting_jobs() from public,anon,authenticated;
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
create or replace function public.kaarya_source_part(p_user uuid,p_meeting uuid,p_offset integer)
returns jsonb language plpgsql set search_path=public as $$
declare source text; total integer;
begin
  if p_offset<0 or p_offset>8388608 then raise exception 'REQUEST_CONFLICT'; end if;
  select source_notes into source from meetings where id=p_meeting and created_by=p_user;
  if not found then raise exception 'NOT_OWNER'; end if;
  total:=length(coalesce(source,''));
  return jsonb_build_object('text',substring(coalesce(source,'') from p_offset+1 for 128000),
    'next_offset',case when p_offset+128000<total then p_offset+128000 else null end);
end;
$$;
revoke all on function public.kaarya_source_part(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.kaarya_source_part(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
