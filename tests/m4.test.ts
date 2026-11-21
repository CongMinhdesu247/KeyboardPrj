import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";
import {
  issueRequestToken,
  verifyRequestToken,
} from "../src/lib/request-token.ts";
import { safeReferenceUrl, youtubeId } from "../src/lib/m4-contract.ts";

test("M4 signed submission token expiry/tampering and safe media links", () => {
  const now = Date.now(),
    token = issueRequestToken("fixture-secret", now);
  assert.ok(verifyRequestToken(token, "fixture-secret", now));
  assert.equal(verifyRequestToken(token, "other", now), null);
  assert.equal(
    verifyRequestToken(token, "fixture-secret", now + 3601000),
    null,
  );
  assert.equal(
    verifyRequestToken(
      token.replace(/.$/, token.endsWith("a") ? "b" : "a"),
      "fixture-secret",
      now,
    ),
    null,
  );
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/x",
    "https://user:pass@example.com/x",
  ])
    assert.equal(safeReferenceUrl(url), false);
  assert.equal(safeReferenceUrl("https://example.com/keycaps"), true);
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(
    youtubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
    null,
  );
  assert.equal(youtubeId("https://youtube.com/watch?v=evil<script>"), null);
});
test("M4 SQL: private intake, idempotence, quotas, optimistic admin changes, deliberate publication", async (t) => {
  const db = await createTestDatabase(),
    admin = randomUUID(),
    guest = randomUUID();
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
    id: randomUUID(),
    category: "keycap",
    customerName: "Private customer",
    phone: "0901234567",
    budget: 500000,
    referenceUrl: "https://example.com/m4",
    note: "Secret sample",
    hash: "a".repeat(64),
    imagePath: "",
  };
  const pid = randomUUID(),
    portfolio = {
      id: pid,
      version: 0,
      title: "Custom keyboard",
      keyboard: "75% keyboard",
      mods: "Lube",
      description: "Sound test",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      published: false,
      approved: false,
      imagePath: `${pid}/${randomUUID()}.webp`,
    };
  try {
    for (const id of [admin, guest]) {
      const email = `${id}@example.test`;
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
        [id, email],
      );
      await db.query("insert into auth.sessions values($1,$1)", [id]);
      await db.query("insert into auth.identities values($1,'google',$2)", [
        id,
        { email, email_verified: true },
      ]);
    }
    await db.query(
      "insert into public.admin_members(user_id,email) values($1,'m4@example.test')",
      [admin],
    );
    await t.test(
      "anonymous and authenticated guests cannot submit/read direct RPC or private storage",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await actor(role, guest);
          for (const [fn, args] of [
            ["submit_custom_request", [JSON.stringify(p)]],
            ["lookup_request_submission", [p.id, p.hash]],
            ["read_published_portfolio", []],
          ] as [string, unknown[]][])
            await assert.rejects(rpc(fn, args), /permission denied/);
          await assert.rejects(
            rpc("list_custom_requests"),
            /Admin required|permission denied/,
          );
          await assert.rejects(
            rpc("list_portfolio_admin"),
            /Admin required|permission denied/,
          );
          await assert.rejects(
            db.query("select * from private.custom_requests"),
            /permission denied/,
          );
        }
      },
    );
    await t.test(
      "server submission retry is idempotent and different content cannot replace it",
      async () => {
        await actor("service_role");
        assert.equal(
          (
            (await rpc("submit_custom_request", [JSON.stringify(p)])) as {
              ok: boolean;
            }
          ).ok,
          true,
        );
        assert.equal(
          (
            (await rpc("submit_custom_request", [JSON.stringify(p)])) as {
              duplicate: boolean;
            }
          ).duplicate,
          true,
        );
        assert.equal(
          (
            (await rpc("submit_custom_request", [
              JSON.stringify({ ...p, hash: "b".repeat(64) }),
            ])) as { code: string }
          ).code,
          "request_conflict",
        );
        assert.equal(
          await rpc("lookup_request_submission", [p.id, "b".repeat(64)]),
          null,
        );
        assert.ok(await rpc("lookup_request_submission", [p.id, p.hash]));
        for (let i = 0; i < 10; i++)
          assert.equal(
            await rpc("consume_request_budget", ["c".repeat(64)]),
            true,
          );
        assert.equal(
          await rpc("consume_request_budget", ["c".repeat(64)]),
          false,
        );
      },
    );
    await t.test(
      "admin notes/version; no order, deposit or stock changes from requests",
      async () => {
        await actor("authenticated", admin);
        const list = (await rpc("list_custom_requests")) as {
          id: string;
          payload_hash?: string;
        }[];
        assert.equal(list.length, 1);
        assert.equal(list[0].payload_hash, undefined);
        assert.equal(
          (
            (await rpc("update_custom_request", [
              p.id,
              1,
              "contacted",
              "Đã tư vấn",
            ])) as { ok: boolean }
          ).ok,
          true,
        );
        assert.equal(
          (
            (await rpc("update_custom_request", [
              p.id,
              1,
              "done",
              "stale",
            ])) as { code: string }
          ).code,
          "conflict",
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.orders",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.inventory_movements",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      "draft invisible; publish requires explicit approval, hide/archive preserve original data",
      async () => {
        await actor("authenticated", admin);
        assert.equal(
          (
            (await rpc("save_portfolio", [JSON.stringify(portfolio)])) as {
              ok: boolean;
            }
          ).ok,
          true,
        );
        await actor("service_role");
        assert.deepEqual(await rpc("read_published_portfolio"), []);
        await actor("authenticated", admin);
        assert.equal(
          (
            (await rpc("save_portfolio", [
              JSON.stringify({ ...portfolio, version: 1, published: true }),
            ])) as { code: string }
          ).code,
          "approval_required",
        );
        assert.equal(
          (
            (await rpc("save_portfolio", [
              JSON.stringify({
                ...portfolio,
                version: 1,
                published: true,
                approved: true,
              }),
            ])) as { ok: boolean }
          ).ok,
          true,
        );
        await actor("service_role");
        const rows = (await rpc("read_published_portfolio")) as Record<
          string,
          unknown
        >[];
        assert.equal(rows.length, 1);
        assert.equal(rows[0].actor_id, undefined);
        assert.equal(JSON.stringify(rows).includes(p.phone), false);
        await actor("authenticated", admin);
        assert.equal(
          (
            (await rpc("save_portfolio", [
              JSON.stringify({ ...portfolio, version: 2, published: false }),
            ])) as { ok: boolean }
          ).ok,
          true,
        );
        assert.equal(
          (
            (await rpc("save_portfolio", [
              JSON.stringify({ id: pid, version: 3, action: "archive" }),
            ])) as { ok: boolean }
          ).ok,
          true,
        );
        await actor("service_role");
        assert.deepEqual(await rpc("read_published_portfolio"), []);
        assert.ok(await rpc("lookup_request_submission", [p.id, p.hash]));
        await actor("authenticated", admin);
        await db.exec("reset role");
        await db.query("delete from auth.sessions where id=$1", [admin]);
        await actor("authenticated", admin);
        await assert.rejects(
          rpc("save_portfolio", [
            JSON.stringify({ ...portfolio, id: randomUUID() }),
          ]),
          /Admin required/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
