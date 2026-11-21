import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";
import type { AdminInbox } from "../src/lib/inbox-contract.ts";

test("admin inbox: isolated receipts, unread counts, bounded pages, revoked sessions and Telegram independence", async () => {
  const db = await createTestDatabase();
  const [first, second, customer] = [randomUUID(), randomUUID(), randomUUID()];
  const events = Array.from({ length: 24 }, () => randomUUID());
  async function actor(id: string) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)", [id, JSON.stringify({ session_id: id })]);
  }
  async function inbox(limit = 20, offset = 0, unread = false) {
    return (await db.query<{ v: AdminInbox }>("select public.admin_inbox($1,$2,$3) v", [limit, offset, unread])).rows[0].v;
  }
  try {
    for (const id of [first, second, customer]) {
      const email = `${id}@example.test`;
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, email]);
      await db.query("insert into auth.identities values($1,'google',$2)", [id, { email, email_verified: true }]);
      await db.query("insert into auth.sessions values($1,$1)", [id]);
    }
    for (const id of [first, second]) await db.query("insert into public.admin_members(user_id,email) values($1,$2)", [id, `${id}@example.test`]);
    for (let i = 0; i < events.length; i++) await db.query("insert into private.notification_outbox(id,event_key,event_type,entity_id,created_at,sent_at) values($1,($1::uuid)::text,'order_created',$2,now()-make_interval(secs=>$3),case when $3::integer%2=0 then now() else null end)", [events[i], randomUUID(), i]);
    await db.exec("set role anon");
    await assert.rejects(inbox(), /permission denied/);
    await assert.rejects(db.query("select public.read_admin_notifications($1::uuid[])", [[events[0]]]), /permission denied/);
    await actor(customer); await assert.rejects(inbox(), /Admin required/);
    await assert.rejects(db.query("select public.read_admin_notifications($1::uuid[])", [[events[0]]]), /Admin required/);
    await actor(first);
    await assert.rejects(db.exec("select * from private.admin_notification_reads"), /permission denied/);
    let data = await inbox();
    assert.equal(data.unread, 24); assert.equal(data.total, 24); assert.equal(data.items.length, 20);
    assert.equal(data.items[0].id, events[0]);
    assert.deepEqual(Object.keys(data.items[0]).sort(), ["created_at", "entity_id", "event_type", "id", "read_at"]);
    assert.equal((await inbox(20, 20)).items.length, 4);
    await assert.rejects(inbox(51), /Invalid inbox pagination/);
    await assert.rejects(inbox(20, -1), /Invalid inbox pagination/);
    await assert.rejects(db.query("select public.read_admin_notifications()"), /Invalid read request/);
    await assert.rejects(db.query("select public.read_admin_notifications(null,now()+interval '1 hour')"), /Invalid read request/);
    await assert.rejects(db.query("select public.read_admin_notifications($1::uuid[])", [Array(51).fill(events[0])]), /Invalid read request/);
    const readOne = async () => (await db.query<{ n: number }>("select public.read_admin_notifications($1::uuid[]) n", [[events[0]]])).rows[0].n;
    assert.equal(await readOne(), 1); assert.equal(await readOne(), 0);
    data = await inbox(); assert.equal(data.unread, 23); assert.ok(data.items[0].read_at);
    assert.equal((await inbox(20, 0, true)).total, 23);
    assert.ok((await inbox(20, 0, true)).items.every(item => !item.read_at));
    await actor(second); assert.equal((await inbox()).unread, 24);
    await actor(first); const watermark = (await inbox()).snapshot_at;
    await db.exec("reset role");
    const newer = randomUUID();
    await db.query("insert into private.notification_outbox(id,event_key,event_type,entity_id) values($1,($1::uuid)::text,'chat_handoff',$2)", [newer, randomUUID()]);
    await actor(first); await db.query("select public.read_admin_notifications(null,$1)", [watermark]);
    data = await inbox(20, 0, true); assert.equal(data.unread, 1); assert.equal(data.items[0].id, newer);
    await actor(second); assert.equal((await inbox()).unread, 25);
    await db.exec("reset role");
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from private.notification_outbox where attempts=0 and sent_at is not null")).rows[0].n, 12, "reads do not send/retry Telegram");
    await db.query("update public.admin_members set active=false where user_id=$1", [first]);
    await actor(first); await assert.rejects(inbox(), /Admin required/);
    await assert.rejects(readOne(), /Admin required/);
    await db.exec("reset role"); await db.query("delete from auth.sessions where user_id=$1", [second]);
    await actor(second); await assert.rejects(inbox(), /Admin required/);
    await assert.rejects(db.query("select public.read_admin_notifications($1::uuid[])", [[events[0]]]), /Admin required/);
  } finally { await db.close(); }
});

