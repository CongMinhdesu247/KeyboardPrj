import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";
import { normalizeOrderCode } from "../src/lib/tracking.ts";
import { validVideoUrl } from "../src/lib/order-contract.ts";

test("M3: atomic receipts, snapshots, stages, cancellation, refunds and private capability", async (t) => {
  const db = await createTestDatabase();
  const admin = randomUUID(),
    guest = randomUUID();
  const setActor = async (role: string, id = "") => {
    await db.exec(`reset role; set role ${role}`);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ session_id: id })],
    );
  };
  const command = async (p: Record<string, unknown>) =>
    (
      await db.query<{ v: { ok: boolean; id: string; code?: string } }>(
        "select public.order_command($1) v",
        [JSON.stringify(p)],
      )
    ).rows[0].v;
  const scalar = async (sql: string) =>
    (await db.query<Record<string, unknown>>(sql)).rows[0].v;
  try {
    for (const id of [admin, guest]) {
      const email = `${id}@example.test`;
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now());",
        [id, email],
      );
      await db.query("insert into auth.sessions values($1,$1)", [id]);
      await db.query("insert into auth.identities values($1,'google',$2)", [
        id,
        { email, email_verified: true },
      ]);
    }
    await db.query(
      "insert into public.admin_members(user_id,email) values($1,'admin@example.test')",
      [admin],
    );
    await db.exec(
      "insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active) overriding system value values(100,'keycap','Test keycap','product','bộ',100003,3,true),(101,'stab','Test stab','product','bộ',50000,0,true),(102,'lube','Test lube','service','gói',20000,null,true)",
    );
    await setActor("authenticated", admin);
    const create = (items: unknown[], plan = "deposit_cod") => ({
      action: "create",
      requestId: randomUUID(),
      code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,
      customerName: "Nguyễn Văn Test",
      phone: "0901234567",
      keyboard: "Keyboard fixture",
      internalNote: "SECRET NOTE",
      plan,
      items,
    });
    const p = create([
      { itemId: "100", quantity: 1, version: 1 },
      { itemId: "102", quantity: 1, version: 1 },
    ]);
    const order = await command(p);
    assert.equal(order.ok, true);
    await t.test(
      "create retry and snapshot; no stock deduction before deposit",
      async () => {
        assert.equal(
          (await command({ ...p, code: `TK-${"F".repeat(32)}` })).id,
          order.id,
        );
        assert.equal(
          await scalar(
            "select stock_quantity v from public.products_services where id=100",
          ),
          3,
        );
        assert.equal(
          (await command({ ...p, keyboard: "other" })).code,
          "request_conflict",
        );
        await db.exec(
          "reset role; update public.products_services set price_vnd=999999,version=version+1 where id=100;",
        );
        await setActor("authenticated", admin);
        const raw = await db.query<{
          v: {
            total_vnd: number;
            deposit_vnd: number;
            items: { price_vnd: number }[];
          };
        }>("select public.read_order($1) v", [order.id]);
        assert.equal(raw.rows[0].v.total_vnd, 120003);
        assert.equal(raw.rows[0].v.deposit_vnd, 24001);
        assert.equal(raw.rows[0].v.items[0].price_vnd, 100003);
      },
    );
    const receipt = {
      action: "receipt",
      requestId: randomUUID(),
      orderId: order.id,
      amount: 24001,
      method: "bank",
      reference: "test-bank",
    };
    await t.test(
      "deposit required, exact payment, idempotent deduction, stale stage blocked",
      async () => {
        assert.equal(
          (
            await command({
              action: "advance",
              requestId: randomUUID(),
              orderId: order.id,
              expectedStage: 0,
            })
          ).code,
          "deposit_required",
        );
        assert.equal(
          (await command({ ...receipt, amount: 24000 })).code,
          "payment_rule",
        );
        assert.equal((await command(receipt)).ok, true);
        assert.equal((await command(receipt)).ok, true);
        assert.equal(
          await scalar(
            "select stock_quantity v from public.products_services where id=100",
          ),
          2,
        );
        assert.equal(
          (
            await command({
              action: "advance",
              requestId: randomUUID(),
              orderId: order.id,
              expectedStage: 0,
              note: "Đang làm",
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await command({
              action: "advance",
              requestId: randomUUID(),
              orderId: order.id,
              expectedStage: 0,
            })
          ).code,
          "stage_conflict",
        );
        assert.equal(
          (
            await command({
              ...receipt,
              requestId: randomUUID(),
              amount: 96002,
              method: "cod",
            })
          ).code,
          "payment_rule",
        );
      },
    );
    await t.test(
      "multi-item stock failure leaves money and ALL inventory unchanged",
      async () => {
        const q = await command(
          create([
            { itemId: "100", quantity: 1, version: 3 },
            { itemId: "101", quantity: 1, version: 1 },
          ]),
        );
        assert.equal(q.ok, true);
        const failure = await command({
          action: "receipt",
          orderId: q.id,
          requestId: randomUUID(),
          amount: 210000,
          method: "bank",
          reference: "attempt",
        });
        assert.equal(failure.code, "insufficient_stock");
        assert.equal(
          await scalar(
            "select stock_quantity v from public.products_services where id=100",
          ),
          2,
        );
        await db.exec("reset role");
        assert.equal(
          await scalar(
            `select count(*)::int v from private.order_payments where order_id='${q.id}'`,
          ),
          0,
        );
        await setActor("authenticated", admin);
      },
    );
    await t.test(
      "cancellation returns only explicitly recovered shop parts and cannot double return",
      async () => {
        const cancel = {
          action: "cancel",
          requestId: randomUUID(),
          orderId: order.id,
          reason: "Customer cancelled",
          returns: { 100: 1 },
        };
        assert.equal(
          (await command({ ...cancel, returns: { 100: 2 } })).code,
          "invalid_returns",
        );
        assert.equal((await command(cancel)).ok, true);
        assert.equal((await command(cancel)).ok, true);
        assert.equal(
          await scalar(
            "select stock_quantity v from public.products_services where id=100",
          ),
          3,
        );
        assert.equal(
          (
            await command({
              action: "refund",
              requestId: randomUUID(),
              orderId: order.id,
              amount: 1,
              method: "bank",
              reference: "attempt",
            })
          ).code,
          "refund_rule",
        );
        assert.equal(
          (
            await command({
              action: "advance",
              requestId: randomUUID(),
              orderId: order.id,
              expectedStage: 1,
            })
          ).code,
          "cancelled",
        );
      },
    );
    await t.test(
      "full payment cancellation retains 20 percent; refund is append-only",
      async () => {
        const q = await command(
          create([{ itemId: "102", quantity: 1, version: 1 }], "transfer_full"),
        );
        assert.equal(q.ok, true);
        assert.equal(
          (
            await command({
              action: "receipt",
              orderId: q.id,
              requestId: randomUUID(),
              amount: 20000,
              method: "bank",
              reference: "full",
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await command({
              action: "cancel",
              orderId: q.id,
              requestId: randomUUID(),
              reason: "Cancelled",
              returns: {},
            })
          ).ok,
          true,
        );
        const refund = {
          action: "refund",
          orderId: q.id,
          requestId: randomUUID(),
          amount: 16000,
          method: "bank",
          reference: "refund",
        };
        assert.equal((await command(refund)).ok, true);
        assert.equal((await command(refund)).ok, true);
        assert.equal(
          (await command({ ...refund, requestId: randomUUID(), amount: 1 }))
            .code,
          "refund_rule",
        );
      },
    );
    await t.test(
      "COD recognized only after completion; proof validates stage and host",
      async () => {
        const q = await command(
          create([{ itemId: "102", quantity: 1, version: 1 }]),
        );
        assert.equal(
          (
            await command({
              action: "receipt",
              orderId: q.id,
              requestId: randomUUID(),
              amount: 4000,
              method: "bank",
              reference: "deposit",
            })
          ).ok,
          true,
        );
        assert.equal(
          (
            await command({
              action: "proof",
              orderId: q.id,
              requestId: randomUUID(),
              stage: 2,
              note: "bad",
            })
          ).code,
          "stage_conflict",
        );
        assert.equal(
          (
            await command({
              action: "proof",
              orderId: q.id,
              requestId: randomUUID(),
              stage: 0,
              note: "bad",
              videoUrl: "https://youtube.com.evil.test/watch",
            })
          ).code,
          "invalid_media",
        );
        for (const stage of [0, 1])
          assert.equal(
            (
              await command({
                action: "advance",
                orderId: q.id,
                requestId: randomUUID(),
                expectedStage: stage,
              })
            ).ok,
            true,
          );
        assert.equal(
          (
            await command({
              action: "cancel",
              orderId: q.id,
              requestId: randomUUID(),
              reason: "bad",
              returns: {},
            })
          ).code,
          "cancel_rule",
        );
        const pay = {
          action: "receipt",
          orderId: q.id,
          requestId: randomUUID(),
          amount: 16000,
          method: "cod",
          reference: "courier remittance",
        };
        assert.equal((await command(pay)).ok, true);
        assert.equal(
          (await command({ ...pay, requestId: randomUUID() })).ok,
          false,
        );
      },
    );
    await t.test(
      "guest/anon cannot read orders or tracking RPC; capability DTO masks identity",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await setActor(role, guest);
          await assert.rejects(
            db.query("select public.track_order($1)", [p.code]),
            /permission denied/,
          );
          await assert.rejects(
            db.query("select * from private.orders"),
            /permission denied/,
          );
        }
        await assert.rejects(
          command({ ...receipt, requestId: randomUUID() }),
          /Admin required/,
        );
        await setActor("service_role");
        const dto = (
          await db.query<{ v: Record<string, unknown> }>(
            "select public.track_order($1) v",
            [p.code],
          )
        ).rows[0].v;
        assert.equal(dto.customerPhoneMasked, "*******567");
        assert.equal(dto.cancelled, true);
        const payment = dto.payment as {
          reference: string;
          received: number;
          total: number;
        };
        assert.match(payment.reference, /^TK\d{10}$/);
        assert.equal(payment.received, 24001);
        assert.equal(payment.total, 120003);
        assert.equal(
          (
            await db.query<{ v: unknown }>("select public.track_order($1) v", [
              payment.reference,
            ])
          ).rows[0].v,
          null,
          "Bank reference is not a tracking capability",
        );
        const serialized = JSON.stringify(dto);
        for (const secret of [
          "0901234567",
          "SECRET NOTE",
          "Nguyễn Văn Test",
          "cost_vnd",
          "price_vnd",
        ])
          assert.equal(serialized.includes(secret), false);
        assert.equal(
          (
            await db.query<{ v: unknown }>(
              "select public.track_order('TK-00000000000000000000000000000000') v",
            )
          ).rows[0].v,
          null,
        );
      },
    );
  } finally {
    await db.close();
  }
});
test("M3 code and external video allowlist", () => {
  assert.equal(
    normalizeOrderCode(` tk-${"a".repeat(32)} `),
    `TK-${"A".repeat(32)}`,
  );
  assert.equal(normalizeOrderCode("TK-1234"), null);
  for (const u of [
    "https://youtube.com.evil.com/a",
    "javascript:alert(1)",
    "https://user@youtube.com/watch?v=a",
    "http://youtu.be/a",
  ])
    assert.equal(validVideoUrl(u), false);
  assert.equal(validVideoUrl("https://youtu.be/abc"), true);
});
