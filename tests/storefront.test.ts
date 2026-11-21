import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseCart } from "../src/lib/cart.ts";
import {
  issueRequestToken,
  verifyRequestToken,
} from "../src/lib/request-token.ts";
import { createTestDatabase } from "./helpers/database.ts";
test("cart stores only bounded IDs/quantities/prices; checkout token cannot be used as a find request", () => {
  assert.deepEqual(parseCart("{}"), []);
  assert.deepEqual(
    parseCart('[{"itemId":"1","quantity":-1,"expectedPrice":100}]'),
    [],
  );
  assert.deepEqual(
    parseCart('[{"itemId":"1","quantity":2,"expectedPrice":100,"cost":999}]'),
    [{ itemId: "1", quantity: 2, expectedPrice: 100 }],
  );
  const token = issueRequestToken("secret", Date.now(), "checkout");
  assert.ok(verifyRequestToken(token, "secret", Date.now(), "checkout"));
  assert.equal(verifyRequestToken(token, "secret"), null);
});
test("guest checkout: authoritative snapshots, private address, retry, stock checks and manual deposit", async (t) => {
  const db = await createTestDatabase(),
    admin = randomUUID(),
    req = randomUUID();
  const actor = async (role: string, id = "") => {
    await db.exec(`reset role;set role ${role}`);
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ session_id: id })],
    );
  };
  const rpc = async (name: string, args: unknown[] = []) =>
    (
      await db.query<{ v: unknown }>(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
        args,
      )
    ).rows[0].v;
  const p = {
    requestId: req,
    hash: "a".repeat(64),
    code: `TK-${"A".repeat(32)}`,
    customerName: "Private Shopper",
    phone: "0901234567",
    delivery: "ship",
    address: "SECRET ADDRESS 123",
    note: "SECRET NOTE",
    plan: "deposit_cod",
    items: [{ itemId: "100", quantity: 2, expectedPrice: 100000 }],
  };
  try {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'admin@test.local',now());",
      [admin],
    );
    await db.query("insert into auth.sessions values($1,$1)", [admin]);
    await db.query("insert into auth.identities values($1,'google',$2)", [
      admin,
      { email: "admin@test.local", email_verified: true },
    ]);
    await db.query(
      "insert into public.admin_members(user_id,email) values($1,'admin@test.local')",
      [admin],
    );
    await db.exec(
      "insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active) overriding system value values(100,'keyboard','Keyboard fixture','product','bộ',100000,2,true),(101,'lube','Service fixture','service','gói',50000,null,true)",
    );
    await t.test(
      "guest cannot call direct checkout RPC or access submissions",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await actor(role);
          await assert.rejects(
            rpc("submit_customer_order", [JSON.stringify(p)]),
            /permission denied/,
          );
          await assert.rejects(
            db.query("select * from private.checkout_submissions"),
            /permission denied/,
          );
        }
      },
    );
    await actor("service_role");
    await t.test(
      "server creates one unpaid order; changing retry content rejected",
      async () => {
        assert.equal(
          (
            (await rpc("submit_customer_order", [JSON.stringify(p)])) as {
              ok: boolean;
            }
          ).ok,
          true,
        );
        assert.deepEqual(
          await rpc("submit_customer_order", [
            JSON.stringify({ ...p, code: `TK-${"B".repeat(32)}` }),
          ]),
          { ok: true, code: p.code },
        );
        assert.equal(
          (
            (await rpc("submit_customer_order", [
              JSON.stringify({ ...p, hash: "b".repeat(64) }),
            ])) as { error: string }
          ).error,
          "request_conflict",
        );
      },
    );
    let id = "";
    await t.test(
      "admin sees address; public sees no address/phone/notes/cost",
      async () => {
        await db.exec("reset role");
        id = (
          await db.query<{ id: string }>(
            "select id from private.orders where code=$1",
            [p.code],
          )
        ).rows[0].id;
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select stock_quantity n from public.products_services where id=100",
            )
          ).rows[0].n,
          2,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.order_payments",
            )
          ).rows[0].n,
          0,
        );
        await actor("authenticated", admin);
        const raw = (await rpc("read_order", [id])) as {
          source: string;
          actor_id: unknown;
          total_vnd: number;
          shipping_address: string;
        };
        assert.equal(raw.source, "web");
        assert.equal(raw.actor_id, null);
        assert.equal(raw.total_vnd, 200000);
        assert.equal(raw.shipping_address, p.address);
        await actor("service_role");
        const dto = await rpc("track_order", [p.code]);
        const text = JSON.stringify(dto);
        for (const v of [p.phone, p.address, p.note, "cost_vnd"])
          assert.equal(text.includes(v), false);
      },
    );
    await t.test(
      "price/quantity/catalogue changes reject new checkout without orphan rows",
      async () => {
        const changed = (items: unknown[]) => ({
          ...p,
          requestId: randomUUID(),
          hash: "c".repeat(64),
          code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,
          items,
        });
        assert.equal(
          (
            (await rpc("submit_customer_order", [
              JSON.stringify(
                changed([{ itemId: "100", quantity: 1, expectedPrice: 1 }]),
              ),
            ])) as { error: string }
          ).error,
          "price_changed",
        );
        assert.equal(
          (
            (await rpc("submit_customer_order", [
              JSON.stringify(
                changed([
                  { itemId: "100", quantity: 3, expectedPrice: 100000 },
                ]),
              ),
            ])) as { error: string }
          ).error,
          "insufficient_stock",
        );
        assert.equal(
          (
            (await rpc("submit_customer_order", [
              JSON.stringify(
                changed([{ itemId: "101", quantity: 1, expectedPrice: 50000 }]),
              ),
            ])) as { error: string }
          ).error,
          "keyboard_required",
        );
        await db.exec(
          "reset role;update public.products_services set stock_quantity=1 where id=100;",
        );
        await actor("service_role");
        assert.equal(
          (
            (await rpc("track_order", [p.code])) as {
              payment: { available: boolean };
            }
          ).payment.available,
          false,
        );
        await db.exec(
          "reset role;update public.products_services set stock_quantity=2,price_vnd=200000 where id=100;",
        );
        await actor("service_role");
        assert.equal(
          (
            (await rpc("track_order", [p.code])) as {
              payment: { available: boolean };
            }
          ).payment.available,
          true,
        );
      },
    );
    await t.test(
      "only admin's receipt deducts stock once against original price",
      async () => {
        await actor("authenticated", admin);
        const pay = {
          action: "receipt",
          requestId: randomUUID(),
          orderId: id,
          amount: 40000,
          method: "bank",
          reference: "BANK CONFIRMED",
        };
        assert.equal(
          (
            (await rpc("order_command", [JSON.stringify(pay)])) as {
              ok: boolean;
            }
          ).ok,
          true,
        );
        assert.equal(
          (
            (await rpc("order_command", [JSON.stringify(pay)])) as {
              ok: boolean;
            }
          ).ok,
          true,
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select stock_quantity n from public.products_services where id=100",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.order_payments",
            )
          ).rows[0].n,
          1,
        );
      },
    );
  } finally {
    await db.close();
  }
});
