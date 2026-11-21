import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { vietnamDate, reportMoney } from "../src/lib/report.ts";
export async function verifyM6Ui({
  page,
  expect,
  admin,
  anonymous,
  rpc,
  runId,
  catalogIds,
  sql,
}) {
  const created = await rpc(admin, "save_catalog_item", {
    p_item: {
      name: `M6 service ${runId}`,
      description: "Temporary report fixture",
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
  assert.equal(created.data?.ok, true);
  const itemId = String(created.data.id);
  catalogIds.push(itemId);
  const item = JSON.parse(
    sql(
      `select json_build_object('id',id::text,'version',version) from public.products_services where id=${Number(itemId)}`,
    ),
  );
  const command = async (p) => {
    const r = await rpc(admin, "order_command", {
      p: { requestId: randomUUID(), ...p },
    });
    assert.equal(r.error, null);
    assert.equal(r.data?.ok, true, `M6 fixture ${p.action}`);
    return r.data;
  };
  const makeOrder = async (plan) =>
    command({
      action: "create",
      code: `TK-${randomUUID().replaceAll("-", "").toUpperCase()}`,
      customerName: `M6 UI ${runId}`,
      phone: "0901234567",
      keyboard: `M6 Report ${runId}`,
      internalNote: "SECRET REPORT NOTE",
      plan,
      items: [{ itemId, quantity: 1, version: item.version }],
    });
  const today = vietnamDate();
  const query = { p_from: today, p_to: today, p_group: "day", p_page: 1 };
  const baseline = (await rpc(admin, "cash_report", query)).data;
  assert.ok(baseline);
  assert.ok((await anonymous.rpc("cash_report", query)).error);
  const order = await makeOrder("deposit_cod");
  const receipt = {
    action: "receipt",
    orderId: order.id,
    amount: 20000,
    method: "bank",
    reference: "M6 fixture deposit",
    requestId: randomUUID(),
  };
  await command(receipt);
  await command(receipt);
  await command({
    action: "advance",
    orderId: order.id,
    expectedStage: 0,
    note: "M6 fixture",
  });
  await command({
    action: "advance",
    orderId: order.id,
    expectedStage: 1,
    note: "M6 fixture",
  });
  const cancelled = await makeOrder("transfer_full");
  await command({
    action: "receipt",
    orderId: cancelled.id,
    amount: 100000,
    method: "bank",
    reference: "M6 fixture full",
  });
  await command({
    action: "cancel",
    orderId: cancelled.id,
    reason: "M6 fixture cancellation",
    returns: {},
  });
  await command({
    action: "refund",
    orderId: cancelled.id,
    amount: 80000,
    method: "bank",
    reference: "M6 fixture refund",
  });
  const before = (await rpc(admin, "cash_report", query)).data;
  assert.equal(BigInt(before.net) - BigInt(baseline.net), BigInt(40000));
  assert.equal(
    BigInt(before.pending.readyAmount) - BigInt(baseline.pending.readyAmount),
    BigInt(80000),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Báo cáo tiền thực thu", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Từ ngày", { exact: true }).fill(today);
  await page.getByLabel("Đến ngày", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Xem báo cáo", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Thực thu trong kỳ", exact: true }),
  ).toContainText(reportMoney(before.net));
  await page.screenshot({
      caret: "initial",
    path: "output/playwright/m6-reports-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Nhóm theo", { exact: true }).selectOption("month");
  await page.getByRole("button", { name: "Xem báo cáo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Thực thu theo tháng", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
      caret: "initial",
    path: "output/playwright/m6-reports-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const mobileHtml = await page.content();
  assert.ok(!mobileHtml.includes("SECRET REPORT NOTE"));
  await page.goto(
    "http://localhost:3000/admin/reports?from=1901-01-01&to=1901-01-01",
  );
  await expect(
    page.getByText("Chưa có giao dịch trong kỳ.", { exact: true }),
  ).toBeVisible();
  await page.goto(
    "http://localhost:3000/admin/reports?from=2026-02-30&to=2026-03-01",
  );
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Chọn khoảng ngày hợp lệ",
  );
  await command({
    action: "receipt",
    orderId: order.id,
    amount: 80000,
    method: "cod",
    reference: "M6 fixture COD",
  });
  const after = (await rpc(admin, "cash_report", query)).data;
  assert.equal(BigInt(after.net) - BigInt(baseline.net), BigInt(120000));
  assert.equal(after.pending.readyAmount, baseline.pending.readyAmount);
  await page.goto(
    `http://localhost:3000/admin/reports?from=${today}&to=${today}`,
  );
  await expect(
    page.getByRole("region", { name: "Thực thu trong kỳ", exact: true }),
  ).toContainText(reportMoney(after.net));
  await page
    .locator(".report-ledger a", { hasText: `M6 Report ${runId}` })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/orders\//);
  const guestPage = await page.context().browser().newPage();
  try {
    await guestPage.goto("http://localhost:3000/admin/reports");
    await expect(guestPage).toHaveURL(/\/admin\/login/);
  } finally {
    await guestPage.close();
  }
}
