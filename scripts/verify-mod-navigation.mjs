import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

// Read-only: exercise real anchor navigation without accounts, writes or fixtures.
const browser=await chromium.launch({channel:"chrome",headless:true});
await mkdir("output/playwright",{recursive:true});
try {
  for (const width of [1440,375]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    const link=page.locator(".buyer-navigation").getByRole("link",{name:"Dịch vụ mod",exact:true});
    const atServices=async () => {
      await expect(page).toHaveURL(/\/#services$/);
      await expect.poll(()=>page.locator("#services h2").evaluate(el=>{
        const rect=el.getBoundingClientRect();return rect.top>=0 && rect.bottom<innerHeight;
      })).toBe(true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    };
    await page.goto("http://localhost:3000/",{waitUntil:"networkidle"});
    await link.click();await atServices();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await link.click();await atServices();
    await page.screenshot({path:`output/playwright/mod-navigation-${width}.png`});
    await page.goto("http://localhost:3000/shop",{waitUntil:"networkidle"});
    await link.click();await atServices();
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await link.focus();await page.keyboard.press("Enter");await atServices();
    await page.close();
    console.log(`PASS: mod navigation ${width}px — initial/repeated click, from shop, keyboard and reduced motion`);
  }
} finally {await browser.close();}
