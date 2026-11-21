import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

// Read-only: use published prices, never create orders or change catalog data.
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await expect(page.locator("#estimate")).toHaveCount(0);
    const navigation = page.locator(".buyer-navigation");
    const menuLink = navigation.getByRole("link", { name: "Ước tính chi phí", exact: true });
    const links = await navigation.getByRole("link").allTextContents();
    assert.equal(links.indexOf("Ước tính chi phí"), links.indexOf("Bàn phím đã làm") + 1);
    await menuLink.click();
    await expect(page).toHaveURL(/\/estimate$/);
    await expect(menuLink).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Ước tính chi phí", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sao chép cấu hình", exact: true })).toBeDisabled();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `output/playwright/estimate-page-${width}.png`, fullPage: true });
    const groups = page.locator(".estimate-categories button");
    let selected = false;
    for (let i = 0; i < await groups.count(); i++) {
      await groups.nth(i).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const available = dialog.getByRole("button", { name: "+ Chọn", exact: true }).filter({ visible: true });
      for (let j = 0; j < await available.count(); j++) {
        if (!await available.nth(j).isEnabled()) continue;
        await available.nth(j).click();
        selected = true;
        break;
      }
      if (selected) {
        await dialog.getByRole("button", { name: /^Xem ước tính/ }).click();
        break;
      }
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
    if (selected) {
      const total = page.locator(".estimate-total strong");
      const initial = Number((await total.innerText()).replace(/\D/g, ""));
      const quantity = page.locator(".quantity-label input").first();
      if (Number(await quantity.getAttribute("max")) >= 2) {
        await quantity.fill("2");
        await quantity.press("Enter");
        await expect.poll(async () => Number((await total.innerText()).replace(/\D/g, ""))).toBe(initial * 2);
      }
      await expect(page.getByRole("button", { name: "Sao chép cấu hình", exact: true })).toBeEnabled();
      await page.getByText("Xem cấu hình dạng văn bản", { exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Cấu hình để sao chép thủ công" })).not.toHaveValue("");
      await page.getByRole("button", { name: /^Bỏ / }).click();
      await expect(total).toHaveText(/0/);
      await expect(page.getByRole("button", { name: "Sao chép cấu hình", exact: true })).toBeDisabled();
    } else {
      console.log(`INFO ${width}px: no published available item; estimate arithmetic skipped`);
    }
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    const service = page.locator("#services .service-card").first();
    if (await service.count()) {
      const href = await service.getAttribute("href");
      await service.click();
      await expect(page).toHaveURL(`http://localhost:3000${href}`);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page.close();
    console.log(`PASS estimate navigation, layout and available pricing flow: ${width}px`);
  }
} finally {
  await browser.close();
}
