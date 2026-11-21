import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./helpers/database.ts";
import {
  chatHash,
  newChatToken,
  consultationOpen,
  redactForAI,
  type ChatTurn,
} from "../src/lib/chat-contract.ts";
import {
  geminiReply,
  sendTelegram,
  notificationText,
  type Notification,
} from "../src/lib/integrations.ts";
import {
  issueRequestToken,
  verifyRequestToken,
} from "../src/lib/request-token.ts";
test("M5 scoped tokens, Vietnam business hours and provider PII reduction", () => {
  const token = issueRequestToken("test", undefined, "chat");
  assert.ok(verifyRequestToken(token, "test", Date.now(), "chat"));
  assert.equal(verifyRequestToken(token, "test"), null);
  assert.equal(verifyRequestToken(token, "test", Date.now(), "checkout"), null);
  assert.equal(consultationOpen(new Date("2026-11-19T00:59:00Z")), false);
  assert.equal(consultationOpen(new Date("2026-11-19T01:00:00Z")), true);
  assert.equal(consultationOpen(new Date("2026-11-19T15:00:00Z")), false);
  const t = newChatToken();
  assert.equal(t.length, 64);
  assert.notEqual(chatHash(t), t);
  assert.equal(chatHash("x"), null);
  assert.doesNotMatch(
    redactForAI("mail@example.com 0901234567 TK-" + "A".repeat(32)),
    /mail@example|0901234567|TK-/,
  );
});
test("Gemini adapter: bounded public context, no tools, failures and unsafe response fall back", async () => {
  const env = {
    GEMINI_ENABLED: "true",
    GEMINI_API_KEY: "synthetic-secret",
    GEMINI_MODEL: "model-fixture",
  };
  const history = [
    {
      id: randomUUID(),
      customer: "Lube? contact mail@example.com",
      assistant: null,
      mode: null,
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  ] as ChatTurn[];
  let called = 0;
  const http = (async (url: unknown, init: RequestInit) => {
    called++;
    assert.match(String(url), /generativelanguage.googleapis.com/);
    const b = JSON.parse(String(init.body));
    assert.equal(b.tools, undefined);
    assert.equal(b.generationConfig.maxOutputTokens, 512);
    assert.doesNotMatch(JSON.stringify(b), /mail@example|synthetic-secret/);
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: "Shop có lube, vui lòng chọn gói ở Cửa hàng." }],
          },
        },
      ],
    });
  }) as typeof fetch;
  assert.equal((await geminiReply(env, [], history, http)).mode, "ai");
  for (const response of [
    Response.json({ error: {} }, { status: 429 }),
    Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: "Chuyển https://bad.example" }] },
        },
      ],
    }),
    Response.json({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [{ text: "partial" }] },
        },
      ],
    }),
  ])
    assert.equal(
      (
        await geminiReply(
          env,
          [],
          history,
          (async () => response) as typeof fetch,
        )
      ).mode,
      "fallback",
    );
  assert.equal(
    (
      await geminiReply(env, [], history, (async () => {
        throw new Error("timeout");
      }) as typeof fetch)
    ).mode,
    "fallback",
  );
  assert.equal((await geminiReply({}, [], history, http)).mode, "fallback");
  assert.equal(called, 1);
});
test("Telegram adapter: plain minimal admin reference, provider retry_after, no secrets in content", async () => {
  const env = {
    TELEGRAM_ENABLED: "true",
    TELEGRAM_BOT_TOKEN: "123:synthetic",
    TELEGRAM_ADMIN_CHAT_ID: "-123",
    APP_ORIGIN: "http://localhost:3000",
  };
  const n: Notification = {
    id: randomUUID(),
    entityId: randomUUID(),
    lease: randomUUID(),
    event: "order_created",
    attempt: 1,
  };
  assert.match(notificationText(n, env.APP_ORIGIN), /\/admin\/orders\//);
  assert.doesNotMatch(
    notificationText(n, env.APP_ORIGIN),
    /TK-|phone|synthetic/,
  );
  const success = (async (_url: unknown, init: RequestInit) => {
    const b = JSON.parse(String(init.body));
    assert.equal(b.chat_id, "-123");
    assert.equal(b.parse_mode, undefined);
    assert.equal(b.protect_content, true);
    return Response.json({ ok: true });
  }) as typeof fetch;
  assert.equal((await sendTelegram(env, n, success)).error, null);
  assert.deepEqual(
    await sendTelegram(env, n, (async () =>
      Response.json(
        { ok: false, error_code: 429, parameters: { retry_after: 240 } },
        { status: 429 },
      )) as typeof fetch),
    { error: "rate_limit", retry: 240 },
  );
  assert.equal(
    (
      await sendTelegram(env, n, (async () => {
        throw new Error("secret url");
      }) as typeof fetch)
    ).error,
    "network",
  );
});
test("M5 SQL: private sessions, durable turns, quotas, atomic outbox, fenced retries and admin authorization", async (t) => {
  const db = await createTestDatabase(),
    hash = chatHash(newChatToken())!,
    other = chatHash(newChatToken())!,
    turn = randomUUID();
  const rpc = async (name: string, args: unknown[] = []) =>
    (
      await db.query<{ v: unknown }>(
        `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) v`,
        args,
      )
    ).rows[0].v as Record<string, unknown>;
  try {
    await t.test(
      "no guest direct RPC/table access and non-admin cannot read history",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`set role ${role}`);
          await assert.rejects(
            rpc("chat_history", [hash]),
            /permission denied/,
          );
          await assert.rejects(
            rpc("begin_chat", [hash, turn, "hello"]),
            /permission denied/,
          );
          await assert.rejects(rpc("claim_notifications"), /permission denied/);
          await assert.rejects(
            db.query("select * from private.chat_turns"),
            /permission denied/,
          );
          if (role === "authenticated")
            await assert.rejects(rpc("admin_chat"), /forbidden/);
          await db.exec("reset role");
        }
      },
    );
    await db.exec("set role service_role");
    await t.test(
      "turn retries do not call model twice, wrong session/lease cannot read or finalize",
      async () => {
        const started = await rpc("begin_chat", [
          hash,
          turn,
          "PRIVATE QUESTION",
        ]);
        assert.ok(started.lease);
        assert.equal(
          (await rpc("begin_chat", [hash, turn, "PRIVATE QUESTION"])).error,
          "busy",
        );
        assert.equal(
          (await rpc("begin_chat", [hash, turn, "changed"])).error,
          "conflict",
        );
        assert.deepEqual(await rpc("chat_history", [other]), []);
        assert.equal(
          await rpc("finish_chat", [
            other,
            turn,
            started.lease,
            "stolen",
            "ai",
          ]),
          false,
        );
        assert.equal(
          await rpc("finish_chat", [
            hash,
            turn,
            randomUUID(),
            "wrong lease",
            "ai",
          ]),
          false,
        );
        assert.equal(
          await rpc("finish_chat", [
            hash,
            turn,
            started.lease,
            "ANSWER",
            "fallback",
          ]),
          true,
        );
        assert.equal(
          (await rpc("begin_chat", [hash, turn, "PRIVATE QUESTION"])).done,
          true,
        );
        assert.equal(
          (await rpc("begin_chat", [other, turn, "PRIVATE QUESTION"])).error,
          "conflict",
        );
        assert.equal(await rpc("handoff_chat", [hash]), true);
        assert.equal(await rpc("handoff_chat", [hash]), false);
      },
    );
    await t.test(
      "outbox contains reference only and claims are exclusive/fenced",
      async () => {
        const first = (await rpc(
          "claim_notifications",
        )) as unknown as Notification[];
        assert.equal(first.length, 1);
        assert.equal(first[0].event, "chat_handoff");
        assert.doesNotMatch(
          JSON.stringify(first),
          /PRIVATE QUESTION|ANSWER|token_hash/,
        );
        assert.deepEqual(await rpc("claim_notifications"), []);
        assert.equal(
          await rpc("finish_notification", [
            first[0].id,
            randomUUID(),
            null,
            60,
          ]),
          false,
        );
        assert.equal(
          await rpc("finish_notification", [
            first[0].id,
            first[0].lease,
            "network",
            60,
          ]),
          true,
        );
        assert.deepEqual(await rpc("claim_notifications"), []);
        await db.exec(
          "reset role;update private.notification_outbox set next_attempt_at=now()-interval '1 second';set role service_role",
        );
        const retry = (await rpc(
          "claim_notifications",
        )) as unknown as Notification[];
        assert.equal(retry[0].attempt, 2);
        assert.notEqual(retry[0].lease, first[0].lease);
        assert.equal(
          await rpc("finish_notification", [
            retry[0].id,
            first[0].lease,
            null,
            60,
          ]),
          false,
        );
        assert.equal(
          await rpc("finish_notification", [
            retry[0].id,
            retry[0].lease,
            null,
            60,
          ]),
          true,
        );
      },
    );
    await t.test(
      "expired lease resolves as fallback without rebilling and hourly/global quotas enforce",
      async () => {
        const tid = randomUUID();
        await rpc("begin_chat", [hash, tid, "crashed"]);
        await db.exec("reset role");
        await db.query(
          "update private.chat_turns set lease_until=now()-interval '1 second' where id=$1",
          [tid],
        );
        await db.exec("set role service_role");
        assert.equal(
          (await rpc("begin_chat", [hash, tid, "crashed"])).done,
          true,
        );
        for (let i = 0; i < 18; i++) {
          const id = randomUUID(),
            r = await rpc("begin_chat", [hash, id, "q" + i]);
          assert.ok(r.lease);
          await rpc("finish_chat", [hash, id, r.lease, "fallback", "fallback"]);
        }
        assert.equal(
          (await rpc("begin_chat", [hash, randomUUID(), "over"])).error,
          "quota",
        );
        await db.exec(
          "reset role;update private.chat_budgets set turns=200;set role service_role",
        );
        assert.equal(
          (await rpc("begin_chat", [other, randomUUID(), "global"])).error,
          "quota",
        );
        await db.exec("reset role");
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.chat_sessions where token_hash=$1",
              [other],
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await db.exec("reset role");
    await t.test(
      "outbox insert rolls back with business transaction",
      async () => {
        const before = (
          await db.query<{ n: number }>(
            "select count(*)::int n from private.notification_outbox",
          )
        ).rows[0].n;
        await db.exec(
          "begin;insert into private.orders(code,customer_name,phone,keyboard,plan,total_vnd,source,actor_id) values('TK-" +
            "D".repeat(32) +
            "','test','0901234567','test','transfer_full',100,'web',null);rollback",
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from private.notification_outbox",
            )
          ).rows[0].n,
          before,
        );
      },
    );
    await t.test(
      "only live admins can inspect and retry exhausted notifications",
      async () => {
        const admin = randomUUID();
        await db.query(
          "insert into auth.users(id,email,email_confirmed_at) values($1,'m5@example.test',now())",
          [admin],
        );
        await db.query("insert into auth.identities values($1,'google',$2)", [
          admin,
          { email: "m5@example.test", email_verified: true },
        ]);
        await db.query("insert into auth.sessions values($1,$1)", [admin]);
        await db.query(
          "insert into public.admin_members(user_id,email) values($1,'m5@example.test')",
          [admin],
        );
        await db.query(
          "insert into private.notification_outbox(event_key,event_type,entity_id,attempts) values($1,'chat_handoff',$2,5)",
          [randomUUID(), randomUUID()],
        );
        await db.exec("set role authenticated");
        await assert.rejects(rpc("retry_failed_notifications"), /forbidden/);
        await db.query(
          "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
          [admin, JSON.stringify({ session_id: admin })],
        );
        assert.equal((await rpc("admin_notifications")).failed, 1);
        assert.equal(await rpc("retry_failed_notifications"), 1);
        assert.equal((await rpc("admin_notifications")).failed, 0);
        await db.exec("reset role");
        await db.query("delete from auth.sessions where id=$1", [admin]);
        await db.exec("set role authenticated");
        await assert.rejects(rpc("admin_chat"), /forbidden/);
      },
    );
  } finally {
    await db.close();
  }
});
