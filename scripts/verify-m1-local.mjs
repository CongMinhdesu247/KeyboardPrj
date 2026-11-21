import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { verifyM3Api, verifyM3Ui } from "./verify-m3-local.mjs";
import { verifyM4Api, verifyM4Ui } from "./verify-m4-local.mjs";
import { verifyStorefrontUi } from "./verify-storefront-local.mjs";
import { verifyCatalogMediaUi } from "./verify-catalog-media-local.mjs";
import { verifyM5Ui } from "./verify-m5-local.mjs";
import { verifyM6Ui } from "./verify-m6-local.mjs";
import { verifyM7Ui } from "./verify-m7-local.mjs";
import { verifyAccountsUi } from "./verify-accounts-local.mjs";
import {verifyBannersUi} from "./verify-banners-local.mjs";
import {verifyInboxUi} from "./verify-inbox-local.mjs";
import {
  createInviteToken,
  hashInviteToken,
} from "../src/lib/admin-contract.ts";

// Chỉ integration fixture trên stack local cố định; KHÔNG dùng để đăng nhập Google.
// Không lấy session/cookie tài khoản thật; không đổi bootstrap/admin của người dùng.
const cli = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);
const statusRun = spawnSync(
  process.execPath,
  [cli, "status", "--output", "json"],
  { encoding: "utf8" },
);
if (statusRun.status !== 0) throw new Error("Supabase local chưa sẵn sàng.");
const config = JSON.parse(statusRun.stdout);
assert.equal(
  config.API_URL,
  "http://127.0.0.1:54321",
  "Chỉ kiểm tra stack local mặc định",
);
const operator = createClient(
  config.API_URL,
  config.SECRET_KEY ?? config.SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const runId = randomUUID();
const users = [];
const files = [];
const catalogIds = [];
const catalogFiles = [];
const bannerFiles = [];
const catalogVideos = [];
const requestIds = [];
const budgetKeys = [];
const chatHashes = [];
let stage = "setup";
let realAdminCount;

function sql(statement) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_trumpkeys-local",
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: statement, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      "Fixture SQL failed; no sensitive SQL/error payload logged.",
    );
  return result.stdout.trim();
}
function clientFor(user) {
  const encoded = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user.id, role: "authenticated", aud: "authenticated", email: user.email, session_id: user.session, iat: now, exp: now + 600, iss: `${config.API_URL}/auth/v1`, aal: "aal1" })}`;
  const token = `${body}.${createHmac("sha256", config.JWT_SECRET).update(body).digest("base64url")}`;
  user.testToken = token;
  return createClient(
    config.API_URL,
    config.PUBLISHABLE_KEY ?? config.ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
async function fixture(label, google = true) {
  const email = `m1-${label}-${runId}@example.test`;
  const result = await operator.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: "admin", provider: "google" },
  });
  assert.equal(result.error, null, "Create local fixture");
  const user = { id: result.data.user.id, email, session: randomUUID() };
  users.push(user);
  // Synthetic identity/session in TEST fixtures only; OAuth login is verified separately by user.
  sql(`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values('${user.session}','${user.id}',now(),now(),'aal1');
    ${google ? `insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values('${user.id}','${user.id}',jsonb_build_object('sub','${user.id}','email','${email}','email_verified',true),'google',now(),now());` : ""}`);
  user.client = clientFor(user);
  return user;
}
async function rpc(user, name, args = {}) {
  return user.client.rpc(name, args);
}
async function invite(admin) {
  const hash = hashInviteToken(createInviteToken());
  const result = await rpc(admin, "create_admin_invite", {
    p_token_hash: hash,
  });
  assert.equal(result.error, null, "Admin invite RPC allowed");
  assert.equal(result.data.ok, true, "Admin invite created");
  return { id: result.data.id, hash };
}
async function check(name, action) {
  stage = name;
  await action();
  console.log(`PASS: ${name}`);
}

try {
  realAdminCount = sql(
    "select count(*) from public.admin_members where lower(email)='congminhnguyen0204@gmail.com' and active;",
  );
  const admin = await fixture("admin");
  const first = await fixture("first");
  const second = await fixture("second");
  const fake = await fixture("metadata-only", false);
  const customerUser=await fixture("customer"),otherCustomer=await fixture("other-customer");
  sql(
    `insert into public.admin_members(user_id,email) values('${admin.id}','${admin.email}');`,
  );
  const anonymous = createClient(
    config.API_URL,
    config.PUBLISHABLE_KEY ?? config.ANON_KEY,
    { auth: { persistSession: false } },
  );

  await check(
    "Anonymous/non-admin cannot read or grant admin; metadata cannot elevate",
    async () => {
      assert.ok((await anonymous.from("admin_members").select("*")).error);
      const visible = await first.client.from("admin_members").select("*");
      assert.equal(visible.error, null);
      assert.deepEqual(visible.data, []);
      assert.equal((await rpc(fake, "is_admin")).data, false);
      assert.ok(
        (
          await rpc(fake, "create_admin_invite", {
            p_token_hash: "a".repeat(64),
          })
        ).error,
      );
      assert.ok(
        (await rpc(first, "bootstrap_first_admin", { p_user_id: first.id }))
          .error,
      );
      assert.ok(
        (
          await first.client
            .from("admin_members")
            .insert({ user_id: first.id, email: first.email })
        ).error,
      );
      assert.ok(
        (await first.client.schema("private").from("admin_invites").select("*"))
          .error,
      );
    },
  );
  await check(
    "Concurrent redemption: exactly one winner, token cannot be reused",
    async () => {
      const code = await invite(admin);
      const outcomes = await Promise.all(
        [first, second].map((user) =>
          rpc(user, "redeem_admin_invite", { p_token_hash: code.hash }),
        ),
      );
      outcomes.forEach((result) => assert.equal(result.error, null));
      assert.equal(outcomes.filter((result) => result.data.ok).length, 1);
      const loser = outcomes[0].data.ok ? second : first;
      assert.equal(
        (await rpc(loser, "redeem_admin_invite", { p_token_hash: code.hash }))
          .data.code,
        "invalid_invite",
      );
      const list = await rpc(admin, "list_admin_invites");
      assert.equal(JSON.stringify(list.data).includes(code.hash), false);
    },
  );
  const winner = (await rpc(first, "is_admin")).data ? first : second;
  const loser = winner === first ? second : first;
  await check(
    "Expired/revoked invitations rejected and failed attempts persist",
    async () => {
      const revoked = await invite(admin);
      assert.equal(
        (await rpc(admin, "revoke_admin_invite", { p_id: Number(revoked.id) }))
          .data.ok,
        true,
      );
      assert.equal(
        (
          await rpc(loser, "redeem_admin_invite", {
            p_token_hash: revoked.hash,
          })
        ).data.code,
        "invalid_invite",
      );
      const expired = await invite(admin);
      sql(
        `update private.admin_invites set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=${Number(expired.id)} and created_by='${admin.id}';`,
      );
      assert.equal(
        (
          await rpc(loser, "redeem_admin_invite", {
            p_token_hash: expired.hash,
          })
        ).data.code,
        "invalid_invite",
      );
      for (let attempt = 0; attempt < 11; attempt++)
        await rpc(loser, "redeem_admin_invite", {
          p_token_hash: "0".repeat(64),
        });
      assert.equal(
        (
          await rpc(loser, "redeem_admin_invite", {
            p_token_hash: "0".repeat(64),
          })
        ).data.code,
        "rate_limited",
      );
    },
  );
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#f59e0b" },
  })
    .png()
    .toBuffer();
  await check(
    "Private Storage: valid upload/read, reject guest, public URL, MIME, size and overwrite",
    async () => {
      const path = `m1-verification/${runId}/valid.png`;
      files.push(path);
      assert.equal(
        (
          await admin.client.storage
            .from("request-images")
            .upload(path, image, { contentType: "image/png" })
        ).error,
        null,
      );
      assert.equal(
        (await admin.client.storage.from("request-images").download(path))
          .error,
        null,
      );
      assert.ok(
        (await anonymous.storage.from("request-images").download(path)).error,
      );
      assert.ok(
        (await loser.client.storage.from("request-images").download(path))
          .error,
      );
      const publicUrl = admin.client.storage
        .from("request-images")
        .getPublicUrl(path).data.publicUrl;
      assert.equal((await fetch(publicUrl)).ok, false);
      const deniedPaths = ["guest.png", "bad.txt", "large.png"].map(
        (name) => `m1-verification/${runId}/${name}`,
      );
      files.push(...deniedPaths);
      assert.ok(
        (
          await loser.client.storage
            .from("request-images")
            .upload(deniedPaths[0], image, { contentType: "image/png" })
        ).error,
      );
      assert.ok(
        (
          await admin.client.storage
            .from("request-images")
            .upload(deniedPaths[1], Buffer.from("test"), {
              contentType: "text/plain",
            })
        ).error,
      );
      assert.ok(
        (
          await admin.client.storage
            .from("request-images")
            .upload(deniedPaths[2], Buffer.alloc(5 * 1024 * 1024 + 1), {
              contentType: "image/png",
            })
        ).error,
      );
      assert.ok(
        (
          await admin.client.storage
            .from("request-images")
            .upload(path, image, { contentType: "image/png", upsert: true })
        ).error,
      );
    },
  );
  await check(
    "Disable removes privileges and revokes unused invites; cannot self-reactivate",
    async () => {
      const childInvite = await invite(winner);
      assert.equal(
        (
          await rpc(admin, "set_admin_active", {
            p_user_id: winner.id,
            p_active: false,
          })
        ).data.ok,
        true,
      );
      assert.equal((await rpc(winner, "is_admin")).data, false);
      assert.ok(
        (
          await rpc(winner, "create_admin_invite", {
            p_token_hash: "b".repeat(64),
          })
        ).error,
      );
      assert.equal(
        (
          await rpc(winner, "redeem_admin_invite", {
            p_token_hash: childInvite.hash,
          })
        ).data.code,
        "account_disabled",
      );
      assert.ok(
        (await winner.client.storage.from("request-images").download(files[0]))
          .error,
      );
      assert.equal(
        sql(
          `select (revoked_at is not null)::text from private.admin_invites where id=${Number(childInvite.id)};`,
        ),
        "true",
      );
      assert.equal(
        (
          await rpc(admin, "set_admin_active", {
            p_user_id: winner.id,
            p_active: true,
          })
        ).data.ok,
        true,
      );
    },
  );
  await check(
    "Deleted Auth session blocks stale JWT; no disruption to real admin",
    async () => {
      sql(
        `delete from auth.sessions where id='${winner.session}' and user_id='${winner.id}';`,
      );
      assert.equal((await rpc(winner, "has_live_session")).data, false);
      assert.equal((await rpc(winner, "is_admin")).data, false);
      assert.ok(
        (
          await rpc(winner, "create_admin_invite", {
            p_token_hash: "c".repeat(64),
          })
        ).error,
      );
      assert.equal(
        sql(
          "select count(*) from public.admin_members where lower(email)='congminhnguyen0204@gmail.com' and active;",
        ),
        realAdminCount,
      );
    },
  );
  const fixtureItem = {
    name: `M2 verification ${runId}`,
    description: "Integration fixture",
    category: "lube",
    type: "product",
    unit: "phím",
    price: 12000,
    cost: 7000,
    active: false,
    lubePackage: "",
    imagePath: "",
  };
  let productId;
  await check(
    "M2 catalog: draft hidden, published item visible, private cost never public",
    async () => {
      const created = await rpc(admin, "save_catalog_item", {
        p_item: fixtureItem,
      });
      assert.equal(created.error, null);
      assert.equal(created.data.ok, true);
      productId = created.data.id;
      catalogIds.push(productId);
      const hidden = await anonymous
        .from("products_services")
        .select("*")
        .eq("id", Number(productId));
      assert.deepEqual(hidden.data, []);
      assert.ok(
        (await rpc(loser, "save_catalog_item", { p_item: fixtureItem })).error,
      );
      assert.ok((await rpc(loser, "list_catalog_admin")).error);
      const published = await rpc(admin, "save_catalog_item", {
        p_item: { ...fixtureItem, id: productId, version: 1, active: true },
      });
      assert.equal(published.data.ok, true);
      const publicRow = await anonymous
        .from("products_services")
        .select("*")
        .eq("id", Number(productId))
        .single();
      assert.equal(publicRow.error, null);
      assert.equal(publicRow.data.price_vnd, 12000);
      assert.equal(Object.hasOwn(publicRow.data, "cost_vnd"), false);
      assert.ok(
        (await anonymous.schema("private").from("product_costs").select("*"))
          .error,
      );
      assert.ok(
        (
          await admin.client
            .from("products_services")
            .update({ stock_quantity: 999 })
            .eq("id", Number(productId))
        ).error,
      );
      assert.ok(
        (
          await rpc(admin, "save_catalog_item", {
            p_item: { ...fixtureItem, active: true, price: null },
          })
        ).error,
      );
    },
  );
  await check(
    "M2 inventory: retries atomic/idempotent, concurrent withdrawals cannot oversell",
    async () => {
      const args = {
        p_id: Number(productId),
        p_delta: 5,
        p_reason: "Fixture nhập hàng",
        p_request_id: randomUUID(),
      };
      const retries = await Promise.all([
        rpc(admin, "adjust_inventory", args),
        rpc(admin, "adjust_inventory", args),
      ]);
      retries.forEach((result) => {
        assert.equal(result.error, null);
        assert.equal(result.data.ok, true);
      });
      assert.equal(
        sql(
          `select stock_quantity from public.products_services where id=${Number(productId)};`,
        ),
        "5",
      );
      const reduce = () =>
        rpc(admin, "adjust_inventory", {
          p_id: Number(productId),
          p_delta: -4,
          p_reason: "Fixture xuất hàng",
          p_request_id: randomUUID(),
        });
      const outcomes = await Promise.all([reduce(), reduce()]);
      assert.equal(outcomes.filter((result) => result.data?.ok).length, 1);
      assert.equal(
        outcomes.filter((result) => result.data?.code === "stock_limit").length,
        1,
      );
      assert.equal(
        sql(
          `select stock_quantity from public.products_services where id=${Number(productId)};`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select count(*) from private.inventory_movements where item_id=${Number(productId)};`,
        ),
        "2",
      );
      assert.equal(
        (
          await rpc(admin, "save_catalog_item", {
            p_item: { ...fixtureItem, id: productId, version: 1 },
          })
        ).data.code,
        "conflict",
      );
      assert.ok(
        (
          await rpc(loser, "adjust_inventory", {
            ...args,
            p_request_id: randomUUID(),
          })
        ).error,
      );
    },
  );
  await check("M2 archive keeps inventory history and hides item", async () => {
    const version = Number(
      sql(
        `select version from public.products_services where id=${Number(productId)};`,
      ),
    );
    assert.equal(
      (
        await rpc(admin, "archive_catalog_item", {
          p_id: Number(productId),
          p_version: version,
        })
      ).data.ok,
      true,
    );
    assert.deepEqual(
      (
        await anonymous
          .from("products_services")
          .select("*")
          .eq("id", Number(productId))
      ).data,
      [],
    );
    assert.equal(
      (
        await rpc(admin, "list_inventory_movements", {
          p_id: Number(productId),
        })
      ).data.length,
      2,
    );
    assert.equal(
      (
        await rpc(admin, "adjust_inventory", {
          p_id: Number(productId),
          p_delta: 1,
          p_reason: "Cannot touch archived",
          p_request_id: randomUUID(),
        })
      ).data.code,
      "not_product",
    );
  });
  await check(
    "M3 API: concurrent deposits, no oversell, retry, private tracking and cancellation",
    () =>
      verifyM3Api({ admin, anonymous, operator, rpc, runId, catalogIds, sql }),
  );
  await check(
    "M4 API: private requests, duplicate submit, version conflict and no guest access",
    () =>
      verifyM4Api({
        admin,
        nonAdmin: fake,
        anonymous,
        operator,
        rpc,
        runId,
        requestIds,
        budgetKeys,
      }),
  );
  if (process.argv.includes("--browser")) {
    await check(
      process.argv.includes("--accounts-only") ? "Customer accounts browser fixtures" : process.argv.includes("--catalog-media-only") ? "Catalog gallery browser fixtures" : "M2 browser: create/photo, stock, public estimate, edit/hide/archive and logout",
      async () => {
        const { chromium, expect: baseExpect } = await import("@playwright/test");
        // Local Next development compiles routes and refreshes Server Actions during navigation.
        const expect = baseExpect.configure({ timeout: 15000 });
        const browser = await chromium.launch({
          channel: "chrome",
          headless: true,
        });
        const { mkdir } = await import("node:fs/promises");
        await mkdir("output/playwright", { recursive: true });
        let uiPage;
        try {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 1000 },
          });
          const session = {
            access_token: admin.testToken,
            refresh_token: randomUUID(),
            token_type: "bearer",
            expires_in: 600,
            expires_at: Math.floor(Date.now() / 1000) + 600,
            user: { id: admin.id, email: admin.email },
          };
          await context.addCookies([
            {
              name: "sb-127-auth-token",
              value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
              domain: "localhost",
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          const page = await context.newPage();
          uiPage = page;
          if(process.argv.includes("--inbox-only")) {
            await verifyInboxUi({page,expect,admin,anonymous,rpc,runId,catalogIds});
            await context.close();return;
          }
          if(process.argv.includes("--banners-only")){
            const publicPage=await browser.newPage();
            await verifyBannersUi({page,publicPage,expect,admin,anonymous,rpc,runId,catalogIds,bannerFiles});
            await context.close();console.log("PASS: banner admin upload, publication, swipe/keyboard, product link and hidden product protection");return;
          }
          if (process.argv.includes("--accounts-only")) {
            const {data:authData,error:authError}=await customerUser.client.auth.getUser(customerUser.testToken);
            console.log("Fixture auth:",{error:authError?.code,verified:!!authData.user?.email_confirmed_at,google:authData.user?.identities?.some(i=>i.provider==="google")});
            const touch=await rpc(customerUser,"touch_account");console.log("Fixture account RPC:",{error:touch.error?.code,status:touch.data?.status});
            assert.equal(touch.error,null);
            const item=(await rpc(admin,"save_catalog_item",{p_item:{name:`Account fixture ${runId}`,category:"keycap",type:"service",unit:"bộ",price:1000,cost:0,active:true,description:"Account regression fixture",imagePath:null,lubePackage:""}})).data;assert.equal(item.ok,true);catalogIds.push(item.id);
            const own=await rpc(customerUser,"submit_account_order",{p:{requestId:randomUUID(),hash:"c".repeat(64),code:`TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,customerName:"Account fixture",phone:"0901234567",delivery:"pickup",plan:"deposit_cod",keyboard:"Fixture keyboard",items:[{itemId:item.id,quantity:1,expectedPrice:1000}]}});assert.equal(own.data?.ok,true);
            await verifyAccountsUi({page,expect,admin,customer:customerUser,otherCustomer,rpc,runId});
            await context.close();return;
          }
          if (process.argv.includes("--catalog-media-only")) {
            const publicContext=await browser.newContext();
            const publicPage=await publicContext.newPage();
            try {
              await verifyCatalogMediaUi({page,publicPage,expect,admin,rpc,runId,catalogIds});
              console.log("PASS: focused catalog gallery and sound test browser checks");
            } catch(error) {
              await publicPage.screenshot({path:"output/playwright/catalog-gallery-failure.png",fullPage:true}).catch(()=>{});
              throw error;
            } finally { await publicContext.close();await context.close(); }
            return;
          }
          const errors = [];
          const renderWarnings = [];
          page.on("pageerror", (error) => errors.push(`${new URL(page.url()).pathname}: ${error.message.slice(0,6000)}`));
          page.on("console", (message) => {
            if (
              ["error", "warning"].includes(message.type()) &&
              /hydration|Each child|unique.*key|cannot be a descendant|controlled.*input|state update/i.test(
                message.text(),
              )
            )
              renderWarnings.push(message.text().slice(-6000));
          });
          await page.goto("http://localhost:3000/admin/catalog");
          await expect(
            page.getByRole("heading", {
              name: "Dịch vụ và linh kiện",
              exact: true,
            }),
          ).toBeVisible();
          await page.screenshot({
            caret: "initial",
            path: "output/playwright/m2-admin-desktop.png",
          });
          await page.screenshot({
            caret: "initial",
            path: "output/playwright/m2-admin-desktop-full.png",
            fullPage: true,
          });
          await page.setViewportSize({ width: 375, height: 812 });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await page.screenshot({
            caret: "initial",
            path: "output/playwright/m2-admin-mobile.png",
          });
          await page.screenshot({
            caret: "initial",
            path: "output/playwright/m2-admin-mobile-full.png",
            fullPage: true,
          });
          await page.goto("http://localhost:3000/admin/catalog/new");
          const title = `Kiểm thử M2 ${runId.slice(0, 8)}`;
          await page
            .getByLabel("Tên dịch vụ / sản phẩm", { exact: true })
            .fill(title);
          await page
            .getByLabel("Loại", { exact: true })
            .selectOption("product");
          await page.getByLabel("Nhóm", { exact: true }).selectOption("keycap");
          await page.getByLabel("Đơn vị", { exact: true }).selectOption("bộ");
          await page
            .getByLabel("Giá vốn linh kiện (VND)", { exact: false })
            .fill("17000");
          await page
            .getByLabel("Công khai trên bảng giá", { exact: false })
            .check();
          await page
            .getByRole("button", { name: "Tạo mục mới", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText("Nhập giá bán");
          await expect(
            page.getByLabel("Tên dịch vụ / sản phẩm", { exact: true }),
          ).toHaveValue(title);
          await page
            .getByLabel("Giá bán (VND)", { exact: false })
            .fill("25000");
          await page
            .getByLabel("Mô tả", { exact: true })
            .fill("Dữ liệu kiểm thử tự động, sẽ được xóa sau lần chạy.");
          await page
            .getByLabel("Ảnh công khai của sản phẩm", { exact: true })
            .setInputFiles({
              name: "invalid.png",
              mimeType: "image/png",
              buffer: Buffer.from("not an image"),
            });
          await page
            .getByRole("button", { name: "Tạo mục mới", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText(
            "Không đọc được ảnh",
          );
          await expect(
            page.getByLabel("Tên dịch vụ / sản phẩm", { exact: true }),
          ).toHaveValue(title);
          await expect(page.getByLabel("Loại", { exact: true })).toHaveValue(
            "product",
          );
          await expect(page.getByLabel("Nhóm", { exact: true })).toHaveValue(
            "keycap",
          );
          await expect(
            page.getByLabel("Công khai trên bảng giá", { exact: false }),
          ).toBeChecked();
          await page
            .getByLabel("Ảnh công khai của sản phẩm", { exact: true })
            .setInputFiles({
              name: "test.png",
              mimeType: "image/png",
              buffer: image,
            });
          await page
            .getByRole("button", { name: "Tạo mục mới", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText(
            "Đã tạo mục mới",
          );
          const listing = await rpc(admin, "list_catalog_admin");
          const created = listing.data.find((item) => item.name === title);
          assert.ok(created);
          catalogIds.push(created.id);
          if (created.image_path) catalogFiles.push(created.image_path);
          await page.goto(`http://localhost:3000/admin/catalog/${created.id}`);
          await expect(page.locator(".catalog-preview img")).toBeVisible();
          await expect
            .poll(() =>
              page
                .locator(".catalog-preview img")
                .evaluate((img) => img.naturalWidth),
            )
            .toBeGreaterThan(0);
          await page
            .getByRole("spinbutton", { name: "Số điều chỉnh tồn", exact: true })
            .fill("-1");
          await page
            .getByLabel("Lý do", { exact: true })
            .fill("Nhập hàng kiểm thử");
          await page
            .getByRole("button", { name: "Ghi điều chỉnh", exact: true })
            .click();
          await expect(
            page.locator('.stock-form [role="status"]'),
          ).toContainText("Không đủ tồn");
          await expect(page.getByLabel("Lý do", { exact: true })).toHaveValue(
            "Nhập hàng kiểm thử",
          );
          await page
            .getByRole("spinbutton", { name: "Số điều chỉnh tồn", exact: true })
            .fill("3");
          await page
            .getByLabel("Lý do", { exact: true })
            .fill("Nhập hàng kiểm thử");
          await page
            .getByRole("button", { name: "Ghi điều chỉnh", exact: true })
            .click();
          await expect(
            page.getByRole("heading", { name: "Tồn kho: 3 bộ", exact: true }),
          ).toBeVisible();
          await page.screenshot({
            caret: "initial",
            path: "output/playwright/m2-editor-mobile-full.png",
            fullPage: true,
          });
          const publicContext = await browser.newContext({
            viewport: { width: 375, height: 812 },
          });
          const customer = await publicContext.newPage();
          await customer.goto("http://localhost:3000/");
          await expect(
            customer.getByRole("link", {
              name: "TRUMP Keys — Trang chủ",
              exact: true,
            }),
          ).toBeVisible();
          await customer.screenshot({
            caret: "initial",
            path: "output/playwright/m2-home-mobile.png",
          });
          await customer
            .getByRole("link", {
              name: "Xem bảng giá Keycap & đặt tìm",
              exact: true,
            })
            .click();
          const product = customer.getByRole("listitem").filter({
            has: customer.getByRole("heading", { name: title, exact: true }),
          });
          await expect(product).toContainText("Còn 3 bộ");
          await expect(product).not.toContainText("17.000");
          await product
            .getByRole("button", { name: "+ Chọn", exact: true })
            .click();
          await customer
            .getByRole("button", { name: /Xem ước tính ·/ })
            .click();
          const qty = customer.getByRole("spinbutton", {
            name: `Số lượng ${title}`,
            exact: true,
          });
          await qty.fill("2");
          await qty.press("Tab");
          await expect(
            customer.locator(".estimate-total strong"),
          ).toContainText("50.000");
          await customer.screenshot({
            caret: "initial",
            path: "output/playwright/m2-estimate-mobile.png",
          });
          assert.equal(
            await customer.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          await customer.setViewportSize({ width: 1440, height: 1000 });
          await customer.goto("http://localhost:3000/");
          await customer.screenshot({
            caret: "initial",
            path: "output/playwright/m2-home-desktop.png",
          });
          await customer.screenshot({
            caret: "initial",
            path: "output/playwright/m2-home-desktop-full.png",
            fullPage: true,
          });
          await page.reload();
          await page
            .getByLabel("Giá bán (VND)", { exact: false })
            .fill("30000");
          await page
            .getByLabel("Công khai trên bảng giá", { exact: false })
            .uncheck();
          await page
            .getByRole("button", { name: "Lưu thay đổi", exact: true })
            .click();
          await expect(
            page.locator('.catalog-editor [role="status"]'),
          ).toContainText("Đã lưu thay đổi");
          assert.deepEqual(
            (
              await anonymous
                .from("products_services")
                .select("id")
                .eq("id", Number(created.id))
            ).data,
            [],
          );
          await page.getByText("Lưu trữ mục này", { exact: true }).click();
          await page
            .getByRole("button", {
              name: "Xác nhận đưa vào lưu trữ",
              exact: true,
            })
            .click();
          await expect(page).toHaveURL(/\/admin\/catalog\?archived=1$/);
          await expect(page.getByRole("status")).toContainText(
            "Đã đưa mục vào lưu trữ",
          );
          await verifyM3Ui({
            page,
            publicPage: await publicContext.newPage(),
            expect,
            admin,
            rpc,
            runId,
            catalogIds,
          });
          console.log(
            "PASS: M3 browser create/deposit/stages/private photo/tracking/COD/mobile",
          );
          await verifyM4Ui({
            page,
            publicPage: await publicContext.newPage(),
            expect,
            admin,
            anonymous,
            operator,
            rpc,
            runId,
            requestIds,
            budgetKeys,
          });
          console.log(
            "PASS: M4 browser private intake, retained form, admin inbox, selected photo copy, publish/preview/hide/archive/mobile",
          );
          await verifyStorefrontUi({
            customer:customerUser,
            page,
            publicPage: await publicContext.newPage(),
            expect,
            admin,
            anonymous,
            rpc,
            runId,
            catalogIds,
            catalogFiles,
            budgetKeys,
          });
          console.log(
            "PASS: storefront image/price/detail, persistent cart, changed prices, shipping checkout, bank QR, manual deposit and stock safety",
          );
          await verifyAccountsUi({page,expect,admin,customer:customerUser,otherCustomer,rpc,runId});
          console.log("PASS: customer registration roles, private account orders, admin analytics, filtering, bans/unban/deletion and preserved history");
          await publicContext.clearCookies();
          await verifyCatalogMediaUi({page,publicPage:await publicContext.newPage(),expect,admin,rpc,runId,catalogIds});
          console.log("PASS: catalog multi-image upload, ordering, cover, mobile gallery, MP4 audio/video playback and external sound test");
          await verifyM5Ui({page,expect,runId,chatHashes,admin,rpc});
          console.log("PASS: M5 chat persists privately, Zalo handoff, admin history and notification status, mobile layout");
          await verifyM6Ui({page,expect,admin,anonymous,rpc,runId,catalogIds,sql});
          console.log("PASS: M6 cash report, filters, private access, refund, COD, no duplicate receipts, mobile and desktop");
          await verifyM7Ui({page,expect,admin,rpc,runId,catalogIds});
          console.log("PASS: M7 approved policies, admin content readiness, private access, responsive pages and offline-only fallback cache");
          await verifyBannersUi({page,publicPage:await publicContext.newPage(),expect,admin,anonymous,rpc,runId,catalogIds,bannerFiles});
          console.log("PASS: banner admin upload, publication, swipe/keyboard, product link and hidden product protection");
          await verifyInboxUi({page,expect,admin,anonymous,rpc,runId,catalogIds});
          await page.goto("http://localhost:3000/admin");
          await page
            .getByRole("button", { name: "Đăng xuất", exact: true })
            .click();
          await expect(page).toHaveURL(/\/admin\/login/);
          assert.equal((await rpc(admin, "is_admin")).data, false);
          if (errors.length) {
            const {writeFile}=await import("node:fs/promises");
            await writeFile("output/playwright/application-errors.txt",errors.join("\n\n"));
          }
          assert.deepEqual(errors, [], "No application page errors");
          if (renderWarnings.length) {
            const { writeFile } = await import("node:fs/promises");
            await writeFile(
              "output/playwright/render-warnings.txt",
              renderWarnings.join("\n\n"),
            );
          }
          assert.deepEqual(renderWarnings, [], "No React rendering warnings");
          await publicContext.close();
          await context.close();
        } catch (error) {
          if (uiPage)
            await uiPage
              .screenshot({
                caret: "initial",
                path: "output/playwright/m2-ui-failure.png",
                fullPage: true,
              })
              .catch(() => {});
          console.error(
            String(error.message)
              .split("\n")
              .slice(0, 8)
              .join("\n")
              .replace(/(?:eyJ|sb_secret_)[A-Za-z0-9._-]+/g, "[redacted]"),
          );
          throw error;
        } finally {
          await browser.close();
        }
      },
    );
  }
} catch {
  console.error(`FAIL at: ${stage}. Sensitive payloads/tokens omitted.`);
  process.exitCode = 1;
} finally {
  stage = "cleanup";
  try {
    if(users.length){
      const actors=users.map(u=>`'${u.id}'`).join(",");
      const bannerPaths=JSON.parse(sql(`select coalesce(json_agg(image_path) filter(where image_path is not null),'[]'::json) from public.home_banners where updated_by in (${actors});`));
      sql(`update public.home_banners set title='',subtitle='',image_path=null,product_id=null,active=false,version=version+1,updated_by=null where updated_by in (${actors});`);
      for(const path of [...new Set([...bannerPaths,...bannerFiles])]){
        if(sql(`select count(*) from public.home_banners where image_path='${path}';`)==="0")assert.equal((await operator.storage.from("home-banners").remove([path])).error,null);
      }
    }
    if(chatHashes.length){
      const hashes=chatHashes.map(h=>`'${h}'`).join(",");
      sql(`begin;select pg_advisory_xact_lock(hashtextextended('chat-global-budget',0));update private.chat_budgets b set turns=greatest(0,b.turns-x.n) from(select (t.created_at at time zone 'Asia/Ho_Chi_Minh')::date budget_day,count(*)::int n from private.chat_turns t join private.chat_sessions s on s.id=t.session_id where s.token_hash in (${hashes}) group by 1) x where b.day=x.budget_day;delete from private.notification_outbox where entity_id in(select id from private.chat_sessions where token_hash in (${hashes}));delete from private.chat_turns where session_id in(select id from private.chat_sessions where token_hash in (${hashes}));delete from private.chat_sessions where token_hash in (${hashes});commit;`);
    }
    const guestIds = JSON.parse(
      sql(
        `select coalesce(json_agg(id),'[]'::json) from private.orders where source='web' and (customer_name in ('Shop UI ${runId}','Shop Full ${runId}') or customer_user_id in (${users.map(u=>`'${u.id}'`).join(",")||"null"}));`,
      ),
    );
    if (guestIds.length) {
      const ids = guestIds.map((id) => `'${id}'`).join(",");
      sql(
        `delete from private.notification_outbox where entity_id in (${ids});delete from private.checkout_submissions where order_id in (${ids});delete from private.inventory_movements where order_id in (${ids});delete from private.order_commands where order_id in (${ids});delete from private.order_payments where order_id in (${ids});delete from private.order_events where order_id in (${ids});delete from private.order_lines where order_id in (${ids});delete from private.orders where id in (${ids});`,
      );
    }
    if (users.length) {
      const actorIds = users.map((u) => `'${u.id}'`).join(",");
      const portfolioPaths = JSON.parse(
        sql(
          `select coalesce(json_agg(image_path) filter(where image_path is not null),'[]'::json) from private.portfolio_items where actor_id in (${actorIds});`,
        ),
      );
      if (portfolioPaths.length)
        assert.equal(
          (
            await operator.storage
              .from("portfolio-media")
              .remove(portfolioPaths)
          ).error,
          null,
        );
      sql(
        `delete from private.portfolio_items where actor_id in (${actorIds});`,
      );
      const ownedRequests = JSON.parse(
        sql(
          `select coalesce(json_agg(id),'[]'::json) from private.custom_requests where customer_name in ('M4 UI ${runId}','M4 API ${runId}');`,
        ),
      );
      for (const id of ownedRequests)
        if (!requestIds.includes(id)) requestIds.push(id);
    }
    if (requestIds.length) {
      const reqs = requestIds.map((id) => `'${id}'`).join(",");
      const paths = JSON.parse(
        sql(
          `select coalesce(json_agg(image_path) filter(where image_path is not null),'[]'::json) from private.custom_requests where id in (${reqs});`,
        ),
      );
      if (paths.length)
        assert.equal(
          (await operator.storage.from("request-images").remove(paths)).error,
          null,
        );
      sql(`delete from private.notification_outbox where entity_id in (${reqs});delete from private.custom_requests where id in (${reqs});`);
    }
    // Account quota is now enforced by the DB, including direct fixture RPC calls.
    for (const user of users) budgetKeys.push(
      createHash("md5").update(`account-checkout:${user.id}`).digest("hex") +
      createHash("md5").update(`account-checkout-2:${user.id}`).digest("hex"),
    );
    if (budgetKeys.length) {
      const keys = budgetKeys.map((key) => `'${key}'`).join(",");
      sql(
        `begin;select pg_advisory_xact_lock(hashtextextended('request-budget',0));update private.request_budgets g set hits=greatest(0,g.hits-x.n) from (select hour,sum(hits)::int n from private.request_budgets where bucket in (${keys}) group by hour) x where g.bucket='global' and g.hour=x.hour;delete from private.request_budgets where bucket in (${keys});commit;`,
      );
    }
    // Kể cả UI lỗi sau create, tìm đúng các item do actor fixture của lần này tạo để cleanup.
    if (users.length) {
      const owned = sql(
        `select coalesce(json_agg(target_id),'[]'::json) from private.admin_audit_events where actor_id='${users[0].id}' and action='catalog_created';`,
      );
      for (const id of JSON.parse(owned))
        if (!catalogIds.includes(id)) catalogIds.push(id);
      if (catalogIds.length) {
        const imagePaths = sql(
          `select coalesce(json_agg(p),'[]'::json) from public.products_services cross join lateral unnest(image_paths) p where id in (${catalogIds.map(Number).join(",")});`,
        );
        for (const path of JSON.parse(imagePaths))
          if (!catalogFiles.includes(path)) catalogFiles.push(path);
        catalogVideos.push(...JSON.parse(sql(`select coalesce(json_agg(video_path) filter(where video_path is not null),'[]'::json) from public.products_services where id in (${catalogIds.map(Number).join(",")});`)));
      }
    }
    if (catalogVideos.length) assert.equal((await operator.storage.from("catalog-videos").remove(catalogVideos)).error,null);
    if (catalogFiles.length)
      assert.equal(
        (await operator.storage.from("catalog-images").remove(catalogFiles))
          .error,
        null,
      );
    if (files.length) {
      const removed = await operator.storage
        .from("request-images")
        .remove(files);
      assert.equal(removed.error, null, "Cleanup fixture Storage files");
    }
    if (users.length) {
      const ids = users.map((user) => `'${user.id}'`).join(",");
      const orderPaths = JSON.parse(
        sql(
          `select coalesce(json_agg(e.path) filter(where e.path is not null),'[]'::json) from private.order_events e join private.orders o on o.id=e.order_id where o.actor_id in (${ids});`,
        ),
      );
      if (orderPaths.length)
        assert.equal(
          (await operator.storage.from("order-media").remove(orderPaths)).error,
          null,
        );
      sql(`delete from private.notification_outbox where entity_id in (select id from private.orders where actor_id in (${ids}));delete from private.inventory_movements where order_id in (select id from private.orders where actor_id in (${ids}));
        delete from private.order_commands where order_id in (select id from private.orders where actor_id in (${ids}));
        delete from private.order_events where order_id in (select id from private.orders where actor_id in (${ids}));
        delete from private.order_payments where order_id in (select id from private.orders where actor_id in (${ids}));
        delete from private.order_lines where order_id in (select id from private.orders where actor_id in (${ids}));
        delete from private.orders where actor_id in (${ids});`);
      if (catalogIds.length) {
        const itemIds = catalogIds.map((id) => Number(id)).join(",");
        sql(
          `delete from private.inventory_movements where item_id in (${itemIds}); delete from private.product_costs where item_id in (${itemIds}); delete from public.products_services where id in (${itemIds});`,
        );
      }
      sql(`delete from private.admin_invites where created_by in (${ids});
        delete from private.admin_audit_events where actor_id in (${ids});
        delete from private.invite_attempts where user_id in (${ids});
        delete from public.admin_members where user_id in (${ids});`);
      for (const user of users)
        assert.equal(
          (await operator.auth.admin.deleteUser(user.id)).error,
          null,
        );
      assert.equal(
        sql(`select count(*) from auth.users where id in (${ids});`),
        "0",
      );
    }
    console.log(
      "CLEANUP: removed this run's synthetic users, sessions, invites, audit and files; real account preserved.",
    );
  } catch {
    console.error(
      "Cleanup incomplete; inspect this run's m1-verification fixtures before rerun.",
    );
    process.exitCode = 1;
  }
}
