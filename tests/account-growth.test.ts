import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";

test("account growth: admin authorization, Vietnam dates, missing history and distinct activity",async()=>{
 const db=await createTestDatabase(),admin=randomUUID(),customer=randomUUID();
 const actor=async(id:string)=>{
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({session_id:id})]);
 };
 const report=async()=> (await db.query<{v:{registered:number;active30:number;new_month:number;daily:{date:string;registered:number;new_registered:number;active:number|null;active30:number|null}[]}}>("select public.account_growth() v")).rows[0].v;
 try {
  for(const id of [admin,customer]) {
   const email=`${id}@example.test`;
   await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,email]);
   await db.query("insert into auth.identities values($1,'google',$2)",[id,{email,email_verified:true}]);
   await db.query("insert into auth.sessions values($1,$1)",[id]);
  }
  await db.query("insert into public.admin_members(user_id,email) values($1,'admin@example.test')",[admin]);
  await db.exec("set role anon");await assert.rejects(report(),/permission denied/);
  await actor(customer);await assert.rejects(report(),/Admin required/);
  await db.query("select public.touch_account()");await db.query("select public.touch_account()");
  await assert.rejects(db.exec("select * from private.account_activity_days"),/permission denied/);
  await actor(admin);let data=await report();
  assert.equal(data.registered,2);assert.equal(data.active30,1);assert.equal(data.new_month,2);assert.equal(data.daily.length,365);
  assert.equal(data.daily.at(-1)!.registered,2);assert.equal(data.daily.at(-1)!.new_registered,2);
  assert.equal(data.daily.at(-1)!.active30,1);assert.equal(data.daily.at(-2)!.active30,null);assert.equal(data.daily.at(-1)!.active,null,"partial migration day is unknown");
  assert.equal(data.daily.at(-2)!.registered,0);
  await db.exec("reset role");
  assert.equal((await db.query<{n:number}>("select count(*)::int n from private.account_activity_days")).rows[0].n,1);
  await db.exec("update private.account_analytics_start set started_on=started_on-40");
  await db.query("insert into private.account_activity_days(user_id,day) values($1,(now() at time zone 'Asia/Ho_Chi_Minh')::date-1),($1,(now() at time zone 'Asia/Ho_Chi_Minh')::date-2)",[customer]);
  await actor(admin);data=await report();assert.equal(data.daily.at(-2)!.active,1);assert.equal(data.daily.at(-2)!.active30,1,"30-day active counts distinct users");
  await db.exec("reset role");
  await db.query("update private.accounts set registered_at=date_trunc('day',now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'-interval '1 second',status='banned' where user_id=$1",[customer]);
  await actor(admin);data=await report();assert.equal(data.active30,0);assert.equal(data.registered,2);assert.equal(data.daily.at(-1)!.new_registered,1);assert.equal(data.daily.at(-2)!.new_registered,1);
  await db.exec("reset role");await db.query("delete from auth.sessions where user_id=$1",[admin]);
  await actor(admin);await assert.rejects(report(),/Admin required/);
 } finally { await db.close(); }
});
