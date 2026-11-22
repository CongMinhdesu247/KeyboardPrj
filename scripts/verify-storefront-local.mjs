import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import jsQR from "jsqr";
import { setFixtureBrowserUser } from "./fixture-browser-auth.mjs";
import {
  createVietQrPayload,
  receivingBank,
} from "../src/lib/bank-transfer.ts";

export async function verifyStorefrontUi({
  page,
  publicPage,
  expect,
  admin,
  anonymous,
  rpc,
  runId,
  catalogIds,
  catalogFiles,
  budgetKeys,
  customer,
}) {
  await setFixtureBrowserUser(publicPage.context(),customer);
  const name = `Keyboard Store ${runId}`,
    imagePath = `${randomUUID()}.webp`;
  const keys = Array.from(
    { length: 48 },
    (_, n) =>
      `<rect x="${62 + (n % 12) * 40}" y="${150 + Math.floor(n / 12) * 40}" width="32" height="30" rx="5" fill="${n === 0 ? "#fbbf24" : "#fff"}"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#eef2f7"/><rect x="38" y="125" width="524" height="225" rx="20" fill="#29364a"/>${keys}<text x="300" y="405" text-anchor="middle" font-family="Arial" font-size="20" fill="#4b5563">Keyboard fixture · test image</text></svg>`;
  const image = await sharp(Buffer.from(svg)).webp().toBuffer();
  assert.equal(
    (
      await admin.client.storage
        .from("catalog-images")
        .upload(imagePath, image, { contentType: "image/webp" })
    ).error,
    null,
  );
  catalogFiles.push(imagePath);
  const input = {
    name,
    description:
      "Fixture mechanical keyboard. Product detail and compatibility.",
    category: "keyboard",
    type: "product",
    unit: "bộ",
    price: 650000,
    cost: 350000,
    active: true,
    lubePackage: "",
    imagePath,
  };
  const created = await rpc(admin, "save_catalog_item", { p_item: input });
  assert.equal(created.data?.ok, true);
  const id = created.data.id;
  catalogIds.push(id);
  assert.equal(
    (
      await rpc(admin, "adjust_inventory", {
        p_id: Number(id),
        p_delta: 4,
        p_reason: "Storefront fixture stock",
        p_request_id: randomUUID(),
      })
    ).data.ok,
    true,
  );
  const errors = [];
  publicPage.on("pageerror", (e) => errors.push(e.name));
  try {
    await publicPage.setViewportSize({ width: 1440, height: 1000 });
    await publicPage.goto("http://localhost:3000/");
    await expect(publicPage.locator(".buyer-home h1")).toBeVisible();
    await publicPage.screenshot({ caret: "initial", path: "output/playwright/buyer-home-fixture-desktop.png", fullPage: true });
    await publicPage.setViewportSize({ width: 375, height: 812 });
    await expect.poll(() => publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await publicPage.screenshot({ caret: "initial", path: "output/playwright/buyer-home-fixture-mobile.png", fullPage: true });
    await publicPage.setViewportSize({ width: 1440, height: 1000 });
    await publicPage.goto("http://localhost:3000/shop");
    await publicPage.getByLabel("Tìm trong cửa hàng", { exact: true }).fill(name);
    await publicPage.getByRole("button", { name: "Tìm kiếm sản phẩm", exact: true }).click();
    await expect(publicPage).toHaveURL(new RegExp(`/shop\\?q=${encodeURIComponent(name).replaceAll("%20", "\\+")}`));
    await expect(publicPage.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true })).toHaveValue(name);
    await publicPage
      .getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true })
      .fill(name);
    const card = publicPage
      .locator(".product-card")
      .filter({ has: publicPage.getByRole("heading", { name, exact: true }) });
    await expect(card).toContainText("650.000");
    await expect(card).toContainText("Còn 4");
    await expect
      .poll(() =>
        card
          .getByAltText(name, { exact: true })
          .evaluate((i) => i.naturalWidth),
      )
      .toBeGreaterThan(0);
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/storefront-desktop.png",
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
      path: "output/playwright/storefront-mobile.png",
      fullPage: true,
    });
    await card
      .getByRole("button", { name: "Thêm vào giỏ", exact: true })
      .click();
    await expect(card.getByRole("status")).toContainText("Đã thêm");
    await expect(publicPage.locator(".buyer-cart-count")).toHaveText("1");
    await publicPage.goto(`http://localhost:3000/shop/${id}`);
    await expect(
      publicPage.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByText(input.description, { exact: true }),
    ).toBeVisible();
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/store-product-mobile.png",
      fullPage: true,
    });
    await publicPage.goto("http://localhost:3000/cart");
    await publicPage.getByLabel(`Số lượng ${name}`, { exact: true }).fill("2");
    await publicPage.reload();
    await expect(
      publicPage.getByLabel(`Số lượng ${name}`, { exact: true }),
    ).toHaveValue("2");
    assert.equal(
      (
        await rpc(admin, "save_catalog_item", {
          p_item: { ...input, id, version: 2, price: 700000 },
        })
      ).data.ok,
      true,
    );
    await publicPage.reload();
    await expect(
      publicPage.getByText("Giá đã thay đổi, hãy xác nhận giá mới.", {
        exact: true,
      }),
    ).toBeVisible();
    await publicPage
      .getByRole("button", { name: "Xác nhận giá mới", exact: true })
      .click();
    await publicPage
      .getByRole("link", { name: "Tiến hành đặt hàng", exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/checkout$/);
    await publicPage
      .getByLabel("Họ và tên", { exact: true })
      .fill(`Shop UI ${runId}`);
    await publicPage
      .getByLabel("Số điện thoại", { exact: true })
      .fill("0901234567");
    await publicPage
      .getByLabel("Địa chỉ nhận hàng", { exact: true })
      .fill(`PRIVATE ADDRESS ${runId}`);
    await publicPage
      .getByLabel("Ghi chú cho shop", { exact: true })
      .fill("PRIVATE STORE NOTE");
    await publicPage.getByLabel(/Tôi đã kiểm tra cấu hình/).check();
    await publicPage.screenshot({
      caret: "initial",
      path: "output/playwright/store-checkout-mobile.png",
      fullPage: true,
    });
    await expect
      .poll(() =>
        publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    const abortCheckout=route=>route.request().method()==="POST"?route.abort("failed"):route.continue();
    await publicPage.route("**/checkout",abortCheckout);
    await publicPage.getByRole("button",{name:"Đặt hàng & nhận QR",exact:true}).click();
    await expect(publicPage.locator('.checkout-summary [role="status"]')).toContainText("Thông tin vẫn giữ nguyên");
    await expect(publicPage.getByLabel("Địa chỉ nhận hàng",{exact:true})).toHaveValue(`PRIVATE ADDRESS ${runId}`);
    await expect(publicPage.getByLabel("Ghi chú cho shop",{exact:true})).toHaveValue("PRIVATE STORE NOTE");
    await publicPage.unroute("**/checkout",abortCheckout);
    await publicPage
      .getByRole("button", { name: "Đặt hàng & nhận QR", exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/track\/TK-[A-F0-9]{32}$/, { timeout: 15000 });
    const track = publicPage.url();
    const orderSummary = (await rpc(admin, "list_orders")).data.find(
      (o) => o.customer_name === `Shop UI ${runId}`,
    );
    assert.ok(orderSummary);
    const order = (await rpc(admin, "read_order", { p_id: orderSummary.id }))
      .data;
    assert.equal(order.source, "web");
    assert.equal(order.actor_id, null);
    assert.equal(order.total_vnd, 1400000);
    assert.equal(order.deposit_vnd, 280000);
    assert.equal(order.payments.length, 0);
    assert.equal(order.shipping_address, `PRIVATE ADDRESS ${runId}`);
    assert.equal(
      (
        await anonymous
          .from("products_services")
          .select("stock_quantity")
          .eq("id", Number(id))
          .single()
      ).data.stock_quantity,
      4,
    );
    const imageUrl = await publicPage
      .getByAltText("QR chuyển khoản Agribank", { exact: true })
      .getAttribute("src");
    const { data, info } = await sharp(
      Buffer.from(imageUrl.split(",")[1], "base64"),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(
      jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data,
      createVietQrPayload({
        ...receivingBank,
        amount: 280000,
        reference: order.payment_reference,
      }),
    );
    const html = await publicPage.content();
    for (const privateValue of [
      order.phone,
      order.shipping_address,
      "PRIVATE STORE NOTE",
      "cost_vnd",
    ])
      assert.equal(html.includes(privateValue), false);
    await page.goto(`http://localhost:3000/admin/orders/${order.id}`);
    await page.getByRole("tab", { name: "Thông tin đơn", exact: true }).click();
    await expect(
      page.getByText(`Giao tới: PRIVATE ADDRESS ${runId}`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Thanh toán", exact: true }).click();
    await page
      .getByLabel("Mã giao dịch / chứng từ", { exact: true })
      .fill("STORE BANK CONFIRMED");
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
      publicPage.getByRole("heading", {
        name: "Shop đã xác nhận nhận cọc",
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      (
        await anonymous
          .from("products_services")
          .select("stock_quantity")
          .eq("id", Number(id))
          .single()
      ).data.stock_quantity,
      2,
    );
    await publicPage.goto("http://localhost:3000/cart");
    await expect(
      publicPage.getByRole("heading", {
        name: "Giỏ hàng đang trống",
        exact: true,
      }),
    ).toBeVisible();
    await publicPage.goto(`http://localhost:3000/shop/${id}`);
    await publicPage
      .getByRole("link", { name: "Mua ngay", exact: true })
      .click();
    await publicPage
      .getByLabel("Họ và tên", { exact: true })
      .fill(`Shop Full ${runId}`);
    await publicPage
      .getByLabel("Số điện thoại", { exact: true })
      .fill("0901234567");
    await publicPage
      .getByLabel("Nhận hàng", { exact: true })
      .selectOption("pickup");
    await publicPage.getByRole("radio", { name: /Chuyển khoản 100%/ }).check();
    await publicPage.getByLabel(/Tôi đã kiểm tra cấu hình/).check();
    await publicPage
      .getByRole("button", { name: "Đặt hàng & nhận QR", exact: true })
      .click();
    await expect(publicPage).toHaveURL(/\/track\/TK-[A-F0-9]{32}$/, { timeout: 15000 });
    await expect(
      publicPage.getByRole("heading", {
        name: "Chuyển khoản toàn bộ 100%",
        exact: true,
      }),
    ).toBeVisible();
    // A pending guest order must not keep offering payment after stock becomes insufficient.
    assert.equal(
      (
        await rpc(admin, "adjust_inventory", {
          p_id: Number(id),
          p_delta: -2,
          p_reason: "Fixture stock became unavailable",
          p_request_id: randomUUID(),
        })
      ).data.ok,
      true,
    );
    await publicPage.reload();
    await expect(
      publicPage.getByAltText("QR chuyển khoản Agribank", { exact: true }),
    ).toHaveCount(0);
    await expect(
      publicPage.getByRole("heading", {
        name: "Shop cần kiểm tra lại mặt hàng",
        exact: true,
      }),
    ).toBeVisible();
    await publicPage.goto(track);
    await expect(
      publicPage.getByRole("heading", {
        name: "Shop đã xác nhận nhận cọc",
        exact: true,
      }),
    ).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    const visitor = (
      await publicPage.context().cookies("http://localhost:3000/checkout")
    )
      .find((c) => c.name === "tk-checkout-visitor")
      ?.value.split(".")[0];
    const secret = readFileSync(".env.local", "utf8")
      .match(/^SUPABASE_SECRET_KEY=(.+)$/m)?.[1]
      ?.trim();
    if (visitor && secret)
      budgetKeys.push(
        createHmac("sha256", secret)
          .update(`checkout-budget:local:${visitor}`)
          .digest("hex"),
      );
  }
}
