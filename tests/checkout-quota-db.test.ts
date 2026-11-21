import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";

test("direct authenticated checkout RPC cannot bypass account/global quota; retry stays idempotent", async () => {
  const db = await createTestDatabase(), id = randomUUID();
  try {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'quota@example.test',now())", [id]);
    await db.query("insert into auth.sessions values($1,$1)", [id]);
    await db.query("insert into auth.identities values($1,'google',$2)", [id, { email: "quota@example.test", email_verified: true }]);
    await db.exec("insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active) overriding system value values(901,'keyboard','Quota fixture','product','bộ',100000,99,true)");
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [id, JSON.stringify({session_id:id})]);
    const payload = () => ({ requestId: randomUUID(), hash: randomBytes(32).toString("hex"), code: `TK-${randomBytes(16).toString("hex").toUpperCase()}`, customerName: "Fixture", phone: "0901234567", delivery: "pickup", plan: "deposit_cod", items: [{itemId:"901",quantity:1,expectedPrice:100000}] });
    const submit = async (p: ReturnType<typeof payload>) => (await db.query<{v:{ok?:boolean;error?:string}}>("select public.submit_account_order($1) v", [p])).rows[0].v;
    const first = payload();
    assert.equal((await submit(first)).ok, true);
    for (let i=1;i<10;i++) assert.equal((await submit(payload())).ok, true);
    assert.deepEqual(await submit(payload()), {ok:false,error:"quota"});
    assert.equal((await submit(first)).ok, true);
    await db.exec("reset role");
    assert.equal((await db.query<{n:number}>("select count(*)::int n from private.orders")).rows[0].n, 10);
    assert.equal((await db.query<{hits:number}>("select hits from private.request_budgets where bucket='global'")).rows[0].hits, 10);
    // A new account also cannot bypass the persistent global ceiling.
    await db.exec("update private.request_budgets set hits=100 where bucket='global'; delete from private.request_budgets where bucket<>'global'");
    await db.exec("set role authenticated");
    assert.deepEqual(await submit(payload()), {ok:false,error:"quota"});
  } finally { await db.close(); }
});
