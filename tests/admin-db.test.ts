import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "./helpers/database.ts";

test("M1 SQL: migration/seed, bootstrap, RLS, invite và thu hồi quyền", async (t) => {
  const db = await createTestDatabase();
  const ids = [1, 2, 3, 4, 5].map(
    (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  );
  const [admin, guest, other, brute, fake] = ids;
  async function actor(
    role: "anon" | "authenticated" | "service_role",
    id = "",
  ) {
    await db.exec(`reset role; set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      id,
    ]);
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ session_id: id }),
    ]);
  }
  async function owner() {
    await db.exec("reset role");
  }
  async function rpc(name: string, params: string[] = []) {
    const result = await db.query<{
      result: { ok: boolean; code?: string; id?: string };
    }>(
      `select public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      params,
    );
    return result.rows[0].result;
  }
  try {
    for (const [index, id] of ids.entries()) {
      const email =
        index === 0 || index === 4
          ? "congminhnguyen0204@gmail.com"
          : `test-${index}@example.test`;
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",
        [id, email, { provider: "google", role: "admin" }],
      );
      await db.query("insert into auth.sessions values($1,$1)", [id]);
      if (index !== 4)
        await db.query("insert into auth.identities values($1,'google',$2)", [
          id,
          { email, email_verified: true },
        ]);
    }
    await t.test(
      "reset schema mới và seed 4 nhóm, không tự có admin",
      async () => {
        assert.equal(
          (
            await db.query<{ count: number }>(
              "select count(*)::int as count from public.service_categories",
            )
          ).rows[0].count,
          7,
        );
        assert.equal(
          (
            await db.query<{ count: number }>(
              "select count(*)::int as count from public.admin_members",
            )
          ).rows[0].count,
          0,
        );
      },
    );
    await t.test(
      "bootstrap chỉ service-role, đúng Google identity, chỉ một lần",
      async () => {
        await actor("authenticated", admin);
        await assert.rejects(
          rpc("bootstrap_first_admin", [admin]),
          /permission denied/,
        );
        await actor("service_role");
        await assert.rejects(
          rpc("bootstrap_first_admin", [fake]),
          /Verified bootstrap identity/,
        );
        assert.equal((await rpc("bootstrap_first_admin", [admin])).ok, true);
        await assert.rejects(
          rpc("bootstrap_first_admin", [admin]),
          /already completed/,
        );
      },
    );
    await t.test(
      "anon/non-admin không xem nội bộ, không tự nâng quyền qua metadata hoặc SQL",
      async () => {
        await actor("anon");
        await assert.rejects(
          db.query("select * from public.admin_members"),
          /permission denied/,
        );
        await assert.rejects(
          rpc("create_admin_invite", ["a".repeat(64)]),
          /permission denied/,
        );
        await actor("authenticated", fake);
        assert.deepEqual(
          (await db.query("select * from public.admin_members")).rows,
          [],
        );
        assert.equal(
          (
            await db.query<{ value: boolean }>(
              "select public.is_admin() as value",
            )
          ).rows[0].value,
          false,
        );
        await assert.rejects(
          rpc("create_admin_invite", ["a".repeat(64)]),
          /Admin required/,
        );
        await assert.rejects(
          db.query(
            "insert into public.admin_members(user_id,email) values($1,'x')",
            [fake],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select * from private.admin_invites"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "invite chỉ hash, danh sách không lộ hash, chỉ dùng một lần",
      async () => {
        await actor("authenticated", admin);
        const invitation = await rpc("create_admin_invite", ["a".repeat(64)]);
        assert.equal(invitation.ok, true);
        const listed = await db.query(
          "select public.list_admin_invites() as result",
        );
        assert.equal(
          JSON.stringify(listed.rows).includes("a".repeat(64)),
          false,
        );
        await actor("authenticated", guest);
        assert.equal(
          (await rpc("redeem_admin_invite", ["a".repeat(64)])).ok,
          true,
        );
        assert.equal(
          (
            await db.query<{ value: boolean }>(
              "select public.is_admin() as value",
            )
          ).rows[0].value,
          true,
        );
        await actor("authenticated", other);
        assert.equal(
          (await rpc("redeem_admin_invite", ["a".repeat(64)])).code,
          "invalid_invite",
        );
      },
    );
    await t.test(
      "hết hạn/thu hồi bị chặn; lỗi thử sai vẫn ghi bộ đếm",
      async () => {
        await actor("authenticated", admin);
        const revoked = await rpc("create_admin_invite", ["b".repeat(64)]);
        await rpc("revoke_admin_invite", [revoked.id!]);
        await rpc("create_admin_invite", ["c".repeat(64)]);
        await owner();
        await db.exec(
          "update private.admin_invites set created_at = now() - interval '2 days', expires_at = now() - interval '1 day' where token_hash = repeat('c',64)",
        );
        await actor("authenticated", other);
        assert.equal(
          (await rpc("redeem_admin_invite", ["b".repeat(64)])).code,
          "invalid_invite",
        );
        assert.equal(
          (await rpc("redeem_admin_invite", ["c".repeat(64)])).code,
          "invalid_invite",
        );
        await actor("authenticated", brute);
        for (let attempt = 0; attempt < 10; attempt++)
          assert.equal(
            (await rpc("redeem_admin_invite", ["d".repeat(64)])).code,
            "invalid_invite",
          );
        assert.equal(
          (await rpc("redeem_admin_invite", ["d".repeat(64)])).code,
          "rate_limited",
        );
      },
    );
    await t.test(
      "RLS catalog/storage: guest chỉ đọc active, admin có thể ghi",
      async () => {
        await actor("authenticated", admin);
        await db.exec(
          "update public.service_categories set active = false where slug = 'lube'",
        );
        await db.exec(
          "insert into storage.objects(bucket_id,name) values('order-media','test.jpg')",
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          1,
        );
        await actor("anon");
        assert.equal(
          (await db.query("select * from public.service_categories")).rows
            .length,
          6,
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
        await actor("authenticated", other);
        assert.equal(
          (
            await db.query(
              "update public.service_categories set active = true where slug = 'lube' returning id",
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.exec(
            "insert into storage.objects(bucket_id,name) values('request-images','forbidden.jpg')",
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.exec(
            "insert into public.service_categories(slug,title,position) values('lube','fake',4)",
          ),
          /row-level security/,
        );
      },
    );
    await t.test(
      "admin bị vô hiệu hóa mất quyền ngay và không thể redeem để tự mở lại",
      async () => {
        await actor("authenticated", guest);
        await rpc("create_admin_invite", ["f".repeat(64)]);
        await actor("authenticated", admin);
        assert.equal(
          (await rpc("set_admin_active", [admin, "false"])).ok,
          false,
        );
        assert.equal(
          (await rpc("set_admin_active", [guest, "false"])).ok,
          true,
        );
        await actor("authenticated", guest);
        assert.equal(
          (
            await db.query<{ value: boolean }>(
              "select public.is_admin() as value",
            )
          ).rows[0].value,
          false,
        );
        await assert.rejects(
          rpc("create_admin_invite", ["e".repeat(64)]),
          /Admin required/,
        );
        assert.equal(
          (await rpc("redeem_admin_invite", ["e".repeat(64)])).code,
          "account_disabled",
        );
        assert.equal(
          (await db.query("select * from storage.objects")).rows.length,
          0,
        );
        await actor("authenticated", other);
        assert.equal(
          (await rpc("redeem_admin_invite", ["f".repeat(64)])).code,
          "invalid_invite",
        );
        await actor("authenticated", admin);
        assert.equal((await rpc("set_admin_active", [guest, "true"])).ok, true);
        await owner();
        assert.ok(
          (
            await db.query<{ count: number }>(
              "select count(*)::int as count from private.admin_audit_events",
            )
          ).rows[0].count >= 7,
        );
      },
    );
    await t.test(
      "JWT cũ không còn quyền khi phiên Auth đã bị đăng xuất/xóa",
      async () => {
        await owner();
        await db.query("delete from auth.sessions where user_id = $1", [guest]);
        await actor("authenticated", guest);
        assert.equal(
          (
            await db.query<{ value: boolean }>(
              "select public.has_live_session() as value",
            )
          ).rows[0].value,
          false,
        );
        assert.equal(
          (
            await db.query<{ value: boolean }>(
              "select public.is_admin() as value",
            )
          ).rows[0].value,
          false,
        );
        await assert.rejects(
          rpc("create_admin_invite", ["e".repeat(64)]),
          /Admin required/,
        );
        await assert.rejects(
          rpc("redeem_admin_invite", ["e".repeat(64)]),
          /Verified Google identity/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
