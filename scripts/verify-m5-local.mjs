import assert from "node:assert/strict";
import { chatHash } from "../src/lib/chat-contract.ts";

export async function verifyM5Ui({
  page,
  expect,
  runId,
  chatHashes,
  admin,
  rpc,
}) {
  const browser = page.context().browser();
  const a = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const b = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const customer = await a.newPage(),
    other = await b.newPage(),
    errors = [];
  for (const p of [customer, other])
    p.on("pageerror", (e) => errors.push(e.message));
  const question = `M5 UI ${runId}: lube 68 switch thì cọc thế nào?`;
  const record = async (context) => {
    for (const c of await context.cookies())
      if (c.name === "tk-chat") {
        assert.equal(c.httpOnly, true);
        assert.equal(c.sameSite, "Lax");
        const hash = chatHash(c.value);
        if (hash && !chatHashes.includes(hash)) chatHashes.push(hash);
      }
  };
  try {
    await customer.goto("http://localhost:3000/chat");
    await expect(
      customer.getByRole("heading", { name: "Cùng chọn bộ phím phù hợp" }),
    ).toBeVisible();
    await customer.screenshot({
      caret: "initial",
      path: "output/playwright/m5-chat-desktop.png",
      fullPage: true,
    });
    await customer
      .getByLabel("Câu hỏi của bạn", { exact: true })
      .fill(question);
    await customer.getByRole("checkbox").check();
    await customer
      .getByRole("button", { name: "Gửi câu hỏi", exact: true })
      .click();
    await expect(customer.locator(".chat-customer")).toContainText(question);
    await expect(customer.locator(".chat-assistant")).toContainText("Zalo");
    await record(a);
    await customer.reload();
    await expect(customer.locator(".chat-customer")).toContainText(question);
    await customer.setViewportSize({ width: 375, height: 812 });
    await customer.screenshot({
      caret: "initial",
      path: "output/playwright/m5-chat-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await customer.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "No mobile overflow",
    );
    await other.goto("http://localhost:3000/chat");
    await expect(other.getByText(question, { exact: true })).toHaveCount(0);
    await customer
      .getByRole("button", { name: "Đánh dấu cần shop hỗ trợ" })
      .click();
    await expect(
      customer.getByRole("status").filter({ hasText: "Đã đánh dấu" }),
    ).toBeVisible();
    await expect(
      customer.getByRole("link", { name: "Mở Zalo ↗" }),
    ).toHaveAttribute("href", "https://zalo.me/0385920038");
    const sessions = await rpc(admin, "admin_chat");
    assert.equal(sessions.error, null);
    const session = sessions.data.find((s) =>
      s.preview?.includes(`M5 UI ${runId}`),
    );
    assert.ok(session?.handoff);
    await page.goto(`http://localhost:3000/admin/chat/${session.id}`);
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await page.goto("http://localhost:3000/admin/notifications");
    await expect(
      page.getByRole("heading", { name: "Tích hợp & thông báo", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(question, { exact: true })).toHaveCount(0);
    await page.screenshot({
      caret: "initial",
      path: "output/playwright/m5-admin-notifications-mobile.png",
      fullPage: true,
    });
    await customer.getByRole("button", { name: "Bắt đầu phiên mới" }).click();
    await expect(customer.locator(".chat-customer")).toHaveCount(0);
    // A reset drops browser access, not history stored for authorized shop admins.
    assert.ok(
      (await rpc(admin, "admin_chat", { p_id: session.id })).data.some(
        (t) => t.customer === question,
      ),
    );
    assert.deepEqual(errors, []);
  } finally {
    await record(a);
    await record(b);
    await a.close();
    await b.close();
  }
}
