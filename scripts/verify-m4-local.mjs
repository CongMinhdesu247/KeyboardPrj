import assert from "node:assert/strict";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";

export async function verifyM4Api({
  admin,
  anonymous,
  operator,
  rpc,
  runId,
  requestIds,
  budgetKeys,
  nonAdmin,
}) {
  for (const name of [
    "list_custom_requests",
    "list_portfolio_admin",
    "read_published_portfolio",
  ])
    assert.ok((await anonymous.rpc(name)).error);
  for (const name of ["list_custom_requests", "list_portfolio_admin"])
    assert.ok((await rpc(nonAdmin, name)).error);
  const id = randomUUID(),
    hash = createHash("sha256").update(runId).digest("hex"),
    key = createHash("sha256").update(`m4-budget-${runId}`).digest("hex");
  budgetKeys.push(key);
  assert.equal(
    (await operator.rpc("consume_request_budget", { p_key: key })).data,
    true,
  );
  const payload = {
    id,
    category: "stab",
    customerName: `M4 API ${runId}`,
    phone: "0901234567",
    budget: 600000,
    referenceUrl: "https://example.com/m4",
    note: "Private request fixture",
    imagePath: "",
    hash,
  };
  requestIds.push(id);
  assert.ok(
    (await anonymous.rpc("submit_custom_request", { p: payload })).error,
  );
  const outcomes = await Promise.all([
    operator.rpc("submit_custom_request", { p: payload }),
    operator.rpc("submit_custom_request", { p: payload }),
  ]);
  for (const r of outcomes) {
    assert.equal(r.error, null);
    assert.equal(r.data.ok, true);
  }
  assert.equal(outcomes.filter((r) => r.data.duplicate).length, 1);
  assert.equal(
    (
      await operator.rpc("submit_custom_request", {
        p: { ...payload, hash: "f".repeat(64) },
      })
    ).data.code,
    "request_conflict",
  );
  const list = await rpc(admin, "list_custom_requests");
  assert.equal(list.error, null);
  assert.equal(list.data.filter((r) => r.id === id).length, 1);
  assert.equal(
    Object.hasOwn(
      list.data.find((r) => r.id === id),
      "payload_hash",
    ),
    false,
  );
  assert.equal(
    (
      await rpc(admin, "update_custom_request", {
        p_id: id,
        p_version: 1,
        p_status: "contacted",
        p_note: "API contact",
      })
    ).data.ok,
    true,
  );
  assert.equal(
    (
      await rpc(admin, "update_custom_request", {
        p_id: id,
        p_version: 1,
        p_status: "done",
        p_note: "stale",
      })
    ).data.code,
    "conflict",
  );
}

export async function verifyM4Ui({
  page,
  publicPage,
  expect,
  admin,
  anonymous,
  operator,
  rpc,
  runId,
  requestIds,
  budgetKeys,
}) {
  const customer = `M4 UI ${runId}`,
    title = `M4 Portfolio ${runId}`,
    errors = [];
  publicPage.on("pageerror", (e) => errors.push(e.name));
  try {
    await publicPage.setViewportSize({ width: 375, height: 812 });
    const response = await publicPage.goto("http://localhost:3000/preorder");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    const token = await publicPage.locator('input[name="token"]').inputValue();
    await publicPage.getByLabel("Tên liên hệ", { exact: true }).fill(customer);
    await publicPage
      .getByLabel("Số điện thoại / Zalo", { exact: true })
      .fill("0901234567");
    await publicPage
      .getByLabel("Ngân sách dự kiến (VND)", { exact: true })
      .fill("500000");
    await publicPage
      .getByLabel("Ghi chú về mẫu muốn tìm", { exact: true })
      .fill("PRIVATE M4 NOTE");
    await publicPage.getByLabel(/Tôi đồng ý để TRUMP Keys/).check();
    await publicPage.getByLabel("Ảnh mẫu", { exact: true }).setInputFiles({
      name: "invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await publicPage
      .getByRole("button", { name: "Gửi yêu cầu đặt tìm", exact: true })
      .click();
    await expect(publicPage.getByRole("status")).toContainText(
      "Ảnh không hợp lệ",
    );
    await expect(
      publicPage.getByLabel("Tên liên hệ", { exact: true }),
    ).toHaveValue(customer);
    const image = await sharp({
      create: { width: 360, height: 240, channels: 3, background: "#f4b73e" },
    })
      .png()
      .toBuffer();
    await publicPage.getByLabel("Ảnh mẫu", { exact: true }).setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: image,
    });
    await publicPage.context().setOffline(true);
    await publicPage
      .getByRole("button", { name: "Gửi yêu cầu đặt tìm", exact: true })
      .click();
    await expect(publicPage.getByRole("status")).toContainText(
      "Chưa kết nối được với shop",
    );
    await expect(
      publicPage.getByLabel("Tên liên hệ", { exact: true }),
    ).toHaveValue(customer);
    await expect(publicPage.locator('input[name="token"]')).toHaveValue(token);
    await publicPage.context().setOffline(false);
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/m4-find-mobile.png",
      fullPage: true,
    });
    await publicPage
      .getByRole("button", { name: "Gửi yêu cầu đặt tìm", exact: true })
      .click();
    await expect(
      publicPage.getByRole("heading", {
        name: "Shop đã nhận yêu cầu",
        exact: true,
      }),
    ).toBeVisible();
    const requests = await rpc(admin, "list_custom_requests"),
      request = requests.data.find((r) => r.customer_name === customer);
    assert.ok(request);
    requestIds.push(request.id);
    assert.ok(request.image_path);
    assert.notEqual(
      (
        await publicPage.request.get(
          `http://127.0.0.1:54321/storage/v1/object/public/request-images/${request.image_path}`,
        )
      ).status(),
      200,
    );
    assert.ok(
      (
        await anonymous.storage
          .from("request-images")
          .createSignedUrl(request.image_path, 300)
      ).error,
    );
    assert.equal(
      (
        await operator.rpc("lookup_request_submission", {
          p_id: request.id,
          p_hash: "0".repeat(64),
        })
      ).data,
      null,
    );
    await page.goto("http://localhost:3000/admin/requests");
    const card = page.locator("article").filter({
      has: page.getByRole("heading", { name: customer, exact: true }),
    });
    await expect(card).toBeVisible();
    await expect
      .poll(() =>
        card
          .getByAltText("Ảnh mẫu khách gửi")
          .evaluate((img) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    await card.getByText("Cập nhật xử lý yêu cầu", { exact: true }).click();
    await card
      .getByLabel("Trạng thái xử lý", { exact: true })
      .selectOption("contacted");
    await card
      .getByLabel("Ghi chú nội bộ", { exact: true })
      .fill("Đã nhắn Zalo, đang tìm mẫu");
    await card.getByRole("button", { name: "Lưu xử lý", exact: true }).click();
    await expect(card.getByRole("status")).toContainText("Đã cập nhật");
    await page.screenshot({
      caret: "initial",
      path: "output/playwright/m4-requests-admin.png",
      fullPage: true,
    });
    // Select one real fixture order image; publication makes a separate private copy.
    const orders = (await rpc(admin, "list_orders")).data,
      source = orders.find((o) => o.keyboard === "M3 Keyboard UI");
    assert.ok(source);
    const order = (await rpc(admin, "read_order", { p_id: source.id })).data,
      event = order.events.find((e) => e.path?.endsWith(".webp"));
    assert.ok(event);
    assert.equal(
      order.actor_id,
      admin.id,
      "Only copy the fixture admin's own order image",
    );
    await page.goto(`http://localhost:3000/admin/orders/${source.id}`);
    await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await page
      .getByRole("link", { name: "Chọn ảnh tạo portfolio", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/portfolio\/new\?/);
    await page.getByLabel("Tên bài portfolio", { exact: true }).fill(title);
    await page
      .getByLabel("Bàn phím / cấu hình", { exact: true })
      .fill("M4 Custom 75%");
    await page
      .getByLabel("Các hạng mục mod", { exact: true })
      .fill("Lube switch · Cân stab");
    await page
      .getByLabel("Link sound test YouTube / TikTok", { exact: true })
      .fill("https://youtu.be/dQw4w9WgXcQ");
    await page
      .getByRole("button", { name: "Lưu portfolio", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/portfolio\/[a-f0-9-]{36}$/);
    const edit = page.url(),
      pid = edit.split("/").at(-1);
    const item = (await rpc(admin, "list_portfolio_admin")).data.find(
      (i) => i.id === pid,
    );
    assert.ok(item.image_path);
    assert.notEqual(item.image_path, event.path);
    assert.equal(item.published, false);
    assert.notEqual(
      (
        await publicPage.request.get(
          `http://127.0.0.1:54321/storage/v1/object/public/portfolio-media/${item.image_path}`,
        )
      ).status(),
      200,
    );
    assert.ok(
      (
        await anonymous.storage
          .from("portfolio-media")
          .createSignedUrl(item.image_path, 300)
      ).error,
    );
    await publicPage.goto("http://localhost:3000/portfolio");
    await expect(
      publicPage.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Công khai trên website", { exact: true }).check();
    await page
      .getByRole("button", { name: "Lưu portfolio", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Xác nhận đã kiểm tra",
    );
    await expect(
      page.getByLabel("Tên bài portfolio", { exact: true }),
    ).toHaveValue(title);
    await expect(
      page.getByLabel("Công khai trên website", { exact: true }),
    ).toBeChecked();
    await page.getByLabel(/Tôi đã kiểm tra quyền sử dụng/).check();
    await page
      .getByRole("button", { name: "Lưu portfolio", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Đã công khai");
    await publicPage.goto("http://localhost:3000/portfolio");
    const publicCard = publicPage.locator("article").filter({
      has: publicPage.getByRole("heading", { name: title, exact: true }),
    });
    await expect(publicCard).toBeVisible();
    await expect
      .poll(() =>
        publicCard.getByAltText(title).evaluate((img) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    const content = await publicPage.content();
    for (const value of [
      customer,
      "PRIVATE M4 NOTE",
      "0901234567",
      "payload_hash",
      source.code,
      event.path,
    ])
      assert.equal(content.includes(value), false);
    await expect(publicCard.locator("iframe")).toHaveCount(0);
    await publicPage.route("https://www.youtube-nocookie.com/**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Fixture video frame</title>",
      }),
    );
    await publicPage.setViewportSize({ width: 1440, height: 1000 });
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/m4-portfolio-desktop.png",
      fullPage: true,
    });
    await publicPage.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(() =>
        publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/m4-portfolio-mobile.png",
      fullPage: true,
    });
    await publicCard
      .getByRole("button", { name: "Mở sound test", exact: true })
      .click();
    await expect(publicCard.locator("iframe")).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0$/,
    );
    await publicPage.goto("http://localhost:3000/");
    await expect(
      publicPage.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.goto(edit);
    await page.getByLabel("Công khai trên website", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Lưu portfolio", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Đã lưu bản nháp");
    await publicPage.goto("http://localhost:3000/portfolio");
    await expect(
      publicPage.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    await page.goto(edit);
    await page.getByText("Lưu trữ bài portfolio", { exact: true }).click();
    await page
      .getByRole("button", { name: "Xác nhận lưu trữ bài", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/portfolio\?archived=1$/);
    assert.equal(
      (await rpc(admin, "read_order", { p_id: source.id })).data.events.find(
        (e) => e.id === event.id,
      ).path,
      event.path,
    );
    assert.equal(
      (await admin.client.storage.from("order-media").download(event.path))
        .error,
      null,
    );
    assert.deepEqual(errors, []);
  } finally {
    const visitor = (
      await publicPage.context().cookies("http://localhost:3000/preorder")
    )
      .find((c) => c.name === "tk-find-visitor")
      ?.value.split(".")[0];
    if (visitor) {
      const secret = readFileSync(".env.local", "utf8")
        .match(/^SUPABASE_SECRET_KEY=(.+)$/m)?.[1]
        ?.trim();
      if (secret)
        budgetKeys.push(
          createHmac("sha256", secret)
            .update(`find-budget:local:${visitor}`)
            .digest("hex"),
        );
    }
  }
}
