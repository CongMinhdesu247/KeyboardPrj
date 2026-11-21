import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validCatalogMp4 } from "../src/lib/catalog-media.ts";
import { createTestDatabase } from "./helpers/database.ts";

test("catalog MP4 checks bounded boxes rather than accepting renamed files", () => {
  const box = (name: string, data: Buffer) => { const head=Buffer.alloc(8); head.writeUInt32BE(data.length+8); head.write(name,4); return Buffer.concat([head,data]); };
  const ftyp=box("ftyp",Buffer.from("isom0000isom"));
  const valid=Buffer.concat([ftyp,box("moov",Buffer.alloc(8)),box("mdat",Buffer.alloc(8))]);
  assert.equal(validCatalogMp4(valid),true);
  assert.equal(validCatalogMp4(ftyp),false);
  assert.equal(validCatalogMp4(Buffer.from("not a video")),false);
  assert.equal(validCatalogMp4(valid.subarray(0,-1)),false);
  assert.equal(validCatalogMp4(Buffer.alloc(10*1024*1024+1)),false);
  const corrupt=Buffer.from(valid); corrupt.writeUInt32BE(0xffffffff,ftyp.length);
  assert.equal(validCatalogMp4(corrupt),false);
});

test("catalog gallery: authorization, cover compatibility, concurrent edits and business data",async () => {
  const db=await createTestDatabase(), admin=randomUUID(), guest=randomUUID();
  const a=`${randomUUID()}.webp`, b=`${randomUUID()}.webp`, c=`${randomUUID()}.webp`, video=`${randomUUID()}.mp4`;
  const actor=async(role:string,id="") => { await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({session_id:id})]); };
  const change=async(version:number,images:string[],path="",url="") => (await db.query<{v:{ok:boolean;code?:string;version:number}}>("select public.set_catalog_media(100,$1,$2,$3,$4) v",[version,images,path,url])).rows[0].v;
  try {
    for(const id of [admin,guest]) {
      const email=`${id}@example.test`;
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,email]);
      await db.query("insert into auth.sessions values($1,$1)",[id]);
      await db.query("insert into auth.identities values($1,'google',$2)",[id,{email,email_verified:true}]);
    }
    await db.query("insert into public.admin_members(user_id,email) values($1,'admin@example.test')",[admin]);
    await db.query("insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active,image_path) overriding system value values(100,'keycap','Gallery fixture','product','bộ',90000,7,true,$1)",[a]);
    // Existing covers migrate/synchronize without needing a new upload.
    assert.deepEqual((await db.query<{image_paths:string[]}>("select image_paths from public.products_services where id=100")).rows[0].image_paths,[a]);
    await actor("anon"); await assert.rejects(change(1,[a,b]),/permission denied/);
    await actor("authenticated",guest);await assert.rejects(change(1,[a,b]),/Admin required/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('catalog-videos',$1)",[video]),/row-level security/);
    await actor("authenticated",admin);
    assert.equal((await change(1,[a,b])).code,"invalid_media");
    for(const path of [b,c]) await db.query("insert into storage.objects(bucket_id,name) values('catalog-images',$1)",[path]);
    await db.query("insert into storage.objects(bucket_id,name) values('catalog-videos',$1)",[video]);
    assert.equal((await change(1,[a,a])).code,"invalid_media");
    assert.equal((await change(1,["../private.webp"])).code,"invalid_media");
    assert.equal((await change(1,Array.from({length:11},()=>`${randomUUID()}.webp`))).code,"invalid_media");
    const added=await change(1,[a,b,c],video);assert.equal(added.ok,true);
    assert.equal((await change(1,[a,b,c],video)).ok,true,"retry is idempotent");
    assert.equal((await change(1,[b,a,c],video)).code,"conflict");
    const reordered=await change(added.version,[b,a,c],video);assert.equal(reordered.ok,true);
    const business=(await db.query("select image_path,price_vnd,stock_quantity from public.products_services where id=100")).rows[0];
    assert.deepEqual(business,{image_path:b,price_vnd:90000,stock_quantity:7});
    assert.equal((await change(reordered.version,[b,a,c],video,"https://youtu.be/example")).code,"invalid_media");
    assert.equal((await change(reordered.version,[b,a,c],"","https://evil.example/video")).code,"invalid_media");
    const linked=await change(reordered.version,[b,a,c],"","https://youtu.be/example");assert.equal(linked.ok,true);
    // Legacy cover editor removes/replaces only the cover and preserves other angles.
    await db.exec("reset role");await db.query("update public.products_services set image_path=null where id=100");
    assert.deepEqual((await db.query("select image_path,image_paths,video_path from public.products_services where id=100")).rows[0],{image_path:a,image_paths:[a,c],video_path:null});
    await actor("authenticated",admin);
    await db.exec("reset role;delete from auth.sessions");await actor("authenticated",admin);
    await assert.rejects(change(linked.version,[a,c]),/Admin required/);
  } finally { await db.close(); }
});
