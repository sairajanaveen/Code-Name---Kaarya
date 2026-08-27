begin;
do $$
declare
  u uuid;
  mid uuid := gen_random_uuid();
  aid uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  out jsonb;
  first_result jsonb;
  repeated jsonb;
  updated jsonb;
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'A signed-in test account is required'; end if;
  out := '{"summary":"Release verification only.","language":"en","readiness_score":100,"decisions":[],"blockers":[],"action_items":[{"task":"Verify the release","owner":"Test owner","team":"","due_date":"","priority":"medium","status":"pending","evidence":"Test owner will verify the release."}],"prep_questions":[]}'::jsonb;
  first_result := public.save_kaarya_draft(u,mid,'Kaarya transactional verification',current_date,out,array[aid],0,sid,'Test owner will verify the release.');
  repeated := public.save_kaarya_draft(u,mid,'Kaarya transactional verification',current_date,out,array[aid],0,sid,'Test owner will verify the release.');
  if (repeated->'meeting'->>'draft_revision')::integer <> 1 then raise exception 'Repeat save changed revision'; end if;
  if (select count(*) from public.action_items where meeting_id = mid) <> 1 then raise exception 'Repeat save duplicated action'; end if;
  begin
    perform public.save_kaarya_draft(gen_random_uuid(),mid,'Unauthorized',current_date,out,array[aid],1,gen_random_uuid(),'');
    raise exception 'Owner isolation failed';
  exception when others then
    if sqlerrm <> 'NOT_OWNER' then raise; end if;
  end;
  updated := public.update_kaarya_task(first_result->'action_items'->0->>'update_token','done','Verified in a rollback-only transaction');
  if updated->>'evidence' <> 'Test owner will verify the release.' then raise exception 'Source evidence changed'; end if;
  if updated->>'status' <> 'done' then raise exception 'Task status did not update'; end if;
  begin
    perform public.save_kaarya_draft(u,mid,'Stale draft',current_date,out,array[aid],1,gen_random_uuid(),'');
    raise exception 'Stale revision accepted';
  exception when others then
    if sqlerrm <> 'STALE_DRAFT' then raise; end if;
  end;
  if has_function_privilege('anon','public.save_kaarya_draft(uuid,uuid,text,date,jsonb,uuid[],integer,uuid,text)','EXECUTE') then raise exception 'Anonymous RPC access remains'; end if;
  if has_table_privilege('authenticated','public.meetings','SELECT') then raise exception 'Direct meeting access remains'; end if;
end;
$$;
rollback;
select 'PASS: save, retry, owner isolation, task update, stale revision, permissions; test data rolled back' as verification;
