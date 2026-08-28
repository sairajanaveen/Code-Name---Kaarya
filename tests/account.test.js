import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { config } from "../lib/config.js";
import { validateProfile, runMeteredGeneration, accountOverview } from "../lib/account.js";
import { PLANS } from "../lib/plans.js";
import meetingRoute from "../pages/api/meetings/[id].js";
import { exampleInput, exampleOutput } from "../lib/exampleMeeting.js";

const user="11111111-1111-4111-8111-111111111111";
const id="22222222-2222-4222-8222-222222222222";
const profile={full_name:"Naveen",company:"",role:"",language:"English",timezone:"Asia/Kolkata"};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
let originalFetch,originalConfig;
beforeEach(()=>{ originalFetch=globalThis.fetch; originalConfig={...config}; config.supabaseUrl="https://test.supabase.local"; config.supabaseServiceKey="server-only-test"; config.supabaseAnonKey="public-test"; });
afterEach(()=>{globalThis.fetch=originalFetch;Object.assign(config,originalConfig);});
const request=(generate)=>({userId:user,requestId:id,input:{payload:exampleInput},generate});
function response(){ const res=new EventEmitter();Object.assign(res,{code:200,setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;},end(){}});return res; }

test("approved plan prices and existing allowances match",()=>{
  assert.equal(PLANS.pro.price,2999); assert.equal(PLANS.team.price,9999);
  assert.equal(PLANS.pro.meetings,40); assert.equal(PLANS.team.meetings,200);
  assert.equal(PLANS.free.meetings,1); assert.equal(PLANS.free.retained,5);
});
test("profile rejects commercial or identity field injection",()=>{
  assert.throws(()=>validateProfile({...profile,plan_id:"pro"}),/Only profile/);
  assert.throws(()=>validateProfile({...profile,id}),/Only profile/);
  assert.throws(()=>validateProfile({...profile,organization_id:id}),/Only profile/);
  assert.throws(()=>validateProfile({...profile,timezone:"invalid"}),/timezone/);
  assert.throws(()=>validateProfile({...profile,full_name:""}),/name/);
  assert.deepEqual(validateProfile(profile),profile);
});
test("profile overview cannot derive entitlements from Google user metadata",async()=>{
  globalThis.fetch=async(url,options)=>{ const body=JSON.parse(options.body);assert.equal(body.p_user,user);assert.equal(body.plan_id,undefined);return json({plan_id:"free",profile});};
  const account=await accountOverview({id:user,email:"test@example.com",user_metadata:{full_name:"Naveen",plan_id:"pro"}});
  assert.equal(account.plan.id,"free");assert.equal(account.checkout_available,false);
});
test("cached successful request does not call the model",async()=>{
  globalThis.fetch=async()=>json({cached:true,result:{structured:exampleOutput}});
  const result=await runMeteredGeneration(request(()=>{throw new Error("must not call model");}));
  assert.equal(result.replayed,true);
});
test("quota failure blocks the model with a useful error",async()=>{
  globalThis.fetch=async()=>json({message:"DAILY_LIMIT"},400);
  await assert.rejects(runMeteredGeneration(request(()=>{throw new Error("must not call model");})),/midnight India/);
});
test("model failure releases the reservation",async()=>{
  const calls=[];globalThis.fetch=async(url)=>{calls.push(url);return json({lease:id});};
  await assert.rejects(runMeteredGeneration(request(()=>{throw new Error("provider failed");})),/provider failed/);
  assert.ok(calls.at(-1).endsWith("kaarya_fail_request"));
});
test("ambiguous commit retries storage without rerunning the model",async()=>{
  let modelCalls=0,commits=0;
  globalThis.fetch=async(url)=>{if(url.endsWith("kaarya_reserve_request")) return json({lease:id});commits++;if(commits===1)throw new Error("network");return json({structured:exampleOutput});};
  await runMeteredGeneration(request(()=>{modelCalls++;return {structured:exampleOutput};}));
  assert.equal(modelCalls,1);assert.equal(commits,2);
});
test("unconfigured storage fails closed before inference",async()=>{
  config.supabaseServiceKey="";
  await assert.rejects(runMeteredGeneration(request(()=>{throw new Error("must not call model");})),/not configured/);
});
test("meeting export strips bearer task links and requires ownership",async()=>{
  globalThis.fetch=async(url)=>{
    if(url.includes("auth/v1/user"))return json({id:user});
    if(url.includes("consume_kaarya_quota"))return json(true);
    assert.ok(url.includes("created_by=eq."+user));
    if(url.includes("/meetings?"))return json([{id,created_by:user,title:"Test"}]);
    return json([{task:"Test",update_token:"private-bearer",meetings:{created_by:user}}]);
  };
  const res=response();await meetingRoute({method:"GET",headers:{authorization:"Bearer test"},query:{id}},res);
  assert.equal(res.code,200);assert.equal(res.data.tasks[0].update_token,undefined);assert.equal(res.data.meeting.created_by,undefined);
});
test("delete requires explicit matching confirmation before RPC",async()=>{
  globalThis.fetch=async(url)=>url.includes("auth/v1/user")?json({id:user}):json([{id,created_by:user}]);
  const res=response();await meetingRoute({method:"DELETE",headers:{authorization:"Bearer test"},query:{id}},res);
  assert.equal(res.code,400);
});
