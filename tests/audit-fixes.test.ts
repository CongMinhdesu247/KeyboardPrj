import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import sharp from "sharp";
import { createTestDatabase } from "./helpers/database.ts";
import { integerInput } from "../src/lib/catalog-input.ts";
import { orderErrors, validVideoUrl } from "../src/lib/order-contract.ts";
import { validCatalogMp4 } from "../src/lib/catalog-media.ts";

test("audit RPC guards reject invalid versions without writes and preserve valid commands", async (t) => {
  const db = await createTestDatabase();
  const admin = randomUUID(), customer = randomUUID(), portfolio = randomUUID();
  const rpc = async (name: string, args: unknown[]) =>
    (await db.query<{ v: { ok: boolean; code?: string } }>(`select public.${name} v`, args)).rows[0].v;
  const snapshot = async () => {
    await db.exec("reset role");
    const rows = await db.query(`select
      (select to_jsonb(p) from private.portfolio_items p where id='${portfolio}') portfolio,
      (select to_jsonb(a) from private.accounts a where user_id='${customer}') account,
      (select count(*)::int from private.admin_audit_events) audit,
      (select count(*)::int from auth.sessions where user_id='${customer}') sessions`);
    await db.exec("set role authenticated");
    return rows.rows;
  };
  try {
    for (const id of [admin, customer]) {
      const email = `${id}@example.test`;
      await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, email]);
      await db.query("insert into auth.identities values($1,'google',$2)", [id, { email, email_verified: true }]);
      await db.query("insert into auth.sessions values($1,$1)", [id]);
    }
    await db.query("insert into public.admin_members(user_id,email) values($1,'audit@example.test')", [admin]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [admin, JSON.stringify({ session_id: admin })]);
    await db.exec("set role authenticated");
    const draft = { id: portfolio, version: 0, title: "Fixture", keyboard: "Fixture", imagePath: `${portfolio}/${randomUUID()}.webp`, approved: true };
    assert.equal((await rpc("save_portfolio($1)", [draft])).ok, true);
    await t.test("portfolio update, publish, hide and archive reject missing, null, invalid and stale versions", async () => {
      for (const operation of [{}, { published: true }, { published: false }, { action: "archive" }]) {
        for (const version of [undefined, null, -1, 0, "1", "wrong", true, {}, [], 1.5, 2147483648, 2]) {
          const payload: Record<string, unknown> = { ...draft, ...operation, version };
          if (version === undefined) delete payload.version;
          const before = await snapshot();
          const result = await rpc("save_portfolio($1)", [payload]);
          assert.equal(result.ok, false, JSON.stringify(payload));
          assert.ok(["invalid_input", "conflict"].includes(result.code ?? ""));
          assert.deepEqual(await snapshot(), before);
        }
      }
      for (const version of [undefined, null, -1, "0"]) {
        const before = await snapshot();
        assert.equal((await rpc("save_portfolio($1)", [{ ...draft, id: randomUUID(), version }])).ok, false);
        assert.deepEqual(await snapshot(), before);
      }
      for (const [version, operation] of [[1, {}], [2, { published: true }], [3, { published: false }], [4, { action: "archive" }]] as const) {
        assert.equal((await rpc("save_portfolio($1)", [{ ...draft, ...operation, version }])).ok, true);
      }
      assert.equal((await rpc("save_portfolio($1)", [{ ...draft, version: 5 }])).code, "conflict");
    });
    await t.test("account guards run before idempotency and preserve status, version, audit and sessions", async () => {
      for (const action of ["ban", "unban", "delete"]) {
        for (const version of [null, 0, -1]) {
          const before = await snapshot();
          assert.deepEqual(await rpc("manage_account($1,$2,$3,$4)", [customer, version, action, "Fixture reason"]), { ok: false, code: "invalid_input" });
          assert.deepEqual(await snapshot(), before);
        }
      }
      for (const version of [2, 2147483647]) {
        const before = await snapshot();
        assert.equal((await rpc("manage_account($1,$2,'ban','Fixture reason')", [customer, version])).code, "conflict");
        assert.deepEqual(await snapshot(), before);
      }
      for (const version of ["wrong", 1.5, 2147483648]) {
        const before = await snapshot();
        await assert.rejects(rpc("manage_account($1,$2,'ban','Fixture reason')", [customer, version]));
        assert.deepEqual(await snapshot(), before);
      }
      for (const [version, action] of [[1, "ban"], [2, "unban"], [3, "delete"]] as const) {
        assert.equal((await rpc("manage_account($1,$2,$3,'Fixture reason')", [customer, version, action])).ok, true);
        const before = await snapshot();
        assert.equal((await rpc("manage_account($1,NULL,$2,'Fixture reason')", [customer, action])).code, "invalid_input");
        assert.deepEqual(await snapshot(), before);
      }
    });
    await t.test("deterministic upload retries are accepted by the real order_command contract", async () => {
      await db.exec("reset role");
      await db.exec("insert into public.products_services(id,category_slug,name,type,unit,price_vnd,stock_quantity,active) overriding system value values(777,'keycap','Audit fixture','product','bộ',100000,4,true)");
      await db.exec("set role authenticated");
      const created = await rpc("order_command($1)", [{ action: "create", requestId: randomUUID(), code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`, customerName: "Fixture", phone: "0901234567", keyboard: "Fixture", plan: "deposit_cod", items: [{ itemId: "777", quantity: 1, version: 1 }] }]);
      assert.equal(created.ok, true);
      const orderId = (created as unknown as { id: string }).id;
      const objects = new Set<string>();
      let loseResponse = true;
      const submit = await loadAction({
        storage: { from: () => ({
          upload: async (path: string) => {
            if (objects.has(path)) return { error: { statusCode: "409", message: "Duplicate" } };
            objects.add(path); return { error: null };
          },
          remove: async () => { assert.fail("Committed media must not be deleted"); },
        }) },
        rpc: async (name: string, { p }: { p: unknown }) => {
          const data = await rpc(`${name}($1)`, [p]);
          if (loseResponse) { loseResponse = false; return { error: { message: "Response lost" }, data: null }; }
          return { error: null, data };
        },
      });
      const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).png().toBuffer();
      const form = new FormData();
      for (const [key, value] of Object.entries({ action: "proof", orderId, requestId: randomUUID(), stage: "0", note: "Fixture proof" })) form.set(key, value);
      form.set("media", new File([new Uint8Array(bytes)], "fixture.png", { type: "image/png" }));
      assert.equal((await submit({}, form)).ok, undefined);
      assert.equal((await submit({}, form)).ok, true);
      assert.equal(objects.size, 1);
      await db.exec("reset role");
      const events = await db.query<{ path: string }>("select path from private.order_events where order_id=$1 and path is not null", [orderId]);
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0].path, [...objects][0]);
      await db.exec("set role authenticated");
    });
    await t.test("RPC implementations retain admin authorization and private grants", async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [customer, JSON.stringify({ session_id: customer })]);
      await assert.rejects(rpc("save_portfolio($1)", [draft]), /Admin required/);
      await assert.rejects(rpc("manage_account($1,1,'ban','Fixture reason')", [customer]), /Admin required/);
      await db.exec("set role anon");
      await assert.rejects(rpc("save_portfolio($1)", [draft]), /permission denied/);
      await assert.rejects(rpc("manage_account($1,1,'ban','Fixture reason')", [customer]), /permission denied/);
    });
  } finally { await db.close(); }
});

// Execute the actual action with isolated dependencies, without Next build or cookies.
async function loadAction(client: unknown) {
  const source = await readFile(new URL("../src/app/admin/orders/actions.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const nativeRequire = createRequire(import.meta.url);
  const dependencies: Record<string, unknown> = {
    "@/lib/auth": { requireAdmin: async () => ({ client }) },
    "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/order-contract": { orderErrors, validVideoUrl },
    "@/lib/catalog-input": { integerInput },
    "@/lib/catalog-media": { validCatalogMp4 },
    "@/lib/notifications": { scheduleNotifications: () => {} },
  };
  const exports: { submitOrder?: (state: object, form: FormData) => Promise<{ ok?: boolean }> } = {};
  new Function("require", "exports", compiled)((name: string) => dependencies[name] ?? nativeRequire(name), exports);
  return exports.submitOrder!;
}

test("audit media retries use normalized content, reuse duplicates and preserve existing evidence", async () => {
  const orderId = randomUUID(), requestId = randomUUID();
  const original = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
  const normalized = await sharp(original, { limitInputPixels: 20000000 }).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const paths: string[] = [], removed: string[] = [];
  const objects = new Set<string>(), committed = new Map<string, string>();
  let uploadError: { status?: number; statusCode?: string | number; message: string } | null = null;
  let rpcResult: { error: object | null; data: { ok?: boolean; id?: string; code?: string } | null } | undefined;
  let loseResponse = true, calls = 0;
  let expectedBytes = normalized;
  const storage = {
    upload: async (path: string, bytes: Buffer, options: { upsert: boolean }) => {
      paths.push(path);
      assert.equal(options.upsert, false);
      assert.deepEqual(bytes, expectedBytes);
      if (uploadError) return { error: uploadError };
      if (objects.has(path)) return { error: { statusCode: "409", message: "Conflict" } };
      objects.add(path); return { error: null };
    },
    remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
  };
  const submit = await loadAction({ storage: { from: (bucket: string) => { assert.equal(bucket, "order-media"); return storage; } }, rpc: async (name: string, { p }: { p: { path: string; requestId: string } }) => {
    calls++;
    assert.equal(name, "order_command");
    assert.match(p.path, new RegExp(`^${orderId}/[a-f0-9-]{36}\\.webp$`));
    if (rpcResult) return rpcResult;
    const old = committed.get(p.requestId);
    if (old && old !== p.path) return { error: null, data: { ok: false, code: "request_conflict" } };
    committed.set(p.requestId, p.path);
    if (loseResponse) { loseResponse = false; return { error: { message: "Lost response after commit" }, data: null }; }
    return { error: null, data: { ok: true, id: orderId } };
  } });
  const form = (request = requestId, file = original) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ action: "proof", orderId, requestId: request, stage: "0", note: "Fixture", videoUrl: "" })) data.set(key, value);
    data.set("media", new File([new Uint8Array(file)], "fixture.png", { type: "image/png" }));
    return data;
  };
  assert.equal((await submit({}, form())).ok, undefined);
  assert.deepEqual(removed, []);
  assert.equal((await submit({}, form())).ok, true);
  assert.equal(committed.size, 1);
  assert.equal(paths[0], paths[1]);
  const hash = createHash("sha256").update(`${requestId}:${createHash("sha256").update(normalized).digest("hex")}`).digest("hex").slice(0, 32);
  assert.equal(paths[0].split("/")[1].replaceAll("-", ""), `${hash}.webp`);
  rpcResult = { error: null, data: { ok: false, code: "request_conflict" } };
  for (const error of [{ statusCode: "409", message: "Conflict" }, { statusCode: 409, message: "Conflict" }, { status: 409, message: "Conflict" }, { statusCode: "400", message: "The resource already exists" }, { statusCode: "400", message: "Duplicate" }]) {
    uploadError = error;
    const before = calls;
    await submit({}, form());
    assert.equal(calls, before + 1);
    assert.deepEqual(removed, []);
  }
  uploadError = { statusCode: "403", message: "Access denied" };
  const before = calls;
  await submit({}, form());
  assert.equal(calls, before);
  assert.deepEqual(removed, []);
  uploadError = null;
  const otherRequest = randomUUID();
  await submit({}, form(otherRequest));
  assert.notEqual(paths.at(-1), paths[0]);
  assert.deepEqual(removed, [paths.at(-1)]);
  rpcResult = { error: null, data: null };
  await submit({}, form());
  assert.equal(removed.length, 1);
  rpcResult = { error: null, data: { ok: true } };
  await submit({}, form());
  assert.equal(removed.length, 1);
  const changed = await sharp({ create: { width: 4, height: 4, channels: 3, background: "blue" } }).png().toBuffer();
  expectedBytes = await sharp(changed).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  rpcResult = undefined;
  assert.equal((await submit({}, form(requestId, changed))).ok, undefined);
  assert.notEqual(paths.at(-1), paths[0]);
  assert.equal(removed.length, 2);
  assert.equal(removed.at(-1), paths.at(-1));
  expectedBytes = normalized;
  rpcResult = { error: { message: "Timeout" }, data: null };
  await submit({}, form(randomUUID()));
  assert.equal(removed.length, 2);
});

