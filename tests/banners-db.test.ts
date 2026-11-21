import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createTestDatabase} from "./helpers/database.ts";
test("home banners: five slots, admin-only edits, public visibility and concurrency guard",async()=>{
 const db=await createTestDatabase(),admin=randomUUID(),guest=randomUUID(),image=`${randomUUID()}.webp`;
 const actor=async(id:string,role="authenticated")=>{await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({session_id:id})]);};
 const save=async(slot=1,version=1,title="Fixture banner",path=image,active=true,clear=false)=> (await db.query<{v:{ok:boolean;code?:string;version:number}}>("select public.save_home_banner($1,$2,$3,'Subtitle',$4,100,$5,$6) v",[slot,version,title,path,active,clear])).rows[0].v;
 try {
  for(const id of [admin,guest]){const email=`${id}@example.test`;await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,email]);await db.query("insert into auth.sessions values($1,$1)",[id]);await db.query("insert into auth.identities values($1,'google',$2)",[id,{email,email_verified:true}]);}
  await db.query("insert into public.admin_members(user_id,email) values($1,'banner-admin@example.test')",[admin]);
  await db.exec("insert into public.products_services(id,category_slug,name,type,unit,price_vnd,active) overriding system value values(100,'lube','Banner service fixture','service','gói',50000,true)");
  assert.equal((await db.query<{n:number}>("select count(*)::int n from public.home_banners")).rows[0].n,5);
  await assert.rejects(db.exec("insert into public.home_banners(slot) values(6)"),/check constraint/);
  await actor("","anon");assert.equal((await db.query("select slot from public.home_banners")).rows.length,0);await assert.rejects(save(),/permission denied/);
  await actor(guest);await assert.rejects(save(),/Admin required/);await assert.rejects(db.exec("update public.home_banners set active=true where slot=1"),/permission denied/);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('home-banners',$1)",[image]),/row-level security/);
  await actor(admin);assert.equal((await db.query("select slot from public.home_banners")).rows.length,5);
  assert.equal((await save(6)).code,"invalid_slot");assert.equal((await save(1,1,"",image,true)).code,"incomplete");assert.equal((await save()).code,"invalid_image");assert.equal((await save(1,1,"Fixture","../private.webp")).code,"invalid_input");
  await db.query("insert into storage.objects(bucket_id,name) values('home-banners',$1)",[image]);
  const first=await save();assert.equal(first.ok,true);assert.equal((await save()).ok,true,"retry identical contents");assert.equal((await save(1,1,"Stale write")).code,"conflict");
  for(let slot=2;slot<=5;slot++)assert.equal((await save(slot)).ok,true);
  await actor("","anon");assert.equal((await db.query("select slot,title from public.home_banners order by slot")).rows.length,5);await assert.rejects(db.exec("select updated_by from public.home_banners"),/permission denied/);
  await db.exec("reset role;update public.products_services set active=false where id=100");await actor("","anon");assert.equal((await db.query("select slot from public.home_banners")).rows.length,0,"hidden product hides all related banners");
  await actor(admin);assert.equal((await save(2,2,"Fixture banner",image,false)).ok,true,"admin can hide a banner linked to a hidden product");
  await db.exec("reset role;update public.products_services set active=true where id=100");await actor(admin);
  const hidden=await save(1,first.version,"Fixture banner",image,false);assert.equal(hidden.ok,true);await actor("","anon");assert.equal((await db.query("select slot from public.home_banners")).rows.length,3);
  await actor(admin);assert.equal((await save(1,hidden.version,"",image,false,true)).ok,true);assert.equal((await db.query<{title:string}>("select title from public.home_banners where slot=1")).rows[0].title,"");
  await db.exec("reset role;delete from auth.sessions");await actor(admin);await assert.rejects(save(2,2,"Revoked"),/Admin required/);
 }finally{await db.close();}
});
