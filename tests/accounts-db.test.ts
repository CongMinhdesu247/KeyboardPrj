import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";

test("customer accounts: Google roles, private orders, statistics, bans and deletion",async t=>{
 const db=await createTestDatabase(),admin=randomUUID(),a=randomUUID(),b=randomUUID(),metadata=randomUUID();
 const actor=async(id:string,role="authenticated")=>{await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({session_id:id})]);};
 const rpc=async<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) => (await db.query<{v:T}>(`select public.${sql} v`,args)).rows[0].v;
 try {
  for(const id of [admin,a,b,metadata]){
   const email=`${id}@example.test`;
   await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,email,{role:"admin",full_name:`Fixture ${id}`}]);
   await db.query("insert into auth.sessions values($1,$1)",[id]);
   if(id!==metadata)await db.query("insert into auth.identities values($1,'google',$2)",[id,{email,email_verified:true}]);
  }
  await db.query("insert into public.admin_members(user_id,email) values($1,'admin@example.test')",[admin]);
  await db.exec("insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active) overriding system value values(100,'keycap','Account fixture','product','bộ',100000,4,true)");
  await t.test("registration cannot grant admin or trust editable metadata; no anonymous reads",async()=>{
   assert.equal((await db.query<{n:number}>("select count(*)::int n from private.accounts")).rows[0].n,3);
   await actor(metadata);await assert.rejects(rpc("touch_account()"),/Session required/);
   await actor(a);assert.equal((await rpc("touch_account()")).role,"customer");assert.equal(await rpc("is_admin()"),false);
   await assert.rejects(rpc("account_report()"),/Admin required/);
   await assert.rejects(db.exec("select * from private.accounts"),/permission denied/);
   await actor("","anon");await assert.rejects(rpc("my_orders()"),/permission denied/);
  });
  const payload={requestId:randomUUID(),hash:"a".repeat(64),code:`TK-${"A".repeat(32)}`,customerName:"Khách fixture",phone:"0901234567",delivery:"pickup",plan:"deposit_cod",items:[{itemId:"100",quantity:1,expectedPrice:100000}]};
  await actor(a);const order=await rpc("submit_account_order($1)",[payload]);assert.equal(order.ok,true);
  await t.test("authenticated identity owns new orders; retry atomic and no stock deduction",async()=>{
   assert.equal((await rpc("submit_account_order($1)",[{...payload,customerId:b}])).ok,true);
   const mine=await rpc<{total:number;orders:Record<string,unknown>[]}>("my_orders()");assert.equal(mine.total,1);assert.equal(mine.orders[0].code,payload.code);
   assert.equal("phone" in mine.orders[0],false);assert.equal("customer_user_id" in mine.orders[0],false);assert.equal("cost_vnd" in mine.orders[0],false);
   await actor(b);assert.equal((await rpc("my_orders()")).total,0);
   await assert.rejects(rpc("submit_account_order($1)",[payload]),/ownership/);
   await assert.rejects(rpc("customer_orders($1)",[a]),/Admin required/);
   await db.exec("reset role");assert.equal((await db.query<{customer_user_id:string}>("select customer_user_id from private.orders where code=$1",[payload.code])).rows[0].customer_user_id,a);
   assert.equal((await db.query<{stock_quantity:number}>("select stock_quantity from public.products_services where id=100")).rows[0].stock_quantity,4);
  });
  await t.test("statistics use real registrations and activity; search and pagination accurate",async()=>{
   await actor(admin);const report=await rpc<{total:number;customers:number;admins:number;active30:number;daily:{count:number}[];matched:number}>("account_report()");
   assert.equal(report.total,3);assert.equal(report.customers,2);assert.equal(report.admins,1);assert.equal(report.active30,1);assert.equal(report.daily.length,30);assert.equal(report.daily.reduce((sum,d)=>sum+d.count,0),3);
   assert.equal((await rpc("account_report($1,$2,$3)",[`${a}@example.test`,"customer",0])).matched,1);
   assert.equal((await rpc("customer_orders($1)",[a]) as unknown as unknown[]).length,1);
   await db.exec("reset role");const extra:string[]=[];
   for(let n=0;n<22;n++){
    const id=randomUUID(),email=`page-${id}@example.test`;extra.push(id);
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,email]);
    await db.query("insert into auth.identities values($1,'google',$2)",[id,{email,email_verified:true}]);
   }
   await actor(admin);
   const first=await rpc<{matched:number;accounts:unknown[]}>("account_report('', 'all',0)"),second=await rpc<{accounts:unknown[]}>("account_report('', 'all',20)");
   assert.equal(first.matched,25);assert.equal(first.accounts.length,20);assert.equal(second.accounts.length,5);
   await db.exec("reset role");await db.query("delete from auth.identities where user_id=any($1::uuid[])",[extra]);await db.query("delete from auth.users where id=any($1::uuid[])",[extra]);await actor(admin);
  });
  await t.test("ban revokes sessions immediately; protected admins; unban requires new login",async()=>{
   assert.equal((await rpc("manage_account($1,1,'ban','Fixture ban')",[admin])).code,"protected_admin");
   assert.equal((await rpc("manage_account($1,1,'ban','Fixture ban')",[a])).ok,true);
   await actor(a);assert.equal(await rpc("has_live_session()"),false);await assert.rejects(rpc("my_orders()"),/Account required/);await assert.rejects(rpc("submit_account_order($1)",[{...payload,requestId:randomUUID()}]),/Account required/);
   await actor(admin);assert.equal((await rpc("manage_account($1,1,'unban','Fixture unban')",[a])).code,"conflict");assert.equal((await rpc("manage_account($1,2,'unban','Fixture unban')",[a])).ok,true);
   await actor(a);assert.equal(await rpc("has_live_session()"),false);
   await db.exec("reset role");await db.query("insert into auth.sessions values($1,$1)",[a]);await actor(a);assert.equal((await rpc("my_orders()")).total,1);
  });
  await t.test("logical deletion preserves orders, rejects stale/recreated sessions and promotion",async()=>{
   await actor(admin);assert.equal((await rpc("manage_account($1,3,'delete','Fixture delete')",[a])).ok,true);
   await actor(a);assert.equal(await rpc("has_live_session()"),false);
   await db.exec("reset role");await db.query("insert into auth.sessions values($1,$1)",[a]);
   await assert.rejects(db.query("insert into public.admin_members(user_id,email) values($1,'bad@example.test')",[a]),/Account restricted/);
   await actor(a);assert.equal((await rpc("touch_account()")).status,"deleted");await assert.rejects(rpc("my_orders()"),/Account required/);
   await actor(admin);assert.equal((await rpc("manage_account($1,4,'unban','Fixture restore')",[a])).code,"conflict");
   const report=await rpc("account_report()");assert.equal(report.total,2);assert.equal(report.deleted,1);
   assert.equal((await rpc("customer_orders($1)",[a]) as unknown as unknown[]).length,1);
  });
  await t.test("profile is private, validated, versioned and not overwritten by Google identity refresh",async()=>{
   await actor("","anon");await assert.rejects(rpc("update_customer_profile('Test','','',1)"),/permission denied/);
   await actor(b);
   assert.equal((await rpc("update_customer_profile('Test','invalid','',1)")).code,"invalid_input");
   assert.equal((await rpc("update_customer_profile('','','',1)")).code,"invalid_input");
   const saved=await rpc("update_customer_profile('Tên khách tự chọn','0385 920 038','Địa chỉ riêng fixture',1)");assert.equal(saved.ok,true);assert.equal(saved.version,2);
   const profile=await rpc("touch_account()");assert.equal(profile.name,"Tên khách tự chọn");assert.equal(profile.phone,"0385920038");assert.equal(profile.address,"Địa chỉ riêng fixture");assert.equal(profile.role,"customer");
   assert.equal((await rpc("update_customer_profile('Tên khác','','',1)")).code,"conflict");
   assert.equal((await rpc("update_customer_profile('Tên khách tự chọn','0385920038','Địa chỉ riêng fixture',1)")).ok,true);
   await db.exec("reset role");await db.query("update auth.identities set identity_data=identity_data||'{\"name\":\"Google name\"}'::jsonb where user_id=$1",[b]);
   await actor(b);assert.equal((await rpc("touch_account()")).name,"Tên khách tự chọn");
   await actor(admin);const report=await rpc<{accounts:Record<string,unknown>[]}>("account_report()");assert.equal("phone" in report.accounts.find(x=>x.id===b)!,false);assert.equal("address" in report.accounts.find(x=>x.id===b)!,false);
   const me=await rpc("touch_account()");assert.notEqual(me.phone,"0385920038");
   assert.equal((await rpc("manage_account($1,2,'ban','Profile ban fixture')",[b])).ok,true);
   await actor(b);await assert.rejects(rpc("update_customer_profile('Tên khách tự chọn','0385920038','Địa chỉ riêng fixture',2)"),/Account required/);
  });
 } finally {await db.close();}
});
