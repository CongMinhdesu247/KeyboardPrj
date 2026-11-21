import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyInboxUi({ page, expect, admin, anonymous, rpc, runId, catalogIds }) {
  const errors = [];
  const onError = error => errors.push(error.message.slice(0, 500));
  page.on("pageerror", onError);
  try {
    assert.ok((await anonymous.rpc("admin_inbox")).error);
    assert.ok((await anonymous.rpc("read_admin_notifications", { p_ids: [randomUUID()] })).error);
    const saved = await rpc(admin, "save_catalog_item", { p_item: {
      name: `Inbox fixture ${runId}`, description: "Notification regression fixture", category: "keycap", type: "service", unit: "bộ", price: 100000, cost: 0, active: true, imagePath: "", lubePackage: "",
    } });
    assert.equal(saved.data?.ok, true); catalogIds.push(saved.data.id);
    const createOrder = async () => {
      const result = await rpc(admin, "order_command", { p: { action: "create", requestId: randomUUID(), code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`, customerName: "Inbox test fixture", phone: "0901234567", keyboard: `Inbox ${runId}`, plan: "deposit_cod", items: [{ itemId: saved.data.id, quantity: 1, version: 1 }] } });
      assert.equal(result.data?.ok, true); return result.data.id;
    };
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const orderId = await createOrder();
      await page.goto("http://localhost:3000/admin/catalog");
      const bell = page.getByRole("button", { name: /^Thông báo/ });
      await expect(bell).toHaveAttribute("aria-label", /\d+ chưa đọc/);
      await bell.click();
      const popup = page.getByRole("dialog", { name: "Thông báo", exact: true });
      await expect(popup).toBeVisible();
      const notification = popup.locator(`a[href="/admin/orders/${orderId}"]`);
      await expect(notification).toBeVisible();
      await expect(notification.locator("..")).toHaveAttribute("data-unread", "true");
      const rect = await popup.boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      await page.screenshot({caret:"initial", path: `output/playwright/admin-bell-${width}.png` });
      await page.keyboard.press("Escape"); await expect(popup).not.toBeVisible();
      await expect(bell).toBeFocused();
      await bell.click(); await notification.click();
      await expect(page).toHaveURL(`http://localhost:3000/admin/orders/${orderId}`);
      const feed = await rpc(admin, "admin_inbox");
      assert.ok(feed.data.items.find(item => item.entity_id === orderId)?.read_at);
      await page.reload();
      await bell.click();
      await expect(popup.locator(`a[href="/admin/orders/${orderId}"]`).locator("..")).toHaveAttribute("data-unread", "false");
      await popup.getByRole("link", { name: "Xem tất cả thông báo" }).click();
      await expect(page).toHaveURL(/\/admin\/inbox$/);
      await expect(page.getByRole("heading", { name: "Thông báo cửa hàng", exact: true })).toBeVisible();
      await page.getByRole("button", { name: /^Chưa đọc \(/ }).click();
      await expect(page.getByRole("button", { name: /^Chưa đọc \(/ })).toBeEnabled();
      // Network failures must not erase the current list or claim a successful write.
      const abort = route => route.request().method() === "POST" ? route.abort("failed") : route.continue();
      await page.route("**/admin/inbox", abort);
      await page.getByRole("button", { name: "Đánh dấu tất cả đã đọc", exact: true }).click();
      await expect(page.locator(".admin-inbox-error[role=alert]")).toContainText("Chưa đánh dấu");
      await page.unroute("**/admin/inbox", abort);
      await page.getByRole("button", { name: "Đánh dấu tất cả đã đọc", exact: true }).click();
      await expect(page.locator(".admin-inbox-page-list")).toContainText("Không có thông báo mới");
      await expect(bell).toHaveAttribute("aria-label", "Thông báo, 0 chưa đọc");
      assert.equal((await rpc(admin, "admin_inbox")).data.unread, 0);
      const nextOrder = await createOrder();
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(bell).toHaveAttribute("aria-label", "Thông báo, 1 chưa đọc");
      await bell.click();
      await expect(popup.locator(`a[href="/admin/orders/${nextOrder}"]`)).toBeVisible();
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({caret:"initial", path: `output/playwright/admin-inbox-${width}.png`, fullPage: true });
      console.log(`PASS inbox ${width}px: bell, live refresh, routing, read persistence, filters, error recovery and Escape`);
    }
    assert.deepEqual(errors, []);
  } finally { page.off("pageerror", onError); }
}
