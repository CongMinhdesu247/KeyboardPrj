import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import jsQR from "jsqr";
import {
  createVietQrPayload,
  receivingBank,
} from "../src/lib/bank-transfer.ts";

async function decodedQr(locator) {
  const source = await locator.getAttribute("src");
  assert.ok(source?.startsWith("data:image/png;base64,"));
  const { data, info } = await sharp(
    Buffer.from(source.split(",")[1], "base64"),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.ok(decoded);
  return decoded.data;
}

export async function verifyM3Api({
  admin,
  anonymous,
  operator,
  rpc,
  runId,
  catalogIds,
  sql,
}) {
  const created = await rpc(admin, "save_catalog_item", {
    p_item: {
      name: `M3 fixture ${runId}`,
      description: "Fixture only",
      category: "keycap",
      type: "product",
      unit: "bộ",
      price: 100000,
      cost: 50000,
      active: true,
      lubePackage: "",
      imagePath: "",
    },
  });
  assert.equal(created.data?.ok, true);
  const itemId = created.data.id;
  catalogIds.push(itemId);
  assert.equal(
    (
      await rpc(admin, "adjust_inventory", {
        p_id: Number(itemId),
        p_delta: 1,
        p_reason: "M3 test stock",
        p_request_id: randomUUID(),
      })
    ).data?.ok,
    true,
  );
  const create = () => ({
    action: "create",
    requestId: randomUUID(),
    code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,
    customerName: "M3 Customer Private",
    phone: "0901234567",
    keyboard: "M3 Test",
    internalNote: "M3 SECRET",
    plan: "deposit_cod",
    items: [{ itemId, quantity: 1, version: 2 }],
  });
  const p = create(),
    q = create();
  const [a, b] = await Promise.all([
    rpc(admin, "order_command", { p }),
    rpc(admin, "order_command", { p: q }),
  ]);
  assert.equal(a.data?.ok, true);
  assert.equal(b.data?.ok, true);
  const pay = (id) => ({
    action: "receipt",
    orderId: id,
    requestId: randomUUID(),
    amount: 20000,
    method: "bank",
    reference: "M3 bank",
  });
  const pa = pay(a.data.id),
    pb = pay(b.data.id);
  const responses = await Promise.all([
    rpc(admin, "order_command", { p: pa }),
    rpc(admin, "order_command", { p: pb }),
  ]);
  assert.equal(responses.filter((r) => r.data?.ok).length, 1);
  assert.equal(
    responses.filter((r) => r.data?.code === "insufficient_stock").length,
    1,
  );
  const won = responses[0].data.ok ? pa : pb;
  const retries = await Promise.all([
    rpc(admin, "order_command", { p: won }),
    rpc(admin, "order_command", { p: won }),
  ]);
  for (const r of retries) assert.equal(r.data?.ok, true);
  assert.equal(
    sql(
      `select stock_quantity from public.products_services where id=${Number(itemId)}`,
    ),
    "0",
  );
  assert.equal(
    sql(
      `select count(*) from private.order_payments where order_id='${won.orderId}'`,
    ),
    "1",
  );
  assert.ok((await anonymous.rpc("track_order", { p_code: p.code })).error);
  assert.ok((await anonymous.rpc("list_orders")).error);
  const tracked = await operator.rpc("track_order", { p_code: p.code });
  assert.equal(tracked.error, null);
  const serialized = JSON.stringify(tracked.data);
  for (const denied of [
    "0901234567",
    "M3 Customer Private",
    "M3 SECRET",
    "cost_vnd",
  ])
    assert.equal(serialized.includes(denied), false);
  assert.equal(
    (await operator.rpc("track_order", { p_code: `TK-${"0".repeat(32)}` }))
      .data,
    null,
  );
  const cancellation = {
    action: "cancel",
    requestId: randomUUID(),
    orderId: won.orderId,
    reason: "Fixture cancellation",
    returns: { [itemId]: 1 },
  };
  assert.equal(
    (await rpc(admin, "order_command", { p: cancellation })).data?.ok,
    true,
  );
  assert.equal(
    (await rpc(admin, "order_command", { p: cancellation })).data?.ok,
    true,
  );
  assert.equal(
    sql(
      `select stock_quantity from public.products_services where id=${Number(itemId)}`,
    ),
    "1",
  );
}

export async function verifyM3Ui({
  page,
  publicPage,
  expect,
  admin,
  rpc,
  runId,
  catalogIds,
}) {
  const name = `M3 UI lube ${runId}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  const c = await rpc(admin, "save_catalog_item", {
    p_item: {
      name,
      description: "Fixture only",
      category: "lube",
      type: "service",
      unit: "gói",
      price: 100000,
      cost: 0,
      active: true,
      lubePackage: "",
      imagePath: "",
    },
  });
  assert.equal(c.data?.ok, true);
  catalogIds.push(c.data.id);
  await page.goto("http://localhost:3000/admin/orders/new");
  await page
    .getByLabel("Tên khách hàng", { exact: true })
    .fill("Nguyễn Văn Fixture");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0901234567");
  await page
    .getByLabel("Bàn phím / cấu hình", { exact: true })
    .fill("M3 Keyboard UI");
  await page.getByLabel(`Số lượng ${name}`, { exact: true }).fill("1");
  await page
    .getByLabel("Tìm hạng mục", { exact: true })
    .fill("not-a-real-item");
  await expect(
    page.getByText("Không có hạng mục phù hợp.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tìm hạng mục", { exact: true }).fill("");
  await expect(
    page.getByLabel(`Số lượng ${name}`, { exact: true }),
  ).toHaveValue("1");
  await page
    .getByLabel("Ghi chú nội bộ", { exact: true })
    .fill("PRIVATE UI NOTE");
  await page.getByRole("button", { name: "Tạo đơn hàng", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/[a-f0-9-]{36}$/);
  const orderId = page.url().split("/").at(-1),
    detail = page.url();
  const read = await rpc(admin, "read_order", { p_id: orderId });
  assert.equal(read.data.total_vnd, 100000);
  assert.equal(read.data.stage, 0);
  const track = `http://localhost:3000/track/${read.data.code}`;
  assert.match(read.data.payment_reference, /^TK\d{10}$/);
  assert.equal(
    (await rpc(admin, "read_order", { p_id: orderId })).data.payments.length,
    0,
  );
  await publicPage.goto(track);
  await expect(
    publicPage.getByRole("heading", {
      name: "Chuyển khoản cọc 20%",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    publicPage.getByLabel("Số tài khoản", { exact: true }),
  ).toHaveValue("1500200768268");
  await expect(
    publicPage.getByLabel("Nội dung chuyển khoản", { exact: true }),
  ).toHaveValue(read.data.payment_reference);
  const expectedPayload = createVietQrPayload({
    ...receivingBank,
    amount: 20000,
    reference: read.data.payment_reference,
  });
  assert.equal(
    await decodedQr(
      publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true }),
    ),
    expectedPayload,
  );
  assert.equal(expectedPayload.includes(read.data.code), false);
  await publicPage.reload();
  assert.equal(
    (await rpc(admin, "read_order", { p_id: orderId })).data.payments.length,
    0,
    "Viewing/refreshing/scanning QR cannot confirm receipt",
  );
  await publicPage.setViewportSize({ width: 375, height: 812 });
  await expect(publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    .toBe(true);
  await publicPage.screenshot({
    caret: "initial",
    path: "output/playwright/bank-payment-mobile.png",
    fullPage: true,
  });
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  await expect(publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true })).toBeVisible();
  await expect.poll(() => publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await publicPage.screenshot({
    caret: "initial",
    path: "output/playwright/bank-payment-desktop.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("tab", { name: "Thanh toán", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByText("Xem QR chuyển khoản của đơn", { exact: true }).click();
  assert.equal(
    await decodedQr(
      page.getByAltText("QR chuyển khoản Agribank", { exact: true }),
    ),
    expectedPayload,
  );
  await page.getByText("Xem QR chuyển khoản của đơn", { exact: true }).click();
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-payment-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Tiến độ & ảnh", exact: true }).click();
  const advance = page.getByRole("button", {
    name: "Chuyển sang Đang xử lý",
    exact: true,
  });
  await advance.click();
  await expect(page.getByRole("status")).toContainText(
    "Cần ghi nhận đã nhận cọc",
  );
  await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
  await page
    .getByLabel("Mã giao dịch / chứng từ", { exact: true })
    .fill("BANK M3 UI");
  await page
    .getByRole("button", { name: "Ghi nhận thực thu", exact: true })
    .click();
  await expect(
    page.getByText("Đã nhận cọc. Khoản COD", { exact: false }),
  ).toBeVisible();
  await publicPage
    .getByRole("link", { name: "Tải lại trạng thái thanh toán", exact: true })
    .click();
  await expect(
    publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true }),
  ).toHaveCount(0);
  await expect(
    publicPage.getByRole("heading", {
      name: "Shop đã xác nhận nhận cọc",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(detail);
  await page
    .getByRole("button", { name: "Chuyển sang Đang xử lý", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu" }),
  ).toBeVisible();
  await page.goto(detail);
  const proof = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Lưu tiến độ public",
      exact: true,
    }),
  });
  await proof
    .getByLabel("Ghi chú public", { exact: true })
    .fill("Đã lube và cân chỉnh");
  await proof.getByLabel("Ảnh / MP4", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await proof
    .getByRole("button", { name: "Lưu tiến độ public", exact: true })
    .click();
  await expect(proof.getByRole("status")).toContainText("Ảnh không hợp lệ");
  await expect(proof.getByLabel("Ghi chú public", { exact: true })).toHaveValue(
    "Đã lube và cân chỉnh",
  );
  const image = await sharp({
    create: { width: 160, height: 100, channels: 3, background: "#f59e0b" },
  })
    .png()
    .toBuffer();
  await proof.getByLabel("Ảnh / MP4", { exact: true }).setInputFiles({
    name: "keyboard.png",
    mimeType: "image/png",
    buffer: image,
  });
  await proof
    .getByRole("button", { name: "Lưu tiến độ public", exact: true })
    .click();
  await expect(proof.getByRole("status")).toContainText("Đã lưu");
  const response = await publicPage.goto(track);
  assert.equal(response.status(), 200);
  assert.ok(response.headers()["cache-control"].includes("no-store"));
  await expect(
    publicPage.getByText("*******567", { exact: true }),
  ).toBeVisible();
  await expect(
    publicPage.getByText("Đã lube và cân chỉnh", { exact: true }),
  ).toBeVisible();
  const content = await publicPage.content();
  for (const secret of [
    "0901234567",
    "PRIVATE UI NOTE",
    "Nguyễn Văn Fixture",
    "cost_vnd",
  ])
    assert.equal(content.includes(secret), false);
  const photo = publicPage.locator(".proof-grid img");
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
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
    path: "output/playwright/m3-track-mobile.png",
    fullPage: true,
  });
  await publicPage.setViewportSize({ width: 1440, height: 1000 });
  await publicPage.screenshot({
    caret: "initial",
    path: "output/playwright/m3-track-desktop.png",
    fullPage: true,
  });
  await page.goto(detail);
  await page
    .getByRole("button", { name: "Chuyển sang Hoàn thành", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chuyển sang Hoàn thành", exact: true }),
  ).toHaveCount(0);
  assert.equal(
    (await rpc(admin, "read_order", { p_id: orderId })).data.stage,
    2,
  );
  await page.goto(detail);
  await page
    .getByLabel("Mã giao dịch / chứng từ", { exact: true })
    .fill("COD M3 UI REMITTED");
  await page
    .getByRole("button", { name: "Ghi nhận thực thu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ghi nhận thực thu", exact: true }),
  ).toHaveCount(0);
  await page.goto(detail);
  await expect(
    page.getByRole("button", { name: "Ghi nhận thực thu", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/m3-admin-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Link & QR", exact: true }).click();
  await expect(page.getByAltText("QR mở trang tra cứu đơn")).toBeVisible();
  await expect(
    page.getByText("Đây là QR tra cứu, không dùng để chuyển khoản.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-qr-desktop.png",
    fullPage: true,
  });
  // Arrow navigation and mobile layouts use the same real order, without touching the user's account.
  await page.getByRole("tab", { name: "Thông tin đơn", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Link & QR", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  for (const href of ["/admin", "/admin/orders", "/admin/catalog", "/admin/reports"]) {
    const link = page.locator(`.admin-nav-daily a[href="${href}"]`);
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 375, "Daily navigation fits mobile viewport");
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("tab", { name: "Tiến độ & ảnh", exact: true }).click();
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-order-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/admin/orders");
  await page.getByLabel("Tìm đơn hàng", { exact: true }).fill(read.data.code);
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.locator(".admin-order-row")).toHaveCount(1);
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-orders-desktop.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/admin");
  await expect(
    page.getByRole("heading", { name: "Tổng quan cửa hàng", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    caret: "initial",
    path: "output/playwright/admin-dashboard-mobile.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/admin/team");
  await expect(
    page.getByRole("heading", { name: "Quản trị viên", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tạo mã mời 24 giờ", exact: true })
    .click();
  await expect(
    page.getByLabel("Mã mời vừa tạo — chọn để sao chép", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await publicPage.goto(track);
  await expect(
    publicPage.getByText("Đã thanh toán đủ", { exact: true }),
  ).toBeVisible();
  await publicPage.goto(`http://localhost:3000/track/TK-${"0".repeat(32)}`);
  await expect(
    publicPage.getByRole("heading", {
      name: /Kiểm tra lại đường dẫn hoặc mã đơn/i,
    }),
  ).toBeVisible();
  // Full bank transfer uses 100%, and cancellation hides its QR without recording payment.
  const fullPayload = {
    action: "create",
    requestId: randomUUID(),
    code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,
    customerName: "Full QR Fixture",
    phone: "0901234567",
    keyboard: "QR Full",
    plan: "transfer_full",
    items: [{ itemId: c.data.id, quantity: 1, version: 1 }],
  };
  const full = await rpc(admin, "order_command", { p: fullPayload });
  assert.equal(full.data.ok, true);
  const fullOrder = (await rpc(admin, "read_order", { p_id: full.data.id }))
    .data;
  const fullTrack = `http://localhost:3000/track/${fullPayload.code}`;
  await publicPage.goto(fullTrack);
  await expect(
    publicPage.getByRole("heading", {
      name: "Chuyển khoản toàn bộ 100%",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    await decodedQr(
      publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true }),
    ),
    createVietQrPayload({
      ...receivingBank,
      amount: 100000,
      reference: fullOrder.payment_reference,
    }),
  );
  const cancel = await rpc(admin, "order_command", {
    p: {
      action: "cancel",
      requestId: randomUUID(),
      orderId: full.data.id,
      reason: "QR test cancellation",
      returns: {},
    },
  });
  assert.equal(cancel.data.ok, true);
  await publicPage.goto(fullTrack);
  await expect(
    publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true }),
  ).toHaveCount(0);
  await expect(
    publicPage.getByText("Không chuyển thêm tiền vào đơn này.", {
      exact: false,
    }),
  ).toBeVisible();
}
