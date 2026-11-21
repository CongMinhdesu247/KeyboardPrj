import assert from "node:assert/strict";
export async function verifyM7Ui({
  page,
  expect,
  admin,
  rpc,
  runId,
  catalogIds,
}) {
  const item = await rpc(admin, "save_catalog_item", {
    p_item: {
      name: `M7 content ${runId}`,
      description: "Fixture content for readiness",
      category: "lube",
      type: "service",
      unit: "gói",
      price: 100000,
      cost: 1000,
      active: true,
      lubePackage: "",
      imagePath: "",
    },
  });
  assert.equal(item.data?.ok, true);
  catalogIds.push(String(item.data.id));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/admin/readiness");
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị vận hành", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa có ảnh", { exact: false }).first(),
  ).toBeVisible();
  const missing = page.locator(".readiness-items a", {
    hasText: `M7 content ${runId}`,
  });
  await expect(missing).toBeVisible();
  await page.screenshot({
      caret: "initial",
    path: "output/playwright/m7-readiness-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
      caret: "initial",
    path: "output/playwright/m7-readiness-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await missing.click();
  await expect(page).toHaveURL(new RegExp(`/admin/catalog/${item.data.id}$`));
  const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 375, height: 812 } }),
    guest = await context.newPage();
  try {
    await guest.goto("http://localhost:3000/guide");
    await expect(
      guest.getByRole("heading", { name: "Hướng dẫn mua hàng", exact: true }),
    ).toBeVisible();
    await guest
      .getByRole("navigation", { name: "Mục lục", exact: true })
      .getByRole("link", { name: "Giao và nhận hàng", exact: true })
      .click();
    await expect(guest).toHaveURL(/#delivery$/);
    await expect(guest.locator("#delivery")).toContainText(
      "Khách thanh toán toàn bộ",
    );
    await guest.screenshot({
      caret: "initial",
      path: "output/playwright/m7-guide-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await guest.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await guest.goto("http://localhost:3000/privacy");
    await expect(guest.locator("#retention")).toContainText(
      "chưa áp dụng xóa tự động",
    );
    await guest.setViewportSize({ width: 1440, height: 1000 });
    await guest.screenshot({
      caret: "initial",
      path: "output/playwright/m7-privacy-desktop.png",
      fullPage: true,
    });
    await guest.goto("http://localhost:3000/checkout");
    const footer = guest.getByRole("navigation", {
      name: "Hướng dẫn và dữ liệu",
      exact: true,
    });
    await expect(
      footer.getByRole("link", { name: "Thông tin riêng tư", exact: true }),
    ).toHaveAttribute("href", "/privacy");
    await guest.goto("http://localhost:3000/admin/readiness");
    await expect(guest).toHaveURL(/\/admin\/login/);
    // Dev omits automatic registration. Exercise the same production SW explicitly in this isolated browser context.
    await guest.goto("http://localhost:3000/guide");
    await guest.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    await guest.reload();
    await expect
      .poll(() => guest.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await context.setOffline(true);
    await guest.goto("http://localhost:3000/shop");
    await expect(
      guest.getByRole("heading", {
        name: "Kết nối lại để xem thông tin mới nhất.",
        exact: true,
      }),
    ).toBeVisible();
    const cached = await guest.evaluate(async () => {
      const rows = [];
      for (const key of await caches.keys())
        for (const request of await (await caches.open(key)).keys())
          rows.push(new URL(request.url).pathname);
      return rows;
    });
    assert.deepEqual(cached, ["/offline.html"]);
    await context.setOffline(false);
    await expect
      .poll(
        () =>
          guest.evaluate(async () => {
            try {
              return (await fetch("/api/health", { cache: "no-store" })).ok;
            } catch {
              return false;
            }
          }),
        { timeout: 10000 },
      )
      .toBe(true);
    await guest.goto("http://localhost:3000/guide");
    await expect(
      guest.getByRole("heading", { name: "Hướng dẫn mua hàng", exact: true }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
