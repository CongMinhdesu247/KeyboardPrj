import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";

// Read-only against the server: the isolated browser's cart never creates an order.
const expect = baseExpect.configure({ timeout: 15000 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("output/playwright", { recursive: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const visit = async (name, path, width) => {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main h1")).toHaveCount(1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal overflow at ${width}px`);
    await page.screenshot({ path: `output/playwright/buyer-${name}-${width}-viewport.png`, caret: "initial" });
    await page.screenshot({ path: `output/playwright/buyer-${name}-${width}.png`, fullPage: true, caret: "initial" });
  };
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await visit("home", "/", width);
    if (width === 375) {
      const lastCategory = page.locator('.buyer-navigation a[href="/portfolio"]');
      await lastCategory.focus();
      await expect(lastCategory).toBeInViewport();
    }
    await page.locator('.storefront-home a[href="/shop"]').click();
    await expect(page).toHaveURL(/\/shop$/);
    await visit("shop", "/shop", width);
    const cards = page.locator(".product-card");
    if (await cards.count()) {
      const available = cards.filter({ has: page.getByRole("button", { name: "Thêm vào giỏ", exact: true }) });
      const target = (await available.count()) ? available.first() : cards.first();
      const name = await target.locator("h3").innerText();
      await page.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true }).fill("không có mẫu kiểm tra giao diện 918273");
      await expect(page.getByRole("heading", { name: "Chưa có mặt hàng phù hợp", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Xem tất cả mặt hàng", exact: true }).click();
      await expect(page.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true })).toHaveValue("");
      await page.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true }).fill(name);
      const card = page.locator(".product-card").first();
      const path = await card.locator(".product-photo").getAttribute("href");
      const add = card.getByRole("button", { name: "Thêm vào giỏ", exact: true });
      if ((await add.count()) && (await add.isEnabled())) {
        await add.click();
        await expect(card.getByRole("status")).toContainText("Đã thêm");
        await expect.poll(() => page.locator(".buyer-cart-count").innerText()).not.toBe("0");
        await visit("product", path, width);
        await visit("cart", "/cart", width);
        await visit("checkout", "/checkout", width);
        await expect(page.getByRole("heading", { name: "Đăng nhập để đặt hàng", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Đăng nhập với Google", exact: true })).toBeVisible();
        await expect(page.locator(".site-header .buyer-navigation")).toBeHidden();
        await expect(page.locator(".mobile-nav")).toBeHidden();
      }
    }
    await visit("category-empty", "/shop?category=keyboard&q=khong-co-mau-918273", width);
    await expect(page.getByRole("button", { name: "Bàn phím", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true })).toHaveValue("khong-co-mau-918273");
    for (const [name, path] of [["chat", "/chat"], ["preorder", "/preorder"], ["portfolio", "/portfolio"], ["guide", "/guide"], ["privacy", "/privacy"], ["tracking", "/track/KB-DEMO2026"]]) {
      await visit(name, path, width);
    }
  }
  // Verify a recoverable form failure without allowing a write to reach the server.
  await page.goto("http://localhost:3000/preorder");
  await page.getByLabel("Tên liên hệ", { exact: true }).fill("Kiểm tra giao diện");
  await page.getByLabel("Số điện thoại / Zalo", { exact: true }).fill("0901234567");
  await page.getByLabel("Ngân sách dự kiến (VND)", { exact: true }).fill("100000");
  await page.getByLabel("Link mẫu tham khảo", { exact: true }).fill("https://example.com/keyboard");
  await page.getByLabel("Ghi chú về mẫu muốn tìm", { exact: true }).fill("Giữ nội dung khi mất kết nối");
  await page.getByRole("checkbox").check();
  let blockedWrites = 0;
  await page.route("**/preorder", (route) => {
    if (route.request().method() === "POST") { blockedWrites++; return route.abort("failed"); }
    return route.continue();
  });
  await page.getByRole("button", { name: "Gửi yêu cầu đặt tìm", exact: true }).click();
  await expect(page.locator('.m4-form [role="status"]')).toContainText("Thông tin vẫn được giữ");
  await expect(page.locator('.m4-form [role="status"]')).toBeFocused();
  await expect(page.locator('.m4-form [role="status"]')).toBeInViewport();
  await expect(page.getByLabel("Tên liên hệ", { exact: true })).toHaveValue("Kiểm tra giao diện");
  await expect(page.getByLabel("Ghi chú về mẫu muốn tìm", { exact: true })).toHaveValue("Giữ nội dung khi mất kết nối");
  assert.equal(blockedWrites, 1);
  await page.unroute("**/preorder");
  await page.screenshot({ path: "output/playwright/buyer-request-error-375.png", fullPage: true, caret: "initial" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/shop");
  if (await page.locator(".product-card img").count()) {
    await page.route("**/storage/v1/object/public/catalog-images/**", (route) => route.abort("failed"));
    await page.reload();
    await expect(page.getByRole("img", { name: /^Ảnh chưa tải được:/ }).first()).toBeVisible();
    await page.screenshot({ path: "output/playwright/buyer-image-error-1440.png", caret: "initial" });
    await page.unroute("**/storage/v1/object/public/catalog-images/**");
    await page.reload();
    await expect.poll(() => page.locator(".product-card img").first().evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/");
  await page.getByLabel("Tìm trong cửa hàng", { exact: true }).fill("kiểm tra tìm kiếm");
  await page.getByRole("button", { name: "Tìm kiếm sản phẩm", exact: true }).click();
  await expect(page.getByLabel("Tìm sản phẩm hoặc dịch vụ", { exact: true })).toHaveValue("kiểm tra tìm kiếm");
  await page.goto("http://localhost:3000/#tracking");
  await page.getByLabel("Theo dõi đơn của bạn", { exact: true }).fill("SAI-MA");
  await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await expect(page.locator("#tracking-error")).toBeVisible();
  assert.deepEqual(errors, [], "No application page errors");
  console.log("PASS: buyer UI at 375/1440, all public pages, keyboard navigation, filter reset, isolated cart, checkout focus, retained forms on blocked network failures, image failure/reload and tracking validation. No order/request submitted.");
} finally {
  await browser.close();
}
