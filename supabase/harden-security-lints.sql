-- Apply after upgrade-long-transcripts.sql. Idempotent and data-preserving.
-- Kaarya reads and writes these tables only from owner-scoped server routes with service_role.
begin;

revoke all on table public.action_items, public.delivery_logs, public.kaarya_entitlements,
  public.kaarya_request_limits, public.kaarya_transcript_jobs, public.kaarya_transcript_sections,
  public.kaarya_transcript_uploads, public.kaarya_usage_requests, public.meetings,
  public.participants, public.prep_questions, public.user_profiles from anon, authenticated;

drop policy if exists kaarya_server_only on public.action_items;
create policy kaarya_server_only on public.action_items as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.delivery_logs;
create policy kaarya_server_only on public.delivery_logs as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_entitlements;
create policy kaarya_server_only on public.kaarya_entitlements as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_request_limits;
create policy kaarya_server_only on public.kaarya_request_limits as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_transcript_jobs;
create policy kaarya_server_only on public.kaarya_transcript_jobs as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_transcript_sections;
create policy kaarya_server_only on public.kaarya_transcript_sections as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_transcript_uploads;
create policy kaarya_server_only on public.kaarya_transcript_uploads as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.kaarya_usage_requests;
create policy kaarya_server_only on public.kaarya_usage_requests as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.meetings;
create policy kaarya_server_only on public.meetings as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.participants;
create policy kaarya_server_only on public.participants as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.prep_questions;
create policy kaarya_server_only on public.prep_questions as restrictive for all to anon, authenticated using (false) with check (false);
drop policy if exists kaarya_server_only on public.user_profiles;
create policy kaarya_server_only on public.user_profiles as restrictive for all to anon, authenticated using (false) with check (false);

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

notify pgrst, 'reload schema';
commit;
