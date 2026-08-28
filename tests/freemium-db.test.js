import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { exampleInput, exampleOutput } from "../lib/exampleMeeting.js";

const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const reserve = (id, kind = "generate", meeting = id, owner = user, hash = "a".repeat(64), chars = 100) => scalar("select kaarya_reserve_request($1,$2,$3,$4,$5,$6)", [owner, id, meeting, kind, hash, chars]);
const finish = (id, lease, owner = user) => scalar("select kaarya_finish_request($1,$2,$3,$4,$5)", [owner, id, lease, { structured: exampleOutput }, exampleInput]);
async function meeting(owner = user) {
  const id = randomUUID();
  await db.query("insert into meetings(id,created_by,title,status) values($1,$2,'Test meeting','reviewed')", [id, owner]);
  return id;
}
before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create schema extensions; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;");
  for (const file of ["schema.sql", "upgrade-focus-flow.sql", "upgrade-freemium.sql", "upgrade-long-transcripts.sql"]) {
    try { await db.exec(await readFile(new URL("../supabase/" + file, import.meta.url), "utf8")); }
    catch (error) { throw new Error(file + ": " + error.message + " at " + error.position); }
  }
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade; truncate meetings cascade;");
  await db.query("insert into auth.users(id) values($1),($2)", [user, other]);
});
after(async () => { await db?.close(); });

test("migration reruns without removing owned data", async () => {
  const id = await meeting();
  await db.exec(await readFile(new URL("../supabase/upgrade-freemium.sql", import.meta.url), "utf8"));
  assert.equal(await scalar("select count(*)::int from meetings where id=$1", [id]), 1);
});
test("overlapping Free requests allow exactly one reservation", async () => {
  const results = await Promise.allSettled([reserve(randomUUID()), reserve(randomUUID())]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(results.find((r) => r.status === "rejected").reason.message, /DAILY_LIMIT/);
});
test("retry recovers the same draft using one credit", async () => {
  const id=randomUUID(); const r=await reserve(id); const result=await finish(id,r.lease);
  assert.equal(result.meeting.id,id); assert.equal(result.retained,true); assert.equal(result.saved,false);
  const cached=await reserve(id); assert.equal(cached.cached,true); assert.equal(cached.result.meeting.id,id);
  assert.equal(await scalar("select count(*)::int from meetings"),1);
  assert.equal(await scalar("select count(*)::int from action_items"),0);
  await assert.rejects(reserve(randomUUID()),/DAILY_LIMIT/);
});
test("failed calls release allowance and stale workers cannot complete", async () => {
  const id=randomUUID(); const first=await reserve(id);
  await scalar("select kaarya_fail_request($1,$2,$3)",[user,id,first.lease]);
  const second=await reserve(id); assert.notEqual(first.lease,second.lease);
  await assert.rejects(finish(id,first.lease),/REQUEST_EXPIRED/);
  await finish(id,second.lease);
});
test("expired reservations release capacity", async () => {
  const id=randomUUID(); await reserve(id);
  await db.query("update kaarya_usage_requests set expires_at=now()-interval '1 minute' where id=$1",[id]);
  assert.ok((await reserve(randomUUID())).lease);
});
test("storage completion is idempotent", async () => {
  const id=randomUUID(); const r=await reserve(id); await finish(id,r.lease); await finish(id,r.lease);
  assert.equal(await scalar("select count(*)::int from meetings"),1);
});
test("request IDs cannot cross accounts or change content", async () => {
  const id=randomUUID(); await reserve(id);
  await assert.rejects(reserve(id,"generate",id,other),/REQUEST_CONFLICT/);
  await assert.rejects(reserve(id,"generate",id,user,"b".repeat(64)),/REQUEST_CONFLICT/);
});
test("five meetings prevent new inference and manual save bypass", async () => {
  for(let i=0;i<5;i++) await meeting();
  await assert.rejects(reserve(randomUUID()),/STORAGE_FULL/);
  await assert.rejects(meeting(),/STORAGE_FULL/);
  assert.equal(await scalar("select count(*)::int from kaarya_usage_requests"),0);
});
test("a manual save cannot steal reserved capacity", async () => {
  for(let i=0;i<4;i++) await meeting();
  const id=randomUUID(); const r=await reserve(id);
  await assert.rejects(meeting(),/STORAGE_FULL/); await finish(id,r.lease);
  assert.equal(await scalar("select count(*)::int from meetings"),5);
});
test("deletion removes derived content without refunding daily quota", async () => {
  const id=randomUUID(); const r=await reserve(id); await finish(id,r.lease);
  await db.query("insert into action_items(meeting_id,task) values($1,'Delete test')",[id]);
  await assert.rejects(scalar("select kaarya_delete_meeting($1,$2)",[other,id]),/NOT_OWNER/);
  await scalar("select kaarya_delete_meeting($1,$2)",[user,id]);
  assert.equal(await scalar("select count(*)::int from meetings"),0);
  assert.equal(await scalar("select count(*)::int from action_items"),0);
  assert.equal(await scalar("select result from kaarya_usage_requests where id=$1",[id]),null);
  await assert.rejects(reserve(randomUUID()),/DAILY_LIMIT/);
});
test("scheduled messages block incomplete deletion", async () => {
  const id=await meeting(); await db.query("insert into delivery_logs(meeting_id,channel,status) values($1,'email','scheduled')",[id]);
  await assert.rejects(scalar("select kaarya_delete_meeting($1,$2)",[user,id]),/DELETE_BLOCKED/);
  assert.equal(await scalar("select count(*)::int from meetings"),1);
});
test("refinements require ownership and cannot evade budgets via manual meetings", async () => {
  const first=await meeting(); const second=await meeting();
  await assert.rejects(reserve(randomUUID(),"refine",first,other),/NOT_OWNER/);
  const id=randomUUID(); const r=await reserve(id,"refine",first); await finish(id,r.lease);
  await assert.rejects(reserve(randomUUID(),"refine",first),/REFINEMENT_LIMIT/);
  await assert.rejects(reserve(randomUUID(),"refine",second),/REFINEMENT_LIMIT/);
});
test("all plans accept long notes while retaining an explicit storage safety limit", async () => {
  const id=randomUUID(); await assert.rejects(reserve(id,"generate",id,user,"a".repeat(64),8388609),/INPUT_LIMIT/);
  assert.ok((await reserve(id,"generate",id,user,"a".repeat(64),8000000)).lease);
});
test("expired Pro entitlement preserves data but enforces Free capacity", async () => {
  await db.query("insert into kaarya_entitlements(user_id,plan_id,valid_until) values($1,'pro',now()+interval '1 month')",[user]);
  for(let i=0;i<6;i++) await meeting();
  await db.query("update kaarya_entitlements set valid_until=now()-interval '1 hour' where user_id=$1",[user]);
  const info=await scalar("select kaarya_account_overview($1,'Name')",[user]);
  assert.equal(info.plan_id,"free"); assert.equal(info.usage.retained,6);
  await assert.rejects(reserve(randomUUID()),/STORAGE_FULL/);
});
test("client database roles cannot read usage or change commercial entitlements", async () => {
  assert.equal(await scalar("select has_table_privilege('authenticated','kaarya_entitlements','UPDATE')"),false);
  assert.equal(await scalar("select has_table_privilege('anon','kaarya_usage_requests','SELECT')"),false);
  assert.equal(await scalar("select has_table_privilege('authenticated','user_profiles','UPDATE')"),false);
  assert.equal(await scalar("select has_function_privilege('authenticated','kaarya_reserve_request(uuid,uuid,uuid,text,text,integer)','EXECUTE')"),false);
});

test("profile synchronization preserves edited names", async () => {
  const first = await scalar("select kaarya_account_overview($1,'Google Name')", [user]);
  assert.equal(first.profile.full_name, "Google Name");
  assert.equal(first.plan_id, "free");
  assert.equal(new Date(first.usage.reset_at).getUTCMinutes(), 30);
  await db.query("update user_profiles set full_name='Chosen Name' where id=$1", [user]);
  const second = await scalar("select kaarya_account_overview($1,'Changed Google Name')", [user]);
  assert.equal(second.profile.full_name, "Chosen Name");
});

async function newJob(parts = [exampleInput.raw_notes], owner = user) {
  const id=randomUUID();
  await scalar("select kaarya_job_create($1,$2,$3,$4,$5)",[owner,id,{...exampleInput,raw_notes:undefined},"b".repeat(64),parts.length]);
  for(const [index,content] of parts.entries()) await scalar("select kaarya_job_upload($1,$2,$3,$4)",[owner,id,index,content]);
  return id;
}
const claimJob=(id,owner=user)=>scalar("select kaarya_job_claim($1,$2)",[owner,id]);

test("refinement seeding is owned, idempotent and Unicode-safe", async () => {
  const meetingId = await meeting();
  const raw = "\u{1F600}\u092d\u093e\u0930\u0924 ".repeat(30000);
  await db.query("update meetings set source_notes=$1 where id=$2", [raw, meetingId]);
  const id = randomUUID();
  await scalar("select kaarya_job_create($1,$2,$3,$4,2)", [user,id,{kind:"refine",meeting_id:meetingId},"c".repeat(64)]);
  await assert.rejects(scalar("select kaarya_job_seed($1,$2,$3)", [other,id,meetingId]), /NOT_OWNER/);
  await scalar("select kaarya_job_seed($1,$2,$3)", [user,id,meetingId]);
  await scalar("select kaarya_job_seed($1,$2,$3)", [user,id,meetingId]);
  assert.equal((await claimJob(id)).raw_notes, raw);
  const part = await scalar("select kaarya_source_part($1,$2,0)", [user,meetingId]);
  const end = await scalar("select kaarya_source_part($1,$2,$3)", [user,meetingId,part.next_offset]);
  assert.equal(part.text + end.text, raw);
  await assert.rejects(scalar("select kaarya_source_part($1,$2,0)", [other,meetingId]), /NOT_OWNER/);
});

test("temporary uploads expire and a new job removes their stored parts", async () => {
  const id = await newJob();
  await db.query("update kaarya_transcript_jobs set expires_at=now()-interval '1 second' where id=$1", [id]);
  await assert.rejects(claimJob(id), /REQUEST_EXPIRED/);
  const next = randomUUID();
  await scalar("select kaarya_job_create($1,$2,$3,$4,1)", [user,next,{},"c".repeat(64)]);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_uploads where job_id=$1", [id]), 0);
});

test("section retry limits cannot be bypassed by releasing the lease", async () => {
  const id = await newJob();
  const preparation = await claimJob(id);
  await scalar("select kaarya_job_prepare($1,$2,$3,$4,$5)", [user,id,preparation.lease,[{text:exampleInput.raw_notes,previous:exampleOutput}],[]]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const part = await claimJob(id);
    assert.equal(part.previous.action_items.length, 3);
    await scalar("select kaarya_job_release($1,$2,$3)", [user,id,part.lease]);
  }
  await assert.rejects(claimJob(id), /SECTION_RETRIES_EXHAUSTED/);
});
async function prepareJob(id, sections=[{text:exampleInput.raw_notes}]) {
  const c=await claimJob(id);
  await scalar("select kaarya_job_prepare($1,$2,$3,$4,$5)",[user,id,c.lease,sections,[]]);
  return c;
}

test("resumable uploads reject cross-user access and changed parts",async()=>{
  const id=await newJob();
  await assert.rejects(claimJob(id,other),/NOT_OWNER/);
  await assert.rejects(scalar("select kaarya_job_upload($1,$2,0,'changed')",[user,id]),/REQUEST_CONFLICT/);
  await scalar("select kaarya_job_upload($1,$2,0,$3)",[user,id,exampleInput.raw_notes]);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_uploads"),1);
  await assert.rejects(newJob(),/JOB_ACTIVE/);
});

test("section checkpoints survive retries; stale workers cannot overwrite them",async()=>{
  const id=await newJob(); await prepareJob(id,[{text:'first section'},{text:'last section'}]);
  const first=await claimJob(id);
  await assert.rejects(claimJob(id),/REQUEST_IN_PROGRESS/);
  await scalar("select kaarya_job_release($1,$2,$3)",[user,id,first.lease]);
  const retry=await claimJob(id); assert.notEqual(retry.lease,first.lease);
  await assert.rejects(scalar("select kaarya_job_checkpoint($1,$2,$3,0,$4)",[user,id,first.lease,{structured:exampleOutput}]),/REQUEST_EXPIRED/);
  await scalar("select kaarya_job_checkpoint($1,$2,$3,0,$4)",[user,id,retry.lease,{structured:exampleOutput}]);
  assert.equal((await claimJob(id)).position,1);
  assert.equal(await scalar("select count(*)::int from kaarya_usage_requests"),1);
});

test("long jobs finalize once, retain original text and clear temporary copies",async()=>{
  const id=await newJob(); await prepareJob(id);
  const part=await claimJob(id);
  await scalar("select kaarya_job_checkpoint($1,$2,$3,0,$4)",[user,id,part.lease,{structured:exampleOutput}]);
  const last=await claimJob(id); assert.equal(last.status,'finishing');
  const result=await scalar("select kaarya_job_finish($1,$2,$3,$4)",[user,id,last.lease,{structured:exampleOutput}]);
  assert.equal(result.meeting.source_notes,undefined);
  assert.equal(result.meeting.output_snapshot,undefined);
  assert.equal(await scalar("select source_notes from meetings where id=$1",[id]),exampleInput.raw_notes);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_uploads"),0);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_sections"),0);
  const replay=await scalar("select kaarya_job_finish($1,$2,$3,$4)",[user,id,last.lease,{structured:exampleOutput}]);
  assert.equal(replay.meeting.id,id);
  await assert.rejects(reserve(randomUUID()),/DAILY_LIMIT/);
  await scalar("select kaarya_delete_meeting($1,$2)",[user,id]);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_jobs"),0);
});

test("cancel removes temporary text, releases unused credit and fences in-flight work",async()=>{
  const id=await newJob(); await prepareJob(id); const c=await claimJob(id);
  await scalar("select kaarya_job_cancel($1,$2)",[user,id]);
  await assert.rejects(scalar("select kaarya_job_checkpoint($1,$2,$3,0,$4)",[user,id,c.lease,{structured:exampleOutput}]),/REQUEST_EXPIRED/);
  assert.equal(await scalar("select source_notes from kaarya_transcript_jobs where id=$1",[id]),null);
  assert.equal(await scalar("select count(*)::int from kaarya_transcript_uploads"),0);
  assert.ok((await reserve(randomUUID())).lease);
});

test("job tables and privileged RPCs are not accessible to browser roles",async()=>{
  for(const table of ['kaarya_transcript_jobs','kaarya_transcript_uploads','kaarya_transcript_sections']) {
    assert.equal(await scalar("select has_table_privilege('authenticated',$1,'SELECT')",[table]),false);
    assert.equal(await scalar("select relrowsecurity from pg_class where relname=$1",[table]),true);
  }
  assert.equal(await scalar("select has_function_privilege('anon','kaarya_job_claim(uuid,uuid)','EXECUTE')"),false);
});

test("saving a review without a source payload preserves long original notes",async()=>{
  const id=randomUUID(); const r=await reserve(id); await finish(id,r.lease);
  await scalar("select save_kaarya_draft($1,$2,$3,$4,$5,$6,0,$7,null)",[user,id,exampleInput.meeting_name,exampleInput.meeting_date,exampleOutput,exampleOutput.action_items.map(()=>randomUUID()),randomUUID()]);
  assert.equal(await scalar("select source_notes from meetings where id=$1",[id]),exampleInput.raw_notes);
});
